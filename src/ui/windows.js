// Spinifex - Window Manager
// WinBox-based windowing system for panels

import { state, getLayersSortedByZIndex } from '../core/state.js';
import { term } from './terminal.js';
import { renderLayerList } from './layers-panel.js';
import {
  applyStyle,
  generateRulesFromField,
  getColorScaleNames,
  getTransformationNames,
  getFieldStats,
  colorScales
} from '../core/styling.js';

// Window instances
let layersWindow = null;
let terminalWindow = null;
let settingsWindow = null;
let legendWindow = null;
const layerPropsWindows = new Map(); // layerId -> WinBox

// Settings storage
const SETTINGS_KEY = 'spinifex_settings';
let settings = {
  theme: 'dark'
};

// Default window positions/sizes
const defaults = {
  layers: { x: 20, y: 80, width: 240, height: 350 },
  terminal: { x: 20, y: 'bottom', width: 600, height: 250, bottom: 50 },
  layerProps: { width: 440, height: 560 },
  legend: { width: 220, height: 300 }
};

/**
 * Initialize the window system
 */
export function initWindows() {
  // Load saved settings
  loadSettings();
  applyTheme(settings.theme);

  // Create initial windows
  createLayersWindow();
  createTerminalWindow();

  // Set up view tab switching
  initViewTabs();
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  settings.theme = theme;
}

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
 */
export function openLayerProperties(layer, tab = 'info') {
  const layerId = layer.id || layer.name;

  // If already open, focus it
  if (layerPropsWindows.has(layerId)) {
    const win = layerPropsWindows.get(layerId);
    win.focus();
    // Switch to requested tab
    switchPropsTab(win.body, tab);
    return win;
  }

  // Create content
  const content = createLayerPropsContent(layer, tab);

  // Calculate position (stagger multiple windows)
  const offset = layerPropsWindows.size * 30;

  const win = new WinBox({
    title: `${layer.name}`,
    class: ['layer-props-window'],
    x: 280 + offset,
    y: 100 + offset,
    width: defaults.layerProps.width,
    height: defaults.layerProps.height,
    minwidth: 320,
    minheight: 300,
    mount: content,
    onclose: () => {
      layerPropsWindows.delete(layerId);
      return false;
    }
  });

  layerPropsWindows.set(layerId, win);
  return win;
}

/**
 * Create Layer Properties content with tabs
 */
function createLayerPropsContent(layer, activeTab = 'info') {
  const content = document.createElement('div');
  content.className = 'layer-props-content';

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'props-tabs';
  tabBar.innerHTML = `
    <div class="props-tab ${activeTab === 'info' ? 'active' : ''}" data-tab="info">Info</div>
    <div class="props-tab ${activeTab === 'fields' ? 'active' : ''}" data-tab="fields">Fields</div>
    <div class="props-tab ${activeTab === 'style' ? 'active' : ''}" data-tab="style">Style</div>
    <div class="props-tab ${activeTab === 'labels' ? 'active' : ''}" data-tab="labels">Labels</div>
  `;

  // Tab panels
  const panels = document.createElement('div');
  panels.className = 'props-panels';

  // Info panel
  const infoPanel = createInfoPanel(layer);
  infoPanel.className = `props-panel ${activeTab === 'info' ? 'active' : ''}`;
  infoPanel.dataset.panel = 'info';
  panels.appendChild(infoPanel);

  // Fields panel
  const fieldsPanel = createFieldsPanel(layer);
  fieldsPanel.className = `props-panel ${activeTab === 'fields' ? 'active' : ''}`;
  fieldsPanel.dataset.panel = 'fields';
  panels.appendChild(fieldsPanel);

  // Style panel
  const stylePanel = createStylePanel(layer);
  stylePanel.className = `props-panel ${activeTab === 'style' ? 'active' : ''}`;
  stylePanel.dataset.panel = 'style';
  panels.appendChild(stylePanel);

  // Labels panel
  const labelsPanel = createLabelsPanel(layer);
  labelsPanel.className = `props-panel ${activeTab === 'labels' ? 'active' : ''}`;
  labelsPanel.dataset.panel = 'labels';
  panels.appendChild(labelsPanel);

  content.appendChild(tabBar);
  content.appendChild(panels);

  // Wire up tab switching
  tabBar.querySelectorAll('.props-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchPropsTab(content, tab.dataset.tab);
    });
  });

  return content;
}

/**
 * Switch active tab in layer properties
 */
function switchPropsTab(container, tabName) {
  container.querySelectorAll('.props-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  container.querySelectorAll('.props-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tabName);
  });
}

/**
 * Create Info panel content
 */
