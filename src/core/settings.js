// Spinifex - Runtime Configuration (rc) and Persistent Settings
// Like matplotlib's rcParams - settings accessible via REPL
// Access via: rc.terrain.autoDetectCRS or rc['terrain.autoDetectCRS']

import { termPrint } from '../ui/terminal.js';
import { events } from './events.js';

/**
 * Default settings
 */
const defaults = {
  // Terrain analysis
  'terrain.autoDetectCRS': true,       // Auto-detect geographic vs projected
  'terrain.assumeProjected': false,    // Force projected (meters) interpretation
  'terrain.defaultAzimuth': 315,       // Hillshade light direction (NW)
  'terrain.defaultAltitude': 45,       // Hillshade light angle
  'terrain.defaultZFactor': 1,         // Vertical exaggeration

  // Raster display
  'raster.defaultColorRamp': 'viridis',
  'raster.defaultStretchType': 'minmax',  // 'minmax', 'stddev', 'percent'
  'raster.stddevStretch': 2,              // Number of std devs for stretch

  // Map
  'map.defaultBasemap': 'osm',
  'map.animationDuration': 500,        // Zoom/pan animation ms

  // Terminal
  'terminal.maxOutputLines': 100,
  'terminal.truncateStrings': 60,      // Max string length in output

  // Export
  'export.defaultFormat': 'geojson',
  'export.geotiffCompression': 'lzw',
};

/**
 * Current settings (initialized from defaults)
 */
const settings = { ...defaults };

/**
 * Create the rc proxy object for dot-notation and bracket access
 * Supports: rc.terrain.autoDetectCRS, rc['terrain.autoDetectCRS'], rc.terrain['autoDetectCRS']
 */
function createRcProxy() {
  // Group settings by prefix for nested access
  const getGroups = () => {
    const groups = {};
    for (const key of Object.keys(settings)) {
      const [group] = key.split('.');
      if (!groups[group]) groups[group] = [];
      groups[group].push(key);
    }
    return groups;
  };

  // Create nested proxy for a group (e.g., rc.terrain)
  const createGroupProxy = (groupName) => {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === Symbol.toStringTag) return 'RcGroup';
        if (prop === 'toString' || prop === Symbol.toPrimitive) {
          return () => {
            const groupKeys = Object.keys(settings).filter(k => k.startsWith(groupName + '.'));
            return `{${groupKeys.map(k => `${k.split('.')[1]}: ${settings[k]}`).join(', ')}}`;
          };
        }
        const fullKey = `${groupName}.${String(prop)}`;
        if (fullKey in settings) {
          return settings[fullKey];
        }
        return undefined;
      },
      set(_, prop, value) {
        const fullKey = `${groupName}.${String(prop)}`;
        if (fullKey in settings) {
          const oldValue = settings[fullKey];
          settings[fullKey] = value;
          termPrint(`rc.${fullKey} = ${value} (was ${oldValue})`, 'dim');
          return true;
        }
        termPrint(`Unknown setting: ${fullKey}`, 'red');
        return false;
      },
      ownKeys() {
        return Object.keys(settings)
          .filter(k => k.startsWith(groupName + '.'))
          .map(k => k.split('.')[1]);
      },
      getOwnPropertyDescriptor(_, prop) {
        const fullKey = `${groupName}.${String(prop)}`;
        if (fullKey in settings) {
          return { enumerable: true, configurable: true, value: settings[fullKey] };
        }
        return undefined;
      }
    });
  };

  return new Proxy({}, {
    get(_, prop) {
      // Special methods
      if (prop === Symbol.toStringTag) return 'Rc';
      if (prop === 'toString' || prop === Symbol.toPrimitive) {
        return () => '[Spinifex rc - use rc.list() to see all settings]';
      }

      // List all settings
      if (prop === 'list') {
        return () => {
          termPrint('Spinifex Runtime Configuration:', 'cyan');
          termPrint('');
          const groups = getGroups();
          for (const [group, keys] of Object.entries(groups)) {
            termPrint(`[${group}]`, 'yellow');
            for (const key of keys) {
              const shortKey = key.split('.')[1];
              const val = settings[key];
              const def = defaults[key];
              const changed = val !== def ? ' *' : '';
              termPrint(`  ${shortKey}: ${val}${changed}`);
            }
          }
          termPrint('');
          termPrint('(* = changed from default)', 'dim');
        };
      }

      // Reset to defaults
      if (prop === 'reset') {
        return (key) => {
          if (key) {
            if (key in defaults) {
              settings[key] = defaults[key];
              termPrint(`Reset: ${key} = ${defaults[key]}`, 'green');
            } else {
              termPrint(`Unknown setting: ${key}`, 'red');
            }
          } else {
            Object.assign(settings, defaults);
            termPrint('All settings reset to defaults', 'green');
          }
        };
      }

      // Get raw settings object
      if (prop === '_settings') return settings;
      if (prop === '_defaults') return defaults;

      // Bracket access with full key: rc['terrain.autoDetectCRS']
      if (typeof prop === 'string' && prop.includes('.')) {
        return settings[prop];
      }

      // Nested access: rc.terrain -> returns group proxy
      const groups = getGroups();
      if (prop in groups) {
        return createGroupProxy(prop);
      }

      return undefined;
    },

    set(_, prop, value) {
      // Full key: rc['terrain.autoDetectCRS'] = false
      if (typeof prop === 'string' && prop.includes('.')) {
        if (prop in settings) {
          const oldValue = settings[prop];
          settings[prop] = value;
          termPrint(`rc['${prop}'] = ${value} (was ${oldValue})`, 'dim');
          return true;
        }
        termPrint(`Unknown setting: ${prop}`, 'red');
        return false;
      }
      termPrint(`Use full key: rc['group.setting'] = value`, 'yellow');
      return false;
    },

    ownKeys() {
      return [...new Set(Object.keys(settings).map(k => k.split('.')[0]))];
    },

    getOwnPropertyDescriptor(_, prop) {
      const groups = getGroups();
      if (prop in groups) {
        return { enumerable: true, configurable: true, value: createGroupProxy(prop) };
      }
      return undefined;
    }
  });
}

