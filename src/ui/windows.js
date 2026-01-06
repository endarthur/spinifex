// Spinifex - Window Manager
// WinBox-based windowing system for panels

import { state, getLayersSortedByZIndex } from '../core/state.js';
import { term, pasteToTerminal } from './terminal.js';
import { renderLayerList } from './layers-panel.js';
import { showContextMenu, hideContextMenu } from './context-menu.js';
import {
  applyStyle,
  generateRulesFromField,
  getColorScaleNames,
  getTransformationNames,
  getFieldStats,
  colorScales
} from '../core/styling.js';
import { COLOR_RAMPS } from '../core/raster-layer.js';
import { persistentSettings } from '../core/settings.js';
import { VERSION, BUILD_DATE } from '../core/version.js';
import { openAttributeTable as openAttributeTableImpl, clearHighlight } from './windows/attribute-table.js';
import { openLegend as openLegendImpl, toggleLegend as toggleLegendImpl, updateLegendContent as updateLegendContentImpl, setLegendWindow } from './windows/legend.js';
import { openSettings as openSettingsImpl, getTheme, applyTheme } from './windows/settings.js';
import { openLayerProperties as openLayerPropertiesImpl, getLayerPropsWindows } from './windows/layer-props.js';

// Window instances (remaining in this module)
let layersWindow = null;
let terminalWindow = null;
let workspacesWindow = null;
let versioningWindow = null;
// Note: settingsWindow, legendWindow, layerPropsWindows, attributeTableWindows
// are now managed by their respective modules in ./windows/

// Default window positions/sizes
const defaults = {
  layers: { x: 20, y: 80, width: 240, height: 350 },
  terminal: { x: 20, y: 'bottom', width: 800, height: 280, bottom: 50 },
  layerProps: { width: 440, height: 560 },
  legend: { width: 220, height: 300 },
  attributeTable: { width: 700, height: 400 },
  workspaces: { width: 340, height: 360 },
  versioning: { width: 400, height: 450 }
};

/**
 * Initialize the window system
 */
export function initWindows() {
  // Load saved theme
  const theme = persistentSettings.get('ui.theme', 'dark');
  applyTheme(theme);

  // Create initial windows
  createLayersWindow();
  createTerminalWindow();

  // Set up view tab switching
  initViewTabs();
}

// getTheme and applyTheme imported from ./windows/settings.js
export { getTheme };

/**
 * Initialize view tab switching
 */
function initViewTabs() {
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewId = tab.dataset.view;
      switchView(viewId);
    });
  });
}

/**
 * Switch to a different view tab
 */
export function switchView(viewId) {
  // Update tab states
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });

  // Update panel visibility
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `view-${viewId}`);
  });

  // Trigger map resize if switching to map view
  if (viewId === 'map2d') {
    setTimeout(() => {
      const map = window.sp?.map;
      if (map) map.updateSize();
    }, 10);
  }
}

/**
 * Create the Layers window
 */
function createLayersWindow() {
  const content = document.createElement('div');
  content.id = 'layer-list';
  content.innerHTML = `
    <div class="empty-state">
      <div>No layers loaded</div>
      <div class="empty-state-hint">load(sample) or drag & drop</div>
    </div>
  `;

  layersWindow = new WinBox({
    title: 'Layers',
    class: ['layers-window'],
    x: defaults.layers.x,
    y: defaults.layers.y,
    width: defaults.layers.width,
    height: defaults.layers.height,
    minwidth: 180,
    minheight: 150,
    mount: content,
    onclose: () => {
      layersWindow = null;
      return false; // Allow close
    }
  });

  return layersWindow;
}

/**
 * Create the Terminal window
 */