function createInfoPanel(layer) {
  const panel = document.createElement('div');
  const isRaster = !layer.geojson;

  let html = `
    <div class="props-section">
      <div class="props-row">
        <span class="props-label">Name</span>
        <span class="props-value">${layer.name}</span>
      </div>
      <div class="props-row">
        <span class="props-label">Type</span>
        <span class="props-value">${isRaster ? 'Raster' : 'Vector'}</span>
      </div>
  `;

  if (!isRaster) {
    html += `
      <div class="props-row">
        <span class="props-label">Geometry</span>
        <span class="props-value">${layer.geomType || 'Unknown'}</span>
      </div>
      <div class="props-row">
        <span class="props-label">Features</span>
        <span class="props-value">${layer.count || 0}</span>
      </div>
    `;
  } else {
    html += `
      <div class="props-row">
        <span class="props-label">Dimensions</span>
        <span class="props-value">${layer.width || '?'} x ${layer.height || '?'}</span>
      </div>
      <div class="props-row">
        <span class="props-label">Bands</span>
        <span class="props-value">${layer.bands || '?'}</span>
      </div>
    `;
  }

  if (layer._sourcePath) {
    html += `
      <div class="props-row">
        <span class="props-label">Source</span>
        <span class="props-value props-value-small">${layer._sourcePath}</span>
      </div>
    `;
  }

  if (layer.extent) {
    const ext = layer.extent;
    const extStr = `${ext.minX.toFixed(4)}, ${ext.minY.toFixed(4)}, ${ext.maxX.toFixed(4)}, ${ext.maxY.toFixed(4)}`;
    html += `
      <div class="props-row">
        <span class="props-label">Extent</span>
        <span class="props-value props-value-small">${extStr}</span>
      </div>
    `;
  }

  html += '</div>';
  panel.innerHTML = html;
  return panel;
}

/**
 * Create Fields panel content
 */
function createFieldsPanel(layer) {
  const panel = document.createElement('div');

  if (!layer.fields || layer.fields.length === 0) {
    panel.innerHTML = '<div class="props-empty">No fields available</div>';
    return panel;
  }

  let html = '<div class="props-fields-table"><table><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>';

  layer.fields.forEach(field => {
    // Determine field type from first feature
    let fieldType = 'unknown';
    if (layer.geojson && layer.geojson.features.length > 0) {
      const sampleValue = layer.geojson.features[0].properties[field];
      fieldType = typeof sampleValue;
      if (fieldType === 'number') {
        fieldType = Number.isInteger(sampleValue) ? 'integer' : 'float';
      }
    }

    html += `<tr><td>${field}</td><td class="field-type">${fieldType}</td></tr>`;
  });

  html += '</tbody></table></div>';
  panel.innerHTML = html;
  return panel;
}

/**
 * Create Style panel content with Rules/Graduated editor
 */
