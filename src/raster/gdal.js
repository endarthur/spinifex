// Spinifex - GDAL WebAssembly Integration
// Uses gdal3.js for raster/vector processing in the browser
// https://gdal3.js.org/

import { termPrint } from '../ui/terminal.js';
import { createWebGLRasterLayer, RENDER_MODES } from './webgl-raster.js';

// Re-export pure JS terrain analysis functions (faster than GDAL WASM)
export {
  hillshade, slope, aspect, contours, tri, tpi, roughness
} from './terrain.js';

// GDAL instance (lazy loaded)
let Gdal = null;
let gdalReady = false;
let gdalLoading = false;
let gdalLoadPromise = null;

/**
 * Ensure GDAL is loaded and ready
 */
export async function ensureGdal() {
  if (gdalReady && Gdal) return Gdal;

  if (gdalLoading) {
    return gdalLoadPromise;
  }

  gdalLoading = true;
  termPrint('Loading GDAL (first use may take a moment)...', 'dim');

  gdalLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package/gdal3.js';
    script.onload = async () => {
      try {
        // Initialize GDAL - initGdalJs is exposed globally by the script
        Gdal = await window.initGdalJs({
          path: 'https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package',
          useWorker: false  // Run in main thread for simplicity
        });
        gdalReady = true;
        gdalLoading = false;
        termPrint('GDAL ready', 'green');
        resolve(Gdal);
      } catch (e) {
        gdalLoading = false;
        reject(new Error(`GDAL init failed: ${e.message}`));
      }
    };
    script.onerror = () => {
      gdalLoading = false;
      reject(new Error('Failed to load GDAL library'));
    };
    document.head.appendChild(script);
  });

  return gdalLoadPromise;
}

/**
 * Check if GDAL is loaded
 */
export function isGdalReady() {
  return gdalReady;
}

/**
 * Create a GeoTIFF from raster layer data
 * @param {Object} layer - Spinifex raster layer
 * @returns {File} In-memory GeoTIFF file
 */
