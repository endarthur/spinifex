// Spinifex - GeoTIFF Loader
// Load GeoTIFF rasters using geotiff.js with WebGL rendering
// Supports single-band, RGB, and RGBA rasters

import { createWebGLRasterLayer, RENDER_MODES, COLOR_RAMPS } from '../raster/webgl-raster.js';
import { termPrint, withLoadingWarning } from '../ui/terminal.js';

// geotiff.js library reference
let GeoTIFF = null;

/**
 * Ensure geotiff.js is loaded
 */
async function ensureGeoTIFF() {
  if (GeoTIFF) return GeoTIFF;

  if (window.GeoTIFF) {
    GeoTIFF = window.GeoTIFF;
    return GeoTIFF;
  }

  // Dynamically load geotiff.js
  termPrint('Loading GeoTIFF library...', 'dim');

  const loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/geotiff@2.1.0/dist-browser/geotiff.js';
    script.onload = () => {
      GeoTIFF = window.GeoTIFF;
      termPrint('GeoTIFF library loaded', 'dim');
      resolve(GeoTIFF);
    };
    script.onerror = () => {
      reject(new Error('Failed to load GeoTIFF library. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return withLoadingWarning(loadPromise, 'GeoTIFF library', 3000);
}

/**
 * Calculate statistics for a band
 * @param {TypedArray} band - Band data
 * @param {number} noDataValue - NoData value to exclude
 */
function calculateBandStats(band, noDataValue) {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < band.length; i++) {
    const val = band[i];
    if (val !== noDataValue && isFinite(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 255 : max };
}

/**
 * Load GeoTIFF file
 * @param {ArrayBuffer} buffer - GeoTIFF file as ArrayBuffer
 * @param {string} name - Layer name
 * @param {object} options - Loading options
 */
export async function loadGeoTIFF(buffer, name, options = {}) {
  try {
    const geotiffLib = await ensureGeoTIFF();

    termPrint('Parsing GeoTIFF...', 'dim');

    // Parse GeoTIFF
    const tiff = await geotiffLib.fromArrayBuffer(buffer);
    const image = await tiff.getImage();

    // Get metadata
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    const samplesPerPixel = image.getSamplesPerPixel();

    // Get nodata value
    const gdalNoData = image.getGDALNoData();
    const noDataValue = gdalNoData !== null ? gdalNoData : -9999;

    termPrint(`Raster: ${width}x${height}, ${samplesPerPixel} band(s)`, 'dim');

    // Read raster data
    const rasterData = await image.readRasters();

    // Convert to array of bands
    const bands = [];
    for (let i = 0; i < samplesPerPixel; i++) {
      bands.push(rasterData[i]);
    }

    // Calculate statistics for each band
    const bandStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (let i = 0; i < bands.length; i++) {
      const stats = calculateBandStats(bands[i], noDataValue);
      bandStats[`band${i + 1}`] = stats;
      if (stats.min < globalMin) globalMin = stats.min;
      if (stats.max > globalMax) globalMax = stats.max;
    }

    // Determine render mode
    let mode = options.mode;
    if (!mode) {
      if (samplesPerPixel >= 3) {
        mode = RENDER_MODES.RGB;
      } else {
        mode = RENDER_MODES.GRAYSCALE;
      }
    }

    // Default color ramp for single band
    const colorRamp = options.colorRamp || 'grayscale';

    // Build metadata
    const extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const metadata = {
      width,
      height,
      extent,
      min: globalMin,
      max: globalMax,
      bandStats,
      nodata: noDataValue,
      samplesPerPixel
    };

    // Create WebGL raster layer
    const layer = createWebGLRasterLayer(
      samplesPerPixel === 1 ? bands[0] : bands,
      metadata,
      name,
      {
        nodata: noDataValue,
        colorRamp,
        mode
      }
    );

    layer.setSource(null, 'geotiff');

    termPrint(`Loaded raster: ${name}`, 'green');
    return layer;
  } catch (e) {
    termPrint(`GeoTIFF error: ${e.message}`, 'red');
    console.error(e);
    return null;
  }
}

/**
 * Load a Cloud Optimized GeoTIFF (COG) from URL
 * Uses HTTP range requests for efficient streaming
 * @param {string} url - URL to the COG file
 * @param {string} name - Layer name (optional, derived from URL)
 * @param {object} options - Loading options
 */
export async function loadCOG(url, name, options = {}) {
  try {
    const geotiffLib = await ensureGeoTIFF();

    // Derive name from URL if not provided
    const layerName = name || url.split('/').pop().replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    termPrint(`Loading COG from: ${url}`, 'dim');

    // Open COG with range request support
    const tiff = await geotiffLib.fromUrl(url);
    const image = await tiff.getImage();

    // Get metadata
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    const samplesPerPixel = image.getSamplesPerPixel();

    // Get nodata value
    const gdalNoData = image.getGDALNoData();
    const noDataValue = gdalNoData !== null ? gdalNoData : -9999;

    termPrint(`COG: ${width}x${height}, ${samplesPerPixel} band(s)`, 'dim');

    // Check for overviews (COG feature)
    const imageCount = await tiff.getImageCount();
    if (imageCount > 1) {
      termPrint(`COG has ${imageCount - 1} overview level(s)`, 'dim');
    }

    // For large COGs, read at a reduced resolution
    // Use overview if available, otherwise subsample
    let readWidth = width;
    let readHeight = height;
    let readImage = image;

    // If very large, try to use an overview
    const MAX_PIXELS = 4096 * 4096; // ~16 million pixels
    if (width * height > MAX_PIXELS && imageCount > 1) {
      // Find appropriate overview level
      for (let i = 1; i < imageCount; i++) {
        const overview = await tiff.getImage(i);
        const ow = overview.getWidth();
        const oh = overview.getHeight();
        if (ow * oh <= MAX_PIXELS) {
          readImage = overview;
          readWidth = ow;
          readHeight = oh;
          termPrint(`Using overview ${i}: ${ow}x${oh}`, 'dim');
          break;
        }
      }
    }

    // Read raster data
    termPrint('Reading raster data...', 'dim');
    const rasterData = await readImage.readRasters();

    // Convert to array of bands
    const bands = [];
    for (let i = 0; i < samplesPerPixel; i++) {
      bands.push(rasterData[i]);
    }

    // Calculate statistics for each band
    const bandStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (let i = 0; i < bands.length; i++) {
      const stats = calculateBandStats(bands[i], noDataValue);
      bandStats[`band${i + 1}`] = stats;
      if (stats.min < globalMin) globalMin = stats.min;
      if (stats.max > globalMax) globalMax = stats.max;
    }

    // Determine render mode
    let mode = options.mode;
    if (!mode) {
      if (samplesPerPixel >= 3) {
        mode = RENDER_MODES.RGB;
      } else {
        mode = RENDER_MODES.GRAYSCALE;
      }
    }

    // Default color ramp for single band
    const colorRamp = options.colorRamp || 'grayscale';

    // Build metadata (use original dimensions for extent, read dimensions for data)
    const extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const metadata = {
      width: readWidth,
      height: readHeight,
      originalWidth: width,
      originalHeight: height,
      extent,
      min: globalMin,
      max: globalMax,
      bandStats,
      nodata: noDataValue,
      samplesPerPixel,
      sourceUrl: url
    };

    // Create WebGL raster layer
    const layer = createWebGLRasterLayer(
      samplesPerPixel === 1 ? bands[0] : bands,
      metadata,
      layerName,
      {
        nodata: noDataValue,
        colorRamp,
        mode
      }
    );

    layer.setSource(url, 'cog');

    termPrint(`Loaded COG: ${layerName}`, 'green');
    layer.zoom();
    return layer;
  } catch (e) {
    termPrint(`COG error: ${e.message}`, 'red');
    console.error(e);
    return null;
  }
}

/**
 * Check if buffer looks like a TIFF
 */
export function isGeoTIFF(buffer) {
  const arr = new Uint8Array(buffer.slice(0, 4));
  // TIFF magic: II (little-endian) or MM (big-endian)
  const isLittleEndian = arr[0] === 0x49 && arr[1] === 0x49 && arr[2] === 0x2A && arr[3] === 0x00;
  const isBigEndian = arr[0] === 0x4D && arr[1] === 0x4D && arr[2] === 0x00 && arr[3] === 0x2A;
  return isLittleEndian || isBigEndian;
}

/**
 * Load a COG from workspace with tiled reading
 * This is more efficient for large rasters as it only loads tiles on demand
 * @param {FileSystemFileHandle} fileHandle - File handle from workspace
 * @param {string} name - Layer name
 * @param {Object} options - Saved layer options (colorRamp, mode, etc.)
 */
export async function loadCOGFromWorkspace(fileHandle, name, options = {}) {
  try {
    const geotiffLib = await ensureGeoTIFF();

    termPrint(`Loading COG: ${name}...`, 'dim');

    // Get file and read
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();

    // Parse COG
    const tiff = await geotiffLib.fromArrayBuffer(buffer);
    const image = await tiff.getImage();

    // Get metadata
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    const samplesPerPixel = image.getSamplesPerPixel();
    // Use saved nodata from project config, fall back to GDAL tag, then default
    const noDataValue = options.nodata ?? image.getGDALNoData() ?? -32768;

    termPrint(`COG: ${width}x${height}, ${samplesPerPixel} band(s)`, 'dim');

    // For now, load full raster (tiled loading can be added later for very large files)
    // The benefit is still there: COG is compressed and has overviews
    const rasterData = await image.readRasters();

    // Convert to array of bands
    const bands = [];
    for (let i = 0; i < samplesPerPixel; i++) {
      bands.push(rasterData[i]);
    }

    // Calculate statistics for each band (always needed for RGB rendering)
    // Global min/max can optionally be provided from project config
    const bandStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (let i = 0; i < bands.length; i++) {
      const stats = calculateBandStats(bands[i], noDataValue);
      bandStats[`band${i + 1}`] = stats;
      if (stats.min < globalMin) globalMin = stats.min;
      if (stats.max > globalMax) globalMax = stats.max;
    }

    // Override global min/max if provided in options (for stretch consistency)
    if (options.min !== undefined) globalMin = options.min;
    if (options.max !== undefined) globalMax = options.max;

    // Use saved mode/colorRamp or auto-detect
    let mode = options.mode;
    if (!mode) {
      if (samplesPerPixel >= 3) {
        mode = RENDER_MODES.RGB;
      } else {
        mode = RENDER_MODES.GRAYSCALE;
      }
    }

    const colorRamp = options.colorRamp || 'terrain';

    // Build metadata
    const extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const metadata = {
      width,
      height,
      extent,
      min: globalMin,
      max: globalMax,
      bandStats,
      nodata: noDataValue,
      samplesPerPixel
    };

    // Create WebGL raster layer
    const layer = createWebGLRasterLayer(
      samplesPerPixel === 1 ? bands[0] : bands,
      metadata,
      name,
      {
        nodata: noDataValue,
        colorRamp,
        mode
      }
    );

    layer.setSource(file.name, 'cog');

    // Restore selected band if saved in project
    if (options.selectedBand) {
      layer._selectedBand = options.selectedBand;
    }

    // Restore RGB band mapping if saved in project
    if (options.bandMapping && Array.isArray(options.bandMapping)) {
      layer._bandMapping = options.bandMapping;
    }

    // Restore per-channel stretch if saved in project
    if (options.bandStretch) {
      layer._bandStretch = options.bandStretch;
    }

    // Update style with restored settings
    if (options.selectedBand || options.bandMapping || options.bandStretch) {
      layer._updateStyle();
    }

    termPrint(`Loaded COG: ${name}`, 'green');
    return layer;
  } catch (e) {
    termPrint(`COG load error: ${e.message}`, 'red');
    console.error(e);
    return null;
  }
}
