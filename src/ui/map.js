// Spinifex - Map Module
// OpenLayers map initialization and interactions

import { state } from '../core/state.js';
import { termPrint } from './terminal.js';
import { BasemapLayer } from '../core/basemap-layer.js';
import { updateLayerPanel } from './layers-panel.js';

// Map instance - will be initialized in init()
let _map = null;

// Counter for unique basemap IDs
let _basemapCounter = 0;

// Available basemaps
// Only includes services that are free with attribution (no API key required)
const BASEMAPS = {
  // === CartoDB (Carto) - CC BY 3.0 ===
  dark: {
    url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© CartoDB © OpenStreetMap',
    group: 'carto',
    label: 'Dark Matter'
  },
  light: {
    url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '© CartoDB © OpenStreetMap',
    group: 'carto',
    label: 'Positron'
  },
  voyager: {
    url: 'https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '© CartoDB © OpenStreetMap',
    group: 'carto',
    label: 'Voyager'
  },

  // === OpenStreetMap - ODbL ===
  osm: {
    url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    group: 'osm',
    label: 'OpenStreetMap'
  },
  topo: {
    url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap, OpenStreetMap',
    group: 'osm',
    label: 'OpenTopoMap'
  },

  // === Stamen (via Stadia) - ODbL ===
  // Stadia hosts Stamen tiles, free tier available without key
  'stamen-toner': {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap',
    group: 'stamen',
    label: 'Toner'
  },
  'stamen-toner-lite': {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap',
    group: 'stamen',
    label: 'Toner Lite'
  },
  'stamen-terrain': {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap',
    group: 'stamen',
    label: 'Terrain'
  },
  'stamen-watercolor': {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap',
    group: 'stamen',
    label: 'Watercolor'
  },

  // === ESRI - Free for non-commercial ===
  // Widely used without auth, tolerated for light use
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    group: 'esri',
    label: 'Satellite'
  },
  'esri-topo': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    group: 'esri',
    label: 'World Topo'
  },
  'esri-street': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    group: 'esri',
    label: 'World Street'
  },

  // === None ===
  none: null
};

// Group labels for menu organization
const BASEMAP_GROUPS = {
  carto: 'CartoDB',
  osm: 'OpenStreetMap',
  stamen: 'Stamen',
  esri: 'ESRI'
};

// Getter for map instance (avoids circular dependency issues)
export function getMap() {
  return _map;
}

// For backwards compatibility
export { _map as map };

// Popup elements
let popupEl = null;
let popupContent = null;
let popup = null;

// Current basemap info (for reference and serialization)
let _currentBasemap = 'dark';
let _currentBasemapConfig = null;  // For custom basemaps: { url, attribution }

// LocalStorage key for custom basemaps
const CUSTOM_BASEMAPS_KEY = 'spinifex-custom-basemaps';

/**
 * Get saved custom basemaps from localStorage
 */
