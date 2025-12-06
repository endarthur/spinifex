// Spinifex - Shapefile Loader
// Parse Shapefile (as ZIP) into GeoJSON
// Requires shpjs library

import { loadGeoJSON } from './geojson.js';
import { termPrint } from '../ui/terminal.js';

// shpjs library reference
let shp = null;

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