async function layerToGeoTiff(layer) {
  // We need to use geotiff.js to write a proper GeoTIFF that GDAL can read
  // For now, we'll create a minimal TIFF structure

  const { width, height, extent } = layer._metadata;
  const [west, south, east, north] = extent;
  const nodata = layer._metadata.nodata ?? -32768;

  // Get band data
  const bands = Array.isArray(layer._data) && ArrayBuffer.isView(layer._data[0])
    ? layer._data
    : [layer._data];

  const bandCount = bands.length;
  const sampleBand = bands[0];

  // Determine sample format
  let bitsPerSample = 16;
  let sampleFormat = 2; // signed int
  if (sampleBand instanceof Float32Array) {
    bitsPerSample = 32;
    sampleFormat = 3; // floating point
  } else if (sampleBand instanceof Uint8Array) {
    bitsPerSample = 8;
    sampleFormat = 1; // unsigned int
  } else if (sampleBand instanceof Uint16Array) {
    bitsPerSample = 16;
    sampleFormat = 1; // unsigned int
  }

  // Create TIFF structure
  // This is a simplified TIFF writer - just enough for GDAL to read
  const bytesPerSample = bitsPerSample / 8;
  const pixelBytes = bytesPerSample * bandCount;
  const imageDataSize = width * height * pixelBytes;

  // For multi-band, we need arrays for BitsPerSample and SampleFormat
  const bitsPerSampleArraySize = bandCount > 1 ? bandCount * 2 : 0;
  const sampleFormatArraySize = bandCount > 1 ? bandCount * 2 : 0;
  // ExtraSamples: for 4 bands, single value fits in tag; for 5+ bands need array
  const extraSamplesSize = bandCount > 4 ? (bandCount - 3) * 2 : 0;

  // TIFF header + IFD + data
  // Tag count:
  // - 15 tags for 1-3 bands (no ExtraSamples)
  // - 16 tags for 4+ bands (includes ExtraSamples)
  const headerSize = 8;
  const ifdEntryCount = bandCount > 3 ? 16 : 15;
  const ifdSize = 2 + (ifdEntryCount * 12) + 4; // count + entries + next offset

  // GeoTIFF tags need extra space
  const geoKeySize = 64;
  // ModelPixelScaleTag: 3 doubles (24 bytes) + ModelTiepointTag: 6 doubles (48 bytes) = 72 bytes
  const geoDoubleSize = 72;
  const nodataStrSize = String(nodata).length + 1;

  const extraDataOffset = headerSize + ifdSize;
  const bitsPerSampleOffset = extraDataOffset;
  const sampleFormatOffset = bitsPerSampleOffset + bitsPerSampleArraySize;
  const extraSamplesOffset = sampleFormatOffset + sampleFormatArraySize;
  const geoKeyOffset = extraSamplesOffset + extraSamplesSize;
  const geoDoubleOffset = geoKeyOffset + geoKeySize;
  const nodataOffset = geoDoubleOffset + geoDoubleSize;
  const imageDataOffset = nodataOffset + nodataStrSize + (4 - (nodataStrSize % 4)) % 4; // align to 4 bytes

  const totalSize = imageDataOffset + imageDataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  // TIFF Header (little-endian)
  view.setUint16(offset, 0x4949, true); offset += 2; // 'II' = little-endian
  view.setUint16(offset, 42, true); offset += 2; // TIFF magic
  view.setUint32(offset, 8, true); offset += 4; // Offset to first IFD

  // IFD
  view.setUint16(offset, ifdEntryCount, true); offset += 2;

  // Helper to write IFD entry
  const writeTag = (tag, type, count, value) => {
    view.setUint16(offset, tag, true); offset += 2;
    view.setUint16(offset, type, true); offset += 2;
    view.setUint32(offset, count, true); offset += 4;
    if (type === 3 && count === 1) { // SHORT
      view.setUint16(offset, value, true);
      offset += 4;
    } else if (type === 4 && count === 1) { // LONG
      view.setUint32(offset, value, true);
      offset += 4;
    } else {
      view.setUint32(offset, value, true); // offset to data
      offset += 4;
    }
  };

  // Required TIFF tags - MUST be in ascending order!
  // PhotometricInterpretation: 1 = grayscale (min is black), 2 = RGB
  const photometric = bandCount >= 3 ? 2 : 1;

  writeTag(256, 4, 1, width);          // ImageWidth
  writeTag(257, 4, 1, height);         // ImageLength

  // BitsPerSample - for multi-band, write array
  if (bandCount > 1) {
    writeTag(258, 3, bandCount, bitsPerSampleOffset);
  } else {
    writeTag(258, 3, 1, bitsPerSample);
  }

  writeTag(259, 3, 1, 1);              // Compression (1 = none)
  writeTag(262, 3, 1, photometric);    // PhotometricInterpretation
  writeTag(273, 4, 1, imageDataOffset); // StripOffsets
  writeTag(277, 3, 1, bandCount);      // SamplesPerPixel
  writeTag(278, 4, 1, height);         // RowsPerStrip
  writeTag(279, 4, 1, imageDataSize);  // StripByteCounts
  writeTag(284, 3, 1, 1);              // PlanarConfiguration (1 = chunky/interleaved)

  // ExtraSamples - needed if more than 3 bands (e.g., RGBA or RGB+NIR)
  // Value 0 = unspecified extra component
  if (bandCount > 3) {
    const extraCount = bandCount - 3;
    if (extraCount === 1) {
      // Single extra sample: value fits directly in tag entry (no offset needed)
      writeTag(338, 3, 1, 0); // 0 = unspecified
    } else {
      // Multiple extra samples: need to write array at offset
      writeTag(338, 3, extraCount, extraSamplesOffset);
    }
  }

  // SampleFormat - for multi-band, write array
  if (bandCount > 1) {
    writeTag(339, 3, bandCount, sampleFormatOffset);
  } else {
    writeTag(339, 3, 1, sampleFormat);
  }

  // GeoTIFF tags
  writeTag(33550, 12, 3, geoDoubleOffset); // ModelPixelScaleTag (3 doubles)
  writeTag(33922, 12, 6, geoDoubleOffset + 24); // ModelTiepointTag (6 doubles)
  writeTag(34735, 3, 16, geoKeyOffset); // GeoKeyDirectoryTag

  // GDAL NoData tag (as ASCII string)
  writeTag(42113, 2, nodataStrSize, nodataOffset);

  // Next IFD offset (0 = no more IFDs)
  view.setUint32(offset, 0, true); offset += 4;

  // Write BitsPerSample array (if multi-band)
  if (bandCount > 1) {
    let bpsOff = bitsPerSampleOffset;
    for (let i = 0; i < bandCount; i++) {
      view.setUint16(bpsOff, bitsPerSample, true);
      bpsOff += 2;
    }
  }

  // Write SampleFormat array (if multi-band)
  if (bandCount > 1) {
    let sfOff = sampleFormatOffset;
    for (let i = 0; i < bandCount; i++) {
      view.setUint16(sfOff, sampleFormat, true);
      sfOff += 2;
    }
  }

  // Write ExtraSamples array (only if more than 4 bands - 1 extra sample fits in tag entry)
  if (bandCount > 4) {
    let esOff = extraSamplesOffset;
    for (let i = 0; i < bandCount - 3; i++) {
      view.setUint16(esOff, 0, true); // 0 = unspecified extra component
      esOff += 2;
    }
  }

  // GeoKey Directory (16 shorts = 32 bytes)
  let gkOff = geoKeyOffset;
  view.setUint16(gkOff, 1, true); gkOff += 2;     // KeyDirectoryVersion
  view.setUint16(gkOff, 1, true); gkOff += 2;     // KeyRevision
  view.setUint16(gkOff, 0, true); gkOff += 2;     // MinorRevision
  view.setUint16(gkOff, 3, true); gkOff += 2;     // NumberOfKeys

  // GTModelTypeGeoKey = 2 (Geographic)
  view.setUint16(gkOff, 1024, true); gkOff += 2;
  view.setUint16(gkOff, 0, true); gkOff += 2;
  view.setUint16(gkOff, 1, true); gkOff += 2;
  view.setUint16(gkOff, 2, true); gkOff += 2;

  // GTRasterTypeGeoKey = 1 (PixelIsArea)
  view.setUint16(gkOff, 1025, true); gkOff += 2;
  view.setUint16(gkOff, 0, true); gkOff += 2;
  view.setUint16(gkOff, 1, true); gkOff += 2;
  view.setUint16(gkOff, 1, true); gkOff += 2;

  // GeographicTypeGeoKey = 4326 (WGS84)
  view.setUint16(gkOff, 2048, true); gkOff += 2;
  view.setUint16(gkOff, 0, true); gkOff += 2;
  view.setUint16(gkOff, 1, true); gkOff += 2;
  view.setUint16(gkOff, 4326, true); gkOff += 2;

  // GeoDouble params
  let gdOff = geoDoubleOffset;
  const pixelWidth = (east - west) / width;
  const pixelHeight = (north - south) / height;

  // ModelPixelScaleTag: [scaleX, scaleY, scaleZ]
  view.setFloat64(gdOff, pixelWidth, true); gdOff += 8;
  view.setFloat64(gdOff, pixelHeight, true); gdOff += 8;
  view.setFloat64(gdOff, 0, true); gdOff += 8;

  // ModelTiepointTag: [i, j, k, x, y, z] - pixel (0,0) maps to (west, north)
  view.setFloat64(gdOff, 0, true); gdOff += 8;
  view.setFloat64(gdOff, 0, true); gdOff += 8;
  view.setFloat64(gdOff, 0, true); gdOff += 8;
  view.setFloat64(gdOff, west, true); gdOff += 8;
  view.setFloat64(gdOff, north, true); gdOff += 8;
  view.setFloat64(gdOff, 0, true); gdOff += 8;

  // Write NoData string
  const nodataStr = String(nodata);
  let ndOff = nodataOffset;
  for (let i = 0; i < nodataStr.length; i++) {
    bytes[ndOff++] = nodataStr.charCodeAt(i);
  }
  bytes[ndOff] = 0; // null terminator

  // Write image data
  let imgOffset = imageDataOffset;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      for (let b = 0; b < bandCount; b++) {
        const value = bands[b][idx];
        if (bitsPerSample === 8) {
          bytes[imgOffset++] = value;
        } else if (bitsPerSample === 16) {
          view.setInt16(imgOffset, value, true);
          imgOffset += 2;
        } else if (bitsPerSample === 32) {
          view.setFloat32(imgOffset, value, true);
          imgOffset += 4;
        }
      }
    }
  }

  return new File([buffer], 'input.tif', { type: 'image/tiff' });
}

