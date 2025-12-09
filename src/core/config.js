// Spinifex - Centralized Configuration
// All constants, defaults, and configuration in one place

/**
 * Color ramps for raster visualization
 * Each ramp has:
 * - stops: Array of normalized positions [0-1]
 * - colors: Array of RGB arrays [r, g, b]
 */
const colorRamps = Object.freeze({
  terrain: Object.freeze({
    stops: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
    colors: [
      [0, 97, 71], [86, 148, 75], [194, 185, 119],
      [179, 140, 90], [139, 90, 53], [200, 200, 200], [255, 255, 255]
    ]
  }),
  grayscale: Object.freeze({
    stops: [0, 1],
    colors: [[0, 0, 0], [255, 255, 255]]
  }),
  viridis: Object.freeze({
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]
  }),
  plasma: Object.freeze({
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]]
  }),
  inferno: Object.freeze({
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]]
  }),
  magma: Object.freeze({
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[0, 0, 4], [81, 18, 124], [183, 55, 121], [254, 159, 109], [252, 253, 191]]
  }),
  bluered: Object.freeze({
    stops: [0, 0.5, 1],
    colors: [[8, 29, 88], [255, 255, 255], [165, 0, 38]]
  }),
  bathymetry: Object.freeze({
    stops: [0, 0.3, 0.5, 0.7, 1],
    colors: [[8, 29, 88], [37, 116, 169], [134, 182, 131], [205, 178, 121], [170, 118, 72]]
  }),
  ndvi: Object.freeze({
    stops: [0, 0.2, 0.4, 0.6, 0.8, 1],
    colors: [[165, 0, 38], [215, 48, 39], [254, 224, 144], [166, 217, 106], [26, 152, 80], [0, 104, 55]]
  }),
  hot: Object.freeze({
    stops: [0, 0.33, 0.66, 1],
    colors: [[0, 0, 0], [230, 0, 0], [255, 210, 0], [255, 255, 255]]
  }),
  cool: Object.freeze({
    stops: [0, 0.5, 1],
    colors: [[0, 255, 255], [255, 0, 255], [255, 255, 255]]
  }),
  spectral: Object.freeze({
    stops: [0, 0.2, 0.4, 0.6, 0.8, 1],
    colors: [[94, 79, 162], [50, 136, 189], [171, 221, 164], [254, 224, 139], [244, 109, 67], [158, 1, 66]]
  })
});

/**
 * Blend modes for layer compositing
 */
const blendModes = Object.freeze([
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity'
]);

/**
 * Default values for various operations
 */
const defaults = Object.freeze({
  raster: Object.freeze({
    colorRamp: 'terrain',
    nodata: -32768,
    stretchType: 'minmax',
    stddevStretch: 2
  }),
  vector: Object.freeze({
    fillColor: '#3388ff',
    fillOpacity: 0.4,
    strokeColor: '#000000',
    strokeWidth: 1,
    strokeOpacity: 1,
    pointRadius: 6
  }),
  buffer: Object.freeze({
    segments: 8,
    units: 'm',
    endCapStyle: 'round'
  }),
  map: Object.freeze({
    basemap: 'osm',
    animationDuration: 500,
    maxZoom: 19,
    minZoom: 0
  }),
  export: Object.freeze({
    format: 'geojson',
    geotiffCompression: 'lzw'
  })
});

/**
 * Unit conversion factors (to meters for distance)
 */
const units = Object.freeze({
  distance: Object.freeze({
    m: 1,
    km: 1000,
    ft: 0.3048,
    mi: 1609.344,
    nmi: 1852,       // Nautical mile
    yd: 0.9144       // Yard
  }),
  area: Object.freeze({
    sqm: 1,
    sqkm: 1000000,
    ha: 10000,       // Hectare
    acre: 4046.86,
    sqft: 0.092903,
    sqmi: 2589988
  })
});

/**
 * UI configuration
 */
const ui = Object.freeze({
  panelWidth: 350,
  terminalHeight: 200,
  maxHistoryItems: 100,
  animationDuration: 200
});

/**
 * The main config object - frozen to prevent modification
 */
export const config = Object.freeze({
  colorRamps,
  blendModes,
  defaults,
  units,
  ui,

  /**
   * Get a color ramp by name
   * @param {string} name - Ramp name
   * @returns {Object|undefined} The color ramp or undefined
   */
  getColorRamp(name) {
    return colorRamps[name];
  },

  /**
   * Convert distance between units
   * @param {number} value - Value to convert
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @returns {number} Converted value
   */
  convertDistance(value, fromUnit, toUnit) {
    const fromFactor = units.distance[fromUnit];
    const toFactor = units.distance[toUnit];
    if (!fromFactor || !toFactor) {
      throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
    }
    // Convert to meters, then to target unit
    return (value * fromFactor) / toFactor;
  },

  /**
   * Convert area between units
   * @param {number} value - Value to convert
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @returns {number} Converted value
   */
  convertArea(value, fromUnit, toUnit) {
    const fromFactor = units.area[fromUnit];
    const toFactor = units.area[toUnit];
    if (!fromFactor || !toFactor) {
      throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
    }
    return (value * fromFactor) / toFactor;
  },

  /**
   * List available color ramp names
   * @returns {string[]}
   */
  listColorRamps() {
    return Object.keys(colorRamps);
  },

  /**
   * List available blend modes
   * @returns {string[]}
   */
  listBlendModes() {
    return [...blendModes];
  }
});

// Make available globally
if (typeof window !== 'undefined') {
  window.config = config;
}
