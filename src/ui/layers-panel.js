// Spinifex - Layers Panel
// UI for layer management with drag-drop reordering

import { state, getLayersSortedByZIndex } from '../core/state.js';
import { showLayerContextMenu } from './context-menu.js';

// Track drag state
let draggedLayerName = null;

/**
 * Update the layer panel UI
 * Layers are sorted by z-index (highest first = top of list = rendered on top)
 */
export function updateLayerPanel() {
  const container = document.getElementById('layer-list');
  if (!container) return;

  if (state.layers.size === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>No layers loaded</div>
        <div class="empty-state-hint">load(sample) or drag & drop</div>
      </div>`;
    updateStatusBar();
    return;
  }

  // Get layers sorted by z-index (highest first)
  const sortedLayers = getLayersSortedByZIndex();

  let html = '';
  sortedLayers.forEach(layer => {
    const visClass = layer.visible ? '' : 'hidden';
    // Show appropriate info based on layer type
    let info;
    if (layer.count !== undefined) {
      info = `(${layer.count})`;
    } else if (layer.width !== undefined) {
      info = `(${layer.width}×${layer.height})`;
    } else {
      info = '';
    }
    html += `
      <div class="layer-item"
           draggable="true"
           data-layer-name="${layer.name}"
           ondragstart="handleLayerDragStart(event)"
           ondragover="handleLayerDragOver(event)"
           ondrop="handleLayerDrop(event)"
           ondragend="handleLayerDragEnd(event)"
           oncontextmenu="handleLayerContextMenu(event, '${layer.name}')">
        <span class="layer-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="layer-visibility ${visClass}" onclick="toggleVis('${layer.name}')">&#128065;</span>
        <span class="layer-name">${layer.name}</span>
        <span class="layer-count">${info}</span>
        <div class="layer-actions">
          <button onclick="runInTerminal('${layer.name}.zoom()')" title="Zoom">&#8982;</button>
          <button onclick="runInTerminal('${layer.name}.remove()')" title="Remove">&times;</button>
        </div>
      </div>`;
  });

  // Drop zone at bottom for dragging to end of list
  html += `
    <div class="layer-drop-zone"
         ondragover="handleBottomDragOver(event)"
         ondrop="handleBottomDrop(event)"
         ondragleave="handleBottomDragLeave(event)">
    </div>`;

  container.innerHTML = html;
  updateStatusBar();
}

// Alias for compatibility with windows system
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

/**
 * Toggle layer visibility (called from onclick)
 */
window.toggleVis = function(name) {
  // Dynamic import to avoid circular dependency
  import('../core/api.js').then(({ sp }) => {
    const layer = sp[name];
    if (layer) {
      const cmd = layer.visible ? `${name}.hide()` : `${name}.show()`;
      window.runInTerminal(cmd);
    }
  });
};

/**
 * Handle drag start
 */
window.handleLayerDragStart = function(e) {
  draggedLayerName = e.target.dataset.layerName;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedLayerName);
};

/**
 * Handle drag over - determine drop position
 */
window.handleLayerDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const item = e.target.closest('.layer-item');
  if (!item || item.dataset.layerName === draggedLayerName) return;

  // Remove existing drop indicators
  document.querySelectorAll('.layer-item').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });

  // Determine if dropping above or below
  const rect = item.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    item.classList.add('drop-above');
  } else {
    item.classList.add('drop-below');
  }
};

/**
 * Handle drop - reorder layers
 */
window.handleLayerDrop = function(e) {
  e.preventDefault();

  const targetItem = e.target.closest('.layer-item');
  if (!targetItem || !draggedLayerName) return;

  const targetName = targetItem.dataset.layerName;
  if (targetName === draggedLayerName) return;

  // Determine drop position
  const rect = targetItem.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const dropAbove = e.clientY < midY;

  // Get current sorted order
  const sortedLayers = getLayersSortedByZIndex();
  const layerNames = sortedLayers.map(l => l.name);

  // Remove dragged layer from current position
  const draggedIndex = layerNames.indexOf(draggedLayerName);
  layerNames.splice(draggedIndex, 1);

  // Find target index and insert
  let targetIndex = layerNames.indexOf(targetName);
  if (!dropAbove) {
    targetIndex += 1;
  }
  layerNames.splice(targetIndex, 0, draggedLayerName);

  // Recalculate z-indices based on new order
  // Top of list (index 0) should have highest z-index
  import('../core/api.js').then(({ sp }) => {
    const baseZ = 100;
    layerNames.forEach((name, index) => {
      const layer = sp[name];
      if (layer && layer.zIndex) {
        // Higher z for lower index (top of list = top of render stack)
        const newZ = baseZ + (layerNames.length - index);
        layer._zIndex = newZ;
        layer._olLayer.setZIndex(newZ);
      }
    });

    // Echo the reorder command to terminal
    const fromPos = sortedLayers.length - draggedIndex;
    const toPos = layerNames.length - targetIndex;
    window.runInTerminal(`// Reordered: ${draggedLayerName} moved ${dropAbove ? 'above' : 'below'} ${targetName}`);

    // Update the panel
    updateLayerPanel();
  });
};

/**
 * Handle drag end - cleanup
 */
window.handleLayerDragEnd = function(e) {
  draggedLayerName = null;
  document.querySelectorAll('.layer-item').forEach(el => {
    el.classList.remove('dragging', 'drop-above', 'drop-below');
  });
  document.querySelectorAll('.layer-drop-zone').forEach(el => {
    el.classList.remove('active');
  });
};

/**
 * Handle drag over bottom drop zone
 */
window.handleBottomDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.target.classList.add('active');

  // Clear other indicators
  document.querySelectorAll('.layer-item').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });
};

/**
 * Handle drag leave bottom drop zone
 */
window.handleBottomDragLeave = function(e) {
  e.target.classList.remove('active');
};

/**
 * Handle drop on bottom zone - move layer to bottom (lowest z-index)
 */
window.handleBottomDrop = function(e) {
  e.preventDefault();
  e.target.classList.remove('active');

  if (!draggedLayerName) return;

  // Get current sorted order
  const sortedLayers = getLayersSortedByZIndex();
  const layerNames = sortedLayers.map(l => l.name);

  // Remove dragged layer from current position
  const draggedIndex = layerNames.indexOf(draggedLayerName);
  if (draggedIndex === layerNames.length - 1) {
    // Already at bottom
    return;
  }

  layerNames.splice(draggedIndex, 1);
  // Add to end (bottom of list = lowest z-index)
  layerNames.push(draggedLayerName);

  // Recalculate z-indices
  import('../core/api.js').then(({ sp }) => {
    const baseZ = 100;
    layerNames.forEach((name, index) => {
      const layer = sp[name];
      if (layer && layer.zIndex) {
        const newZ = baseZ + (layerNames.length - index);
        layer._zIndex = newZ;
        layer._olLayer.setZIndex(newZ);
      }
    });

    window.runInTerminal(`// Reordered: ${draggedLayerName} moved to bottom`);
    updateLayerPanel();
  });
};

/**
 * Handle right-click on layer - show context menu
 */
window.handleLayerContextMenu = function(e, layerName) {
  e.preventDefault();
  e.stopPropagation();

  import('../core/api.js').then(({ sp }) => {
    const layer = sp[layerName];
    if (layer) {
      showLayerContextMenu(e, layer);
    }
  });
};
