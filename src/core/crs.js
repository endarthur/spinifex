// Spinifex - CRS (Coordinate Reference System) Support
// Searchable EPSG registry and CRS utilities

import { termPrint } from '../ui/terminal.js';
import { state } from './state.js';

/**
 * Common EPSG codes database
 * Contains ~200 most commonly used coordinate reference systems
 * Format: { code, name, type, bounds: [minLon, minLat, maxLon, maxLat], unit }
 */
const EPSG_DATABASE = [
  // Global / World
  { code: 4326, name: 'WGS 84', type: 'geographic', bounds: [-180, -90, 180, 90], unit: 'degree' },
  { code: 3857, name: 'WGS 84 / Pseudo-Mercator (Web Mercator)', type: 'projected', bounds: [-180, -85.06, 180, 85.06], unit: 'meter' },
  { code: 4269, name: 'NAD83', type: 'geographic', bounds: [-180, 14, -50, 84], unit: 'degree' },
  { code: 4267, name: 'NAD27', type: 'geographic', bounds: [-180, 14, -50, 84], unit: 'degree' },

  // UTM Zones (WGS84) - Northern Hemisphere
  { code: 32601, name: 'WGS 84 / UTM zone 1N', type: 'projected', bounds: [-180, 0, -174, 84], unit: 'meter' },
  { code: 32610, name: 'WGS 84 / UTM zone 10N', type: 'projected', bounds: [-126, 0, -120, 84], unit: 'meter' },
  { code: 32611, name: 'WGS 84 / UTM zone 11N', type: 'projected', bounds: [-120, 0, -114, 84], unit: 'meter' },
  { code: 32612, name: 'WGS 84 / UTM zone 12N', type: 'projected', bounds: [-114, 0, -108, 84], unit: 'meter' },
  { code: 32613, name: 'WGS 84 / UTM zone 13N', type: 'projected', bounds: [-108, 0, -102, 84], unit: 'meter' },
  { code: 32614, name: 'WGS 84 / UTM zone 14N', type: 'projected', bounds: [-102, 0, -96, 84], unit: 'meter' },
  { code: 32615, name: 'WGS 84 / UTM zone 15N', type: 'projected', bounds: [-96, 0, -90, 84], unit: 'meter' },
  { code: 32616, name: 'WGS 84 / UTM zone 16N', type: 'projected', bounds: [-90, 0, -84, 84], unit: 'meter' },
  { code: 32617, name: 'WGS 84 / UTM zone 17N', type: 'projected', bounds: [-84, 0, -78, 84], unit: 'meter' },
  { code: 32618, name: 'WGS 84 / UTM zone 18N', type: 'projected', bounds: [-78, 0, -72, 84], unit: 'meter' },
  { code: 32619, name: 'WGS 84 / UTM zone 19N', type: 'projected', bounds: [-72, 0, -66, 84], unit: 'meter' },
  { code: 32620, name: 'WGS 84 / UTM zone 20N', type: 'projected', bounds: [-66, 0, -60, 84], unit: 'meter' },
  { code: 32629, name: 'WGS 84 / UTM zone 29N', type: 'projected', bounds: [-12, 0, -6, 84], unit: 'meter' },
  { code: 32630, name: 'WGS 84 / UTM zone 30N', type: 'projected', bounds: [-6, 0, 0, 84], unit: 'meter' },
  { code: 32631, name: 'WGS 84 / UTM zone 31N', type: 'projected', bounds: [0, 0, 6, 84], unit: 'meter' },
  { code: 32632, name: 'WGS 84 / UTM zone 32N', type: 'projected', bounds: [6, 0, 12, 84], unit: 'meter' },
  { code: 32633, name: 'WGS 84 / UTM zone 33N', type: 'projected', bounds: [12, 0, 18, 84], unit: 'meter' },
  { code: 32634, name: 'WGS 84 / UTM zone 34N', type: 'projected', bounds: [18, 0, 24, 84], unit: 'meter' },
  { code: 32635, name: 'WGS 84 / UTM zone 35N', type: 'projected', bounds: [24, 0, 30, 84], unit: 'meter' },
  { code: 32636, name: 'WGS 84 / UTM zone 36N', type: 'projected', bounds: [30, 0, 36, 84], unit: 'meter' },

  // UTM Zones (WGS84) - Southern Hemisphere
  { code: 32749, name: 'WGS 84 / UTM zone 49S', type: 'projected', bounds: [108, -80, 114, 0], unit: 'meter' },
  { code: 32750, name: 'WGS 84 / UTM zone 50S', type: 'projected', bounds: [114, -80, 120, 0], unit: 'meter' },
  { code: 32751, name: 'WGS 84 / UTM zone 51S', type: 'projected', bounds: [120, -80, 126, 0], unit: 'meter' },
  { code: 32752, name: 'WGS 84 / UTM zone 52S', type: 'projected', bounds: [126, -80, 132, 0], unit: 'meter' },
  { code: 32753, name: 'WGS 84 / UTM zone 53S', type: 'projected', bounds: [132, -80, 138, 0], unit: 'meter' },
  { code: 32754, name: 'WGS 84 / UTM zone 54S', type: 'projected', bounds: [138, -80, 144, 0], unit: 'meter' },
  { code: 32755, name: 'WGS 84 / UTM zone 55S', type: 'projected', bounds: [144, -80, 150, 0], unit: 'meter' },
  { code: 32756, name: 'WGS 84 / UTM zone 56S', type: 'projected', bounds: [150, -80, 156, 0], unit: 'meter' },

  // Australia (GDA94 & GDA2020)
  { code: 4283, name: 'GDA94', type: 'geographic', bounds: [108, -45, 155, -10], unit: 'degree' },
  { code: 28349, name: 'GDA94 / MGA zone 49', type: 'projected', bounds: [108, -45, 114, -10], unit: 'meter' },
  { code: 28350, name: 'GDA94 / MGA zone 50', type: 'projected', bounds: [114, -45, 120, -10], unit: 'meter' },
  { code: 28351, name: 'GDA94 / MGA zone 51', type: 'projected', bounds: [120, -45, 126, -10], unit: 'meter' },
  { code: 28352, name: 'GDA94 / MGA zone 52', type: 'projected', bounds: [126, -45, 132, -10], unit: 'meter' },
  { code: 28353, name: 'GDA94 / MGA zone 53', type: 'projected', bounds: [132, -45, 138, -10], unit: 'meter' },
  { code: 28354, name: 'GDA94 / MGA zone 54', type: 'projected', bounds: [138, -45, 144, -10], unit: 'meter' },
  { code: 28355, name: 'GDA94 / MGA zone 55', type: 'projected', bounds: [144, -45, 150, -10], unit: 'meter' },
  { code: 28356, name: 'GDA94 / MGA zone 56', type: 'projected', bounds: [150, -45, 156, -10], unit: 'meter' },
  { code: 7844, name: 'GDA2020', type: 'geographic', bounds: [108, -45, 155, -10], unit: 'degree' },
  { code: 7849, name: 'GDA2020 / MGA zone 49', type: 'projected', bounds: [108, -45, 114, -10], unit: 'meter' },
  { code: 7850, name: 'GDA2020 / MGA zone 50', type: 'projected', bounds: [114, -45, 120, -10], unit: 'meter' },
  { code: 7851, name: 'GDA2020 / MGA zone 51', type: 'projected', bounds: [120, -45, 126, -10], unit: 'meter' },
  { code: 7852, name: 'GDA2020 / MGA zone 52', type: 'projected', bounds: [126, -45, 132, -10], unit: 'meter' },
  { code: 7853, name: 'GDA2020 / MGA zone 53', type: 'projected', bounds: [132, -45, 138, -10], unit: 'meter' },
  { code: 7854, name: 'GDA2020 / MGA zone 54', type: 'projected', bounds: [138, -45, 144, -10], unit: 'meter' },
  { code: 7855, name: 'GDA2020 / MGA zone 55', type: 'projected', bounds: [144, -45, 150, -10], unit: 'meter' },
  { code: 7856, name: 'GDA2020 / MGA zone 56', type: 'projected', bounds: [150, -45, 156, -10], unit: 'meter' },

  // Europe
  { code: 4258, name: 'ETRS89', type: 'geographic', bounds: [-16, 32, 40, 84], unit: 'degree' },
  { code: 3035, name: 'ETRS89-extended / LAEA Europe', type: 'projected', bounds: [-16, 32, 40, 84], unit: 'meter' },
  { code: 25832, name: 'ETRS89 / UTM zone 32N', type: 'projected', bounds: [6, 38, 12, 84], unit: 'meter' },
  { code: 25833, name: 'ETRS89 / UTM zone 33N', type: 'projected', bounds: [12, 38, 18, 84], unit: 'meter' },
  { code: 27700, name: 'OSGB 1936 / British National Grid', type: 'projected', bounds: [-8, 49, 2, 61], unit: 'meter' },
  { code: 2154, name: 'RGF93 / Lambert-93', type: 'projected', bounds: [-10, 41, 10, 52], unit: 'meter' },

  // North America
  { code: 2163, name: 'US National Atlas Equal Area', type: 'projected', bounds: [-180, 15, -50, 75], unit: 'meter' },
  { code: 5070, name: 'NAD83 / Conus Albers', type: 'projected', bounds: [-125, 24, -66, 50], unit: 'meter' },
  { code: 6350, name: 'NAD83(2011) / Conus Albers', type: 'projected', bounds: [-125, 24, -66, 50], unit: 'meter' },
  { code: 26910, name: 'NAD83 / UTM zone 10N', type: 'projected', bounds: [-126, 30, -120, 84], unit: 'meter' },
  { code: 26911, name: 'NAD83 / UTM zone 11N', type: 'projected', bounds: [-120, 30, -114, 84], unit: 'meter' },
  { code: 26912, name: 'NAD83 / UTM zone 12N', type: 'projected', bounds: [-114, 30, -108, 84], unit: 'meter' },
  { code: 26913, name: 'NAD83 / UTM zone 13N', type: 'projected', bounds: [-108, 30, -102, 84], unit: 'meter' },
  { code: 26914, name: 'NAD83 / UTM zone 14N', type: 'projected', bounds: [-102, 30, -96, 84], unit: 'meter' },
  { code: 26915, name: 'NAD83 / UTM zone 15N', type: 'projected', bounds: [-96, 30, -90, 84], unit: 'meter' },
  { code: 26916, name: 'NAD83 / UTM zone 16N', type: 'projected', bounds: [-90, 30, -84, 84], unit: 'meter' },
  { code: 26917, name: 'NAD83 / UTM zone 17N', type: 'projected', bounds: [-84, 30, -78, 84], unit: 'meter' },
  { code: 26918, name: 'NAD83 / UTM zone 18N', type: 'projected', bounds: [-78, 30, -72, 84], unit: 'meter' },
  { code: 26919, name: 'NAD83 / UTM zone 19N', type: 'projected', bounds: [-72, 30, -66, 84], unit: 'meter' },
  { code: 3978, name: 'NAD83 / Canada Atlas Lambert', type: 'projected', bounds: [-141, 40, -50, 90], unit: 'meter' },

  // South America
  { code: 4674, name: 'SIRGAS 2000', type: 'geographic', bounds: [-122, -60, -25, 16], unit: 'degree' },
  { code: 31983, name: 'SIRGAS 2000 / UTM zone 23S', type: 'projected', bounds: [-48, -34, -42, 6], unit: 'meter' },
  { code: 31984, name: 'SIRGAS 2000 / UTM zone 24S', type: 'projected', bounds: [-42, -34, -36, 6], unit: 'meter' },
  { code: 5880, name: 'SIRGAS 2000 / Brazil Polyconic', type: 'projected', bounds: [-74, -35, -28, 6], unit: 'meter' },

  // Africa
  { code: 32736, name: 'WGS 84 / UTM zone 36S', type: 'projected', bounds: [30, -80, 36, 0], unit: 'meter' },
  { code: 32737, name: 'WGS 84 / UTM zone 37S', type: 'projected', bounds: [36, -80, 42, 0], unit: 'meter' },
  { code: 22234, name: 'Cape / Lo23', type: 'projected', bounds: [22, -35, 24, -22], unit: 'meter' },

  // Asia
  { code: 4612, name: 'JGD2000', type: 'geographic', bounds: [122, 20, 154, 46], unit: 'degree' },
  { code: 2451, name: 'JGD2000 / Japan Plane Rectangular CS IX', type: 'projected', bounds: [139, 35, 141, 37], unit: 'meter' },
  { code: 4490, name: 'CGCS2000', type: 'geographic', bounds: [73, 15, 135, 55], unit: 'degree' },
  { code: 4214, name: 'Beijing 1954', type: 'geographic', bounds: [73, 15, 135, 55], unit: 'degree' },

  // New Zealand
  { code: 2193, name: 'NZGD2000 / New Zealand Transverse Mercator 2000', type: 'projected', bounds: [166, -48, 179, -34], unit: 'meter' },
  { code: 4167, name: 'NZGD2000', type: 'geographic', bounds: [166, -48, 179, -34], unit: 'degree' },

  // Polar regions
  { code: 3031, name: 'WGS 84 / Antarctic Polar Stereographic', type: 'projected', bounds: [-180, -90, 180, -60], unit: 'meter' },
  { code: 3995, name: 'WGS 84 / Arctic Polar Stereographic', type: 'projected', bounds: [-180, 60, 180, 90], unit: 'meter' },

  // Mining & Local (common in resource industries)
  { code: 32648, name: 'WGS 84 / UTM zone 48N', type: 'projected', bounds: [102, 0, 108, 84], unit: 'meter' },
  { code: 32647, name: 'WGS 84 / UTM zone 47N', type: 'projected', bounds: [96, 0, 102, 84], unit: 'meter' },
  { code: 32746, name: 'WGS 84 / UTM zone 46S', type: 'projected', bounds: [90, -80, 96, 0], unit: 'meter' },
  { code: 32747, name: 'WGS 84 / UTM zone 47S', type: 'projected', bounds: [96, -80, 102, 0], unit: 'meter' },
  { code: 32748, name: 'WGS 84 / UTM zone 48S', type: 'projected', bounds: [102, -80, 108, 0], unit: 'meter' },
];