export const rc = createRcProxy();

/**
 * Get a setting value (for internal use)
 */
export function getSetting(key) {
  return settings[key];
}

/**
 * Check if a setting exists
 */
export function hasSetting(key) {
  return key in settings;
}

// ============================================================================
// Persistent Settings API
// ============================================================================
// Unlike rc (runtime config with predefined keys), this is a general-purpose
// key-value store persisted to localStorage. Use for:
// - Tool defaults and presets
// - Plugin settings
// - UI preferences
// - History tracking

const STORAGE_KEY = 'sp_settings';

/**
 * Load settings from localStorage
 */
function loadPersistedSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('[Settings] Failed to load:', e);
    return {};
  }
}

/**
 * Save settings to localStorage
 */
function savePersistedSettings(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[Settings] Failed to save:', e);
  }
}

/**
 * Persistent settings API
 */
export const persistentSettings = {
  /**
   * Get a value by key (supports dot-notation)
   * @param {string} key - Dot-notated key like 'tools.buffer.distance'
   * @param {*} defaultValue - Value to return if key doesn't exist
   * @returns {*} The stored value or defaultValue
   */
  get(key, defaultValue = null) {
    const data = loadPersistedSettings();
    const keys = key.split('.');
    let current = data;

    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[k];
    }

    return current !== undefined ? current : defaultValue;
  },

  /**
   * Set a value by key (supports dot-notation)
   * @param {string} key - Dot-notated key
   * @param {*} value - Value to store
   */
  set(key, value) {
    const data = loadPersistedSettings();
    const keys = key.split('.');
    const last = keys.pop();

    let current = data;
    for (const k of keys) {
      if (current[k] === undefined || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[last] = value;
    savePersistedSettings(data);

    // Emit change event
    events.emit('settings:changed', key, value);
  },

  /**
   * Remove a key
   * @param {string} key - Dot-notated key
   */
  remove(key) {
    const data = loadPersistedSettings();
    const keys = key.split('.');
    const last = keys.pop();

    let current = data;
    for (const k of keys) {
      if (current[k] === undefined || typeof current[k] !== 'object') {
        return; // Key doesn't exist
      }
      current = current[k];
    }

    if (current && last in current) {
      delete current[last];
      savePersistedSettings(data);
    }
  },

  /**
   * Get all settings under a namespace
   * @param {string} namespace - Top-level key
   * @returns {Object} All settings under that namespace
   */
  getNamespace(namespace) {
    const data = loadPersistedSettings();
    return data[namespace] || {};
  },

  /**
   * Clear all settings under a namespace
   * @param {string} namespace - Top-level key
   */
  clearNamespace(namespace) {
    const data = loadPersistedSettings();
    delete data[namespace];
    savePersistedSettings(data);
  },

  /**
   * Listen for changes to a key or namespace
   * @param {string} keyPrefix - Key or prefix to watch
   * @param {Function} callback - Called with (value, key) on change
   * @returns {Function} Unsubscribe function
   */
  onChange(keyPrefix, callback) {
    return events.on('settings:changed', (changedKey, value) => {
      if (changedKey === keyPrefix || changedKey.startsWith(keyPrefix + '.')) {
        callback(value, changedKey);
      }
    });
  },

  /**
   * Clear all persistent settings
   */
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.settings = persistentSettings;
}
