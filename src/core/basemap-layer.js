// Spinifex - BasemapLayer Class
// Wrapper around OpenLayers tile layer for basemaps

import { state } from './state.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { getMap } from '../ui/map.js';
import { termPrint } from '../ui/terminal.js';

/**
 * BasemapLayer - represents a tile/raster basemap layer
 * Similar interface to Layer but for tile sources
 */
// Available blend modes (Canvas 2D globalCompositeOperation)
const BLEND_MODES = [
  'source-over',  // Normal (default)
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
];

export { BLEND_MODES };

export class BasemapLayer {
  constructor(id, name, olLayer, config) {
    this._id = id;
    this._name = name;
    this._olLayer = olLayer;
    this._config = config;  // { url, attribution, label, group, basemapKey }
    this._visible = true;
    this._opacity = 1;
    this._zIndex = config.zIndex ?? -100;  // Basemaps default to bottom
    this._isBasemap = true;
    this._blendMode = 'source-over';
    this._basemapKey = config.basemapKey || null;  // Original BASEMAPS key (e.g., "stamen-terrain")

    if (this._olLayer) {
      this._olLayer.setZIndex(this._zIndex);
      this._olLayer.setOpacity(this._opacity);
    }
  }

  // === Getters ===
  get name() { return this._name; }
  get id() { return this._id; }
  get visible() { return this._visible; }
  get olLayer() { return this._olLayer; }
  get isBasemap() { return true; }
  get layerType() { return 'basemap'; }

  // Config info
  get url() { return this._config.url; }
  get attribution() { return this._config.attribution; }
  get label() { return this._config.label || this._name; }
  get group() { return this._config.group; }

  // === Visibility ===
  show() {
    this._olLayer.setVisible(true);
    this._visible = true;
    updateLayerPanel();
    return this;
  }

  hide() {
    this._olLayer.setVisible(false);
    this._visible = false;
    updateLayerPanel();
    return this;
  }

  // === Opacity ===
  opacity(value) {
    if (value !== undefined) {
      this._opacity = Math.max(0, Math.min(1, value));
      this._olLayer.setOpacity(this._opacity);
      updateLayerPanel();
      return this;
    }
    return this._opacity;
  }

  // === Blend Mode ===
  blendMode(mode) {
    if (mode !== undefined) {
      if (!BLEND_MODES.includes(mode)) {
        termPrint(`Unknown blend mode: ${mode}`, 'red');
        termPrint(`Available: ${BLEND_MODES.join(', ')}`, 'dim');
        return this;
      }
      this._blendMode = mode;
      // Apply via pre/post render events
      this._olLayer.un('prerender', this._preRenderHandler);
      this._olLayer.un('postrender', this._postRenderHandler);

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

      // Force redraw
      this._olLayer.changed();
      termPrint(`Blend mode: ${mode}`, 'green');
      return this;
    }
    return this._blendMode;
  }

  // === Z-Index ===
  zIndex(value) {
    if (value !== undefined) {
      this._zIndex = value;
      this._olLayer.setZIndex(value);
      updateLayerPanel();
      return this;
    }
    return this._zIndex;
  }

  bringToFront() {
    // Among basemaps, find highest z-index
    let maxZ = -100;
    state.layers.forEach(l => {
      if (l.isBasemap) {
        const z = l.zIndex ? l.zIndex() : -100;
        if (z > maxZ) maxZ = z;
      }
    });
    this.zIndex(maxZ + 1);
    return this;
  }

  sendToBack() {
    // Among basemaps, find lowest z-index
    let minZ = -100;
    state.layers.forEach(l => {
      if (l.isBasemap) {
        const z = l.zIndex ? l.zIndex() : -100;
        if (z < minZ) minZ = z;
      }
    });
    this.zIndex(minZ - 1);
    return this;
  }

  // === Rename ===
  /**
   * Rename this basemap layer
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
      termPrint(`Renamed: "${oldName}" → "${newName}"`, 'green');
    });

    return this;
  }

  // === Remove ===
  remove() {
    getMap().removeLayer(this._olLayer);
    state.layers.delete(this._id);
    // Remove from ly namespace
    import('./api.js').then(({ ly }) => {
      delete ly[this._name];
    });
    updateLayerPanel();
    termPrint(`Removed basemap: ${this._name}`, 'dim');
    return null;
  }

  // === Info ===
  toString() {
    return `BasemapLayer<${this._name}> ${this._config.label || ''}`;
  }

  // Serialize for project.json
  toJSON() {
    return {
      name: this._name,
      type: 'basemap',
      basemapKey: this._basemapKey,  // Original key for BASEMAPS lookup (e.g., "stamen-terrain")
      url: this._config.url,
      attribution: this._config.attribution,
      label: this._config.label,
      group: this._config.group,
      visible: this._visible,
      opacity: this._opacity,
      blendMode: this._blendMode,
      zIndex: this._zIndex
    };
  }
}