function createStylePanel(layer) {
  const panel = document.createElement('div');
  panel.className = 'style-panel';

  // Get current style settings or defaults
  const currentStyle = layer._styleOpts || {};
  const styleType = currentStyle.type === 'graduated' ? 'graduated' : 'rules';

  // Build field options
  const fields = layer.fields || [];
  const fieldOptions = fields.map(f => `<option value="${f}">${f}</option>`).join('');

  // Build scale options
  const scaleNames = getColorScaleNames();
  const scaleOptions = scaleNames.map(s => `<option value="${s}">${s}</option>`).join('');

  // Build transformation options
  const transforms = getTransformationNames();
  const transformOptions = transforms.map(t =>
    `<option value="${t.value}">${t.label}</option>`
  ).join('');

  panel.innerHTML = `
    <div class="style-type-selector">
      <label>
        <input type="radio" name="style-type-${layer.id}" value="rules" ${styleType === 'rules' ? 'checked' : ''}>
        Rules (discrete)
      </label>
      <label>
        <input type="radio" name="style-type-${layer.id}" value="graduated" ${styleType === 'graduated' ? 'checked' : ''}>
        Graduated (continuous)
      </label>
    </div>

    <div class="style-common">
      <div class="style-row">
        <label>Stroke</label>
        <input type="color" class="style-color" id="style-stroke-${layer.id}" value="${currentStyle.stroke || '#000000'}">
        <label>Width</label>
        <input type="number" class="style-num" id="style-width-${layer.id}" value="${currentStyle.width || 1}" min="0" max="10" step="0.5">
      </div>
      <div class="style-row">
        <label>Opacity</label>
        <input type="range" class="style-range" id="style-opacity-${layer.id}" value="${(currentStyle.opacity ?? 0.7) * 100}" min="0" max="100">
        <span class="style-range-val">${Math.round((currentStyle.opacity ?? 0.7) * 100)}%</span>
      </div>
      ${layer.geomType?.includes('Point') ? `
      <div class="style-row">
        <label>Radius</label>
        <input type="number" class="style-num" id="style-radius-${layer.id}" value="${currentStyle.radius || 6}" min="1" max="50">
      </div>
      ` : ''}
    </div>

    <div class="style-rules-container" ${styleType !== 'rules' ? 'style="display:none"' : ''}>
      <div class="style-row">
        <label>Fill from field</label>
        <select class="style-select" id="style-fill-field-${layer.id}">
          <option value="">-- select --</option>
          ${fieldOptions}
        </select>
        <select class="style-select style-select-sm" id="style-fill-scale-${layer.id}">
          ${scaleOptions}
        </select>
        <button class="style-btn" id="style-fill-btn-${layer.id}">Fill</button>
      </div>
      <div class="style-rules-table-wrap">
        <table class="style-rules-table" id="style-rules-table-${layer.id}">
          <thead>
            <tr>
              <th>Filter</th>
              <th>Color</th>
              <th>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="style-rules-body-${layer.id}">
          </tbody>
        </table>
      </div>
      <div class="style-row">
        <button class="style-btn" id="style-add-rule-${layer.id}">+ Add Rule</button>
        <div class="style-row-right">
          <label>Default</label>
          <input type="color" class="style-color" id="style-default-${layer.id}" value="${currentStyle.default || '#888888'}">
        </div>
      </div>
    </div>

    <div class="style-graduated-container" ${styleType !== 'graduated' ? 'style="display:none"' : ''}>
      <div class="style-row">
        <label>Field</label>
        <select class="style-select" id="style-grad-field-${layer.id}">
          <option value="">-- select --</option>
          ${fieldOptions}
        </select>
      </div>
      <div class="style-row">
        <label>Expression</label>
        <input type="text" class="style-text" id="style-grad-expr-${layer.id}" placeholder="e.g. r.fe_pct / 100" value="${currentStyle.expression || ''}">
      </div>
      <div class="style-row">
        <label>Transform</label>
        <select class="style-select" id="style-grad-transform-${layer.id}">
          ${transformOptions}
        </select>
      </div>
      <div class="style-row">
        <label>Scale</label>
        <select class="style-select" id="style-grad-scale-${layer.id}">
          ${scaleOptions}
        </select>
        <div class="style-scale-preview" id="style-scale-preview-${layer.id}"></div>
      </div>
      <div class="style-row">
        <label>Min</label>
        <input type="number" class="style-num" id="style-grad-min-${layer.id}" placeholder="auto" step="any">
        <label>Max</label>
        <input type="number" class="style-num" id="style-grad-max-${layer.id}" placeholder="auto" step="any">
        <button class="style-btn style-btn-sm" id="style-grad-auto-${layer.id}">Auto</button>
      </div>
      <div class="style-row">
        <label>Default</label>
        <input type="color" class="style-color" id="style-grad-default-${layer.id}" value="${currentStyle.default || '#888888'}">
        <span class="style-hint">(non-numeric values)</span>
      </div>
    </div>

    <div class="style-actions">
      <label class="style-checkbox">
        <input type="checkbox" id="style-show-legend-${layer.id}" ${(currentStyle.showInLegend !== false) ? 'checked' : ''}>
        Show in legend
      </label>
      <div class="style-actions-right">
        <button class="style-btn style-btn-primary" id="style-apply-${layer.id}">Apply Style</button>
        <button class="style-btn" id="style-reset-${layer.id}">Reset</button>
      </div>
    </div>
  `;

  // Wire up event handlers after DOM insertion
  setTimeout(() => wireStylePanelEvents(panel, layer), 0);

  return panel;
}

/**
 * Wire up event handlers for style panel
 */
