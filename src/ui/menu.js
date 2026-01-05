// Spinifex - Menu Bar Module
// Dropdown menu interactions

import { windows } from './windows.js';
import { ws } from '../core/workspace.js';
import { termPrint } from './terminal.js';
import { setBasemap, getBasemaps, listBasemaps, getCustomBasemaps, removeCustomBasemap } from './map.js';
import { toolbox } from '../core/toolbox.js';
import { openToolPanel, openToolWithId } from './tool-panel.js';

let openMenu = null;

/**
 * Initialize menu bar interactions
 */
export function initMenuBar() {
  const menuBar = document.querySelector('.menu-bar');
  if (!menuBar) return;

  // Handle menu trigger clicks
  menuBar.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuItem = trigger.closest('.menu-item');

      if (menuItem.classList.contains('open')) {
        closeAllMenus();
      } else {
        closeAllMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });

    // Hover to switch menus when one is open
    trigger.addEventListener('mouseenter', () => {
      if (openMenu && openMenu !== trigger.closest('.menu-item')) {
        closeAllMenus();
        const menuItem = trigger.closest('.menu-item');
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  });

  // Handle menu option clicks
  menuBar.querySelectorAll('.menu-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = option.dataset.action;
      if (action && !option.classList.contains('disabled')) {
        closeAllMenus();
        handleMenuAction(action);
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', () => {
    closeAllMenus();
  });

  // Close menus on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus();
    }
  });
}

/**
 * Close all open menus
 */
function closeAllMenus() {
  document.querySelectorAll('.menu-item.open').forEach(item => {
    item.classList.remove('open');
  });
  openMenu = null;
}

/**
 * Populate a menu dropdown from toolbox tools
 * @param {HTMLElement} dropdown - The dropdown element to populate
 * @param {string} category - Category to filter by
 * @param {Object} options - Options for grouping
 */
function populateMenuFromToolbox(dropdown, category, options = {}) {
  const tools = toolbox.list(category);
  if (tools.length === 0) {
    dropdown.innerHTML = '<div class="menu-option disabled">No tools available</div>';
    return;
  }

  // Group tools by subcategory if specified
  const groups = options.groups || {};
  const groupedTools = {};
  const ungrouped = [];

  tools.forEach(tool => {
    let placed = false;
    for (const [groupName, filter] of Object.entries(groups)) {
      if (filter(tool)) {
        if (!groupedTools[groupName]) groupedTools[groupName] = [];
        groupedTools[groupName].push(tool);
        placed = true;
        break;
      }
    }
    if (!placed) ungrouped.push(tool);
  });

  let html = '';

  // Render grouped tools
  for (const [groupName, groupTools] of Object.entries(groupedTools)) {
    if (groupTools.length > 0) {
      if (html) html += '<div class="menu-separator"></div>';
      html += `<div class="menu-group-label">${groupName}</div>`;
      groupTools.forEach(tool => {
        html += `<div class="menu-option" data-action="tool:${tool.id}">${tool.name}</div>`;
      });
    }
  }

  // Render ungrouped tools
  if (ungrouped.length > 0) {
    if (html) html += '<div class="menu-separator"></div>';
    ungrouped.forEach(tool => {
      html += `<div class="menu-option" data-action="tool:${tool.id}">${tool.name}</div>`;
    });
  }

  dropdown.innerHTML = html;

  // Attach click handlers
  dropdown.querySelectorAll('.menu-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = option.dataset.action;
      if (action && !option.classList.contains('disabled')) {
        closeAllMenus();
        handleMenuAction(action);
      }
    });
  });
}

/**
 * Populate all dynamic menus from toolbox
 */
export function populateToolMenus() {
  // Populate Vector menu
  const vectorDropdown = document.querySelector('[data-menu="vector"]');
  if (vectorDropdown) {
    populateMenuFromToolbox(vectorDropdown, 'Vector', {
      groups: {
        'Overlay': t => ['clip', 'intersect', 'union'].some(k => t.id.includes(k)),
        'Geometry': t => ['buffer', 'centroid', 'voronoi', 'dissolve'].some(k => t.id.includes(k)),
      }
    });
  }

  // Populate Raster menu
  const rasterDropdown = document.querySelector('[data-menu="raster"]');
  if (rasterDropdown) {
    populateMenuFromToolbox(rasterDropdown, 'Raster', {
      groups: {
        'Terrain Analysis': t => ['hillshade', 'slope', 'aspect', 'contours', 'tri', 'tpi', 'roughness'].some(k => t.id.includes(k)),
        'Processing': t => ['reproject', 'resample', 'clip', 'mosaic', 'rasterize'].some(k => t.id.includes(k)),
        'Raster Algebra': t => ['calc', 'ndvi', 'ndwi', 'difference', 'ratio', 'threshold'].some(k => t.id.includes(k)),
      }
    });
  }

  // Populate Tools menu with Measurement and Export
  const toolsDropdown = document.querySelector('[data-menu="tools"]');
  if (toolsDropdown) {
    const measureTools = toolbox.list('Measurement');
    const exportTools = toolbox.list('Export');
    const utilTools = toolbox.list('Utilities');

    let html = '';

    // Measurement tools
    if (measureTools.length > 0) {
      html += '<div class="menu-group-label">Measurement</div>';
      measureTools.forEach(tool => {
        html += `<div class="menu-option" data-action="tool:${tool.id}">${tool.name}</div>`;
      });
    }

    // Export tools
    if (exportTools.length > 0) {
      if (html) html += '<div class="menu-separator"></div>';
      html += '<div class="menu-group-label">Export</div>';
      exportTools.forEach(tool => {
        html += `<div class="menu-option" data-action="tool:${tool.id}">${tool.name}</div>`;
      });
    }

    // Utility tools
    if (utilTools.length > 0) {
      if (html) html += '<div class="menu-separator"></div>';
      utilTools.forEach(tool => {
        html += `<div class="menu-option" data-action="tool:${tool.id}">${tool.name}</div>`;
      });
    }

    // Tool Panel link
    html += '<div class="menu-separator"></div>';
    html += '<div class="menu-option" data-action="open-tool-panel">All Tools...</div>';

    toolsDropdown.innerHTML = html;

    // Attach click handlers
    toolsDropdown.querySelectorAll('.menu-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = option.dataset.action;
        if (action && !option.classList.contains('disabled')) {
          closeAllMenus();
          handleMenuAction(action);
        }
      });
    });
  }
}

