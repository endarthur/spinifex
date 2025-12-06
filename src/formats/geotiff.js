// Spinifex - GeoTIFF Loader
// Display GeoTIFF rasters using geotiff.js
// Basic display only - raster algebra will be added later

import { state } from '../core/state.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel, updateStatusBar } from '../ui/layers-panel.js';
import { termPrint } from '../ui/terminal.js';

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

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/geotiff@2.1.0/dist-browser/geotiff.js';
    script.onload = () => {
      GeoTIFF = window.GeoTIFF;
      termPrint('GeoTIFF library loaded', 'dim');
      resolve(GeoTIFF);
    };
    script.onerror = () => {
      reject(new Error('Failed to load GeoTIFF library'));
    };
    document.head.appendChild(script);
  });
}

/**
 * RasterLayer class - wrapper for raster layers
 */
class RasterLayer {
  constructor(id, name, olLayer, metadata, zIndex) {
    this._id = id;
    this._name = name;
    this._olLayer = olLayer;
    this._metadata = metadata;
    this._visible = true;
    this._zIndex = zIndex || 0;
    // Source file info for project persistence
    this._sourcePath = null;    // e.g., "rasters/dem.tif"
    this._sourceFormat = 'geotiff';
    if (this._olLayer) {
      this._olLayer.setZIndex(this._zIndex);
    }
  }

  get name() { return this._name; }
  get id() { return this._id; }
  get visible() { return this._visible; }
  get olLayer() { return this._olLayer; }
  get metadata() { return this._metadata; }
  get sourcePath() { return this._sourcePath; }
  get sourceFormat() { return this._sourceFormat; }

  setSource(path, format = 'geotiff') {
    this._sourcePath = path;
    this._sourceFormat = format;
    return this;
  }

  get width() { return this._metadata.width; }
  get height() { return this._metadata.height; }
  get bands() { return this._metadata.samplesPerPixel; }
  get extent() { return this._metadata.extent; }

  show() {
    this._olLayer.setVisible(true);
    this._visible = true;
    updateLayerPanel();
    return this;
  }

  hide() {
    this._olLayer.setVisible(false);
    this._visible = false;
    updateLayerPanel();
    return this;
  }

  zoom() {
    const map = getMap();
    map.getView().fit(this._metadata.olExtent, {
      padding: [50, 50, 50, 50],
      duration: 500
    });
    return this;
  }

  opacity(value) {
    if (value !== undefined) {
      this._olLayer.setOpacity(value);
      return this;
    }
    return this._olLayer.getOpacity();
  }

  /**
   * Get or set layer z-index (rendering order)
   * Higher z-index = rendered on top
   */
  zIndex(value) {
    if (value !== undefined) {
      this._zIndex = value;
      this._olLayer.setZIndex(value);
      updateLayerPanel();
      return this;
    }
    return this._zIndex;
  }

  /**
   * Move layer to top of render stack
   */
  bringToFront() {
    let maxZ = 0;
    state.layers.forEach(l => {
      const z = l.zIndex ? l.zIndex() : 0;
      if (z > maxZ) maxZ = z;
    });
    this.zIndex(maxZ + 1);
    return this;
  }

  /**
   * Move layer to bottom of render stack
   */
  sendToBack() {
    let minZ = Infinity;
    state.layers.forEach(l => {
      const z = l.zIndex ? l.zIndex() : 0;
      if (z < minZ) minZ = z;
    });
    this.zIndex(minZ - 1);
    return this;
  }

  remove() {
    const map = getMap();
    map.removeLayer(this._olLayer);
    state.layers.delete(this._id);
    updateLayerPanel();
    return null;
  }

  toString() {
    return `RasterLayer<${this._name}> (${this.width}x${this.height}, ${this.bands} band${this.bands > 1 ? 's' : ''})`;
  }
}

/**
 * Create canvas from raster data
 */
function createRasterCanvas(raster, width, height, noDataValue) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  // Determine if single band (grayscale) or multi-band (RGB)
  const numBands = raster.length;

  if (numBands === 1) {
    // Single band - create grayscale
    const band = raster[0];
    let min = Infinity, max = -Infinity;

    // Find min/max for stretching
    for (let i = 0; i < band.length; i++) {
      const val = band[i];
      if (val !== noDataValue && isFinite(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    const range = max - min || 1;

    for (let i = 0; i < band.length; i++) {
      const val = band[i];
      const idx = i * 4;

      if (val === noDataValue || !isFinite(val)) {
        // Transparent for nodata
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 0;
        imageData.data[idx + 3] = 0;
      } else {
        // Stretch to 0-255
        const gray = Math.round(((val - min) / range) * 255);
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
        imageData.data[idx + 3] = 255;
      }
    }
  } else if (numBands >= 3) {
    // RGB or RGBA
    const r = raster[0];
    const g = raster[1];
    const b = raster[2];
    const a = numBands >= 4 ? raster[3] : null;

    for (let i = 0; i < r.length; i++) {
      const idx = i * 4;
      imageData.data[idx] = Math.min(255, Math.max(0, r[i]));
      imageData.data[idx + 1] = Math.min(255, Math.max(0, g[i]));
      imageData.data[idx + 2] = Math.min(255, Math.max(0, b[i]));
      imageData.data[idx + 3] = a ? Math.min(255, Math.max(0, a[i])) : 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
    const raster = await image.readRasters();

    // Create canvas
    const canvas = createRasterCanvas(raster, width, height, noDataValue);

    // Create OpenLayers layer
    const extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
    const olExtent = ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857');

    const imageLayer = new ol.layer.Image({
      source: new ol.source.ImageStatic({
        url: canvas.toDataURL(),
        imageExtent: olExtent,
        projection: 'EPSG:3857'
      })
    });

    const map = getMap();
    map.addLayer(imageLayer);

    // Create RasterLayer wrapper
    const id = `raster_${state.layerCounter++}`;
    const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const zIndex = state.zIndexCounter++;

    const metadata = {
      width,
      height,
      samplesPerPixel,
      extent,
      olExtent,
      noDataValue
    };

    const layer = new RasterLayer(id, cleanName, imageLayer, metadata, zIndex);
    state.layers.set(id, layer);

    // Add to sp namespace
    import('../core/api.js').then(({ sp }) => {
      sp[cleanName] = layer;
    });

    updateLayerPanel();
    updateStatusBar();

    termPrint(`Loaded raster: ${cleanName}`, 'green');
    return layer;
  } catch (e) {
    termPrint(`GeoTIFF error: ${e.message}`, 'red');
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
