// Spinifex - Layers Panel
// Classic GIS-style layer tree with groups, drag-drop reordering

import { state, getLayersSortedByZIndex } from '../core/state.js';
import { showLayerContextMenu } from './context-menu.js';
import { createGroupLayer } from '../core/group-layer.js';
import { termPrint } from './terminal.js';

// Track UI state
let draggedLayerName = null;
let lastHighlightedItem = null;
let selectedLayerName = null;

// ─────────────────────────────────────────────────────────────────────────────
// Layer Type Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get layer type icon class based on layer properties
 */
function getLayerIconType(layer) {
  if (layer.type === 'group') return 'type-group';
  if (layer.isBasemap) return 'type-basemap';
  if (layer.type === 'raster') return 'type-raster';
  if (layer.type === 'tile') return 'type-tile';

  // Vector layer - determine geometry type
  if (layer.type === 'vector' && layer._source) {
    const features = layer._source.getFeatures();
    if (features.length > 0) {
      const geom = features[0].getGeometry();
      if (geom) {
        const geomType = geom.getType();
        if (geomType.includes('Point')) return 'type-point';
        if (geomType.includes('Line')) return 'type-line';
        if (geomType.includes('Polygon')) return 'type-polygon';
      }
    }
  }

  return 'type-polygon'; // default
}

/**
 * Get layer info text (feature count, dimensions, etc.)
 */
