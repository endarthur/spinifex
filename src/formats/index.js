// Spinifex - Format Loaders
// Unified interface for loading various geospatial formats

import { loadGeoJSON } from './geojson.js';
import { loadCSV, isCSV } from './csv.js';
import { loadXLSX, isXLSX } from './xlsx.js';
import { loadShapefile, isShapefile } from './shapefile.js';
import { loadGeoTIFF, isGeoTIFF } from './geotiff.js';
import { loadSRTMFromWorkspace } from '../data/srtm.js';
import { termPrint } from '../ui/terminal.js';

/**
 * Detect format from file content and name
 */
function detectFormat(content, filename) {
  const ext = filename?.toLowerCase().split('.').pop() || '';

  // Check by extension first
  if (ext === 'geojson' || ext === 'json') {
    return 'geojson';
  }
  if (ext === 'csv' || ext === 'tsv') {
    return 'csv';
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return 'xlsx';
  }
  if (ext === 'zip' || ext === 'shp') {
    return 'shapefile';
  }
  if (ext === 'tif' || ext === 'tiff') {
    return 'geotiff';
  }

  // Check by content
  if (content instanceof ArrayBuffer) {
    if (isGeoTIFF(content)) return 'geotiff';
    if (isXLSX(content)) return 'xlsx';
    if (isShapefile(content, filename)) return 'shapefile';
  }

  if (typeof content === 'string') {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
        return 'geojson';
      }
    } catch (e) {
      // Not JSON
    }

    // Check if looks like CSV
    if (isCSV(content)) {
      return 'csv';
    }
  }

  return 'unknown';
}

/**
 * Load file based on detected format
 * @param {File} file - File object
 * @param {string} name - Layer name (optional, derived from filename)
 * @param {object} options - Format-specific options
 */
export async function loadFile(file, name, options = {}) {
  const filename = file.name;
  const layerName = name || filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

  const ext = filename.toLowerCase().split('.').pop();

  try {
    // GeoJSON
    if (ext === 'geojson' || ext === 'json') {
      const text = await file.text();
      const geojson = JSON.parse(text);
      return loadGeoJSON(layerName, geojson);
    }

    // CSV
    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      return loadCSV(text, layerName, options);
    }

    // Excel
    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      return await loadXLSX(buffer, layerName, options);
    }

    // Shapefile (zipped)
    if (ext === 'zip') {
      const buffer = await file.arrayBuffer();
      return await loadShapefile(buffer, layerName, options);
    }

    // GeoTIFF
    if (ext === 'tif' || ext === 'tiff') {
      const buffer = await file.arrayBuffer();
      return await loadGeoTIFF(buffer, layerName, options);
    }

    // Try to detect format from content
    const buffer = await file.arrayBuffer();
    const format = detectFormat(buffer, filename);

    switch (format) {
      case 'geotiff':
        return await loadGeoTIFF(buffer, layerName, options);
      case 'xlsx':
        return await loadXLSX(buffer, layerName, options);
      case 'shapefile':
        return await loadShapefile(buffer, layerName, options);
      case 'geojson':
        const decoder = new TextDecoder();
        const text = decoder.decode(buffer);
        const geojson = JSON.parse(text);
        return loadGeoJSON(layerName, geojson);
      case 'csv':
        const csvDecoder = new TextDecoder();
        const csvText = csvDecoder.decode(buffer);
        return loadCSV(csvText, layerName, options);
      default:
        termPrint(`Unknown format: ${filename}`, 'red');
        termPrint('Supported formats: GeoJSON, CSV, XLSX, Shapefile (.zip), GeoTIFF', 'yellow');
        return null;
    }
  } catch (e) {
    termPrint(`Error loading ${filename}: ${e.message}`, 'red');
    // Add helpful hints for common errors
    if (e.message.includes('JSON')) {
      termPrint('Hint: File may be corrupted or not valid JSON', 'yellow');
    } else if (e.message.includes('shapefile') || e.message.includes('.shp')) {
      termPrint('Hint: Shapefile must be a .zip containing .shp, .shx, .dbf files', 'yellow');
    }
    return null;
  }
}

