// Spinifex - CSV Loader
// Parse CSV files with coordinate columns into GeoJSON points

import { loadGeoJSON } from './geojson.js';
import { termPrint } from '../ui/terminal.js';

// Common coordinate column name patterns
const COORD_PATTERNS = {
  x: ['x', 'easting', 'east', 'e', 'lon', 'long', 'longitude', 'lng'],
  y: ['y', 'northing', 'north', 'n', 'lat', 'latitude']
};

/**
 * Parse CSV text into array of objects
 */
function parseCSV(text, options = {}) {
  const delimiter = options.delimiter || detectDelimiter(text);
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  // Parse header
  const headers = parseLine(lines[0], delimiter).map(h => h.trim());

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line, delimiter);
    const row = {};

    headers.forEach((header, idx) => {
      let value = values[idx]?.trim() || '';

      // Try to parse numbers
      if (value !== '' && !isNaN(value)) {
        value = parseFloat(value);
      }

      row[header] = value;
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Detect CSV delimiter (comma, semicolon, or tab)
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0];

  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

/**
 * Auto-detect coordinate columns from headers
 */
function detectCoordinateColumns(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase());

  let xCol = null;
  let yCol = null;

  // Find X column
  for (const pattern of COORD_PATTERNS.x) {
    const idx = lowerHeaders.findIndex(h => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      xCol = headers[idx];
      break;
    }
  }

  // Find Y column
  for (const pattern of COORD_PATTERNS.y) {
    const idx = lowerHeaders.findIndex(h => h === pattern || h.includes(pattern));
    if (idx !== -1) {
      yCol = headers[idx];
      break;
    }
  }

  return { x: xCol, y: yCol };
}

/**
 * Detect if coordinates look like lat/lon or projected
 */
function detectCRS(rows, xCol, yCol) {
  if (rows.length === 0) return 'EPSG:4326';

  const sample = rows.slice(0, 10);
  const xValues = sample.map(r => r[xCol]).filter(v => typeof v === 'number');
  const yValues = sample.map(r => r[yCol]).filter(v => typeof v === 'number');

  if (xValues.length === 0 || yValues.length === 0) return 'EPSG:4326';

  const avgX = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

  // If values are in typical lat/lon range
  if (Math.abs(avgX) <= 180 && Math.abs(avgY) <= 90) {
    return 'EPSG:4326';
  }

  // Looks like projected coordinates
  return 'projected';
}

/**
 * Convert CSV rows to GeoJSON FeatureCollection
 */
function rowsToGeoJSON(rows, xCol, yCol, sourceCRS) {
  const features = [];

  for (const row of rows) {
    const x = row[xCol];
    const y = row[yCol];

    if (typeof x !== 'number' || typeof y !== 'number') {
      continue; // Skip rows without valid coordinates
    }

    // Transform if needed
    let coords = [x, y];
    if (sourceCRS !== 'EPSG:4326' && sourceCRS !== 'projected') {
      // Use proj4 if available and CRS is defined
      if (window.proj4 && proj4.defs(sourceCRS)) {
        coords = proj4(sourceCRS, 'EPSG:4326', coords);
      }
    }

    // Build properties (exclude coordinate columns)
    const properties = {};
    for (const [key, value] of Object.entries(row)) {
      if (key !== xCol && key !== yCol) {
        properties[key] = value;
      }
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coords
      },
      properties
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Load CSV file as point layer
 * @param {string} text - CSV text content
 * @param {string} name - Layer name
 * @param {object} options - Loading options
 * @param {string} options.x - X/longitude column name
 * @param {string} options.y - Y/latitude column name
 * @param {string} options.crs - Source CRS (default: auto-detect)
 * @param {string} options.delimiter - CSV delimiter (default: auto-detect)
 */
export function loadCSV(text, name, options = {}) {
  try {
    const { headers, rows } = parseCSV(text, options);

    if (rows.length === 0) {
      termPrint('CSV has no data rows', 'red');
      return null;
    }

    // Determine coordinate columns
    let xCol = options.x;
    let yCol = options.y;

    if (!xCol || !yCol) {
      const detected = detectCoordinateColumns(headers);
      xCol = xCol || detected.x;
      yCol = yCol || detected.y;
    }

    if (!xCol || !yCol) {
      termPrint(`Could not detect coordinate columns. Headers: ${headers.join(', ')}`, 'red');
      termPrint('Specify with: load(csv, "name", { x: "col", y: "col" })', 'yellow');
      return null;
    }

    // Determine CRS
    const sourceCRS = options.crs || detectCRS(rows, xCol, yCol);

    if (sourceCRS === 'projected' && !options.crs) {
      termPrint('Coordinates appear to be projected. Specify CRS with: { crs: "EPSG:32750" }', 'yellow');
    }

    // Convert to GeoJSON
    const geojson = rowsToGeoJSON(rows, xCol, yCol, sourceCRS);

    if (geojson.features.length === 0) {
      termPrint('No valid coordinate rows found', 'red');
      return null;
    }

    termPrint(`Parsed ${geojson.features.length} points from CSV (${xCol}, ${yCol})`, 'dim');

    return loadGeoJSON(name, geojson);
  } catch (e) {
    termPrint(`CSV error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Check if content looks like CSV
 */
export function isCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return false;

  // Check if first line has consistent delimiter
  const delim = detectDelimiter(text);
  const headerCols = parseLine(lines[0], delim).length;
  const dataCols = parseLine(lines[1], delim).length;

  return headerCols > 1 && headerCols === dataCols;
}