function getLayerInfo(layer) {
  if (layer.type === 'group') {
    const count = layer.children?.length || 0;
    return count === 1 ? '1 layer' : `${count} layers`;
  }
  if (layer.count !== undefined) {
    return `${layer.count}`;
  }
  if (layer.width !== undefined && layer.height !== undefined) {
    return `${layer.width}×${layer.height}`;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Layer Tree Structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build hierarchical tree from flat layer list
 * Layers in groups are excluded from top level
 */
function buildLayerTree() {
  const sortedLayers = getLayersSortedByZIndex();
  const inGroup = new Set();

  // Find all layers that are children of groups
  for (const layer of sortedLayers) {
    if (layer.type === 'group' && layer.children) {
      for (const child of layer.children) {
        inGroup.add(child.name || child._name);
      }
    }
  }

  // Return only top-level layers (not in any group)
  return sortedLayers.filter(layer => !inGroup.has(layer.name));
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the toolbar
 */
function renderToolbar() {
  return `
    <div class="layer-toolbar">
      <button onclick="window.spCreateGroup()" title="New Group">+ Group</button>
      <button onclick="window.spExpandAll()" title="Expand All">▼</button>
      <button onclick="window.spCollapseAll()" title="Collapse All">▶</button>
    </div>`;
}

/**
 * Render a single layer item
 */
function renderLayerItem(layer, depth = 0) {
  const isGroup = layer.type === 'group';
  const isExpanded = isGroup && layer.expanded !== false;
  const isVisible = layer.visible !== false;
  const iconType = getLayerIconType(layer);
  const info = getLayerInfo(layer);
  const displayName = layer.label || layer.name;

  // Escape for HTML attributes and JS
  const escapedName = layer.name.replace(/"/g, '&quot;');
  const jsEscapedName = layer.name.replace(/'/g, "\\'").replace(/"/g, '\\"');

  // Build class list
  const classes = ['layer-item'];
  if (isGroup && isExpanded) classes.push('expanded');
  if (!isVisible) classes.push('not-visible');
  if (selectedLayerName === layer.name) classes.push('selected');

  // Build controls
  let actions = '';
  if (layer.isBasemap) {
    const opacity = layer.opacity ? layer.opacity() : 1;
    const opacityPercent = Math.round(opacity * 100);
    actions = `
      <input type="range" min="0" max="100" value="${opacityPercent}"
             class="opacity-slider" title="Opacity: ${opacityPercent}%"
             onclick="event.stopPropagation()"
             oninput="window.spSetOpacity('${jsEscapedName}', this.value)">
      <button onclick="event.stopPropagation(); window.spRemoveLayer('${jsEscapedName}')" title="Remove">×</button>`;
  } else {
    actions = `
      <button onclick="event.stopPropagation(); window.spZoomLayer('${jsEscapedName}')" title="Zoom to Layer">⌖</button>
      <button onclick="event.stopPropagation(); window.spRemoveLayer('${jsEscapedName}')" title="Remove">×</button>`;
  }

  // Render item HTML
  let html = `
    <div class="${classes.join(' ')}"
         draggable="true"
         data-layer-name="${escapedName}"
         data-layer-type="${layer.type || 'vector'}"
         data-is-group="${isGroup}"
         onclick="window.spSelectLayer('${jsEscapedName}')"
         ondragstart="window.spDragStart(event)"
         ondragover="window.spDragOver(event)"
         ondrop="window.spDrop(event)"
         ondragend="window.spDragEnd(event)"
         oncontextmenu="window.spContextMenu(event, '${jsEscapedName}')">
      ${isGroup
        ? `<span class="layer-expand" onclick="event.stopPropagation(); window.spToggleGroup('${jsEscapedName}')"></span>`
        : '<span class="layer-expand-spacer"></span>'}
      <input type="checkbox" class="layer-checkbox"
             ${isVisible ? 'checked' : ''}
             onclick="event.stopPropagation(); window.spToggleVisibility('${jsEscapedName}')"
             title="${isVisible ? 'Hide layer' : 'Show layer'}">
      <span class="layer-icon ${iconType}"></span>
      <span class="layer-name" title="${displayName}">${displayName}</span>
      ${info ? `<span class="layer-info">${info}</span>` : ''}
      <div class="layer-actions">${actions}</div>
    </div>`;

  // Render group children
  if (isGroup && layer.children && layer.children.length > 0) {
    const childClass = isExpanded ? 'group-children' : 'group-children collapsed';
    html += `<div class="${childClass}" data-group="${escapedName}">`;
    for (const child of layer.children) {
      html += renderLayerItem(child, depth + 1);
    }
    html += '</div>';
  }

  return html;
}

/**
 * Update the layer panel UI
 */
export function updateLayerPanel() {
  const container = document.getElementById('layer-list');
  if (!container) return;

  if (state.layers.size === 0) {
    container.innerHTML = `
      <div class="layer-empty">
        <div>No layers loaded</div>
        <div class="layer-empty-hint">load(sample) or drag & drop</div>
      </div>`;
    updateStatusBar();
    return;
  }

  const tree = buildLayerTree();

  let html = renderToolbar();
  html += '<div class="layer-tree">';

  for (const layer of tree) {
    html += renderLayerItem(layer);
  }

  // Drop zone at bottom
  html += `
    <div class="layer-drop-zone"
         ondragover="window.spBottomDragOver(event)"
         ondrop="window.spBottomDrop(event)"
         ondragleave="window.spBottomDragLeave(event)">
    </div>`;

  html += '</div>';

  container.innerHTML = html;
  updateStatusBar();
}

// Alias for compatibility
export const renderLayerList = updateLayerPanel;

/**
 * Update the status bar
 */
export function updateStatusBar() {
  const el = document.getElementById('status-layers');
  if (el) {
    el.textContent = state.layers.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

// Select layer
window.spSelectLayer = function(name) {
  selectedLayerName = name;
  updateLayerPanel();
};

// Toggle visibility
window.spToggleVisibility = function(name) {
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer) {
      if (layer.visible) {
        layer.hide();
      } else {
        layer.show();
      }
    }
  });
};

// Toggle group expand/collapse
window.spToggleGroup = function(name) {
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer && layer.type === 'group') {
      layer.toggle();
    }
  });
};

// Zoom to layer
window.spZoomLayer = function(name) {
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer && layer.zoom) {
      layer.zoom();
    }
  });
};

// Remove layer
window.spRemoveLayer = function(name) {
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer && layer.remove) {
      const lyRef = `ly["${name}"]`;
      window.runInTerminal(`${lyRef}.remove()`);
    }
  });
};

// Set opacity
window.spSetOpacity = function(name, value) {
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer && layer.opacity) {
      layer.opacity(value / 100);
    }
  });
};

// Context menu
window.spContextMenu = function(e, name) {
  e.preventDefault();
  e.stopPropagation();
  import('../core/api.js').then(({ ly }) => {
    const layer = ly[name];
    if (layer) {
      showLayerContextMenu(e, layer);
    }
  });
};

// Create new group
window.spCreateGroup = function() {
  createGroupLayer();
};

