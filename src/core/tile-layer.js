// Spinifex - TileLayer Class
// Extends BaseLayer for tile-based sources (XYZ, WMS, WMTS)

import { BaseLayer } from './base-layer.js';
import { state } from './state.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { updateLegendContent } from '../ui/windows.js';
import { termPrint } from '../ui/terminal.js';

// OpenLayers is loaded globally via CDN

let tileCounter = 0;

/**
 * TileLayer - tile-based layer (XYZ, WMS, WMTS)
 * Extends BaseLayer for consistent interface
 */
export class SpTileLayer extends BaseLayer {
  constructor(id, name, olLayer, config = {}) {
    super(id, name, olLayer, config.zIndex ?? 0);

    this._sourceType = config.sourceType || 'xyz';
    this._url = config.url || '';
    this._attribution = config.attribution || '';
    this._crs = config.crs || 'EPSG:3857';
    this._extent = config.extent || null;
    this._minZoom = config.minZoom;
    this._maxZoom = config.maxZoom;
    this._params = config.params || {};  // For WMS/WMTS
  }

  // ─────────────────────────────────────────────────────────────
  // Type identifier
  // ─────────────────────────────────────────────────────────────

  get type() { return 'tile'; }
  get sourceType() { return this._sourceType; }

  // ─────────────────────────────────────────────────────────────
  // Tile-specific getters
  // ─────────────────────────────────────────────────────────────

  get url() { return this._url; }
  get attribution() { return this._attribution; }
  get crs() { return this._crs; }

  // ─────────────────────────────────────────────────────────────
  // Extent handling
  // ─────────────────────────────────────────────────────────────

  /**
   * Get layer extent (if defined)
   * @returns {Array|null} [minX, minY, maxX, maxY] or null
   */
  extent() {
    return this._extent;
  }

  /**
   * Internal extent for zoom functionality
   * @protected
   */
  _getExtent() {
    return this._extent;
  }

  /**
   * Zoom to layer extent (if defined)
   */
  zoom() {
    const ext = this._getExtent();
    if (ext) {
      getMap().getView().fit(ext, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    } else {
      termPrint('No extent defined for this tile layer', 'yellow');
    }
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────

  toJSON() {
    return {
      name: this._name,
      type: 'tile',
      sourceType: this._sourceType,
      url: this._url,
      attribution: this._attribution,
      crs: this._crs,
      extent: this._extent,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      params: this._params,
      visible: this._visible,
      opacity: this._olLayer.getOpacity(),
      zIndex: this._zIndex,
      blendMode: this._blendMode,
    };
  }

  toString() {
    return `TileLayer<${this._name}> (${this._sourceType})`;
  }
}

/**
 * Create a tile layer from URL or options
 * @param {string|Object} urlOrOptions - XYZ URL template or options object
 * @param {string} [name] - Layer name (optional if using options object)
 * @returns {SpTileLayer}
 */
export function createTileLayer(urlOrOptions, name) {
  let config;

  if (typeof urlOrOptions === 'string') {
    config = {
      url: urlOrOptions,
      name: name || `tiles_${++tileCounter}`,
      type: 'xyz',
    };
  } else {
    config = { ...urlOrOptions };
    config.name = config.name || name || `tiles_${++tileCounter}`;
    config.type = config.type || 'xyz';
  }

  // Create appropriate OL source
  let source;
  const sourceType = config.type.toLowerCase();

  switch (sourceType) {
    case 'wms':
      source = new ol.source.TileWMS({
        url: config.url,
        params: config.params || {},
        crossOrigin: 'anonymous',
        attributions: config.attribution ? [config.attribution] : undefined,
      });
      break;

    case 'wmts':
      // WMTS requires more complex setup with capabilities
      // For now, treat as XYZ with a warning
      termPrint('WMTS support is limited - using as XYZ template', 'yellow');
      source = new ol.source.XYZ({
        url: config.url,
        crossOrigin: 'anonymous',
        attributions: config.attribution ? [config.attribution] : undefined,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
      });
      break;

    case 'xyz':
    default:
      source = new ol.source.XYZ({
        url: config.url,
        crossOrigin: 'anonymous',
        attributions: config.attribution ? [config.attribution] : undefined,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
      });
      break;
  }

  // Create OL tile layer
  const olLayer = new ol.layer.Tile({
    source,
    opacity: config.opacity ?? 1,
    visible: config.visible ?? true,
    zIndex: config.zIndex ?? 0,
  });

  // Generate unique ID
  const id = `tile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create our layer wrapper
  const layer = new SpTileLayer(id, config.name, olLayer, {
    sourceType,
    url: config.url,
    attribution: config.attribution,
    crs: config.crs || 'EPSG:3857',
    extent: config.extent,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    params: config.params,
    zIndex: config.zIndex ?? 0,
  });

  // Add to map
  getMap().addLayer(olLayer);

  // Add to state
  state.layers.set(id, layer);

  // Add to ly namespace
  import('./api.js').then(({ ly }) => {
    ly[config.name] = layer;
  });

  // Update UI
  updateLayerPanel();
  updateLegendContent();

  termPrint(`Tile layer: ${config.name}`, 'green');

  return layer;
}
