/**
 * xterm-kit: Theming System
 * Configurable color themes for terminal output
 *
 * Provides global theme management and multiple built-in themes.
 * All xterm-kit components respect the global theme by default.
 */

/**
 * Default theme - standard terminal colors
 * Not project-specific, works anywhere
 */
export const defaultTheme = {
  colors: {
    error: (text) => `\x1b[31m${text}\x1b[0m`,       // red
    success: (text) => `\x1b[32m${text}\x1b[0m`,     // green
    warning: (text) => `\x1b[33m${text}\x1b[0m`,     // yellow
    info: (text) => `\x1b[90m${text}\x1b[0m`,        // gray
    primary: (text) => `\x1b[36m${text}\x1b[0m`,     // cyan
    highlight: (text) => `\x1b[7m${text}\x1b[0m`,    // inverse
    bold: (text) => `\x1b[1m${text}\x1b[0m`,         // bold
    dim: (text) => `\x1b[2m${text}\x1b[0m`,          // dim
  },
  pager: {
    prompt: '\x1b[7m-- More --\x1b[0m',              // inverse
    searchHighlight: (text) => `\x1b[7m${text}\x1b[0m`, // inverse
    percent: (text) => `\x1b[2m${text}\x1b[0m`,      // dim
  },
  indicators: {
    sys: '#00ff88',      // green
    disk: '#ff6b35',     // orange
    net: '#4a9eff',      // blue
    user: '#ffd700',     // gold
  },
  progress: {
    bar: '\x1b[32m',         // green bar
    background: '\x1b[90m',  // gray background
    spinner: '\x1b[36m',     // cyan spinner
  },
  table: {
    header: (text) => `\x1b[1m${text}\x1b[0m`,      // bold
    border: '\x1b[90m',                              // gray
  },
  box: {
    border: '\x1b[90m',      // gray borders
    title: (text) => `\x1b[1m${text}\x1b[0m`,       // bold title
  }
};

/**
 * Spinifex theme - earth tones for GIS work
 */
export const spinifexTheme = {
  colors: {
    error: (text) => `\x1b[31m${text}\x1b[0m`,           // red
    success: (text) => `\x1b[38;5;71m${text}\x1b[0m`,    // earthy green
    warning: (text) => `\x1b[38;5;214m${text}\x1b[0m`,   // amber
    info: (text) => `\x1b[90m${text}\x1b[0m`,            // gray
    primary: (text) => `\x1b[38;5;75m${text}\x1b[0m`,    // sky blue
    highlight: (text) => `\x1b[7m${text}\x1b[0m`,        // inverse
    bold: (text) => `\x1b[1m${text}\x1b[0m`,             // bold
    dim: (text) => `\x1b[2m${text}\x1b[0m`,              // dim
  },
  pager: {
    prompt: '\x1b[38;5;75m-- More --\x1b[0m',
    searchHighlight: (text) => `\x1b[48;5;75m\x1b[30m${text}\x1b[0m`,
    percent: (text) => `\x1b[2m${text}\x1b[0m`,
  },
  indicators: {
    sys: '#87af5f',      // earthy green
    disk: '#d7875f',     // terracotta
    net: '#5fafff',      // sky blue
    user: '#d7af5f',     // sand
  },
  progress: {
    bar: '\x1b[38;5;71m',        // earthy green bar
    background: '\x1b[90m',      // gray background
    spinner: '\x1b[38;5;75m',    // sky blue spinner
  },
  table: {
    header: (text) => `\x1b[1m\x1b[38;5;75m${text}\x1b[0m`,
    border: '\x1b[90m',
  },
  box: {
    border: '\x1b[38;5;240m',
    title: (text) => `\x1b[1m\x1b[38;5;75m${text}\x1b[0m`,
  }
};

// ============================================================================
// Global Theme Management
// ============================================================================

let currentTheme = defaultTheme;

/**
 * Set global theme for all xterm-kit components
 * @param {object} theme - Theme object
 */
export function setTheme(theme) {
  currentTheme = theme;
}

/**
 * Get current global theme
 * @returns {object} Current theme
 */
export function getTheme() {
  return currentTheme;
}

/**
 * Reset to default theme
 */
export function resetTheme() {
  currentTheme = defaultTheme;
}

/**
 * Create a custom theme by merging overrides with the default theme
 * @param {object} overrides - Theme properties to override
 * @returns {object} New theme object
 */
export function createTheme(overrides = {}) {
  return {
    colors: {
      ...defaultTheme.colors,
      ...(overrides.colors || {})
    },
    pager: {
      ...defaultTheme.pager,
      ...(overrides.pager || {})
    },
    indicators: {
      ...defaultTheme.indicators,
      ...(overrides.indicators || {})
    },
    progress: {
      ...defaultTheme.progress,
      ...(overrides.progress || {})
    },
    table: {
      ...defaultTheme.table,
      ...(overrides.table || {})
    },
    box: {
      ...defaultTheme.box,
      ...(overrides.box || {})
    }
  };
}