function createTerminalWindow() {
  const content = document.createElement('div');
  content.id = 'terminal-container';

  // Calculate position from bottom
  const viewportHeight = window.innerHeight;
  const statusBarHeight = 30;
  const y = viewportHeight - defaults.terminal.height - statusBarHeight - 36 - 32; // header + tabs

  terminalWindow = new WinBox({
    title: 'Terminal',
    class: ['terminal-window'],
    x: defaults.terminal.x,
    y: Math.max(80, y),
    width: defaults.terminal.width,
    height: defaults.terminal.height,
    minwidth: 300,
    minheight: 120,
    mount: content,
    // ResizeObserver handles most resize events, but WinBox events help catch edge cases
    onresize: () => term?._debouncedFit?.(),
    onmaximize: () => setTimeout(() => term?._debouncedFit?.(), 50),
    onminimize: () => setTimeout(() => term?._debouncedFit?.(), 50),
    onrestore: () => setTimeout(() => term?._debouncedFit?.(), 50),
    onfullscreen: () => setTimeout(() => term?._debouncedFit?.(), 50),
    onclose: () => {
      if (term?._resizeObserver) {
        term._resizeObserver.disconnect();
      }
      terminalWindow = null;
      return false;
    }
  });

  return terminalWindow;
}

/**
 * Toggle Layers window visibility
 */
export function toggleLayers() {
  if (layersWindow) {
    layersWindow.close();
    layersWindow = null;
  } else {
    createLayersWindow();
    renderLayerList();
  }
}

/**
 * Toggle Terminal window visibility
 */
export function toggleTerminal() {
  if (terminalWindow) {
    // Clean up ResizeObserver before closing
    if (term && term._resizeObserver) {
      term._resizeObserver.disconnect();
    }
    terminalWindow.close();
    terminalWindow = null;
  } else {
    createTerminalWindow();
    // Re-init terminal in new container
    if (term) {
      const container = document.getElementById('terminal-container');
      if (container) {
        term.open(container);

        // Set up ResizeObserver for the new container
        if (window.ResizeObserver && term._debouncedFit) {
          if (term._resizeObserver) {
            term._resizeObserver.disconnect();
          }
          const resizeObserver = new ResizeObserver(() => {
            term._debouncedFit();
          });
          resizeObserver.observe(container);
          term._resizeObserver = resizeObserver;
        }

        // Trigger fit with retries
        if (term._debouncedFit) {
          term._debouncedFit();
          setTimeout(() => term._debouncedFit(), 100);
          setTimeout(() => term._debouncedFit(), 300);
        }
      }
    }
  }
}

/**
 * Show Layers window (create if needed)
 */
export function showLayers() {
  if (!layersWindow) {
    createLayersWindow();
  }
  layersWindow.focus();
  renderLayerList();
}

/**
 * Show Terminal window (create if needed)
 */
export function showTerminal() {
  if (!terminalWindow) {
    toggleTerminal(); // This creates and reopens terminal
  }
  terminalWindow.focus();
}

/**
 * Open Layer Properties window for a specific layer
 * (Delegated to windows/layer-props.js)
 */
export function openLayerProperties(layer, tab = 'info') {
  return openLayerPropertiesImpl(layer, tab);
}


/**
 * Get the Layers window instance
 */
export function getLayersWindow() {
  return layersWindow;
}

/**
 * Get the Terminal window instance
 */
export function getTerminalWindow() {
  return terminalWindow;
}

/**
 * Open Settings window
 * (Delegated to windows/settings.js)
 */
export function openSettings() {
  return openSettingsImpl();
}


/**
 * Open or refresh the Legend window
 * (Delegated to windows/legend.js)
 */
export function openLegend() {
  return openLegendImpl();
}

/**
 * Toggle legend window
 * (Delegated to windows/legend.js)
 */
export function toggleLegend() {
  return toggleLegendImpl();
}

/**
 * Update legend content based on current layers
 * (Delegated to windows/legend.js)
 */
export function updateLegendContent() {
  return updateLegendContentImpl();
}


/**
 * Open Attribute Table window for a layer
 * (Delegated to windows/attribute-table.js)
 */
export function openAttributeTable(layer) {
  return openAttributeTableImpl(layer, showTerminal);
}


// ============================================
// Workspaces Window
// ============================================

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days === 1 ? 'Yesterday' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'Just now';
}

/**
 * Open Workspaces window showing recent workspaces
 */
