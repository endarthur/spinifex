// Spinifex - Custom Color Ramps
// Functions for creating, managing, and using color ramps

import { COLOR_RAMPS } from './raster-layer.js';
import { termPrint } from '../ui/terminal.js';

// Track which ramps are custom (user-created) vs built-in
const customRampNames = new Set();

/**
 * Parse a color string or array into RGB array
 * @param {string|number[]} color - Hex string (#RRGGBB), RGB string, or RGB array
 * @returns {number[]} RGB array [r, g, b]
 */
export function parseColor(color) {
  if (Array.isArray(color)) {
    // Already RGB array
    return color.slice(0, 3).map(v => Math.round(Math.min(255, Math.max(0, v))));
  }

  if (typeof color === 'string') {
    // Hex color
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        // Short form #RGB
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16)
        ];
      } else if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    // RGB string like "rgb(255, 0, 0)"
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
    }

    // Named colors (basic)
    const namedColors = {
      red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
      white: [255, 255, 255], black: [0, 0, 0], yellow: [255, 255, 0],
      cyan: [0, 255, 255], magenta: [255, 0, 255], orange: [255, 165, 0],
      purple: [128, 0, 128], pink: [255, 192, 203], gray: [128, 128, 128],
      grey: [128, 128, 128]
    };
    if (namedColors[color.toLowerCase()]) {
      return namedColors[color.toLowerCase()];
    }
  }

  throw new Error(`Invalid color: ${color}`);
}

/**
 * Convert RGB array to hex string
 * @param {number[]} rgb - RGB array [r, g, b]
 * @returns {string} Hex color string
 */
export function rgbToHex(rgb) {
  return '#' + rgb.map(v => {
    const hex = Math.round(Math.min(255, Math.max(0, v))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Create a color ramp from an array of colors
 * Colors are evenly spaced between 0 and 1
 * @param {Array<string|number[]>} colors - Array of colors (hex strings or RGB arrays)
 * @param {number[]} [stops] - Optional custom stop positions (0-1), defaults to even spacing
 * @returns {Object} Color ramp object { stops, colors }
 */
export function createRamp(colors, stops = null) {
  if (!Array.isArray(colors) || colors.length < 2) {
    throw new Error('Color ramp requires at least 2 colors');
  }

  const parsedColors = colors.map(c => parseColor(c));

  // Generate evenly spaced stops if not provided
  const rampStops = stops || colors.map((_, i) => i / (colors.length - 1));

  if (rampStops.length !== parsedColors.length) {
    throw new Error('Number of stops must match number of colors');
  }

  return {
    stops: rampStops,
    colors: parsedColors
  };
}

/**
 * Add a custom color ramp
 * @param {string} name - Unique name for the ramp
 * @param {Array<string|number[]>|Object} colorsOrRamp - Array of colors or ramp object { stops, colors }
 * @param {number[]} [stops] - Optional stop positions if providing color array
 * @returns {Object} The created ramp
 */
export function addColorRamp(name, colorsOrRamp, stops = null) {
  if (!name || typeof name !== 'string') {
    throw new Error('Ramp name must be a non-empty string');
  }

  // Sanitize name
  const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  let ramp;
  if (colorsOrRamp && typeof colorsOrRamp === 'object' && !Array.isArray(colorsOrRamp)) {
    // Already a ramp object
    if (!colorsOrRamp.stops || !colorsOrRamp.colors) {
      throw new Error('Ramp object must have stops and colors arrays');
    }
    ramp = {
      stops: [...colorsOrRamp.stops],
      colors: colorsOrRamp.colors.map(c => parseColor(c))
    };
  } else {
    // Array of colors
    ramp = createRamp(colorsOrRamp, stops);
  }

  // Add to COLOR_RAMPS
  COLOR_RAMPS[safeName] = ramp;
  customRampNames.add(safeName);

  termPrint(`Added color ramp: ${safeName}`, 'green');
  return ramp;
}

/**
 * Remove a custom color ramp
 * @param {string} name - Name of the ramp to remove
 * @returns {boolean} True if removed, false if not found or is built-in
 */
export function removeColorRamp(name) {
  const safeName = name.toLowerCase();

  if (!customRampNames.has(safeName)) {
    termPrint(`Cannot remove '${name}': not a custom ramp`, 'yellow');
    return false;
  }

  delete COLOR_RAMPS[safeName];
  customRampNames.delete(safeName);
  termPrint(`Removed color ramp: ${safeName}`, 'dim');
  return true;
}

/**
 * Get a color ramp by name
 * @param {string} name - Ramp name
 * @returns {Object|null} The color ramp or null if not found
 */
export function getColorRamp(name) {
  return COLOR_RAMPS[name] || COLOR_RAMPS[name.toLowerCase()] || null;
}

/**
 * List all available color ramp names
 * @param {boolean} [customOnly=false] - If true, only return custom ramps
 * @returns {string[]} Array of ramp names
 */
export function listColorRamps(customOnly = false) {
  if (customOnly) {
    return [...customRampNames];
  }
  return Object.keys(COLOR_RAMPS);
}

/**
 * Check if a ramp is custom (user-created)
 * @param {string} name - Ramp name
 * @returns {boolean} True if custom, false if built-in
 */
export function isCustomRamp(name) {
  return customRampNames.has(name.toLowerCase());
}

/**
 * Create a reversed copy of an existing ramp
 * @param {string} sourceName - Name of the source ramp
 * @param {string} [newName] - Name for the reversed ramp (defaults to sourceName + '_r')
 * @returns {Object} The new reversed ramp
 */
export function reverseRamp(sourceName, newName = null) {
  const source = getColorRamp(sourceName);
  if (!source) {
    throw new Error(`Color ramp not found: ${sourceName}`);
  }

  const targetName = newName || `${sourceName}_r`;

  const reversed = {
    stops: source.stops.map(s => 1 - s).reverse(),
    colors: [...source.colors].reverse()
  };

  return addColorRamp(targetName, reversed);
}

/**
 * Interpolate a color from a ramp at a given position
 * @param {string|Object} rampOrName - Ramp name or ramp object
 * @param {number} t - Position (0-1)
 * @returns {number[]} Interpolated RGB color
 */
export function interpolateColor(rampOrName, t) {
  const ramp = typeof rampOrName === 'string' ? getColorRamp(rampOrName) : rampOrName;
  if (!ramp) {
    return [128, 128, 128]; // Default gray
  }

  // Clamp t to 0-1
  t = Math.max(0, Math.min(1, t));

  const { stops, colors } = ramp;

  // Find the two stops we're between
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1]) {
      const range = stops[i + 1] - stops[i];
      const localT = range > 0 ? (t - stops[i]) / range : 0;

      // Linear interpolation between colors
      const c1 = colors[i];
      const c2 = colors[i + 1];
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * localT),
        Math.round(c1[1] + (c2[1] - c1[1]) * localT),
        Math.round(c1[2] + (c2[2] - c1[2]) * localT)
      ];
    }
  }

  // Return last color if t >= 1
  return [...colors[colors.length - 1]];
}

