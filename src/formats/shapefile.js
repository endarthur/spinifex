// Spinifex - Shapefile Loader & Exporter
// Parse Shapefile (as ZIP) into GeoJSON
// Export GeoJSON to Shapefile (via shpwrite)
// Requires shpjs (read) and shpwrite (write) libraries

import { loadGeoJSON } from './geojson.js';
import { termPrint } from '../ui/terminal.js';

// Library references
let shp = null;      // shpjs for reading
let shpwrite = null; // shpwrite for writing

/**
 * Ensure shpjs is loaded
 */
async function ensureShp() {
  if (shp) return shp;

  if (window.shp) {
    shp = window.shp;
    return shp;
  }

  // Dynamically load shpjs
  termPrint('Loading Shapefile library...', 'dim');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/shpjs@latest/dist/shp.min.js';
    script.onload = () => {
      shp = window.shp;
      termPrint('Shapefile library loaded', 'dim');
      resolve(shp);
    };
    script.onerror = () => {
      reject(new Error('Failed to load Shapefile library'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load Shapefile (as ZIP) as layer
 * @param {ArrayBuffer} buffer - Shapefile ZIP as ArrayBuffer
 * @param {string} name - Layer name
 * @param {object} options - Loading options
 */
export async function loadShapefile(buffer, name, options = {}) {
  try {
    const shpLib = await ensureShp();

    termPrint('Parsing Shapefile...', 'dim');

    // Parse shapefile
    const geojson = await shpLib(buffer);

    if (!geojson) {
      termPrint('Failed to parse Shapefile', 'red');
      return null;
    }

    // shpjs may return a single FeatureCollection or an object with multiple
    if (geojson.type === 'FeatureCollection') {
      return loadGeoJSON(name, geojson);
    }

    // Multiple layers in the shapefile
    if (typeof geojson === 'object' && !geojson.type) {
      const layers = [];
      for (const [layerName, fc] of Object.entries(geojson)) {
        if (fc && fc.type === 'FeatureCollection') {
          layers.push(loadGeoJSON(layerName, fc));
        }
      }

      if (layers.length === 0) {
        termPrint('No valid layers found in Shapefile', 'red');
        return null;
      }

      if (layers.length === 1) {
        return layers[0];
      }

      termPrint(`Loaded ${layers.length} layers from Shapefile`, 'green');
      return layers;
    }

    termPrint('Unexpected Shapefile format', 'red');
    return null;
  } catch (e) {
    termPrint(`Shapefile error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Check if ArrayBuffer looks like a ZIP (shapefile archive)
 */
export function isShapefile(buffer, filename = '') {
  // Check for ZIP header
  const arr = new Uint8Array(buffer.slice(0, 4));
  const isZip = arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;

  // If it's a ZIP and filename suggests shapefile
  if (isZip && filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'zip' || ext === 'shp';
  }

  return isZip;
}

/**
 * Check for .shp file header (standalone shapefile, not zipped)
 */
export function isShpFile(buffer) {
  // Shapefile magic number: 0x0000270a (big-endian)
  const arr = new Uint8Array(buffer.slice(0, 4));
  return arr[0] === 0x00 && arr[1] === 0x00 && arr[2] === 0x27 && arr[3] === 0x0a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shapefile Export (via shpwrite)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure shpwrite library is loaded
 */
async function ensureShpwrite() {
  if (shpwrite) return shpwrite;

  if (window.shpwrite) {
    shpwrite = window.shpwrite;
    return shpwrite;
  }

  // Dynamically load shpwrite
  termPrint('Loading Shapefile export library...', 'dim');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mapbox/shp-write@0.4.3/shpwrite.js';
    script.onload = () => {
      shpwrite = window.shpwrite;
      termPrint('Shapefile export library loaded', 'dim');
      resolve(shpwrite);
    };
    script.onerror = () => {
      reject(new Error('Failed to load shpwrite library'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Export GeoJSON to Shapefile (ZIP) using pure JS
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {string} filename - Output filename (without extension)
 * @param {Object} options - Export options
 * @returns {Promise<Blob>} ZIP blob containing shapefile
 */
export async function exportShapefile(geojson, filename = 'export', options = {}) {
  try {
    const shpLib = await ensureShpwrite();

    termPrint('Generating Shapefile...', 'dim');

    // shpwrite options
    const shpOptions = {
      folder: filename,
      outputType: 'blob',  // Return Blob instead of ArrayBuffer
      compression: 'STORE',  // DEFLATE can be buggy in browser
      types: {
        point: 'points',
        polygon: 'polygons',
        line: 'lines'
      }
    };

    // Generate shapefile as ZIP blob
    const zipBlob = await shpLib.zip(geojson, shpOptions);

    termPrint('Shapefile generated', 'green');
    return zipBlob;
  } catch (e) {
    termPrint(`Shapefile export error: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Download layer as Shapefile using pure JS (shpwrite)
 * Falls back to GDAL if shpwrite fails
 * @param {Object} layer - Vector layer to export
 * @param {string} filename - Output filename
 * @param {Object} options - Export options
 */
export async function downloadShapefile(layer, filename, options = {}) {
  const name = filename || layer.name || 'export';
  const geojson = layer.geojson || layer._geojson;

  if (!geojson || !geojson.features) {
    termPrint('No vector data to export', 'red');
    return null;
  }

  try {
    // Try pure JS export first (faster, lighter)
    const zipBlob = await exportShapefile(geojson, name, options);

    // Download the blob
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.shp.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    termPrint(`Downloaded: ${name}.shp.zip`, 'green');
    return `${name}.shp.zip`;
  } catch (e) {
    // Fall back to GDAL if shpwrite fails
    termPrint('Pure JS export failed, trying GDAL...', 'yellow');

    try {
      // Dynamic import to avoid circular dependency
      const { downloadVector } = await import('../raster/gdal.js');
      return await downloadVector(layer, 'shapefile', filename);
    } catch (gdalError) {
      termPrint(`GDAL fallback also failed: ${gdalError.message}`, 'red');
      return null;
    }
  }
}

/**
 * Check if shpwrite is available (without loading it)
 */
export function isShpwriteAvailable() {
  return shpwrite !== null || window.shpwrite !== undefined;
}