// Expand all groups
window.spExpandAll = function() {
  import('../core/api.js').then(({ ly }) => {
    for (const layer of state.layers.values()) {
      if (layer.type === 'group' && layer.expand) {
        layer._expanded = true;
      }
    }
    updateLayerPanel();
  });
};

// Collapse all groups
window.spCollapseAll = function() {
  import('../core/api.js').then(({ ly }) => {
    for (const layer of state.layers.values()) {
      if (layer.type === 'group' && layer.collapse) {
        layer._expanded = false;
      }
    }
    updateLayerPanel();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Drag & Drop Handlers
// ─────────────────────────────────────────────────────────────────────────────

window.spDragStart = function(e) {
  const layerItem = e.target.closest('.layer-item');
  if (!layerItem) return;

  draggedLayerName = layerItem.dataset.layerName;
  layerItem.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedLayerName || '');
};

window.spDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const item = e.target.closest('.layer-item');
  if (!item || item.dataset.layerName === draggedLayerName) return;

  // Clear previous highlight
  if (lastHighlightedItem && lastHighlightedItem !== item) {
    lastHighlightedItem.classList.remove('drop-above', 'drop-below', 'drop-into');
  }

  const rect = item.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  item.classList.remove('drop-above', 'drop-below', 'drop-into');

  // If it's a group, allow dropping into it (middle zone)
  const isGroup = item.dataset.isGroup === 'true';
  if (isGroup && y > height * 0.25 && y < height * 0.75) {
    item.classList.add('drop-into');
  } else if (y < height / 2) {
    item.classList.add('drop-above');
  } else {
    item.classList.add('drop-below');
  }

  lastHighlightedItem = item;
};

window.spDrop = function(e) {
  e.preventDefault();

  const targetItem = e.target.closest('.layer-item');
  if (!targetItem || !draggedLayerName) return;

  const targetName = targetItem.dataset.layerName;
  if (targetName === draggedLayerName) return;

  // Capture layer name before async - spDragEnd clears it synchronously after drop
  const layerName = draggedLayerName;

  const rect = targetItem.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  const isGroup = targetItem.dataset.isGroup === 'true';

  // Determine drop mode
  let dropMode;
  if (isGroup && y > height * 0.25 && y < height * 0.75) {
    dropMode = 'into';
  } else if (y < height / 2) {
    dropMode = 'above';
  } else {
    dropMode = 'below';
  }

  import('../core/api.js').then(({ ly }) => {
    const draggedLayer = ly[layerName];
    const targetLayer = ly[targetName];

    if (!draggedLayer || !targetLayer) return;

    if (dropMode === 'into' && targetLayer.type === 'group') {
      // Move into group
      removeFromCurrentGroup(draggedLayer, ly);
      targetLayer.add(draggedLayer);
      termPrint(`Moved "${layerName}" into group "${targetName}"`, 'green');
      updateLayerPanel();
    } else {
      // Reorder layers (calls updateLayerPanel when done)
      reorderLayers(layerName, targetName, dropMode === 'above', ly);
    }
  });
};

window.spDragEnd = function(e) {
  const draggedItem = e.target.closest('.layer-item');
  if (draggedItem) {
    draggedItem.classList.remove('dragging');
  }

  if (lastHighlightedItem) {
    lastHighlightedItem.classList.remove('drop-above', 'drop-below', 'drop-into');
    lastHighlightedItem = null;
  }

  const dropZone = document.querySelector('.layer-drop-zone');
  if (dropZone) {
    dropZone.classList.remove('active');
  }

  draggedLayerName = null;
  // Panel update is handled by the async drop handlers after they complete
};

window.spBottomDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.target.classList.add('active');

  if (lastHighlightedItem) {
    lastHighlightedItem.classList.remove('drop-above', 'drop-below', 'drop-into');
    lastHighlightedItem = null;
  }
};

window.spBottomDragLeave = function(e) {
  e.target.classList.remove('active');
};