function wireStylePanelEvents(panel, layer) {
  const id = layer.id;

  // Style type toggle
  const typeRadios = panel.querySelectorAll(`input[name="style-type-${id}"]`);
  const rulesContainer = panel.querySelector('.style-rules-container');
  const gradContainer = panel.querySelector('.style-graduated-container');

  typeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const isRules = radio.value === 'rules';
      rulesContainer.style.display = isRules ? '' : 'none';
      gradContainer.style.display = isRules ? 'none' : '';
    });
  });

  // Opacity slider display
  const opacitySlider = document.getElementById(`style-opacity-${id}`);
  const opacityVal = panel.querySelector('.style-range-val');
  if (opacitySlider && opacityVal) {
    opacitySlider.addEventListener('input', () => {
      opacityVal.textContent = `${opacitySlider.value}%`;
    });
  }

  // Fill from field button
  const fillBtn = document.getElementById(`style-fill-btn-${id}`);
  if (fillBtn) {
    fillBtn.addEventListener('click', () => {
      const field = document.getElementById(`style-fill-field-${id}`).value;
      const scale = document.getElementById(`style-fill-scale-${id}`).value;
      if (!field) return;

      const rules = generateRulesFromField(layer, field, scale);
      populateRulesTable(layer, rules);
    });
  }

  // Add rule button
  const addRuleBtn = document.getElementById(`style-add-rule-${id}`);
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => {
      addRuleRow(layer, { filter: '', fill: '#4a9eff' });
    });
  }

  // Graduated field change - auto-populate min/max
  const gradField = document.getElementById(`style-grad-field-${id}`);
  if (gradField) {
    gradField.addEventListener('change', () => {
      updateGraduatedMinMax(layer);
      updateScalePreview(layer);
    });
  }

  // Auto min/max button
  const autoBtn = document.getElementById(`style-grad-auto-${id}`);
  if (autoBtn) {
    autoBtn.addEventListener('click', () => updateGraduatedMinMax(layer));
  }

  // Scale preview update
  const scaleSelect = document.getElementById(`style-grad-scale-${id}`);
  if (scaleSelect) {
    scaleSelect.addEventListener('change', () => updateScalePreview(layer));
    updateScalePreview(layer);
  }

  // Apply button
  const applyBtn = document.getElementById(`style-apply-${id}`);
  if (applyBtn) {
    applyBtn.addEventListener('click', () => applyStyleFromPanel(layer));
  }

  // Reset button
  const resetBtn = document.getElementById(`style-reset-${id}`);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      layer._styleOpts = null;
      // Re-render panel
      const propsWin = layerPropsWindows.get(layer.id || layer.name);
      if (propsWin) {
        const newPanel = createStylePanel(layer);
        newPanel.className = 'props-panel active';
        newPanel.dataset.panel = 'style';
        const oldPanel = propsWin.body.querySelector('[data-panel="style"]');
        if (oldPanel) oldPanel.replaceWith(newPanel);
      }
    });
  }

  // Load existing rules if any
  if (layer._styleOpts?.rules) {
    populateRulesTable(layer, layer._styleOpts.rules);
  }

  // Load existing graduated settings
  if (layer._styleOpts?.type === 'graduated') {
    const opts = layer._styleOpts;
    if (opts.field) {
      const gf = document.getElementById(`style-grad-field-${id}`);
      if (gf) gf.value = opts.field;
    }
    if (opts.transform) {
      const gt = document.getElementById(`style-grad-transform-${id}`);
      if (gt) gt.value = opts.transform;
    }
    if (opts.scale) {
      const gs = document.getElementById(`style-grad-scale-${id}`);
      if (gs) gs.value = opts.scale;
    }
    if (opts.min !== undefined) {
      const gmin = document.getElementById(`style-grad-min-${id}`);
      if (gmin) gmin.value = opts.min;
    }
    if (opts.max !== undefined) {
      const gmax = document.getElementById(`style-grad-max-${id}`);
      if (gmax) gmax.value = opts.max;
    }
    updateScalePreview(layer);
  }
}

/**
 * Populate rules table with rule objects
 */
function populateRulesTable(layer, rules) {
  const tbody = document.getElementById(`style-rules-body-${layer.id}`);
  if (!tbody) return;

  tbody.innerHTML = '';
  rules.forEach(rule => addRuleRow(layer, rule));
}

/**
 * Add a single rule row to the table
 */