/**
 * Handle menu action
 */
async function handleMenuAction(action) {
  switch (action) {
    // Workspace
    case 'ws-new':
      ws.new();
      break;
    case 'ws-open':
      ws.connect();
      break;
    case 'ws-recent':
      ws.recent();
      break;
    case 'ws-save':
      ws.save();
      break;
    case 'ws-versions':
      import('./windows.js').then(m => m.openVersioningWindow());
      break;
    case 'ws-export':
      ws.export();
      break;

    // Layer
    case 'layer-add':
      window.spOpen?.() || window.runInTerminal?.('open()');
      break;
    case 'layer-sample':
      window.runInTerminal?.('load(sample)');
      break;
    case 'layer-clear':
      window.clear?.();
      break;

    // Basemaps - CartoDB
    case 'basemap-dark':
      setBasemap('dark');
      break;
    case 'basemap-light':
      setBasemap('light');
      break;
    case 'basemap-voyager':
      setBasemap('voyager');
      break;

    // Basemaps - OSM
    case 'basemap-osm':
      setBasemap('osm');
      break;
    case 'basemap-topo':
      setBasemap('topo');
      break;

    // Basemaps - Stamen
    case 'basemap-stamen-toner':
      setBasemap('stamen-toner');
      break;
    case 'basemap-stamen-toner-lite':
      setBasemap('stamen-toner-lite');
      break;
    case 'basemap-stamen-terrain':
      setBasemap('stamen-terrain');
      break;
    case 'basemap-stamen-watercolor':
      setBasemap('stamen-watercolor');
      break;

    // Basemaps - ESRI
    case 'basemap-satellite':
      setBasemap('satellite');
      break;
    case 'basemap-esri-topo':
      setBasemap('esri-topo');
      break;
    case 'basemap-esri-street':
      setBasemap('esri-street');
      break;

    // Basemaps - Custom & Clear
    case 'basemap-custom':
      promptCustomBasemap();
      break;
    case 'basemap-clear':
      import('./map.js').then(({ clearBasemaps }) => clearBasemaps());
      break;

    // Vector operations - paste to terminal for user to complete
    case 'vector-buffer':
      window.pasteToTerminal?.('buffer(layer, "100m")', -6);
      break;
    case 'vector-clip':
      window.pasteToTerminal?.('clip(layer, mask)');
      break;
    case 'vector-intersect':
      window.pasteToTerminal?.('intersect(layer1, layer2)');
      break;
    case 'vector-union':
      window.pasteToTerminal?.('union(layer1, layer2)');
      break;
    case 'vector-dissolve':
      window.pasteToTerminal?.('dissolve(layer, "field")');
      break;
    case 'vector-centroid':
      window.pasteToTerminal?.('centroid(layer)');
      break;
    case 'vector-voronoi':
      window.pasteToTerminal?.('voronoi(points)');
      break;

    // Tools - measurement
    case 'tool-distance':
      window.runInTerminal?.('measure.distance()');
      break;
    case 'tool-area':
      window.runInTerminal?.('measure.area()');
      break;
    case 'tool-bearing':
      window.runInTerminal?.('measure.bearing()');
      break;

    // View
    case 'toggle-layers':
      windows.toggleLayers();
      break;
    case 'toggle-terminal':
      windows.toggleTerminal();
      break;
    case 'toggle-legend':
      windows.toggleLegend();
      break;
    case 'view-map':
      windows.switchView('map2d');
      break;
    case 'view-3d':
      windows.switchView('map3d');
      break;

    // Settings
    case 'open-settings':
      windows.openSettings();
      break;

    // Help
    case 'show-help':
      // Run help() in terminal
      window.runInTerminal?.('help()');
      break;
    case 'show-about':
      showAboutDialog();
      break;

    // Tool Panel
    case 'open-tool-panel':
      openToolPanel();
      break;

    default:
      // Check for tool: prefix
      if (action.startsWith('tool:')) {
        const toolId = action.slice(5);
        openToolWithId(toolId);
      } else {
        termPrint(`Unknown menu action: ${action}`, 'yellow');
      }
  }
}