/**
 * Load from URL
 */
export async function loadURL(url, name, options = {}) {
  try {
    termPrint(`Fetching: ${url}`, 'dim');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const filename = url.split('/').pop().split('?')[0];
    const layerName = name || filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    const contentType = response.headers.get('content-type') || '';
    const ext = filename.toLowerCase().split('.').pop();

    // GeoJSON
    if (ext === 'geojson' || ext === 'json' || contentType.includes('json')) {
      const geojson = await response.json();
      return loadGeoJSON(layerName, geojson);
    }

    // CSV
    if (ext === 'csv' || ext === 'tsv' || contentType.includes('csv')) {
      const text = await response.text();
      return loadCSV(text, layerName, options);
    }

    // GeoTIFF
    if (ext === 'tif' || ext === 'tiff') {
      const buffer = await response.arrayBuffer();
      return await loadGeoTIFF(buffer, layerName, options);
    }

    // Binary formats
    const buffer = await response.arrayBuffer();
    const format = detectFormat(buffer, filename);

    switch (format) {
      case 'geotiff':
        return await loadGeoTIFF(buffer, layerName, options);
      case 'xlsx':
        return await loadXLSX(buffer, layerName, options);
      case 'shapefile':
        return await loadShapefile(buffer, layerName, options);
      default:
        termPrint(`Unknown format: ${filename}`, 'red');
        termPrint('Supported formats: GeoJSON, CSV, XLSX, Shapefile (.zip), GeoTIFF', 'yellow');
        return null;
    }
  } catch (e) {
    termPrint(`Error fetching ${url}: ${e.message}`, 'red');
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      termPrint('Hint: Check URL is correct and server allows CORS', 'yellow');
    }
    return null;
  }
}

/**
 * Load from raw content (for workspace reloading)
 * @param {string|ArrayBuffer} content - File content
 * @param {string} name - Layer name
 * @param {string} format - Format type: 'geojson', 'csv', 'xlsx', 'shapefile', 'geotiff'
 * @param {object} options - Format-specific options
 */
export async function loadFromContent(content, name, format, options = {}) {
  try {
    switch (format) {
      case 'geojson':
      case 'json':
        const geojson = typeof content === 'string' ? JSON.parse(content) : JSON.parse(new TextDecoder().decode(content));
        return loadGeoJSON(name, geojson);

      case 'csv':
      case 'tsv':
        const csvText = typeof content === 'string' ? content : new TextDecoder().decode(content);
        return loadCSV(csvText, name, options);

      case 'xlsx':
      case 'xls':
        const xlsxBuffer = content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer;
        return await loadXLSX(xlsxBuffer, name, options);

      case 'shapefile':
      case 'zip':
        const shpBuffer = content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer;
        return await loadShapefile(shpBuffer, name, options);

      case 'geotiff':
      case 'tif':
      case 'tiff':
        const tiffBuffer = content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer;
        return await loadGeoTIFF(tiffBuffer, name, options);

      default:
        termPrint(`Unknown format: ${format}`, 'red');
        return null;
    }
  } catch (e) {
    termPrint(`Error loading ${name}: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Get format from file extension
 */
export function getFormatFromExtension(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'geojson':
    case 'json':
      return 'geojson';
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'zip':
      return 'shapefile';
    case 'tif':
    case 'tiff':
      return 'geotiff';
    case 'srtm':
      return 'srtm';
    default:
      return null;
  }
}

// Re-export individual loaders
export { loadGeoJSON } from './geojson.js';
export { loadCSV } from './csv.js';
export { loadXLSX } from './xlsx.js';
export { loadShapefile, downloadShapefile, exportShapefile } from './shapefile.js';
export { loadGeoTIFF, loadCOG } from './geotiff.js';
export { geojsonToKml, exportKml, downloadKml } from './kml.js';
