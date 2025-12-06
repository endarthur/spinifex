// Spinifex - XLSX Loader
// Parse Excel files with coordinate columns into GeoJSON points
// Requires SheetJS (xlsx) library

import { loadCSV } from './csv.js';
import { termPrint } from '../ui/terminal.js';

// SheetJS library reference (loaded from CDN)
let XLSX = null;

/**
 * Ensure SheetJS is loaded
 */
async function ensureXLSX() {
  if (XLSX) return XLSX;

  if (window.XLSX) {
    XLSX = window.XLSX;
    return XLSX;
  }

  // Dynamically load SheetJS
  termPrint('Loading XLSX library...', 'dim');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => {
      XLSX = window.XLSX;
      termPrint('XLSX library loaded', 'dim');
      resolve(XLSX);
    };
    script.onerror = () => {
      reject(new Error('Failed to load XLSX library'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load Excel file as point layer
 * @param {ArrayBuffer} buffer - Excel file as ArrayBuffer
 * @param {string} name - Layer name
 * @param {object} options - Loading options
 * @param {string} options.sheet - Sheet name (default: first sheet)
 * @param {string} options.x - X/longitude column name
 * @param {string} options.y - Y/latitude column name
 * @param {string} options.crs - Source CRS
 */
export async function loadXLSX(buffer, name, options = {}) {
  try {
    const xlsx = await ensureXLSX();

    // Parse workbook
    const workbook = xlsx.read(buffer, { type: 'array' });

    // Get sheet
    const sheetName = options.sheet || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      termPrint(`Sheet not found: ${sheetName}`, 'red');
      termPrint(`Available sheets: ${workbook.SheetNames.join(', ')}`, 'yellow');
      return null;
    }

    // Convert to CSV text
    const csvText = xlsx.utils.sheet_to_csv(sheet);

    termPrint(`Loaded sheet: ${sheetName}`, 'dim');

    // Use CSV loader for the actual parsing
    return loadCSV(csvText, name, options);
  } catch (e) {
    termPrint(`XLSX error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * List sheets in an Excel file
 */
export async function listSheets(buffer) {
  try {
    const xlsx = await ensureXLSX();
    const workbook = xlsx.read(buffer, { type: 'array' });
    return workbook.SheetNames;
  } catch (e) {
    termPrint(`Error reading Excel file: ${e.message}`, 'red');
    return [];
  }
}

/**
 * Check if ArrayBuffer looks like Excel file
 */
export function isXLSX(buffer) {
  // Check for ZIP header (Excel files are ZIP archives)
  const arr = new Uint8Array(buffer.slice(0, 4));
  return arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;
}