export function getCustomBasemaps() {
  try {
    const stored = localStorage.getItem(CUSTOM_BASEMAPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a custom basemap to localStorage
 */
function saveCustomBasemap(url, attribution, name) {
  const customs = getCustomBasemaps();
  // Check if already exists (by URL)
  const existing = customs.findIndex(c => c.url === url);
  if (existing >= 0) {
    // Update existing
    customs[existing] = { url, attribution, name: name || customs[existing].name };
  } else {
    // Add new (keep last 10)
    customs.unshift({ url, attribution, name: name || 'Custom' });
    if (customs.length > 10) customs.pop();
  }
  localStorage.setItem(CUSTOM_BASEMAPS_KEY, JSON.stringify(customs));
}

/**
 * Remove a custom basemap from localStorage
 */
export function removeCustomBasemap(url) {
  const customs = getCustomBasemaps().filter(c => c.url !== url);
  localStorage.setItem(CUSTOM_BASEMAPS_KEY, JSON.stringify(customs));
}

/**
 * Get available basemaps organized by group
 */
export function getBasemaps() {
  return { basemaps: BASEMAPS, groups: BASEMAP_GROUPS };
}

/**
 * Get current basemap name
 */
export function getCurrentBasemap() {
  return _currentBasemap;
}

/**
 * Get current basemap config for serialization
 * Returns { name } for built-in, { name: 'custom', url, attribution } for custom
 */
export function getBasemapConfig() {
  if (_currentBasemap === 'custom' && _currentBasemapConfig) {
    return {
      name: 'custom',
      url: _currentBasemapConfig.url,
      attribution: _currentBasemapConfig.attribution
    };
  }
  return { name: _currentBasemap };
}

/**
 * Add a basemap layer by name or custom URL
 * Multiple basemaps can be added and will stack
 * @param {string} nameOrUrl - Basemap name (e.g., 'dark', 'satellite') or XYZ URL
 * @param {string} [attribution] - Attribution text (for custom URLs)
 * @returns {BasemapLayer} The created basemap layer
 */
export function setBasemap(nameOrUrl, attribution) {
  if (!_map) return null;

  // Handle 'none' - remove all basemaps
  if (nameOrUrl === 'none') {
    clearBasemaps();
    return null;
  }

  // Check if it's a URL (custom basemap)
  const isUrl = nameOrUrl.includes('://') || nameOrUrl.includes('{z}');

  let basemapConfig;
  let basemapKey;

  if (isUrl) {
    // Custom URL
    basemapKey = 'custom_' + (_basemapCounter++);
    basemapConfig = {
      url: nameOrUrl,
      attribution: attribution || 'Custom basemap',
      label: 'Custom',
      group: 'custom'
    };
    // Save custom basemaps for reuse
    saveCustomBasemap(nameOrUrl, attribution);
  } else {
    // Named basemap
    basemapConfig = BASEMAPS[nameOrUrl];
    basemapKey = nameOrUrl;

    if (basemapConfig === undefined) {
      termPrint(`Unknown basemap: ${nameOrUrl}`, 'red');
      const names = Object.keys(BASEMAPS).filter(k => k !== 'none');
      termPrint(`Available: ${names.join(', ')}`, 'dim');
      termPrint(`Or use a custom XYZ URL: basemap("https://...")`, 'dim');
      return null;
    }

    // Check if this basemap is already loaded
    for (const layer of state.layers.values()) {
      if (layer.isBasemap && layer.name === basemapKey) {
        termPrint(`Basemap already loaded. Use ly["${basemapKey}"].show() or .remove()`, 'yellow');
        return layer;
      }
    }
  }

  // Find lowest basemap z-index for proper stacking
  let minZ = -100;
  state.layers.forEach(l => {
    if (l.isBasemap) {
      const z = l.zIndex ? l.zIndex() : -100;
      if (z <= minZ) minZ = z - 1;
    }
  });

  // Create OpenLayers tile layer
  const olLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: basemapConfig.url,
      attributions: basemapConfig.attribution
    }),
    zIndex: minZ
  });

  // Add to map
  _map.addLayer(olLayer);

  // Create BasemapLayer wrapper
  const layerId = `basemap_${basemapKey}_${Date.now()}`;
  const layer = new BasemapLayer(layerId, basemapKey, olLayer, {
    ...basemapConfig,
    basemapKey: isUrl ? null : basemapKey,  // Store original key for loading
    zIndex: minZ
  });

  // Register in state
  state.layers.set(layerId, layer);

  // Add to ly namespace (accessible via ly["name"] or ly.name)
  import('../core/api.js').then(({ ly }) => {
    ly[basemapKey] = layer;
  });

  // Update tracking
  _currentBasemap = basemapKey;
  _currentBasemapConfig = isUrl ? { url: nameOrUrl, attribution } : null;

  updateLayerPanel();
  termPrint(`Added basemap: ${basemapConfig.label || basemapKey}`, 'green');

  return layer;
}

/**
 * Remove all basemap layers
 */
export function clearBasemaps() {
  const toRemove = [];
  state.layers.forEach((layer, id) => {
    if (layer.isBasemap) {
      toRemove.push(layer);
    }
  });

  toRemove.forEach(layer => layer.remove());

  _currentBasemap = 'none';
  _currentBasemapConfig = null;

  if (toRemove.length > 0) {
    termPrint(`Removed ${toRemove.length} basemap(s)`, 'dim');
  } else {
    termPrint('No basemaps to remove', 'dim');
  }
}