/**
 * Prompt for custom basemap URL
 */
function promptCustomBasemap() {
  const customs = getCustomBasemaps();
  const content = document.createElement('div');
  content.className = 'custom-basemap-form';
  content.style.cssText = 'padding: 12px;';

  // Build saved basemaps list if any
  let savedHtml = '';
  if (customs.length > 0) {
    savedHtml = `
      <div style="margin-bottom: 16px;">
        <div style="margin-bottom: 6px; color: var(--text-dim); font-size: 11px;">Saved basemaps:</div>
        <div id="saved-basemaps" style="max-height: 100px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
          ${customs.map((c, i) => `
            <div class="saved-basemap-item" data-index="${i}" style="padding: 6px 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);">
              <span style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${c.url.length > 45 ? c.url.slice(0, 42) + '...' : c.url}</span>
              <span class="remove-saved" data-index="${i}" style="color: var(--red); cursor: pointer; margin-left: 8px; font-size: 14px;">&times;</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <p style="margin-bottom: 12px; color: var(--text-dim); font-size: 11px;">
      Enter an XYZ tile URL with {z}, {x}, {y} placeholders.<br>
      <span style="color: var(--yellow);">Note:</span> Ensure you comply with the provider's terms of service.
    </p>
    ${savedHtml}
    <label style="display: block; margin-bottom: 8px;">
      <span style="display: block; margin-bottom: 4px;">Tile URL:</span>
      <input type="text" id="custom-basemap-url"
        placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
        style="width: 100%; padding: 6px 8px; background: var(--bg-input); border: 1px solid var(--border); color: var(--text); font-family: inherit; font-size: 12px;">
    </label>
    <label style="display: block; margin-bottom: 16px;">
      <span style="display: block; margin-bottom: 4px;">Attribution (optional):</span>
      <input type="text" id="custom-basemap-attr"
        placeholder="© Provider Name"
        style="width: 100%; padding: 6px 8px; background: var(--bg-input); border: 1px solid var(--border); color: var(--text); font-family: inherit; font-size: 12px;">
    </label>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="custom-basemap-cancel" class="btn">Cancel</button>
      <button id="custom-basemap-apply" class="btn btn-primary">Apply</button>
    </div>
  `;

  const win = new WinBox({
    title: 'Custom Basemap',
    class: ['custom-basemap-window'],
    x: 'center',
    y: 'center',
    width: 450,
    height: customs.length > 0 ? 340 : 240,
    minwidth: 380,
    minheight: 220,
    mount: content
  });

  const urlInput = content.querySelector('#custom-basemap-url');
  const attrInput = content.querySelector('#custom-basemap-attr');
  const cancelBtn = content.querySelector('#custom-basemap-cancel');
  const applyBtn = content.querySelector('#custom-basemap-apply');

  urlInput.focus();

  // Click saved basemap to fill inputs
  content.querySelectorAll('.saved-basemap-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-saved')) return;
      const idx = parseInt(item.dataset.index);
      const saved = customs[idx];
      if (saved) {
        urlInput.value = saved.url;
        attrInput.value = saved.attribution || '';
      }
    });
  });

  // Remove saved basemap
  content.querySelectorAll('.remove-saved').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const saved = customs[idx];
      if (saved) {
        removeCustomBasemap(saved.url);
        btn.closest('.saved-basemap-item').remove();
        termPrint('Removed saved basemap', 'dim');
      }
    });
  });

  cancelBtn.addEventListener('click', () => win.close());

  applyBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
      termPrint('Please enter a tile URL', 'red');
      return;
    }
    if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
      termPrint('URL must contain {z}, {x}, {y} placeholders', 'red');
      return;
    }
    const attr = attrInput.value.trim() || undefined;
    setBasemap(url, attr);
    win.close();
  });

  // Enter key to apply
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyBtn.click();
    if (e.key === 'Escape') win.close();
  });
  attrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyBtn.click();
    if (e.key === 'Escape') win.close();
  });
}

/**
 * Show About dialog
 */
function showAboutDialog() {
  // Create a simple about window
  const content = document.createElement('div');
  content.className = 'about-content';
  content.innerHTML = `
    <div class="about-logo">
      <span class="about-title">SPINIFEX</span>
      <span class="about-subtitle">ultrabasic web gis</span>
    </div>
    <div class="about-info">
      <p>A browser-based GIS with a JavaScript REPL.</p>
      <p>Built with OpenLayers, Turf.js, and xterm.js.</p>
    </div>
    <div class="about-links">
      <p>Type <code>help()</code> in the terminal for API reference.</p>
    </div>
  `;

  new WinBox({
    title: 'About Spinifex',
    class: ['about-window'],
    x: 'center',
    y: 'center',
    width: 360,
    height: 280,
    minwidth: 300,
    minheight: 220,
    mount: content
  });
}