window.spBottomDrop = async function(e) {
  e.preventDefault();
  e.target.classList.remove('active');

  if (!draggedLayerName) return;

  // Capture layer name before async - spDragEnd clears it synchronously after drop
  const layerName = draggedLayerName;

  const { ly } = await import('../core/api.js');
  const { getMap } = await import('../ui/map.js');
  const draggedLayer = ly[layerName];
  if (!draggedLayer) return;

  const map = getMap();

  // Remove from any group
  removeFromCurrentGroup(draggedLayer, ly);

  // For WebGL layers (raster/tile), use remove/re-add approach
  const isWebGL = draggedLayer.type === 'raster' || draggedLayer.type === 'tile';
  if (isWebGL && draggedLayer._olLayer && map) {
    try {
      map.removeLayer(draggedLayer._olLayer);
    } catch (e) {
      // Layer might not be on map
    }
  }

  // Move to bottom (lowest z-index)
  draggedLayer.sendToBack();

  // Wait for render cycle
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Re-add WebGL layer
  if (isWebGL && draggedLayer._visible !== false && draggedLayer._olLayer && map) {
    try {
      map.addLayer(draggedLayer._olLayer);
    } catch (e) {
      // Layer might already be on map
    }
    map.render();
  }

  termPrint(`Moved "${layerName}" to bottom`, 'green');

  // Update panel after async work completes
  updateLayerPanel();
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove layer from its current group (if any)
 */
function removeFromCurrentGroup(layer, ly) {
  for (const l of state.layers.values()) {
    if (l.type === 'group' && l.children) {
      const idx = l.children.indexOf(layer);
      if (idx !== -1) {
        l._children.splice(idx, 1);
        return;
      }
    }
  }
}

/**
 * Reorder layers by adjusting z-indices
 * Uses remove/re-add approach for WebGL layers to avoid texture corruption
 */
async function reorderLayers(draggedName, targetName, dropAbove, ly) {
  const { getMap } = await import('../ui/map.js');
  const map = getMap();
  if (!map) return;

  const sortedLayers = getLayersSortedByZIndex();
  const layerNames = sortedLayers.map(l => l.name);

  // Remove dragged layer from current position
  const draggedIndex = layerNames.indexOf(draggedName);
  if (draggedIndex === -1) return;
  layerNames.splice(draggedIndex, 1);

  // Find target index and insert
  let targetIndex = layerNames.indexOf(targetName);
  if (targetIndex === -1) return;
  if (!dropAbove) targetIndex += 1;
  layerNames.splice(targetIndex, 0, draggedName);

  // Recalculate z-indices
  const baseZ = 100;
  const layersToUpdate = [];

  layerNames.forEach((name, index) => {
    const layer = ly[name];
    if (layer && layer.zIndex && layer._olLayer) {
      layersToUpdate.push({ layer, newZ: baseZ + (layerNames.length - index) });
    }
  });

  // Identify WebGL layers (raster and tile types need special handling)
  const webglLayers = layersToUpdate.filter(({ layer }) =>
    layer.type === 'raster' || layer.type === 'tile'
  );

  // For WebGL layers: remove from map, update z-index, re-add
  // This avoids WebGL texture corruption issues
  for (const { layer } of webglLayers) {
    try {
      map.removeLayer(layer._olLayer);
    } catch (e) {
      // Layer might not be on map
    }
  }

  // Apply ALL z-index changes
  for (const { layer, newZ } of layersToUpdate) {
    layer._zIndex = newZ;
    layer._olLayer.setZIndex(newZ);
  }

  // Wait for a frame
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Re-add WebGL layers in z-index order (lowest first so highest ends up on top)
  const sortedWebGL = [...webglLayers].sort((a, b) => a.newZ - b.newZ);
  for (const { layer } of sortedWebGL) {
    if (layer._visible !== false) {
      try {
        map.addLayer(layer._olLayer);
      } catch (e) {
        // Layer might already be on map
      }
    }
  }

  // Force render
  map.render();

  termPrint(`Reordered: ${draggedName} moved ${dropAbove ? 'above' : 'below'} ${targetName}`, 'green');

  // Update panel after async work completes
  updateLayerPanel();
}

// Legacy compatibility
window.toggleVis = window.spToggleVisibility;
window.handleLayerDragStart = window.spDragStart;
window.handleLayerDragOver = window.spDragOver;
window.handleLayerDrop = window.spDrop;
window.handleLayerDragEnd = window.spDragEnd;
window.handleBottomDragOver = window.spBottomDragOver;
window.handleBottomDragLeave = window.spBottomDragLeave;
window.handleBottomDrop = window.spBottomDrop;
window.handleLayerContextMenu = window.spContextMenu;
window.setLayerOpacity = window.spSetOpacity;