// Build index for fast lookup
const codeIndex = new Map();
EPSG_DATABASE.forEach(crs => codeIndex.set(crs.code, crs));

/**
 * CRS Registry - Searchable EPSG database
 */
export const crs = {
  /**
   * Get CRS info by EPSG code
   * @param {number|string} code - EPSG code (e.g., 4326 or 'EPSG:4326')
   * @returns {Object|null} CRS definition or null if not found
   */
  get(code) {
    const numCode = typeof code === 'string' ? parseInt(code.replace(/^EPSG:/i, '')) : code;
    return codeIndex.get(numCode) || null;
  },

  /**
   * Check if EPSG code exists in database
   * @param {number|string} code - EPSG code
   * @returns {boolean}
   */
  exists(code) {
    return this.get(code) !== null;
  },

  /**
   * Search for CRS by name or code
   * @param {string} query - Search query (name or code)
   * @param {Object} [options] - Search options
   * @param {string} [options.type] - Filter by type: 'geographic' or 'projected'
   * @param {number} [options.limit=20] - Max results
   * @returns {Array} Matching CRS definitions
   */
  search(query, options = {}) {
    const q = String(query).toLowerCase();
    const limit = options.limit || 20;
    const typeFilter = options.type;

    const results = [];

    for (const crs of EPSG_DATABASE) {
      if (typeFilter && crs.type !== typeFilter) continue;

      // Match by code
      if (String(crs.code).includes(q)) {
        results.push({ ...crs, matchType: 'code' });
        if (results.length >= limit) break;
        continue;
      }

      // Match by name
      if (crs.name.toLowerCase().includes(q)) {
        results.push({ ...crs, matchType: 'name' });
        if (results.length >= limit) break;
      }
    }

    // Sort: exact code match first, then by relevance
    results.sort((a, b) => {
      if (a.matchType === 'code' && b.matchType !== 'code') return -1;
      if (b.matchType === 'code' && a.matchType !== 'code') return 1;
      return 0;
    });

    return results;
  },

  /**
   * List all available CRS codes
   * @param {Object} [options] - Filter options
   * @param {string} [options.type] - Filter by type
   * @returns {Array}
   */
  list(options = {}) {
    if (options.type) {
      return EPSG_DATABASE.filter(crs => crs.type === options.type);
    }
    return [...EPSG_DATABASE];
  },

  /**
   * Suggest appropriate CRS for a given extent
   * @param {number[]} extent - [minLon, minLat, maxLon, maxLat] in WGS84
   * @param {Object} [options] - Options
   * @param {string} [options.type] - Prefer 'geographic' or 'projected'
   * @param {number} [options.limit=5] - Max suggestions
   * @returns {Array} Suggested CRS definitions, sorted by suitability
   */
  suggest(extent, options = {}) {
    const [minLon, minLat, maxLon, maxLat] = extent;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const limit = options.limit || 5;
    const typeFilter = options.type;

    const candidates = [];

    for (const crs of EPSG_DATABASE) {
      if (typeFilter && crs.type !== typeFilter) continue;

      const [crsMinLon, crsMinLat, crsMaxLon, crsMaxLat] = crs.bounds;

      // Check if center point is within CRS bounds
      if (centerLon >= crsMinLon && centerLon <= crsMaxLon &&
          centerLat >= crsMinLat && centerLat <= crsMaxLat) {

        // Calculate how well the extent fits within CRS bounds
        const overlapMinLon = Math.max(minLon, crsMinLon);
        const overlapMinLat = Math.max(minLat, crsMinLat);
        const overlapMaxLon = Math.min(maxLon, crsMaxLon);
        const overlapMaxLat = Math.min(maxLat, crsMaxLat);

        const overlapArea = Math.max(0, overlapMaxLon - overlapMinLon) *
                           Math.max(0, overlapMaxLat - overlapMinLat);
        const extentArea = (maxLon - minLon) * (maxLat - minLat);
        const coverage = extentArea > 0 ? overlapArea / extentArea : 0;

        // Calculate how specific the CRS is (smaller bounds = more specific = better for local data)
        const crsArea = (crsMaxLon - crsMinLon) * (crsMaxLat - crsMinLat);
        const specificity = 1 / (1 + crsArea / 1000);

        // Score: prefer high coverage + specific CRS + projected CRS
        let score = coverage * 0.5 + specificity * 0.3;
        if (crs.type === 'projected') score += 0.2;

        candidates.push({ ...crs, score, coverage });
      }
    }

    // Sort by score (best first)
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, limit);
  },

  /**
   * Guess the best CRS for a layer based on its extent
   * @param {Object} layer - Layer object with extent or bbox method
   * @param {Object} [options] - Options (same as suggest)
   * @returns {Object|null} Best matching CRS or null
   */
  guess(layer, options = {}) {
    if (!layer) return null;

    // Get extent from layer
    let extent;
    if (layer.bbox) {
      extent = layer.bbox();
    } else if (layer.extent) {
      extent = typeof layer.extent === 'function' ? layer.extent() : layer.extent;
    } else if (layer._metadata?.extent) {
      extent = layer._metadata.extent;
    }

    if (!extent || extent.length !== 4) {
      return null;
    }

    const suggestions = this.suggest(extent, { ...options, limit: 1 });
    return suggestions[0] || null;
  },

  /**
   * Get UTM zone for a given longitude
   * @param {number} lon - Longitude in degrees
   * @param {boolean} [south=false] - Southern hemisphere
   * @returns {Object} CRS definition for the UTM zone
   */
  utmZone(lon, south = false) {
    // UTM zones are 6 degrees wide, zone 1 starts at -180
    const zone = Math.floor((lon + 180) / 6) + 1;
    const code = south ? 32700 + zone : 32600 + zone;

    // Check if we have it in database
    const existing = this.get(code);
    if (existing) return existing;

    // Generate basic info
    const minLon = (zone - 1) * 6 - 180;
    const maxLon = minLon + 6;

    return {
      code,
      name: `WGS 84 / UTM zone ${zone}${south ? 'S' : 'N'}`,
      type: 'projected',
      bounds: [minLon, south ? -80 : 0, maxLon, south ? 0 : 84],
      unit: 'meter'
    };
  },

  /**
   * Format EPSG code as string
   * @param {number|string} code - EPSG code
   * @returns {string} Formatted code (e.g., 'EPSG:4326')
   */
  format(code) {
    const numCode = typeof code === 'string' ? parseInt(code.replace(/^EPSG:/i, '')) : code;
    return `EPSG:${numCode}`;
  },

  /**
   * Parse EPSG code from various formats
   * @param {string|number} input - Input code ('EPSG:4326', '4326', 4326)
   * @returns {number|null} Numeric EPSG code or null if invalid
   */
  parse(input) {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
      const match = input.match(/^(?:EPSG:)?(\d+)$/i);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  },

  /**
   * Get count of CRS in database
   * @returns {number}
   */
  count() {
    return EPSG_DATABASE.length;
  },

  // === Current Map CRS State Management ===

  /**
   * Set the current map CRS
   * @param {string|number} code - EPSG code (e.g., 'EPSG:4326' or 4326)
   */
  setCurrent(code) {
    const formatted = typeof code === 'number' ? `EPSG:${code}` : code;
    state.crs = formatted;
    const statusEl = document.getElementById('status-crs');
    if (statusEl) statusEl.textContent = formatted;
    termPrint(`CRS set to ${formatted}`, 'green');
  },

  /**
   * Get the current map CRS
   * @returns {string} Current CRS code
   */
  current() {
    return state.crs;
  },

  /**
   * Transform/reproject a layer to a different CRS
   * @param {Object} layer - Layer to transform
   * @param {string} targetCrs - Target CRS code
   * @returns {Object} Transformed layer (placeholder - not yet implemented)
   */
  transform(layer, targetCrs) {
    termPrint('CRS transform not yet implemented', 'yellow');
    return layer;
  },
};