function addRuleRow(layer, rule) {
  const tbody = document.getElementById(`style-rules-body-${layer.id}`);
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="style-rule-filter" placeholder="r.field == 'value'"></td>
    <td><input type="color" class="style-rule-color" value="${rule.fill || '#4a9eff'}"></td>
    <td><input type="text" class="style-rule-label" placeholder="Label"></td>
    <td><button class="style-rule-remove">&times;</button></td>
  `;

  // Set values via property to avoid HTML escaping issues with quotes
  tr.querySelector('.style-rule-filter').value = rule.filter || '';
  tr.querySelector('.style-rule-label').value = rule.label || '';

  tr.querySelector('.style-rule-remove').addEventListener('click', () => {
    tr.remove();
  });

  tbody.appendChild(tr);
}

/**
 * Update min/max from field statistics
 */
function updateGraduatedMinMax(layer) {
  const id = layer.id;
  const field = document.getElementById(`style-grad-field-${id}`)?.value;
  if (!field) return;

  const stats = getFieldStats(layer, field);
  if (stats) {
    const minInput = document.getElementById(`style-grad-min-${id}`);
    const maxInput = document.getElementById(`style-grad-max-${id}`);
    if (minInput) minInput.value = stats.min;
    if (maxInput) maxInput.value = stats.max;
  }
}

/**
 * Update scale preview gradient
 */
function updateScalePreview(layer) {
  const id = layer.id;
  const scaleSelect = document.getElementById(`style-grad-scale-${id}`);
  const preview = document.getElementById(`style-scale-preview-${id}`);
  if (!scaleSelect || !preview) return;

  const scaleName = scaleSelect.value;
  const scaleVal = colorScales[scaleName];

  // Generate gradient CSS
  let gradient;
  if (typeof scaleVal === 'string') {
    // Named chroma scale
    try {
      const scale = chroma.scale(scaleVal).mode('lab');
      const colors = [0, 0.25, 0.5, 0.75, 1].map(t => scale(t).hex());
      gradient = `linear-gradient(to right, ${colors.join(', ')})`;
    } catch (e) {
      gradient = 'linear-gradient(to right, #888, #888)';
    }
  } else if (Array.isArray(scaleVal)) {
    gradient = `linear-gradient(to right, ${scaleVal.join(', ')})`;
  } else {
    gradient = 'linear-gradient(to right, #888, #888)';
  }

  preview.style.background = gradient;
}

/**
 * Collect style options from panel and apply
 */
function applyStyleFromPanel(layer) {
  const id = layer.id;

  // Get common options
  const stroke = document.getElementById(`style-stroke-${id}`)?.value || '#000000';
  const width = parseFloat(document.getElementById(`style-width-${id}`)?.value) || 1;
  const opacity = (parseInt(document.getElementById(`style-opacity-${id}`)?.value) || 70) / 100;
  const radius = parseFloat(document.getElementById(`style-radius-${id}`)?.value) || 6;

  // Determine style type
  const typeRadio = document.querySelector(`input[name="style-type-${id}"]:checked`);
  const styleType = typeRadio?.value || 'rules';

  let opts = { stroke, width, opacity, radius };

  if (styleType === 'rules') {
    opts.type = 'rules';
    opts.default = document.getElementById(`style-default-${id}`)?.value || '#888888';

    // Collect rules from table
    const rows = document.querySelectorAll(`#style-rules-body-${id} tr`);
    opts.rules = Array.from(rows).map(row => ({
      filter: row.querySelector('.style-rule-filter')?.value || '',
      fill: row.querySelector('.style-rule-color')?.value || '#4a9eff',
      label: row.querySelector('.style-rule-label')?.value || ''
    }));
  } else {
    opts.type = 'graduated';
    opts.field = document.getElementById(`style-grad-field-${id}`)?.value || null;
    opts.expression = document.getElementById(`style-grad-expr-${id}`)?.value || null;
    opts.transform = document.getElementById(`style-grad-transform-${id}`)?.value || 'linear';
    opts.scale = document.getElementById(`style-grad-scale-${id}`)?.value || 'viridis';
    opts.default = document.getElementById(`style-grad-default-${id}`)?.value || '#888888';

    const minVal = document.getElementById(`style-grad-min-${id}`)?.value;
    const maxVal = document.getElementById(`style-grad-max-${id}`)?.value;
    if (minVal !== '') opts.min = parseFloat(minVal);
    if (maxVal !== '') opts.max = parseFloat(maxVal);
  }

  // Legend visibility option
  opts.showInLegend = document.getElementById(`style-show-legend-${id}`)?.checked !== false;

  // Store options for later
  layer._styleOpts = opts;

  // Apply the style
  applyStyle(layer, opts);

  // Refresh legend if open
  updateLegendContent();
}

/**
 * Create Labels panel content
 */
