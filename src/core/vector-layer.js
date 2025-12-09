// Spinifex - Vector Layer Class
// Extends BaseLayer for vector (point, line, polygon) data

import { BaseLayer } from './base-layer.js';
import { state } from './state.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { applyStyle } from './styling.js';
import { updateLegendContent } from '../ui/windows.js';
import { termPrint } from '../ui/terminal.js';
import { events } from './events.js';

/**
 * Vector Layer class for GeoJSON-based layers
 */
export class VectorLayer extends BaseLayer {
  constructor(id, name, geojson, olLayer, source, zIndex) {
    super(id, name, olLayer, zIndex);

    this._geojson = geojson;
    this._source = source;
    this._styleOpts = null;
    this._labelStyle = null;

    // Assign IDs to features if missing
    this._geojson.features.forEach((f, i) => {
      if (!f.id) f.id = `feature_${i}_${Date.now()}`;
    });

    // Selection state (Set of feature IDs for efficient lookup)
    this._selection = new Set();
    this._selectionStyle = {
      fillColor: 'rgba(0, 255, 255, 0.4)',
      strokeColor: '#00ffff',
      strokeWidth: 2,
    };

    // Edit mode state
    this._editing = false;
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndoSteps = 50;

    // Vector-specific namespace
    this.v = new VectorMethods(this);
  }

  // ─────────────────────────────────────────────────────────────
  // Type identifier
  // ─────────────────────────────────────────────────────────────

  get type() { return 'vector'; }

  // ─────────────────────────────────────────────────────────────
  // Vector-specific getters
  // ─────────────────────────────────────────────────────────────

  get count() { return this._geojson.features.length; }
  get features() { return this._geojson.features; }
  get geojson() { return this._geojson; }
  get source() { return this._source; }

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

  // ─────────────────────────────────────────────────────────────
  // Override base methods
  // ─────────────────────────────────────────────────────────────

  _getExtent() {
    return this._source.getExtent();
  }

  /**
   * Apply style options to the layer
   */
  style(opts) {
    if (opts === undefined) {
      return this.properties('style');
    }
    applyStyle(this, opts);
    this._styleOpts = { ...(this._styleOpts || {}), ...opts };
    return this;
  }

  /**
   * Refresh layer display (re-apply current styling)
   */
  refresh() {
    if (this._styleOpts) {
      applyStyle(this, this._styleOpts);
    } else {
      this._source.changed();
    }
    return this;
  }

