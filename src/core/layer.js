// Spinifex - Layer Class
// Wrapper around OpenLayers layer with chainable API

import { state } from './state.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { getMap } from '../ui/map.js';
import { applyStyle } from './styling.js';
import { updateLegendContent } from '../ui/windows.js';

export class Layer {
  constructor(id, name, geojson, olLayer, source, zIndex) {
    this._id = id;
    this._name = name;
    this._geojson = geojson;
    this._olLayer = olLayer;
    this._source = source;
    this._visible = true;
    this._zIndex = zIndex || 0;
    // Source file info for project persistence
    this._sourcePath = null;    // e.g., "data/geology.geojson"
    this._sourceFormat = null;  // e.g., "geojson", "csv", "shapefile"
    if (this._olLayer) {
      this._olLayer.setZIndex(this._zIndex);
    }
  }

  get name() { return this._name; }
  get id() { return this._id; }
  get count() { return this._geojson.features.length; }
  get features() { return this._geojson.features; }
  get geojson() { return this._geojson; }
  get visible() { return this._visible; }
  get olLayer() { return this._olLayer; }
  get source() { return this._source; }
  get sourcePath() { return this._sourcePath; }
  get sourceFormat() { return this._sourceFormat; }

  setSource(path, format) {
    this._sourcePath = path;
    this._sourceFormat = format;
    return this;
  }

  get fields() {
    const f = this._geojson.features[0];
    return f ? Object.keys(f.properties) : [];
  }

  get geomType() {
    const f = this._geojson.features[0];
    return f ? f.geometry.type : null;
  }

  get extent() {
    const ext = this._source.getExtent();
    const min = ol.proj.toLonLat([ext[0], ext[1]]);
    const max = ol.proj.toLonLat([ext[2], ext[3]]);
    return { minX: min[0], minY: min[1], maxX: max[0], maxY: max[1] };
  }

  show() {
    this._olLayer.setVisible(true);
    this._visible = true;
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  hide() {
    this._olLayer.setVisible(false);
    this._visible = false;
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  zoom() {
    const extent = this._source.getExtent();
    getMap().getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
    return this;
  }

  style(opts) {
    // If called with no args, open properties window at style tab
    if (opts === undefined) {
      import('../ui/windows.js').then(({ openLayerProperties }) => {
        openLayerProperties(this, 'style');
      });
      return this;
    }
    applyStyle(this, opts);
    // Store style options for later retrieval (e.g., style modal)
    this._styleOpts = { ...(this._styleOpts || {}), ...opts };
    return this;
  }

  /**
   * Open layer properties window
   * @param {string} tab - Optional tab to open: 'info', 'fields', 'style', 'labels'
   */
  properties(tab = 'info') {
    import('../ui/windows.js').then(({ openLayerProperties }) => {
      openLayerProperties(this, tab);
    });
    return this;
  }

  /**
   * Get or set layer z-index (rendering order)
   * Higher z-index = rendered on top
   */
  zIndex(value) {
    if (value !== undefined) {
      this._zIndex = value;
      this._olLayer.setZIndex(value);
      updateLayerPanel();
      updateLegendContent();
      return this;
    }
    return this._zIndex;
  }

  /**
   * Move layer to top of render stack
   */
  bringToFront() {
    // Find highest z-index among all layers
    let maxZ = 0;
    state.layers.forEach(l => {
      const z = l.zIndex ? l.zIndex() : 0;
      if (z > maxZ) maxZ = z;
    });
    this.zIndex(maxZ + 1);
    return this;
  }

  /**
   * Move layer to bottom of render stack
   */
  sendToBack() {
    // Find lowest z-index among all layers
    let minZ = Infinity;
    state.layers.forEach(l => {
      const z = l.zIndex ? l.zIndex() : 0;
      if (z < minZ) minZ = z;
    });
    this.zIndex(minZ - 1);
    return this;
  }

  where(predicate) {
    const filtered = this._geojson.features.filter(predicate);
    const self = this;
    return {
      count: filtered.length,
      features: filtered,
      save(name) {
        // Import dynamically to avoid circular dependency
        return import('./api.js').then(({ load }) => {
          const fc = { type: 'FeatureCollection', features: filtered };
          return load(fc, name || `${self._name}_filtered`);
        });
      }
    };
  }

  remove() {
    getMap().removeLayer(this._olLayer);
    state.layers.delete(this._id);
    // Remove from API namespace
    import('./api.js').then(({ sp }) => {
      delete sp[this._name];
    });
    updateLayerPanel();
    updateLegendContent();
    return null;
  }

  stats(field) {
    const values = this._geojson.features
      .map(f => f.properties[field])
      .filter(v => typeof v === 'number');
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum,
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  toString() {
    return `Layer<${this._name}> (${this.count} ${this.geomType}s)`;
  }
}