function createLabelsPanel(layer) {
  const panel = document.createElement('div');
  panel.className = 'labels-panel';

  // Get current label settings from style
  const currentStyle = layer._styleOpts || {};
  const hasLabels = !!currentStyle.labelField;

  // Build field options
  const fields = layer.fields || [];
  const fieldOptions = fields.map(f => `<option value="${f}">${f}</option>`).join('');

  // Check if current labelField is a template or simple field
  const isTemplate = currentStyle.labelField?.includes('${');
  const simpleField = isTemplate ? '' : (currentStyle.labelField || '');
  const templateExpr = isTemplate ? currentStyle.labelField : '';

  panel.innerHTML = `
    <div class="labels-section">
      <label class="style-checkbox">
        <input type="checkbox" id="labels-enabled-${layer.id}" ${hasLabels ? 'checked' : ''}>
        Enable labels
      </label>
    </div>

    <div class="labels-settings" id="labels-settings-${layer.id}" ${!hasLabels ? 'style="display:none"' : ''}>
      <div class="labels-section">
        <div class="labels-section-title">Label Text</div>
        <div class="style-row">
          <label>Field</label>
          <select class="style-select" id="labels-field-${layer.id}">
            <option value="">-- select --</option>
            ${fieldOptions}
          </select>
        </div>
        <div class="style-row">
          <label>Or template</label>
          <input type="text" class="style-text" id="labels-template-${layer.id}"
                 placeholder="\${r.name} (\${r.value})" value="${templateExpr.replace(/"/g, '&quot;')}">
        </div>
        <div class="labels-hint">Template overrides field if set. Use \${r.field} syntax.</div>
      </div>

      <div class="labels-section">
        <div class="labels-section-title">Appearance</div>
        <div class="style-row">
          <label>Size</label>
          <input type="number" class="style-num" id="labels-size-${layer.id}"
                 value="${currentStyle.labelSize || 12}" min="6" max="48">
          <label>Color</label>
          <input type="color" class="style-color" id="labels-color-${layer.id}"
                 value="${currentStyle.labelColor || '#ffffff'}">
        </div>
        <div class="style-row">
          <label>Halo</label>
          <input type="color" class="style-color" id="labels-outline-${layer.id}"
                 value="${currentStyle.labelOutline || '#000000'}">
          <label>Width</label>
          <input type="number" class="style-num" id="labels-outline-width-${layer.id}"
                 value="${currentStyle.labelOutlineWidth ?? 3}" min="0" max="10" step="0.5">
        </div>
      </div>

      <div class="labels-section">
        <div class="labels-section-title">Placement</div>
        <div class="style-row">
          <label>Align</label>
          <select class="style-select" id="labels-align-${layer.id}">
            <option value="center" ${(currentStyle.labelAlign || 'center') === 'center' ? 'selected' : ''}>Center</option>
            <option value="left" ${currentStyle.labelAlign === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${currentStyle.labelAlign === 'right' ? 'selected' : ''}>Right</option>
          </select>
          <label>Baseline</label>
          <select class="style-select" id="labels-baseline-${layer.id}">
            <option value="middle" ${(currentStyle.labelBaseline || 'middle') === 'middle' ? 'selected' : ''}>Middle</option>
            <option value="top" ${currentStyle.labelBaseline === 'top' ? 'selected' : ''}>Top</option>
            <option value="bottom" ${currentStyle.labelBaseline === 'bottom' ? 'selected' : ''}>Bottom</option>
          </select>
        </div>
        <div class="style-row">
          <label>Offset X</label>
          <input type="number" class="style-num" id="labels-offsetx-${layer.id}"
                 value="${currentStyle.labelOffsetX || 0}" step="1">
          <label>Y</label>
          <input type="number" class="style-num" id="labels-offsety-${layer.id}"
                 value="${currentStyle.labelOffsetY || 0}" step="1">
        </div>
        ${layer.geomType?.includes('Line') ? `
        <div class="style-row">
          <label class="style-checkbox">
            <input type="checkbox" id="labels-follow-line-${layer.id}" ${currentStyle.labelPlacement === 'line' ? 'checked' : ''}>
            Follow line
          </label>
        </div>
        ` : ''}
        <div class="style-row">
          <label class="style-checkbox">
            <input type="checkbox" id="labels-declutter-${layer.id}" ${layer._olLayer?.getDeclutter?.() ? 'checked' : ''}>
            Declutter (hide overlapping)
          </label>
        </div>
      </div>
    </div>

    <div class="style-actions">
      <div></div>
      <div class="style-actions-right">
        <button class="style-btn style-btn-primary" id="labels-apply-${layer.id}">Apply Labels</button>
        <button class="style-btn" id="labels-clear-${layer.id}">Clear</button>
      </div>
    </div>
  `;

  // Set the simple field value after DOM creation
  setTimeout(() => {
    const fieldSelect = document.getElementById(`labels-field-${layer.id}`);
    if (fieldSelect && simpleField) {
      fieldSelect.value = simpleField;
    }
    wireLabelsPanel(panel, layer);
  }, 0);

  return panel;
}

/**
 * Wire up labels panel events
 */