/**
 * Convert raster to Cloud Optimized GeoTIFF
 * @param {Object} layer - Spinifex raster layer
 * @param {Object} options - COG options
 * @returns {Promise<Blob>} COG file as Blob
 */
export async function toCOG(layer, options = {}) {
  const gdal = await ensureGdal();

  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  termPrint('Creating COG...', 'dim');

  // Create a GeoTIFF file from layer data
  const inputFile = await layerToGeoTiff(layer);

  // Open in GDAL
  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];

  // Translate to COG
  const cogOptions = [
    '-of', 'COG',
    '-co', `COMPRESS=${options.compress || 'DEFLATE'}`,
    '-co', `BLOCKSIZE=${options.blockSize || 512}`,
    '-co', `OVERVIEWS=${options.overviews !== false ? 'AUTO' : 'NONE'}`,
    '-co', `RESAMPLING=${options.resampling || 'AVERAGE'}`
  ];

  if (options.quality && (options.compress === 'JPEG' || options.compress === 'WEBP')) {
    cogOptions.push('-co', `QUALITY=${options.quality}`);
  }

  const output = await gdal.gdal_translate(dataset, cogOptions);

  // Get output bytes
  const cogBytes = await gdal.getFileBytes(output);

  // Cleanup
  await gdal.close(dataset);

  termPrint(`COG created (${(cogBytes.length / 1024 / 1024).toFixed(2)} MB)`, 'green');

  return new Blob([cogBytes], { type: 'image/tiff' });
}

