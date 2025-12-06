// Spinifex - Global State
// Central state management for the application

export const state = {
  layers: new Map(),
  crs: 'EPSG:4326',
  history: [],
  historyIndex: -1,
  layerCounter: 0,
  zIndexCounter: 100,  // Start at 100 to leave room for basemaps
  selection: null
};

/**
 * Get layers sorted by z-index (descending - highest first for display)
 * Top of list = rendered on top
 */
export function getLayersSortedByZIndex() {
  return Array.from(state.layers.values()).sort((a, b) => {
    const zA = a.zIndex ? a.zIndex() : 0;
    const zB = b.zIndex ? b.zIndex() : 0;
    return zB - zA;  // Descending: highest z-index first
  });
}

// Geology-specific color palette
export const geologyColors = {
  granite: '#ff9999',
  bif: '#666666',
  mafic: '#669966',
  schist: '#cc99ff',
  sandstone: '#f4a460',
  limestone: '#d3d3d3',
  basalt: '#2f4f4f',
  gneiss: '#dda0dd'
};

// Default colors for auto-assignment
export const defaultColors = [
  '#4a9eff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3',
  '#f38181', '#aa96da', '#fcbad3', '#a8d8ea', '#ffb6b9'
];