/**
 * Generate a color palette (array of colors) from a ramp
 * @param {string|Object} rampOrName - Ramp name or ramp object
 * @param {number} n - Number of colors to generate
 * @returns {number[][]} Array of RGB colors
 */
export function generatePalette(rampOrName, n = 10) {
  const palette = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    palette.push(interpolateColor(rampOrName, t));
  }
  return palette;
}

/**
 * Generate hex color palette from a ramp
 * @param {string|Object} rampOrName - Ramp name or ramp object
 * @param {number} n - Number of colors to generate
 * @returns {string[]} Array of hex color strings
 */
export function generatePaletteHex(rampOrName, n = 10) {
  return generatePalette(rampOrName, n).map(rgb => rgbToHex(rgb));
}

/**
 * Create common scientific color ramps
 */
export const colorScales = {
  /**
   * Create a sequential single-hue ramp
   * @param {string} hue - Base hue (hex or color name)
   * @param {boolean} [light=true] - If true, light to dark; if false, dark to light
   * @returns {Object} Color ramp
   */
  sequential(hue, light = true) {
    const base = parseColor(hue);
    const colors = light ? [
      [255, 255, 255],
      base.map(v => Math.round(v * 0.25 + 192)),
      base.map(v => Math.round(v * 0.5 + 127)),
      base.map(v => Math.round(v * 0.75 + 64)),
      base
    ] : [
      base,
      base.map(v => Math.round(v * 0.75 + 64)),
      base.map(v => Math.round(v * 0.5 + 127)),
      base.map(v => Math.round(v * 0.25 + 192)),
      [255, 255, 255]
    ];
    return createRamp(colors);
  },

  /**
   * Create a diverging ramp with a neutral center
   * @param {string} lowColor - Color for low values
   * @param {string} highColor - Color for high values
   * @param {string} [midColor='#ffffff'] - Color for middle value
   * @returns {Object} Color ramp
   */
  diverging(lowColor, highColor, midColor = '#ffffff') {
    return createRamp([lowColor, midColor, highColor], [0, 0.5, 1]);
  },

  /**
   * Create a categorical/qualitative ramp
   * @param {number} n - Number of distinct colors needed
   * @returns {Object} Color ramp with distinct colors
   */
  categorical(n = 8) {
    // Use golden angle for maximally distinct hues
    const colors = [];
    for (let i = 0; i < n; i++) {
      const hue = (i * 137.508) % 360;
      const sat = 0.65 + (i % 3) * 0.1;
      const light = 0.45 + (i % 2) * 0.15;
      colors.push(hslToRgb(hue, sat, light));
    }
    return createRamp(colors);
  }
};

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {number[]} RGB array
 */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Export custom ramps for workspace saving
 * @returns {Object} Custom ramps data
 */
export function exportCustomRamps() {
  const data = {};
  for (const name of customRampNames) {
    data[name] = COLOR_RAMPS[name];
  }
  return data;
}

/**
 * Import custom ramps from workspace data
 * @param {Object} data - Custom ramps data
 */
export function importCustomRamps(data) {
  if (!data || typeof data !== 'object') return;

  for (const [name, ramp] of Object.entries(data)) {
    if (ramp && ramp.stops && ramp.colors) {
      COLOR_RAMPS[name] = ramp;
      customRampNames.add(name);
    }
  }
}