/**
 * Download a raster layer as COG
 * @param {Object} layer - Spinifex raster layer
 * @param {string} filename - Output filename
 * @param {Object} options - COG options
 */
export async function downloadCOG(layer, filename, options = {}) {
  try {
    const blob = await toCOG(layer, options);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${layer.name}.cog.tif`;
    a.click();
    URL.revokeObjectURL(url);

    termPrint(`Downloaded: ${a.download}`, 'green');
  } catch (e) {
    termPrint(`COG export failed: ${e.message}`, 'red');
    console.error(e);
  }
}

/**
 * Convert raster to regular GeoTIFF
 * @param {Object} layer - Spinifex raster layer
 * @param {Object} options - Options
 * @returns {Promise<Blob>} GeoTIFF file as Blob
 */
export async function toGeoTiff(layer, options = {}) {
  const gdal = await ensureGdal();

  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  termPrint('Creating GeoTIFF...', 'dim');

  const inputFile = await layerToGeoTiff(layer);
  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];

  const tiffOptions = [
    '-of', 'GTiff',
    '-co', `COMPRESS=${options.compress || 'DEFLATE'}`,
    '-co', `TILED=${options.tiled ? 'YES' : 'NO'}`
  ];

  const output = await gdal.gdal_translate(dataset, tiffOptions);
  const tiffBytes = await gdal.getFileBytes(output);

  await gdal.close(dataset);

  termPrint(`GeoTIFF created (${(tiffBytes.length / 1024 / 1024).toFixed(2)} MB)`, 'green');

  return new Blob([tiffBytes], { type: 'image/tiff' });
}

/**
 * Reproject a raster layer
 * @param {Object} layer - Spinifex raster layer
 * @param {string} targetCRS - Target CRS (e.g., 'EPSG:32755')
 * @param {Object} options - Warp options
 * @returns {Promise<Object>} New reprojected layer
 */
export async function reproject(layer, targetCRS, options = {}) {
  const gdal = await ensureGdal();

  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  termPrint(`Reprojecting to ${targetCRS}...`, 'dim');

  const inputFile = await layerToGeoTiff(layer);
  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];

  const warpOptions = [
    '-t_srs', targetCRS,
    '-r', options.resampling || 'bilinear'
  ];

  if (options.resolution) {
    warpOptions.push('-tr', options.resolution, options.resolution);
  }

  const output = await gdal.gdalwarp(dataset, warpOptions);
  const warpedBytes = await gdal.getFileBytes(output);

  await gdal.close(dataset);

  // Load the reprojected raster back
  const { loadGeoTIFF } = await import('../formats/geotiff.js');
  const newLayer = await loadGeoTIFF(
    warpedBytes.buffer,
    `${layer.name}_${targetCRS.replace(':', '_')}`,
    { colorRamp: layer._colorRamp, mode: layer._mode }
  );

  termPrint(`Reprojected: ${newLayer.name}`, 'green');
  return newLayer;
}

/**
 * Get GDAL info for a file
 * @param {ArrayBuffer|Blob|File} file - Input file
 * @param {string} filename - Filename for format detection
 */
export async function gdalInfo(file, filename = 'input.tif') {
  const gdal = await ensureGdal();

  let inputFile;
  if (file instanceof File) {
    inputFile = file;
  } else if (file instanceof Blob) {
    inputFile = new File([file], filename);
  } else {
    inputFile = new File([file], filename);
  }

  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];
  const info = await gdal.getInfo(dataset);

  await gdal.close(dataset);

  termPrint(info);
  return info;
}

/**
 * List available GDAL drivers
 */
export async function listDrivers() {
  const gdal = await ensureGdal();

  const raster = gdal.drivers?.raster || [];
  const vector = gdal.drivers?.vector || [];

  termPrint(`Raster drivers: ${raster.length}`, 'cyan');
  termPrint(`Vector drivers: ${vector.length}`, 'cyan');

  return { raster, vector };
}

/**
 * Rasterize vector layer to raster
 * @param {Object} layer - Spinifex vector layer
 * @param {Object} options - Rasterize options
 * @param {number} options.resolution - Output resolution in map units
 * @param {string} options.attribute - Attribute to burn (optional, burns 1 if not set)
 * @param {number} options.width - Output width in pixels (alternative to resolution)
 * @param {number} options.height - Output height in pixels (alternative to resolution)
 * @param {number} options.nodata - NoData value (default: -9999)
 * @param {string} options.name - Output layer name
 * @returns {Promise<Object>} New raster layer
 */
export async function rasterize(layer, options = {}) {
  const gdal = await ensureGdal();

  // Support Layer class (has _geojson), raw GeoJSON, or OL layer
  const geojsonData = layer._geojson || layer.geojson;
  const source = layer._source;

  if (!geojsonData && !source) {
    throw new Error('Invalid vector layer - needs _geojson or _source');
  }

  const name = options.name || `${layer.name || layer._name}_rasterized`;
  const nodata = options.nodata ?? -9999;

  termPrint('Rasterizing vector layer...', 'dim');

  // Get GeoJSON data - prefer stored geojson, fall back to converting from source
  let geojson;
  if (geojsonData) {
    geojson = geojsonData;
  } else {
    const features = source.getFeatures();
    if (features.length === 0) {
      throw new Error('No features to rasterize');
    }
    const { GeoJSON } = await import('ol/format.js');
    const format = new GeoJSON();
    geojson = format.writeFeaturesObject(features, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });
  }

  if (!geojson.features || geojson.features.length === 0) {
    throw new Error('No features to rasterize');
  }

  const geojsonFile = new File(
    [JSON.stringify(geojson)],
    'input.geojson',
    { type: 'application/geo+json' }
  );

  const result = await gdal.open(geojsonFile);
  const dataset = result.datasets[0];

  // Calculate extent from GeoJSON bbox or source
  let west, south, east, north;
  if (source) {
    const extent = source.getExtent();
    const { transformExtent } = await import('ol/proj.js');
    [west, south, east, north] = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
  } else {
    // Calculate from GeoJSON features
    west = Infinity; south = Infinity; east = -Infinity; north = -Infinity;
    for (const f of geojson.features) {
      const coords = f.geometry.coordinates.flat(10);
      for (let i = 0; i < coords.length; i += 2) {
        if (coords[i] < west) west = coords[i];
        if (coords[i] > east) east = coords[i];
        if (coords[i+1] < south) south = coords[i+1];
        if (coords[i+1] > north) north = coords[i+1];
      }
    }
  }

  // Determine output size
  let width, height;
  if (options.resolution) {
    width = Math.ceil((east - west) / options.resolution);
    height = Math.ceil((north - south) / options.resolution);
  } else if (options.width && options.height) {
    width = options.width;
    height = options.height;
  } else {
    // Default: approximately 1000 pixels on longest side
    const aspectRatio = (east - west) / (north - south);
    if (aspectRatio > 1) {
      width = 1000;
      height = Math.ceil(1000 / aspectRatio);
    } else {
      height = 1000;
      width = Math.ceil(1000 * aspectRatio);
    }
  }

  const rasterizeOptions = [
    '-te', String(west), String(south), String(east), String(north),
    '-ts', String(width), String(height),
    '-a_nodata', String(nodata),
    '-of', 'GTiff',
    '-ot', 'Float32'
  ];

  if (options.attribute) {
    rasterizeOptions.push('-a', options.attribute);
  } else {
    rasterizeOptions.push('-burn', '1');
  }

  const output = await gdal.gdal_rasterize(dataset, rasterizeOptions);
  const outputBytes = await gdal.getFileBytes(output);

  await gdal.close(dataset);

  const { loadGeoTIFF } = await import('../formats/geotiff.js');
  const newLayer = await loadGeoTIFF(outputBytes.buffer, name, {
    colorRamp: options.colorRamp || 'viridis',
    mode: 'singleband'
  });

  termPrint(`Rasterized: ${name} (${width}x${height})`, 'green');
  return newLayer;
}

/**
 * Clip raster to polygon boundary
 * @param {Object} rasterLayer - Spinifex raster layer
 * @param {Object} vectorLayer - Spinifex vector layer (polygon) or GeoJSON geometry
 * @param {Object} options - Clip options
 * @param {string} options.name - Output layer name
 * @returns {Promise<Object>} New clipped raster layer
 */
export async function clip(rasterLayer, vectorLayer, options = {}) {
  const gdal = await ensureGdal();

  if (!rasterLayer._data || !rasterLayer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const name = options.name || `${rasterLayer.name}_clipped`;

  termPrint('Clipping raster...', 'dim');

  // Prepare raster
  const rasterFile = await layerToGeoTiff(rasterLayer);
  const rasterResult = await gdal.open(rasterFile);
  const rasterDataset = rasterResult.datasets[0];

  // Prepare clip geometry
  let clipGeojson;
  if (vectorLayer._olLayer) {
    // It's a Spinifex layer
    const source = vectorLayer._olLayer.getSource();
    const features = source.getFeatures();
    const { GeoJSON } = await import('ol/format.js');
    const format = new GeoJSON();
    clipGeojson = format.writeFeaturesObject(features, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });
  } else if (vectorLayer.type === 'Feature' || vectorLayer.type === 'FeatureCollection') {
    clipGeojson = vectorLayer;
  } else if (vectorLayer.type) {
    // Raw geometry
    clipGeojson = { type: 'Feature', geometry: vectorLayer, properties: {} };
  } else {
    throw new Error('Invalid clip geometry');
  }

  const clipFile = new File(
    [JSON.stringify(clipGeojson)],
    'clip.geojson',
    { type: 'application/geo+json' }
  );

  const warpOptions = [
    '-cutline', clipFile.name,
    '-crop_to_cutline',
    '-dstalpha',
    '-of', 'GTiff'
  ];

  // Need to open clip file too
  await gdal.open(clipFile);

  const output = await gdal.gdalwarp(rasterDataset, warpOptions);
  const outputBytes = await gdal.getFileBytes(output);

  await gdal.close(rasterDataset);

  const { loadGeoTIFF } = await import('../formats/geotiff.js');
  const newLayer = await loadGeoTIFF(outputBytes.buffer, name, {
    colorRamp: rasterLayer._colorRamp,
    mode: rasterLayer._mode
  });

  termPrint(`Clipped: ${name}`, 'green');
  return newLayer;
}

/**
 * Mosaic multiple rasters together
 * @param {Array<Object>} layers - Array of Spinifex raster layers
 * @param {Object} options - Mosaic options
 * @param {string} options.resampling - Resampling method (default: 'bilinear')
 * @param {string} options.name - Output layer name
 * @returns {Promise<Object>} New mosaicked raster layer
 */
export async function mosaic(layers, options = {}) {
  const gdal = await ensureGdal();

  if (!Array.isArray(layers) || layers.length < 2) {
    throw new Error('Need at least 2 layers to mosaic');
  }

  const name = options.name || 'mosaic';
  const resampling = options.resampling || 'bilinear';

  termPrint(`Mosaicking ${layers.length} layers...`, 'dim');

  // Convert all layers to GeoTIFFs and open them
  const datasets = [];
  for (const layer of layers) {
    if (!layer._data || !layer._metadata) {
      throw new Error(`Invalid raster layer: ${layer.name}`);
    }
    const file = await layerToGeoTiff(layer);
    const result = await gdal.open(file);
    datasets.push(result.datasets[0]);
  }

  // Use gdalwarp to mosaic
  const warpOptions = [
    '-r', resampling,
    '-of', 'GTiff'
  ];

  const output = await gdal.gdalwarp(datasets, warpOptions);
  const outputBytes = await gdal.getFileBytes(output);

  // Close all datasets
  for (const ds of datasets) {
    await gdal.close(ds);
  }

  const { loadGeoTIFF } = await import('../formats/geotiff.js');
  const newLayer = await loadGeoTIFF(outputBytes.buffer, name, {
    colorRamp: layers[0]._colorRamp,
    mode: layers[0]._mode
  });

  termPrint(`Mosaic created: ${name}`, 'green');
  return newLayer;
}

/**
 * Resample raster to different resolution
 * @param {Object} layer - Spinifex raster layer
 * @param {Object} options - Resample options
 * @param {number} options.resolution - Target resolution in map units
 * @param {number} options.width - Target width in pixels (alternative)
 * @param {number} options.height - Target height in pixels (alternative)
 * @param {number} options.scale - Scale factor (e.g., 0.5 = half size)
 * @param {string} options.method - Resampling method: near, bilinear, cubic, average, etc.
 * @param {string} options.name - Output layer name
 * @returns {Promise<Object>} New resampled raster layer
 */
export async function resample(layer, options = {}) {
  const gdal = await ensureGdal();

  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const method = options.method || 'bilinear';
  const name = options.name || `${layer.name}_resampled`;

  termPrint(`Resampling (${method})...`, 'dim');

  const inputFile = await layerToGeoTiff(layer);
  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];

  const { width, height, extent } = layer._metadata;
  const [west, south, east, north] = extent;

  const warpOptions = [
    '-r', method,
    '-of', 'GTiff'
  ];

  if (options.resolution) {
    warpOptions.push('-tr', String(options.resolution), String(options.resolution));
  } else if (options.width && options.height) {
    warpOptions.push('-ts', String(options.width), String(options.height));
  } else if (options.scale) {
    const newWidth = Math.round(width * options.scale);
    const newHeight = Math.round(height * options.scale);
    warpOptions.push('-ts', String(newWidth), String(newHeight));
  } else {
    throw new Error('Specify resolution, width/height, or scale');
  }

  const output = await gdal.gdalwarp(dataset, warpOptions);
  const outputBytes = await gdal.getFileBytes(output);

  await gdal.close(dataset);

  const { loadGeoTIFF } = await import('../formats/geotiff.js');
  const newLayer = await loadGeoTIFF(outputBytes.buffer, name, {
    colorRamp: layer._colorRamp,
    mode: layer._mode
  });

  termPrint(`Resampled: ${name}`, 'green');
  return newLayer;
}

/**
 * Convert/export vector layer to different format
 * @param {Object} layer - Spinifex vector layer
 * @param {string} format - Output format: 'shapefile', 'gpkg', 'geojson', 'kml', 'csv', etc.
 * @param {Object} options - Conversion options
 * @param {string} options.filename - Output filename
 * @returns {Promise<Blob>} Output file as Blob
 */
export async function convert(layer, format, options = {}) {
  const gdal = await ensureGdal();

  // Support Layer class (has _geojson), raw GeoJSON, or OL layer
  const geojsonData = layer._geojson || layer.geojson;
  const source = layer._source;

  if (!geojsonData && !source) {
    throw new Error('Invalid vector layer - needs _geojson or _source');
  }

  // Map format names to GDAL driver names
  const formatMap = {
    'shapefile': 'ESRI Shapefile',
    'shp': 'ESRI Shapefile',
    'gpkg': 'GPKG',
    'geopackage': 'GPKG',
    'geojson': 'GeoJSON',
    'kml': 'KML',
    'csv': 'CSV',
    'gml': 'GML',
    'dxf': 'DXF',
    'flatgeobuf': 'FlatGeobuf',
    'fgb': 'FlatGeobuf',
    'gpx': 'GPX'
  };

  const driverName = formatMap[format.toLowerCase()] || format;
  termPrint(`Converting to ${driverName}...`, 'dim');

  // Get GeoJSON data
  let geojson;
  if (geojsonData) {
    geojson = geojsonData;
  } else {
    const features = source.getFeatures();
    const { GeoJSON } = await import('ol/format.js');
    const geoFormat = new GeoJSON();
    geojson = geoFormat.writeFeaturesObject(features, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });
  }

  const inputFile = new File(
    [JSON.stringify(geojson)],
    'input.geojson',
    { type: 'application/geo+json' }
  );

  const result = await gdal.open(inputFile);
  const dataset = result.datasets[0];

  const ogrOptions = [
    '-f', driverName
  ];

  const output = await gdal.ogr2ogr(dataset, ogrOptions);
  const outputBytes = await gdal.getFileBytes(output);

  await gdal.close(dataset);

  // Determine MIME type
  const mimeTypes = {
    'ESRI Shapefile': 'application/x-shapefile',
    'GPKG': 'application/geopackage+sqlite3',
    'GeoJSON': 'application/geo+json',
    'KML': 'application/vnd.google-earth.kml+xml',
    'CSV': 'text/csv',
    'GML': 'application/gml+xml',
    'DXF': 'application/dxf',
    'FlatGeobuf': 'application/flatgeobuf',
    'GPX': 'application/gpx+xml'
  };

  const mimeType = mimeTypes[driverName] || 'application/octet-stream';
  const blob = new Blob([outputBytes], { type: mimeType });

  termPrint(`Converted: ${layer.name || layer._name} → ${driverName}`, 'green');
  return blob;
}

/**
 * Download vector layer in specified format
 * @param {Object} layer - Spinifex vector layer
 * @param {string} format - Output format
 * @param {string} filename - Output filename (optional)
 */
export async function downloadVector(layer, format, filename) {
  const extensionMap = {
    'shapefile': 'shp.zip',
    'shp': 'shp.zip',
    'gpkg': 'gpkg',
    'geopackage': 'gpkg',
    'geojson': 'geojson',
    'kml': 'kml',
    'csv': 'csv',
    'gml': 'gml',
    'dxf': 'dxf',
    'flatgeobuf': 'fgb',
    'fgb': 'fgb',
    'gpx': 'gpx'
  };

  const ext = extensionMap[format.toLowerCase()] || format;
  const fname = filename || `${layer.name}.${ext}`;

  try {
    const blob = await convert(layer, format);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);

    termPrint(`Downloaded: ${fname}`, 'green');
  } catch (e) {
    termPrint(`Export failed: ${e.message}`, 'red');
    console.error(e);
  }
}