function wireLabelsPanel(panel, layer) {
  const id = layer.id;

  // Toggle settings visibility
  const enabledCheckbox = document.getElementById(`labels-enabled-${id}`);
  const settingsDiv = document.getElementById(`labels-settings-${id}`);

  if (enabledCheckbox && settingsDiv) {
    enabledCheckbox.addEventListener('change', () => {
      settingsDiv.style.display = enabledCheckbox.checked ? '' : 'none';
    });
  }

  // Template overrides field - clear field when template is entered
  const templateInput = document.getElementById(`labels-template-${id}`);
  const fieldSelect = document.getElementById(`labels-field-${id}`);

  if (templateInput && fieldSelect) {
    templateInput.addEventListener('input', () => {
      if (templateInput.value.trim()) {
        fieldSelect.value = '';
      }
    });
    fieldSelect.addEventListener('change', () => {
      if (fieldSelect.value) {
        templateInput.value = '';
      }
    });
  }

  // Apply button
  const applyBtn = document.getElementById(`labels-apply-${id}`);
  if (applyBtn) {
    applyBtn.addEventListener('click', () => applyLabelsFromPanel(layer));
  }

  // Clear button
  const clearBtn = document.getElementById(`labels-clear-${id}`);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (enabledCheckbox) enabledCheckbox.checked = false;
      if (settingsDiv) settingsDiv.style.display = 'none';
      if (fieldSelect) fieldSelect.value = '';
      if (templateInput) templateInput.value = '';
      applyLabelsFromPanel(layer);
    });
  }
}

/**
 * Apply labels from panel to layer style
 */
function applyLabelsFromPanel(layer) {
  const id = layer.id;

  const enabled = document.getElementById(`labels-enabled-${id}`)?.checked;
  const field = document.getElementById(`labels-field-${id}`)?.value;
  const template = document.getElementById(`labels-template-${id}`)?.value;
  const size = parseInt(document.getElementById(`labels-size-${id}`)?.value) || 12;
  const color = document.getElementById(`labels-color-${id}`)?.value || '#ffffff';
  const outline = document.getElementById(`labels-outline-${id}`)?.value || '#000000';
  const outlineWidth = parseFloat(document.getElementById(`labels-outline-width-${id}`)?.value) ?? 3;

  // Placement options
  const align = document.getElementById(`labels-align-${id}`)?.value || 'center';
  const baseline = document.getElementById(`labels-baseline-${id}`)?.value || 'middle';
  const offsetX = parseInt(document.getElementById(`labels-offsetx-${id}`)?.value) || 0;
  const offsetY = parseInt(document.getElementById(`labels-offsety-${id}`)?.value) || 0;
  const followLine = document.getElementById(`labels-follow-line-${id}`)?.checked;
  const declutter = document.getElementById(`labels-declutter-${id}`)?.checked || false;

  // Determine label field (template takes precedence)
  let labelField = null;
  if (enabled) {
    labelField = template.trim() || field || null;
  }

  // Update style options
  if (!layer._styleOpts) {
    layer._styleOpts = {};
  }

  layer._styleOpts.labelField = labelField;
  layer._styleOpts.labelSize = size;
  layer._styleOpts.labelColor = color;
  layer._styleOpts.labelOutline = outline;
  layer._styleOpts.labelOutlineWidth = outlineWidth;
  layer._styleOpts.labelAlign = align;
  layer._styleOpts.labelBaseline = baseline;
  layer._styleOpts.labelOffsetX = offsetX;
  layer._styleOpts.labelOffsetY = offsetY;
  layer._styleOpts.labelPlacement = followLine ? 'line' : 'point';

  // Re-apply the style to update labels
  applyStyle(layer, layer._styleOpts);

  // Set declutter on the layer (this is a layer property, not style)
  if (layer._olLayer?.setDeclutter) {
    layer._olLayer.setDeclutter(declutter);
  }
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
 */
export function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const content = createSettingsContent();

  settingsWindow = new WinBox({
    title: 'Settings',
    class: ['settings-window'],
    x: 'center',
    y: 'center',
    width: 340,
    height: 280,
    minwidth: 280,
    minheight: 200,
    mount: content,
    onclose: () => {
      settingsWindow = null;
      return false;
    }
  });
}

/**
 * Create settings window content
 */
function createSettingsContent() {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const themes = [
    { value: 'dark', label: 'Dark (default)' },
    { value: 'light', label: 'Light' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'amber', label: 'Amber' },
    { value: 'koma', label: 'Koma' },
    { value: 'ctp-latte', label: 'Catppuccin Latte' },
    { value: 'ctp-frappe', label: 'Catppuccin Frappé' },
    { value: 'ctp-macchiato', label: 'Catppuccin Macchiato' },
    { value: 'ctp-mocha', label: 'Catppuccin Mocha' }
  ];

  const themeOptions = themes.map(t =>
    `<option value="${t.value}" ${settings.theme === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Appearance</div>

      <div class="settings-row">
        <label class="settings-label">Theme</label>
        <select class="settings-select" id="setting-theme">
          ${themeOptions}
        </select>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">About</div>
      <div class="settings-about">
        <div><strong>Spinifex</strong> - ultrabasic web gis</div>
        <div class="settings-about-dim">JavaScript-powered GIS in your browser</div>
      </div>
    </div>
  `;

  // Wire up theme selector
  setTimeout(() => {
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
        saveSettings();
      });
    }
  }, 0);

  return content;
}

