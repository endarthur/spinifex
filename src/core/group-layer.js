// Spinifex - GroupLayer Class
// Logical grouping of layers for organization

import { BaseLayer } from './base-layer.js';
import { state } from './state.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel } from '../ui/layers-panel.js';
import { updateLegendContent } from '../ui/windows.js';
import { termPrint } from '../ui/terminal.js';

let groupCounter = 0;

/**
 * GroupLayer - logical container for organizing layers
 * Unlike other layers, it doesn't have an OL layer - it manages children
 */
export class GroupLayer {
  constructor(id, name, children = []) {
    this._id = id;
    this._name = name;
    this._children = [...children];
    this._visible = true;
    this._opacity = 1;
    this._zIndex = 0;
    this._expanded = true;
    this._showInLegend = true;
  }

  // ─────────────────────────────────────────────────────────────
  // Type identifier
  // ─────────────────────────────────────────────────────────────

  get type() { return 'group'; }

  // ─────────────────────────────────────────────────────────────
  // Basic getters
  // ─────────────────────────────────────────────────────────────

  get name() { return this._name; }
  get id() { return this._id; }
  get visible() { return this._visible; }
  get children() { return [...this._children]; }
  get expanded() { return this._expanded; }
  get showInLegend() { return this._showInLegend; }

  // ─────────────────────────────────────────────────────────────
  // Child Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Add a layer to this group
   * @param {BaseLayer|GroupLayer} layer
   */
  add(layer) {
    if (!this._children.includes(layer)) {
      this._children.push(layer);
      updateLayerPanel();
      updateLegendContent();
    }
    return this;
  }

  /**
   * Remove a layer from this group (does not delete the layer)
   * @param {BaseLayer|GroupLayer} layer
   */
  removeChild(layer) {
    const idx = this._children.indexOf(layer);
    if (idx !== -1) {
      this._children.splice(idx, 1);
      updateLayerPanel();
      updateLegendContent();
    }
    return this;
  }

  /**
   * Check if a layer is in this group
   * @param {BaseLayer|GroupLayer} layer
   * @returns {boolean}
   */
  has(layer) {
    return this._children.includes(layer);
  }

  /**
   * Remove all children from this group
   */
  clear() {
    this._children = [];
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Visibility (cascades to children)
  // ─────────────────────────────────────────────────────────────

  show() {
    this._visible = true;
    for (const child of this._children) {
      if (child.show) child.show();
    }
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  hide() {
    this._visible = false;
    for (const child of this._children) {
      if (child.hide) child.hide();
    }
    updateLayerPanel();
    updateLegendContent();
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Opacity (cascades to children)
  // ─────────────────────────────────────────────────────────────

  opacity(value) {
    if (value !== undefined) {
      this._opacity = Math.max(0, Math.min(1, value));
      for (const child of this._children) {
        if (child.opacity) child.opacity(this._opacity);
      }
      return this;
    }
    return this._opacity;
  }

  // ─────────────────────────────────────────────────────────────
  // Z-Index
  // ─────────────────────────────────────────────────────────────

  zIndex(value) {
    if (value !== undefined) {
      const delta = value - this._zIndex;
      this._zIndex = value;
      // Adjust children z-indices to maintain relative order
      for (const child of this._children) {
        if (child.zIndex) {
          child.zIndex(child.zIndex() + delta);
        }
      }
      updateLayerPanel();
      updateLegendContent();
      return this;
    }
    return this._zIndex;
  }

  bringToFront() {
    let maxZ = 0;
    state.layers.forEach(l => {
      const z = typeof l.zIndex === 'function' ? l.zIndex() : 0;
      if (z > maxZ) maxZ = z;
    });
    this.zIndex(maxZ + 1);
    return this;
  }

  sendToBack() {
    let minZ = Infinity;
    state.layers.forEach(l => {
      const z = typeof l.zIndex === 'function' ? l.zIndex() : 0;
      if (z < minZ) minZ = z;
    });
    this.zIndex(minZ - 1);
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Expand/Collapse (UI state for layer panel)
  // ─────────────────────────────────────────────────────────────

  expand() {
    this._expanded = true;
    updateLayerPanel();
    return this;
  }

  collapse() {
    this._expanded = false;
    updateLayerPanel();
    return this;
  }

  toggle() {
    this._expanded = !this._expanded;
    updateLayerPanel();
    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Zoom (to combined extent of children)
  // ─────────────────────────────────────────────────────────────

  zoom() {
    // Collect extents from children
    let combinedExtent = null;

    for (const child of this._children) {
      let extent = null;
      if (child.extent && typeof child.extent === 'function') {
        extent = child.extent();
      } else if (child._getExtent && typeof child._getExtent === 'function') {
        extent = child._getExtent();
      }

      if (extent) {
        if (!combinedExtent) {
          combinedExtent = [...extent];
        } else {
          // Extend combined extent
          combinedExtent[0] = Math.min(combinedExtent[0], extent[0]);
          combinedExtent[1] = Math.min(combinedExtent[1], extent[1]);
          combinedExtent[2] = Math.max(combinedExtent[2], extent[2]);
          combinedExtent[3] = Math.max(combinedExtent[3], extent[3]);
        }
      }
    }

    if (combinedExtent) {
      getMap().getView().fit(combinedExtent, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    } else {
      termPrint('No extent available for group children', 'yellow');
    }

    return this;
  }

  // ─────────────────────────────────────────────────────────────
  // Rename
  // ─────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────
  // Remove group (optionally remove children too)
  // ─────────────────────────────────────────────────────────────

  /**
   * Remove this group
   * @param {boolean} removeChildren - If true, also remove all children from map
   */
  remove(removeChildren = false) {
    if (removeChildren) {
      for (const child of [...this._children]) {
        if (child.remove) child.remove(removeChildren);
      }
    }

    state.layers.delete(this._id);

    import('./api.js').then(({ ly }) => {
      delete ly[this._name];
    });

    updateLayerPanel();
    updateLegendContent();
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────

  toJSON() {
    return {
      name: this._name,
      type: 'group',
      visible: this._visible,
      opacity: this._opacity,
      zIndex: this._zIndex,
      expanded: this._expanded,
      children: this._children.map(c => c.toJSON ? c.toJSON() : { name: c.name }),
    };
  }

  toString() {
    return `GroupLayer<${this._name}> (${this._children.length} children)`;
  }
}

/**
 * Create a group layer
 * @param {string} name - Group name
 * @param {Array} children - Initial child layers
 * @returns {GroupLayer}
 */
export function createGroupLayer(name, children = []) {
  const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const groupName = name || `group_${++groupCounter}`;

  const group = new GroupLayer(id, groupName, children);

  // Add to state
  state.layers.set(id, group);

  // Add to ly namespace
  import('./api.js').then(({ ly }) => {
    ly[groupName] = group;
  });

  updateLayerPanel();
  updateLegendContent();

  termPrint(`Group: ${groupName} (${children.length} children)`, 'green');

  return group;
}
