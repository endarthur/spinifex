// Spinifex - Main Entry Point
// Initializes all modules and starts the application

import { initMap, getMap } from './ui/map.js';
import { initTerminal } from './ui/terminal.js';
import { initDragDrop } from './ui/drag-drop.js';
import { initWindows, windows } from './ui/windows.js';
import { initMenuBar, populateToolMenus } from './ui/menu.js';
import { ws } from './core/workspace.js';
import { mapTools } from './core/map-tools.js';

// Import API to register globals and executor
import './core/api.js';

/**
 * Initialize Spinifex
 */
async function init() {
  // Initialize map first (other modules depend on it)
  initMap();

  // Initialize map tools manager
  mapTools.init(getMap());

  // Initialize windows system (creates WinBox containers)
  initWindows();

  // Initialize terminal (mounts to terminal container created by windows)
  initTerminal();

  // Initialize menu bar
  initMenuBar();

  // Populate tool menus from toolbox registry
  populateToolMenus();

  // Setup drag and drop
  initDragDrop();

  // Expose windows manager globally
  window.sp = window.sp || {};
  window.sp.windows = windows;

  // Try to reconnect to previous workspace (after a short delay for terminal to be ready)
  setTimeout(() => {
    ws.reconnect().catch(() => {});
  }, 500);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