/**
 * Open or refresh the Legend window
 */
export function openLegend() {
  if (legendWindow) {
    // Refresh content
    updateLegendContent();
    legendWindow.focus();
    return;
  }

  const content = document.createElement('div');
  content.className = 'legend-content';
  content.id = 'legend-content';

  legendWindow = new WinBox({
    title: 'Legend',
    class: ['legend-window'],
    x: 'right',
    y: 80,
    right: 20,
    width: defaults.legend.width,
    height: defaults.legend.height,
    minwidth: 160,
    minheight: 120,
    mount: content,
    onclose: () => {
      legendWindow = null;
      return false;
    }
  });

  updateLegendContent();
}

/**
 * Toggle legend window
 */
export function toggleLegend() {
  if (legendWindow) {
    legendWindow.close();
    legendWindow = null;
  } else {
    openLegend();
  }
}

/**
 * Update legend content based on current layers
 */
export function updateLegendContent() {
  const container = document.getElementById('legend-content');
  if (!container) return;

  // Get layers sorted by z-index (top layer first, matching layer panel order)
  const layers = getLayersSortedByZIndex().filter(l =>
    l.visible && l._styleOpts && l._styleOpts.showInLegend !== false
  );

  if (layers.length === 0) {
    container.innerHTML = '<div class="legend-empty">No styled layers</div>';
    return;
  }

  let html = '';

  layers.forEach(layer => {
    const opts = layer._styleOpts;
    html += `<div class="legend-layer">`;
    html += `<div class="legend-layer-title">${layer.name}</div>`;

    if (opts.type === 'graduated') {
      // Graduated: show color ramp
      html += renderGraduatedLegend(layer, opts);
    } else if (opts.rules && opts.rules.length > 0) {
      // Rules: show each rule with color + label
      html += renderRulesLegend(opts);
    }

    html += `</div>`;
  });

  container.innerHTML = html;
}

/**
 * Render legend items for rules-based style
 */
function renderRulesLegend(opts) {
  let html = '<div class="legend-items">';

  opts.rules.forEach(rule => {
    const label = rule.label || rule.filter || 'No filter';
    const color = rule.fill || '#888888';
    html += `
      <div class="legend-item">
        <span class="legend-swatch" style="background: ${color}"></span>
        <span class="legend-label">${label}</span>
      </div>
    `;
  });

  // Default color if present
  if (opts.default) {
    html += `
      <div class="legend-item">
        <span class="legend-swatch" style="background: ${opts.default}"></span>
        <span class="legend-label">Other</span>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Render legend for graduated style
 */
function renderGraduatedLegend(layer, opts) {
  const scale = opts.scale || 'viridis';
  const scaleVal = colorScales[scale];

  // Generate gradient
  let gradient;
  if (typeof scaleVal === 'string') {
    try {
      const chromaScale = chroma.scale(scaleVal).mode('lab');
      const colors = [0, 0.25, 0.5, 0.75, 1].map(t => chromaScale(t).hex());
      gradient = `linear-gradient(to right, ${colors.join(', ')})`;
    } catch (e) {
      gradient = 'linear-gradient(to right, #888, #888)';
    }
  } else if (Array.isArray(scaleVal)) {
    gradient = `linear-gradient(to right, ${scaleVal.join(', ')})`;
  } else {
    gradient = 'linear-gradient(to right, #888, #888)';
  }

  // Get min/max values
  let minVal = opts.min;
  let maxVal = opts.max;

  if ((minVal === undefined || maxVal === undefined) && opts.field && layer.geojson) {
    const stats = getFieldStats(layer, opts.field);
    if (stats) {
      if (minVal === undefined) minVal = stats.min;
      if (maxVal === undefined) maxVal = stats.max;
    }
  }

  minVal = minVal ?? 0;
  maxVal = maxVal ?? 100;

  const fieldLabel = opts.field || opts.expression || 'Value';

  return `
    <div class="legend-graduated">
      <div class="legend-grad-label">${fieldLabel}</div>
      <div class="legend-grad-ramp" style="background: ${gradient}"></div>
      <div class="legend-grad-range">
        <span>${formatNumber(minVal)}</span>
        <span>${formatNumber(maxVal)}</span>
      </div>
    </div>
  `;
}

/**
 * Format number for legend display
 */
function formatNumber(n) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

// Export window manager object for global access
export const windows = {
  toggleLayers,
  toggleTerminal,
  showLayers,
  showTerminal,
  openLayerProperties,
  openSettings,
  openLegend,
  toggleLegend,
  switchView
};