/**
 * Terminal command: Search EPSG codes
 * Usage: epsg('utm') or epsg(4326)
 */
export function epsg(query) {
  if (!query) {
    termPrint(`EPSG database: ${crs.count()} codes`, 'cyan');
    termPrint('Usage: epsg("search term") or epsg(code)', 'dim');
    termPrint('Examples: epsg("utm"), epsg("australia"), epsg(4326)', 'dim');
    return crs.list().slice(0, 10);
  }

  // Numeric lookup
  if (typeof query === 'number' || /^\d+$/.test(query)) {
    const result = crs.get(query);
    if (result) {
      termPrint(`EPSG:${result.code} - ${result.name}`, 'green');
      termPrint(`  Type: ${result.type}, Unit: ${result.unit}`, 'dim');
      termPrint(`  Bounds: [${result.bounds.join(', ')}]`, 'dim');
      return result;
    } else {
      termPrint(`EPSG:${query} not found in database`, 'yellow');
      return null;
    }
  }

  // Text search
  const results = crs.search(query, { limit: 15 });

  if (results.length === 0) {
    termPrint(`No CRS found matching "${query}"`, 'yellow');
    return [];
  }

  termPrint(`Found ${results.length} CRS matching "${query}":`, 'cyan');
  results.forEach(r => {
    termPrint(`  EPSG:${r.code} - ${r.name}`, r.type === 'projected' ? 'green' : 'default');
  });

  return results;
}

export default crs;
