// Spinifex - Base Layer Class
// Abstract base class defining the common layer interface
// All layer types (vector, raster, basemap) extend this

import { state } from './state.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { getMap } from '../ui/map.js';
import { updateLegendContent } from '../ui/windows.js';
import { termPrint } from '../ui/terminal.js';

// Common blend modes for all layer types
export const BLEND_MODES = [
  'source-over',    // Normal (default)
  'multiply',       // Darken
  'screen',         // Lighten
  'overlay',        // Contrast
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
];

/**
 * Base Layer class - defines the common interface for all layers
 * @abstract
 */
export class BaseLayer {
  constructor(id, name, olLayer, zIndex = 0) {
    if (new.target === BaseLayer) {
      throw new Error('BaseLayer is abstract and cannot be instantiated directly');
    }

    this._id = id;
    this._name = name;
    this._olLayer = olLayer;
    this._visible = true;
    this._zIndex = zIndex;
    this._blendMode = 'source-over';
    this._preRenderHandler = null;
    this._postRenderHandler = null;

    // Source file info for project persistence
    this._sourcePath = null;
    this._sourceFormat = null;

    // Legend visibility
    this._showInLegend = true;

    if (this._olLayer) {
      this._olLayer.setZIndex(this._zIndex);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Abstract - must be overridden by subclasses
  // ─────────────────────────────────────────────────────────────

  /**
   * Layer type identifier
   * @returns {string} 'vector' | 'raster' | 'basemap'
   */
  get type() {
    throw new Error('Subclass must implement type getter');
  }

  // ─────────────────────────────────────────────────────────────
  // Common getters - same for all layer types
  // ─────────────────────────────────────────────────────────────

  get name() { return this._name; }
  get id() { return this._id; }
  get visible() { return this._visible; }
  get olLayer() { return this._olLayer; }
  get sourcePath() { return this._sourcePath; }
  get sourceFormat() { return this._sourceFormat; }
  get showInLegend() { return this._showInLegend; }

  // ─────────────────────────────────────────────────────────────
  // Common methods - same implementation for all layer types
  // ─────────────────────────────────────────────────────────────

  /**
   * Set source file info for project persistence
   */
  setSource(path, format) {
    this._sourcePath = path;
    this._sourceFormat = format;
    return this;
  }

  /**
   * Show the layer on the map
   */
  show() {
    this._olLayer.setVisible(true);
    this._visible = true;
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  /**
   * Hide the layer from the map
   */
  hide() {
    this._olLayer.setVisible(false);
    this._visible = false;
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  /**
   * Zoom map to layer extent
   * Subclasses should override if they have custom extent handling
   */
  zoom() {
    const extent = this._getExtent();
    if (extent) {
      getMap().getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    }
    return this;
  }

  /**
   * Get layer extent in map projection (EPSG:3857)
   * Subclasses must implement this
   * @protected
   */
  _getExtent() {
    throw new Error('Subclass must implement _getExtent()');
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
   * Get or set layer opacity (0-1)
   */
  opacity(value) {
    if (value !== undefined) {
      this._olLayer.setOpacity(value);
      return this;
    }
    return this._olLayer.getOpacity();
  }

  /**
   * Move layer to top of render stack
   */
  bringToFront() {
    let maxZ = 0;
    state.layers.forEach(l => {
      const z = typeof l.zIndex === 'function' ? l.zIndex() : 0;
      if (z > maxZ) maxZ = z;
    });
    this.zIndex(maxZ + 1);
    return this;
  }

  /**
   * Move layer to bottom of render stack
   */
  sendToBack() {
    let minZ = Infinity;
    state.layers.forEach(l => {
      const z = typeof l.zIndex === 'function' ? l.zIndex() : 0;
      if (z < minZ) minZ = z;
    });
    this.zIndex(minZ - 1);
    return this;
  }

  /**
   * Get or set layer blend mode
   * @param {string} mode - Canvas 2D globalCompositeOperation
   */
  blendMode(mode) {
    if (mode !== undefined) {
      if (!BLEND_MODES.includes(mode)) {
        termPrint(`Unknown blend mode: ${mode}`, 'red');
        termPrint(`Available: ${BLEND_MODES.join(', ')}`, 'dim');
        return this;
      }
      this._blendMode = mode;

      // Remove old handlers
      if (this._preRenderHandler) {
        this._olLayer.un('prerender', this._preRenderHandler);
      }
      if (this._postRenderHandler) {
        this._olLayer.un('postrender', this._postRenderHandler);
      }

      // Apply new blend mode via pre/post render events
      if (mode !== 'source-over') {
        this._preRenderHandler = (e) => {
          e.context.globalCompositeOperation = this._blendMode;
        };
        this._postRenderHandler = (e) => {
          e.context.globalCompositeOperation = 'source-over';
        };
        this._olLayer.on('prerender', this._preRenderHandler);
        this._olLayer.on('postrender', this._postRenderHandler);
      }

      this._olLayer.changed();
      termPrint(`Blend mode: ${mode}`, 'green');
      return this;
    }
    return this._blendMode;
  }

  /**
   * Open layer properties window
   * @param {string} tab - Tab to open: 'info', 'fields', 'style', 'labels'
   */
  properties(tab = 'info') {
    import('../ui/windows.js').then(({ openLayerProperties }) => {
      openLayerProperties(this, tab);
    });
    return this;
  }

  /**
   * Open style tab of properties window, or apply style options
   * Subclasses should override to handle style options
   */
  style(opts) {
    if (opts === undefined) {
      return this.properties('style');
    }
    // Subclasses implement actual styling
    return this;
  }

  /**
   * Rename this layer
   * @param {string} newName - New name for the layer
   */
  rename(newName) {
    if (!newName || typeof newName !== 'string') {
      termPrint('New name must be a non-empty string', 'red');
      return this;
    }

    import('./api.js').then(({ ly }) => {
      if (ly[newName] && ly[newName] !== this) {
        termPrint(`Layer "${newName}" already exists`, 'red');
        return;
      }

      const oldName = this._name;
      delete ly[oldName];
      ly[newName] = this;
      this._name = newName;

      updateLayerPanel();
      updateLegendContent();
      termPrint(`Renamed: "${oldName}" → "${newName}"`, 'green');
    });

    return this;
  }

  /**
   * Remove layer from map
   */
  remove() {
    getMap().removeLayer(this._olLayer);
    state.layers.delete(this._id);

    import('./api.js').then(({ ly }) => {
      delete ly[this._name];
    });

    updateLayerPanel();
    updateLegendContent();
    return null;
  }

  /**
   * String representation
   */
  toString() {
    return `Layer<${this._name}> (${this.type})`;
  }
}