/**
 * List available basemaps in terminal
 */
export function listBasemaps() {
  termPrint('');
  termPrint('Available basemaps:', 'yellow');
  termPrint('');

  // Group by provider
  const byGroup = {};
  for (const [name, config] of Object.entries(BASEMAPS)) {
    if (config === null) continue;
    const group = config.group || 'other';
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push({ name, label: config.label });
  }

  for (const [group, items] of Object.entries(byGroup)) {
    const groupLabel = BASEMAP_GROUPS[group] || group;
    termPrint(`  ${groupLabel}:`, 'cyan');
    for (const { name, label } of items) {
      const current = name === _currentBasemap ? ' (current)' : '';
      termPrint(`    basemap("${name}")  ${label}${current}`);
    }
  }

  termPrint('');
  termPrint('  None:', 'cyan');
  termPrint('    basemap("none")  No basemap');

  // Show saved custom basemaps
  const customs = getCustomBasemaps();
  if (customs.length > 0) {
    termPrint('');
    termPrint('Saved Custom Basemaps:', 'yellow');
    for (const custom of customs) {
      const current = _currentBasemap === 'custom' && _currentBasemapConfig?.url === custom.url ? ' (current)' : '';
      const shortUrl = custom.url.length > 50 ? custom.url.slice(0, 47) + '...' : custom.url;
      termPrint(`  ${shortUrl}${current}`, 'dim');
    }
  }

  termPrint('');
  termPrint('Custom XYZ URL:', 'yellow');
  termPrint('  basemap("https://tiles.example.com/{z}/{x}/{y}.png", "© Attribution")');
  termPrint('');
}

/**
 * Initialize the OpenLayers map
 */
export function initMap() {
  // Middle mouse button panning (like QGIS)
  const middleMouseDragPan = new ol.interaction.DragPan({
    condition: function(event) {
      // Button 1 = middle mouse
      return event.originalEvent.button === 1;
    }
  });

  _map = new ol.Map({
    target: 'map',
    layers: [],  // Start empty, basemap added via setBasemap
    view: new ol.View({
      center: ol.proj.fromLonLat([117.5, -22.5]),  // Pilbara, WA
      zoom: 9
    }),
    controls: ol.control.defaults.defaults({ attribution: false }).extend([
      new ol.control.ScaleLine()
    ])
  });

  // Add middle mouse panning
  _map.addInteraction(middleMouseDragPan);

  // Add default basemap
  setBasemap('dark');

  // Setup popup
  popupEl = document.getElementById('popup');
  popupContent = document.getElementById('popup-content');

  popup = new ol.Overlay({
    element: popupEl,
    positioning: 'bottom-center',
    offset: [0, -10],
    autoPan: false
  });
  _map.addOverlay(popup);
  popupEl.style.display = 'none';

  // Track mouse position
  _map.on('pointermove', (evt) => {
    const coords = ol.proj.toLonLat(evt.coordinate);
    document.getElementById('status-coords').textContent =
      `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  });

  // Click to identify features
  _map.on('singleclick', (evt) => {
    const features = [];
    _map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      for (const [id, lyr] of state.layers) {
        if (lyr.olLayer === layer) {
          features.push({ feature, layerName: lyr.name });
          break;
        }
      }
    });

    if (features.length > 0) {
      let html = '';
      features.forEach(({ feature, layerName }) => {
        const props = feature.getProperties();
        html += `<div class="popup-title">${layerName}</div>`;
        for (const [key, val] of Object.entries(props)) {
          if (key === 'geometry') continue;
          html += `<div class="popup-row">
            <span class="popup-key">${key}</span>
            <span class="popup-value">${val}</span>
          </div>`;
        }
      });
      popupContent.innerHTML = html;
      popup.setPosition(evt.coordinate);
      popupEl.style.display = 'block';
    } else {
      closePopup();
    }
  });

  return _map;
}

/**
 * Close the popup overlay
 */
export function closePopup() {
  if (popup) {
    popup.setPosition(undefined);
  }
  if (popupEl) {
    popupEl.style.display = 'none';
  }
}

// Expose closePopup globally for onclick handler
window.closePopup = closePopup;