export async function openWorkspacesWindow() {
  // Import workspace functions
  const {
    getWorkspaceHistory,
    removeFromHistory,
    connectToWorkspace,
    ws
  } = await import('../core/workspace.js');

  if (workspacesWindow) {
    // Refresh content and focus
    await updateWorkspacesContent(getWorkspaceHistory, removeFromHistory, connectToWorkspace, ws);
    workspacesWindow.focus();
    return;
  }

  const content = document.createElement('div');
  content.className = 'workspaces-content';
  content.id = 'workspaces-content';

  workspacesWindow = new WinBox({
    title: 'Recent Workspaces',
    class: ['workspaces-window'],
    x: 'center',
    y: 'center',
    width: defaults.workspaces.width,
    height: defaults.workspaces.height,
    minwidth: 280,
    minheight: 200,
    mount: content,
    onclose: () => {
      workspacesWindow = null;
      return false;
    }
  });

  await updateWorkspacesContent(getWorkspaceHistory, removeFromHistory, connectToWorkspace, ws);
}

/**
 * Update workspaces window content
 */
async function updateWorkspacesContent(getWorkspaceHistory, removeFromHistory, connectToWorkspace, ws) {
  const container = document.getElementById('workspaces-content');
  if (!container) return;

  const history = await getWorkspaceHistory();

  let html = '<div class="workspaces-list">';

  if (history.length === 0) {
    html += '<div class="workspaces-empty">No recent workspaces</div>';
  } else {
    history.forEach((entry, index) => {
      const isConnected = ws.connected && ws.name === entry.name;
      const statusClass = isConnected ? 'workspace-connected' : '';
      const statusBadge = isConnected ? '<span class="workspace-badge">Connected</span>' : '';

      html += `
        <div class="workspace-item ${statusClass}" data-index="${index}" data-name="${entry.name}">
          <div class="workspace-info">
            <div class="workspace-name">${entry.name}${statusBadge}</div>
            <div class="workspace-time">${formatRelativeTime(entry.lastAccessed)}</div>
          </div>
          <button class="workspace-remove" data-name="${entry.name}" title="Remove from history">×</button>
        </div>
      `;
    });
  }

  html += '</div>';

  html += `
    <div class="workspaces-actions">
      <button class="btn btn-primary" id="ws-connect-new">Connect New...</button>
    </div>
  `;

  container.innerHTML = html;

  // Add event listeners
  container.querySelectorAll('.workspace-item').forEach(item => {
    item.addEventListener('dblclick', async (e) => {
      if (e.target.classList.contains('workspace-remove')) return;
      const name = item.dataset.name;
      await connectToWorkspace(name);
      if (workspacesWindow) {
        workspacesWindow.close();
        workspacesWindow = null;
      }
    });
  });

  container.querySelectorAll('.workspace-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = btn.dataset.name;
      await removeFromHistory(name);
      await updateWorkspacesContent(getWorkspaceHistory, removeFromHistory, connectToWorkspace, ws);
    });
  });

  document.getElementById('ws-connect-new')?.addEventListener('click', async () => {
    await ws.connect();
    if (workspacesWindow) {
      workspacesWindow.close();
      workspacesWindow = null;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Versioning Window
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Open the versioning/snapshots window
 */
export async function openVersioningWindow() {
  const { versioning, v } = await import('../core/versioning.js');
  const { workspace } = await import('../core/workspace.js');

  if (versioningWindow) {
    await updateVersioningContent(v, workspace);
    versioningWindow.focus();
    return;
  }

  const content = document.createElement('div');
  content.className = 'versioning-content';
  content.id = 'versioning-content';

  versioningWindow = new WinBox({
    title: 'Version History',
    class: ['versioning-window'],
    x: 'center',
    y: 'center',
    width: defaults.versioning.width,
    height: defaults.versioning.height,
    minwidth: 320,
    minheight: 300,
    mount: content,
    onclose: () => {
      versioningWindow = null;
      return false;
    }
  });

  await updateVersioningContent(v, workspace);
}

/**
 * Update versioning window content
 */
async function updateVersioningContent(v, workspace) {
  const container = document.getElementById('versioning-content');
  if (!container) return;

  // Check workspace connection
  if (!workspace.connected) {
    container.innerHTML = `
      <div class="versioning-empty">
        <p>No workspace connected.</p>
        <p class="versioning-hint">Use <code>ws.connect()</code> to connect to a folder first.</p>
      </div>
    `;
    return;
  }

  // Build UI
  let html = '';

  // Create version form
  html += `
    <div class="versioning-create">
      <div class="versioning-form-row">
        <input type="text" id="version-message" placeholder="Version message..." class="versioning-input">
        <button id="version-save-btn" class="btn btn-primary">Save</button>
      </div>
      <div class="versioning-form-row">
        <label class="versioning-checkbox">
          <input type="checkbox" id="version-full">
          <span>Full snapshot (include all data)</span>
        </label>
      </div>
    </div>
  `;

  // Version list
  html += '<div class="versioning-list" id="version-list">';

  try {
    // Get versions without terminal output (direct manifest read)
    const { workspace: ws } = await import('../core/workspace.js');
    const manifestPath = '.versions/manifest.json';
    let versions = [];

    if (await ws.exists(manifestPath)) {
      const content = await ws.readFile(manifestPath);
      const manifest = JSON.parse(content);
      versions = manifest.versions || [];
    }

    if (versions.length === 0) {
      html += '<div class="versioning-empty">No versions yet</div>';
    } else {
      // Show versions in reverse order (newest first)
      for (const ver of [...versions].reverse()) {
        const date = new Date(ver.timestamp);
        const relTime = formatRelativeTime(ver.timestamp);
        const fullBadge = ver.full ? '<span class="version-badge full">Full</span>' : '<span class="version-badge light">Light</span>';
        const layerInfo = `${ver.layerCount} layer${ver.layerCount !== 1 ? 's' : ''}`;

        html += `
          <div class="version-item" data-id="${ver.id}">
            <div class="version-header">
              <span class="version-id">v${ver.id}</span>
              ${fullBadge}
              <span class="version-time" title="${date.toLocaleString()}">${relTime}</span>
            </div>
            <div class="version-message">${escapeHtml(ver.message)}</div>
            <div class="version-meta">${layerInfo}</div>
            <div class="version-actions">
              <button class="version-btn version-restore" data-id="${ver.id}" title="Restore this version">Restore</button>
              <button class="version-btn version-details" data-id="${ver.id}" title="Show details">Details</button>
              <button class="version-btn version-delete" data-id="${ver.id}" title="Delete this version">×</button>
            </div>
          </div>
        `;
      }
    }
  } catch (e) {
    html += `<div class="versioning-error">Error loading versions: ${e.message}</div>`;
  }

  html += '</div>';

  container.innerHTML = html;

  // Event listeners
  const saveBtn = document.getElementById('version-save-btn');
  const messageInput = document.getElementById('version-message');
  const fullCheckbox = document.getElementById('version-full');

  saveBtn?.addEventListener('click', async () => {
    const message = messageInput.value.trim() || `Version ${Date.now()}`;
    const full = fullCheckbox.checked;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await v.save(message, { full });
      messageInput.value = '';
      fullCheckbox.checked = false;
      await updateVersioningContent(v, workspace);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  // Enter key to save
  messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveBtn?.click();
    }
  });

  // Restore buttons
  container.querySelectorAll('.version-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      if (confirm(`Restore to version ${id}? This will clear current layers.`)) {
        btn.disabled = true;
        btn.textContent = 'Restoring...';
        try {
          await v.restore(id);
          if (versioningWindow) {
            versioningWindow.close();
            versioningWindow = null;
          }
        } catch (e) {
          console.error('Restore failed:', e);
          btn.disabled = false;
          btn.textContent = 'Restore';
        }
      }
    });
  });

  // Details buttons
  container.querySelectorAll('.version-details').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      await v.show(id);  // Outputs to terminal
    });
  });

  // Delete buttons
  container.querySelectorAll('.version-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      if (confirm(`Delete version ${id}?`)) {
        await v.remove(id);
        await updateVersioningContent(v, workspace);
      }
    });
  });
}
// Export window manager object for global access
export const windows = {
  toggleLayers,
  toggleTerminal,
  showLayers,
  showTerminal,
  openLayerProperties,
  openAttributeTable,
  openSettings,
  openLegend,
  toggleLegend,
  openWorkspacesWindow,
  openVersioningWindow,
  switchView
};