  /**
   * Open attribute table window
   */
  table() {
    import('../ui/windows.js').then(({ openAttributeTable }) => {
      openAttributeTable(this);
    });
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────

  /**
   * Get current selection (array of feature IDs)
   */
  get selection() {
    return [...this._selection];
  }

  /**
   * Get number of selected features
   */
  get selectedCount() {
    return this._selection.size;
  }

  /**
   * Alias for selectedCount (backward compatibility)
   */
  get selectionCount() {
    return this._selection.size;
  }

  /**
   * Check if any features are selected
   */
  get hasSelection() {
    return this._selection.size > 0;
  }

  /**
   * Select features by ID, index, array, or filter function
   * @param {string|number|Array|Function} selector - Feature ID, index, array, or filter function
   * @param {Object} options - { add: boolean } - Whether to add to existing selection
   */
  select(selector, options = {}) {
    const add = options.add || false;
    if (!add) this._selection.clear();

    if (typeof selector === 'string') {
      // Feature ID
      const feature = this._geojson.features.find(f => f.id === selector);
      if (feature) this._selection.add(feature.id);
    } else if (typeof selector === 'number') {
      // Index
      const feature = this._geojson.features[selector];
      if (feature) this._selection.add(feature.id);
    } else if (Array.isArray(selector)) {
      // Array of IDs or indices
      for (const item of selector) {
        if (typeof item === 'string') {
          const feature = this._geojson.features.find(f => f.id === item);
          if (feature) this._selection.add(feature.id);
        } else if (typeof item === 'number') {
          const feature = this._geojson.features[item];
          if (feature) this._selection.add(feature.id);
        } else if (item && item.id) {
          this._selection.add(item.id);
        }
      }
    } else if (typeof selector === 'function') {
      // Filter function
      for (const feature of this._geojson.features) {
        if (selector(feature)) {
          this._selection.add(feature.id);
        }
      }
    } else if (selector && selector.id) {
      // Feature object
      this._selection.add(selector.id);
    }

    this._updateSelectionStyle();
    this._emitSelectionChanged();
    return this;
  }

  /**
   * Deselect features
   * @param {string|number|Array} selector - Feature ID, index, or array
   */
  deselect(selector) {
    if (typeof selector === 'string') {
      this._selection.delete(selector);
    } else if (typeof selector === 'number') {
      const feature = this._geojson.features[selector];
      if (feature) this._selection.delete(feature.id);
    } else if (Array.isArray(selector)) {
      for (const item of selector) {
        if (typeof item === 'string') {
          this._selection.delete(item);
        } else if (typeof item === 'number') {
          const feature = this._geojson.features[item];
          if (feature) this._selection.delete(feature.id);
        } else if (item && item.id) {
          this._selection.delete(item.id);
        }
      }
    } else if (selector && selector.id) {
      this._selection.delete(selector.id);
    }

    this._updateSelectionStyle();
    this._emitSelectionChanged();
    return this;
  }

  /**
   * Toggle selection of a feature
   * @param {string|number} selector - Feature ID or index
   */
  toggleSelect(selector) {
    const id = typeof selector === 'number'
      ? this._geojson.features[selector]?.id
      : selector;

    if (id && this._selection.has(id)) {
      this._selection.delete(id);
    } else if (id) {
      this._selection.add(id);
    }

    this._updateSelectionStyle();
    this._emitSelectionChanged();
    return this;
  }

  /**
   * Select all features
   */
  selectAll() {
    for (const feature of this._geojson.features) {
      this._selection.add(feature.id);
    }
    this._updateSelectionStyle();
    this._emitSelectionChanged();
    return this;
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    if (this._selection.size > 0) {
      this._selection.clear();
      this._updateSelectionStyle();
      this._emitSelectionChanged();
    }
    return this;
  }

  /**
   * Invert selection (select unselected, deselect selected)
   */
  invertSelection() {
    const allIds = new Set(this._geojson.features.map(f => f.id));
    const newSelection = new Set([...allIds].filter(id => !this._selection.has(id)));
    this._selection = newSelection;
    this._updateSelectionStyle();
    this._emitSelectionChanged();
    return this;
  }

  /**
   * Check if a feature is selected
   * @param {string|number} selector - Feature ID or index
   * @returns {boolean}
   */
  isSelected(selector) {
    const id = typeof selector === 'number'
      ? this._geojson.features[selector]?.id
      : selector;
    return id ? this._selection.has(id) : false;
  }

  /**
   * Get selected features as GeoJSON array
   * @returns {Array} Array of GeoJSON features
   */
  getSelected() {
    return this._geojson.features.filter(f => this._selection.has(f.id));
  }

  /**
   * Alias for getSelected
   */
  getSelectedFeatures() {
    return this.getSelected();
  }

  /**
   * Set selection style
   * @param {Object} style - Style options
   */
  setSelectionStyle(style) {
    this._selectionStyle = { ...this._selectionStyle, ...style };
    this._updateSelectionStyle();
    return this;
  }

  /**
   * Update visual styling for selected features
   * @private
   */
  _updateSelectionStyle() {
    // Refresh the layer styling to apply selection highlighting
    if (this._styleOpts) {
      applyStyle(this, this._styleOpts);
    } else {
      this._source.changed();
    }
  }

  /**
   * Emit selection changed event
   * @private
   */
  _emitSelectionChanged() {
    events.emit('selection:changed', {
      layer: this,
      layerName: this._name,
      layerId: this._id,
      selection: [...this._selection],
      count: this._selection.size,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Edit Mode
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if layer is in edit mode
   */
  get isEditing() {
    return this._editing;
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this._redoStack.length > 0;
  }

  /**
   * Start editing mode
   */
  startEditing() {
    if (this._editing) return this;
    this._editing = true;
    this._undoStack = [];
    this._redoStack = [];
    events.emit('layer:edit-started', this);
    termPrint(`Editing: ${this._name}`, 'info');
    return this;
  }

  /**
   * Stop editing mode
   * @param {boolean} save - Whether to keep changes (true) or revert (false)
   */
  stopEditing(save = true) {
    if (!this._editing) return this;

    if (!save && this._undoStack.length > 0) {
      // Revert all changes
      while (this._undoStack.length > 0) {
        this.undo();
      }
    }

    this._editing = false;
    this._undoStack = [];
    this._redoStack = [];
    events.emit('layer:edit-stopped', this, save);
    termPrint(`Editing ${save ? 'saved' : 'cancelled'}: ${this._name}`, 'info');
    return this;
  }

  /**
   * Undo last edit action
   */
  undo() {
    if (!this.canUndo()) return this;
    const action = this._undoStack.pop();
    this._applyAction(action.undo);
    this._redoStack.push(action);
    events.emit('layer:edit-undo', this, action);
    return this;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (!this.canRedo()) return this;
    const action = this._redoStack.pop();
    this._applyAction(action.redo);
    this._undoStack.push(action);
    events.emit('layer:edit-redo', this, action);
    return this;
  }

  /**
   * Push an action to the undo stack
   * @private
   */
  _pushUndo(action) {
    this._undoStack.push(action);
    if (this._undoStack.length > this._maxUndoSteps) {
      this._undoStack.shift();
    }
    this._redoStack = []; // Clear redo on new action
  }

  /**
   * Apply an undo/redo action without pushing to stack
   * @private
   */
  _applyAction(action) {
    switch (action.action) {
      case 'add':
        if (action.index !== undefined) {
          this._geojson.features.splice(action.index, 0, action.feature);
        } else {
          this._geojson.features.push(action.feature);
        }
        break;
      case 'delete':
        const idx = this._geojson.features.findIndex(f => f.id === action.featureId);
        if (idx >= 0) this._geojson.features.splice(idx, 1);
        break;
      case 'replace':
        const replaceIdx = this._geojson.features.findIndex(f => f.id === action.featureId);
        if (replaceIdx >= 0) this._geojson.features[replaceIdx] = action.feature;
        break;
      case 'update':
        const feat = this._geojson.features.find(f => f.id === action.featureId);
        if (feat) {
          if (action.changes.geometry) feat.geometry = action.changes.geometry;
          if (action.changes.properties) Object.assign(feat.properties, action.changes.properties);
        }
        break;
    }
    this._syncToSource();
  }

  /**
   * Add a new feature (requires edit mode)
   * @param {Object} geometry - GeoJSON geometry
   * @param {Object} properties - Feature properties
   * @returns {Object|null} The added feature or null if not editing
   */
  addFeature(geometry, properties = {}) {
    if (!this._editing) {
      termPrint('Layer not in edit mode. Call startEditing() first.', 'warn');
      return null;
    }

    const feature = {
      type: 'Feature',
      id: `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      geometry,
      properties
    };

    this._geojson.features.push(feature);
    this._syncToSource();

    this._pushUndo({
      type: 'add',
      redo: { action: 'add', feature },
      undo: { action: 'delete', featureId: feature.id }
    });

    events.emit('layer:feature-added', this, feature);
    return feature;
  }

  /**
   * Update a feature's geometry or properties (requires edit mode)
   * @param {string} featureId - Feature ID to update
   * @param {Object} changes - { geometry?, properties? }
   * @returns {Object|null} The updated feature or null
   */
  updateFeature(featureId, changes) {
    if (!this._editing) {
      termPrint('Layer not in edit mode. Call startEditing() first.', 'warn');
      return null;
    }

    const feature = this._geojson.features.find(f => f.id === featureId);
    if (!feature) return null;

    const before = JSON.parse(JSON.stringify(feature));

    if (changes.geometry) feature.geometry = changes.geometry;
    if (changes.properties) Object.assign(feature.properties, changes.properties);

    this._syncToSource();

    this._pushUndo({
      type: 'update',
      redo: { action: 'update', featureId, changes },
      undo: { action: 'replace', featureId, feature: before }
    });

    events.emit('layer:feature-updated', this, feature);
    return feature;
  }

  /**
   * Delete a feature (requires edit mode)
   * @param {string} featureId - Feature ID to delete
   * @returns {boolean} Whether deletion was successful
   */
  deleteFeature(featureId) {
    if (!this._editing) {
      termPrint('Layer not in edit mode. Call startEditing() first.', 'warn');
      return false;
    }

    const idx = this._geojson.features.findIndex(f => f.id === featureId);
    if (idx < 0) return false;

    const feature = this._geojson.features[idx];
    this._geojson.features.splice(idx, 1);
    this._selection.delete(featureId);
    this._syncToSource();

    this._pushUndo({
      type: 'delete',
      redo: { action: 'delete', featureId },
      undo: { action: 'add', feature, index: idx }
    });

    events.emit('layer:feature-deleted', this, feature);
    return true;
  }

  /**
   * Delete all selected features (requires edit mode)
   * @returns {number} Number of features deleted
   */
  deleteSelected() {
    if (!this._editing) {
      termPrint('Layer not in edit mode. Call startEditing() first.', 'warn');
      return 0;
    }

    const toDelete = [...this._selection];
    let deleted = 0;
    for (const id of toDelete) {
      if (this.deleteFeature(id)) deleted++;
    }
    return deleted;
  }

  /**
   * Sync GeoJSON to OpenLayers source
   * @private
   */
  _syncToSource() {
    const format = new ol.format.GeoJSON();
    this._source.clear();
    this._source.addFeatures(format.readFeatures(this._geojson, {
      featureProjection: 'EPSG:3857'
    }));
    updateLayerPanel();
  }

  toString() {
    const editFlag = this._editing ? ' [EDITING]' : '';
    return `Layer<${this._name}> (${this.count} ${this.geomType}s)${editFlag}`;
  }
}

/**
 * Vector-specific methods namespace
 * Access via layer.v.methodName()
 */
class VectorMethods {
  constructor(layer) {
    this._layer = layer;
  }

  /**
   * Filter features by predicate
   * @param {Function} predicate - Filter function (feature) => boolean
   * @returns {Object} Filtered result with save() method
   */
  where(predicate) {
    const layer = this._layer;
    const filtered = layer._geojson.features.filter(predicate);
    return {
      count: filtered.length,
      features: filtered,
      save(name) {
        return import('./api.js').then(({ load }) => {
          const fc = { type: 'FeatureCollection', features: filtered };
          return load(fc, name || `${layer._name}_filtered`);
        });
      }
    };
  }

  /**
   * Calculate statistics for a numeric field
   * @param {string} field - Field name
   */
  stats(field) {
    const values = this._layer._geojson.features
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

  /**
   * Buffer features by distance
   * @param {number} dist - Buffer distance in kilometers
   * @param {string} name - Optional output layer name
   */
  buffer(dist, name) {
    return import('./commands.js').then(({ buffer }) => {
      return buffer(this._layer, dist, name);
    });
  }

  /**
   * Dissolve features by field
   * @param {string} field - Field to dissolve by
   * @param {string} name - Optional output layer name
   */
  dissolve(field, name) {
    return import('./commands.js').then(({ dissolve }) => {
      return dissolve(this._layer, field, name);
    });
  }

  /**
   * Create Voronoi polygons from points
   * @param {string} name - Optional output layer name
   */
  voronoi(name) {
    return import('./commands.js').then(({ voronoi }) => {
      return voronoi(this._layer, name);
    });
  }

  /**
   * Create centroid points from polygons
   * @param {string} name - Optional output layer name
   */
  centroid(name) {
    return import('./commands.js').then(({ centroid }) => {
      return centroid(this._layer, name);
    });
  }

  /**
   * Get unique values for a field
   * @param {string} field - Field name
   */
  unique(field) {
    const values = this._layer._geojson.features
      .map(f => f.properties[field])
      .filter(v => v !== null && v !== undefined);
    return [...new Set(values)].sort();
  }

  /**
   * Download layer as GeoJSON
   * @param {string} filename - Optional filename
   */
  download(filename) {
    const data = JSON.stringify(this._layer._geojson, null, 2);
    const blob = new Blob([data], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${this._layer._name}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    termPrint(`Downloaded: ${a.download}`, 'green');
    return this._layer;
  }

  // ─────────────────────────────────────────────────────────────
  // Selection shortcuts
  // ─────────────────────────────────────────────────────────────

  /**
   * Select features (shorthand for layer.select())
   */
  select(selector, options) {
    return this._layer.select(selector, options);
  }

  /**
   * Deselect features (shorthand for layer.deselect())
   */
  deselect(selector) {
    return this._layer.deselect(selector);
  }

  /**
   * Get selection (shorthand for layer.selection)
   */
  get selection() {
    return this._layer.selection;
  }

  /**
   * Clear selection (shorthand for layer.clearSelection())
   */
  clearSelection() {
    return this._layer.clearSelection();
  }

  /**
   * Get selected features
   */
  getSelected() {
    return this._layer.getSelected();
  }

  /**
   * Invert selection
   */
  invertSelection() {
    return this._layer.invertSelection();
  }

  // ─────────────────────────────────────────────────────────────
  // Edit mode shortcuts
  // ─────────────────────────────────────────────────────────────

  /**
   * Start editing mode
   */
  startEditing() {
    return this._layer.startEditing();
  }

  /**
   * Stop editing mode
   */
  stopEditing(save = true) {
    return this._layer.stopEditing(save);
  }

  /**
   * Check if editing
   */
  get isEditing() {
    return this._layer.isEditing;
  }

  /**
   * Undo last action
   */
  undo() {
    return this._layer.undo();
  }

  /**
   * Redo last undone action
   */
  redo() {
    return this._layer.redo();
  }

  /**
   * Add a new feature
   */
  addFeature(geometry, properties) {
    return this._layer.addFeature(geometry, properties);
  }

  /**
   * Update a feature
   */
  updateFeature(featureId, changes) {
    return this._layer.updateFeature(featureId, changes);
  }

  /**
   * Delete a feature
   */
  deleteFeature(featureId) {
    return this._layer.deleteFeature(featureId);
  }

  /**
   * Delete selected features
   */
  deleteSelected() {
    return this._layer.deleteSelected();
  }
}

// Keep backward compatibility - export as Layer too
export { VectorLayer as Layer };
