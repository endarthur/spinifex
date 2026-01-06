// Spinifex - Layer Properties Window
// Layer info, fields, styling (vector and raster), and labels configuration

import { state } from '../../core/state.js';
import {
  applyStyle,
  generateRulesFromField,
  getColorScaleNames,
  getTransformationNames,
  getFieldStats,
  colorScales
} from '../../core/styling.js';
import { COLOR_RAMPS } from '../../core/raster-layer.js';
import { showContextMenu } from '../context-menu.js';
import { pasteToTerminal } from '../terminal.js';
import { updateLegendContent } from './legend.js';

// Window registry
const layerPropsWindows = new Map(); // layerId -> WinBox

// Default dimensions
const defaults = {
  width: 440,
  height: 560
};

/**
 * Get the layer properties windows map (for external access)
 */
export function getLayerPropsWindows() {
  return layerPropsWindows;
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
    width: defaults.width,
    height: defaults.height,
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
  const isRaster = layer.type === 'raster';

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
  const wrapperClass = isRaster ? 'raster-style-wrapper' : 'vector-style-wrapper';
  stylePanel.classList.add('props-panel', wrapperClass);
  if (activeTab === 'style') stylePanel.classList.add('active');
  stylePanel.dataset.panel = 'style';
  panels.appendChild(stylePanel);

  // Labels panel (uses flex wrapper style for proper layout)
  const labelsPanel = createLabelsPanel(layer);
  labelsPanel.className = `props-panel labels-wrapper ${activeTab === 'labels' ? 'active' : ''}`;
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
  const isRaster = layer.type === 'raster';

  // Get CRS info
  let layerCrs = 'EPSG:4326'; // Default for vector
  if (isRaster) {
    layerCrs = layer.crs || layer._metadata?.crs || 'EPSG:4326';
  }
  // Look up CRS name if available
  const crsInfo = window.crs?.get(layerCrs);
  const crsDisplay = crsInfo ? `${layerCrs} (${crsInfo.name})` : layerCrs;

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
      <div class="props-row">
        <span class="props-label">CRS</span>
        <span class="props-value props-value-small">${crsDisplay}</span>
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
    // Handle both array format [minX, minY, maxX, maxY] and object format {minX, minY, maxX, maxY}
    let extStr;
    if (Array.isArray(ext)) {
      extStr = `${ext[0].toFixed(4)}, ${ext[1].toFixed(4)}, ${ext[2].toFixed(4)}, ${ext[3].toFixed(4)}`;
    } else {
      extStr = `${ext.minX.toFixed(4)}, ${ext.minY.toFixed(4)}, ${ext.maxX.toFixed(4)}, ${ext.maxY.toFixed(4)}`;
    }
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
 * For vector layers: shows attribute fields
 * For raster layers: shows band information
 */
function createFieldsPanel(layer) {
  const panel = document.createElement('div');
  const isRaster = layer.type === 'raster';

  if (isRaster) {
    // Raster: show band information
    const metadata = layer._metadata || {};
    const bandCount = metadata.bandCount || metadata.samplesPerPixel || 1;
    const bandStats = metadata.bandStats || {};
    const nodata = metadata.nodata;
    const dataType = metadata.dataType || 'unknown';

    let html = '<div class="props-section"><div class="props-section-title">Band Information</div>';
    html += '<div class="props-fields-table"><table><thead><tr><th>Band</th><th>Min</th><th>Max</th></tr></thead><tbody>';

    for (let i = 1; i <= bandCount; i++) {
      const stats = bandStats[`band${i}`] || {};
      const min = stats.min !== undefined ? stats.min.toFixed(2) : '-';
      const max = stats.max !== undefined ? stats.max.toFixed(2) : '-';
      html += `<tr><td>Band ${i}</td><td class="field-type">${min}</td><td class="field-type">${max}</td></tr>`;
    }

    html += '</tbody></table></div></div>';

    // Additional raster metadata
    html += '<div class="props-section"><div class="props-section-title">Metadata</div>';
    html += '<div class="props-row"><span class="props-label">Bands</span><span class="props-value">' + bandCount + '</span></div>';
    if (nodata !== undefined && nodata !== null) {
      html += '<div class="props-row"><span class="props-label">NoData</span><span class="props-value">' + nodata + '</span></div>';
    }
    if (metadata.width && metadata.height) {
      html += '<div class="props-row"><span class="props-label">Size</span><span class="props-value">' + metadata.width + ' × ' + metadata.height + ' px</span></div>';
    }
    html += '</div>';

    panel.innerHTML = html;
    return panel;
  }

  // Vector: show attribute fields
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

// Get available color ramps from the single source of truth
const RASTER_COLOR_RAMPS = Object.keys(COLOR_RAMPS);

/**
 * Create Style panel for raster layers
 * Layout: Mode selector at top, scrollable content in middle, opacity/blend/apply at bottom
 */
function createRasterStylePanel(layer) {
  const panel = document.createElement('div');
  panel.className = 'style-panel raster-style-panel sp-panel';

  const bandCount = layer._metadata?.bandCount || 1;
  const currentMode = layer._mode || (bandCount >= 3 ? 'rgb' : 'singleband');
  const currentBands = layer._bandMapping || [1, 2, 3];
  const currentRamp = layer._colorRamp || 'terrain';
  const stretch = layer.r?.stretch?.() || { min: 0, max: 255 };
  const currentExpr = layer._customExpression || '';
  const currentOpacity = layer.olLayer?.getOpacity?.() ?? 1;
  const usesExpression = !!currentExpr;
  const currentBlend = layer._blendMode || 'source-over';

  // Get per-channel stretch values
  const rStretch = layer._bandStretch?.r || {};
  const gStretch = layer._bandStretch?.g || {};
  const bStretch = layer._bandStretch?.b || {};

  // State object for widget values
  const values = {
    mode: currentMode,
    source: usesExpression ? 'expression' : 'band',
    bandR: { band: currentBands[0] || 1, min: rStretch.min ?? null, max: rStretch.max ?? null },
    bandG: { band: currentBands[1] || 2, min: gStretch.min ?? null, max: gStretch.max ?? null },
    bandB: { band: currentBands[2] || 3, min: bStretch.min ?? null, max: bStretch.max ?? null },
    displayBand: layer._selectedBand || 1,
    expression: currentExpr,
    colorRamp: currentRamp,
    stretchMin: stretch.min,
    stretchMax: stretch.max,
    opacity: Math.round(currentOpacity * 100),
    blend: currentBlend,
    showInLegend: layer._showInLegend !== false,
  };

  // Store values on panel for access in apply
  panel._rasterValues = values;
  panel._rasterLayer = layer;

  // Build blend mode options
  const blendModes = [
    { value: 'source-over', label: 'Normal' }, { value: 'multiply', label: 'multiply' },
    { value: 'screen', label: 'screen' }, { value: 'overlay', label: 'overlay' },
    { value: 'darken', label: 'darken' }, { value: 'lighten', label: 'lighten' },
    { value: 'color-dodge', label: 'color-dodge' }, { value: 'color-burn', label: 'color-burn' },
    { value: 'hard-light', label: 'hard-light' }, { value: 'soft-light', label: 'soft-light' },
    { value: 'difference', label: 'difference' }, { value: 'exclusion', label: 'exclusion' },
  ];

  // Build band options
  const bandOptions = Array.from({ length: bandCount }, (_, i) => ({
    value: i + 1, label: `Band ${i + 1}`,
  }));

  // Build color ramp options
  const rampOptions = RASTER_COLOR_RAMPS.map(r => ({ value: r, label: r }));

  // Helper to get band stats for auto button
  const getBandStats = (bandNum) => {
    return layer._bandStats?.[`band${bandNum}`] || { min: 0, max: 255 };
  };

  // Widget schema for the panel
  const schema = [
    // Display mode
    { type: 'formRow', label: 'Display Mode', children: [
      { type: 'select', name: 'mode', options: [
        { value: 'rgb', label: 'RGB Composite', disabled: bandCount < 3 },
        { value: 'singleband', label: 'Single Band' },
      ]},
    ]},
    { type: 'spacer', size: 8 },

    // RGB Section (shown when mode=rgb)
    { type: 'conditional', field: 'mode', showWhen: 'rgb', children: [
      { type: 'header', text: 'RGB Channels' },
      { type: 'hint', text: 'Band    Min    Max' },
      { type: 'rgbChannel', name: 'bandR', channel: 'r', bandCount, onAuto: getBandStats },
      { type: 'rgbChannel', name: 'bandG', channel: 'g', bandCount, onAuto: getBandStats },
      { type: 'rgbChannel', name: 'bandB', channel: 'b', bandCount, onAuto: getBandStats },
      { type: 'presetButtons', label: 'Presets:', presets: [
        { label: 'Natural', value: 'natural', disabled: bandCount < 3 },
        { label: 'False Color', value: 'false-color', disabled: bandCount < 4 },
      ]},
      { type: 'spacer', size: 8 },
    ]},

    // Single Band Section (shown when mode=singleband)
    { type: 'conditional', field: 'mode', showWhen: 'singleband', children: [
      { type: 'header', text: 'Source' },
      { type: 'radioGroup', name: 'source', options: [
        { value: 'band', label: 'Band' },
        { value: 'expression', label: 'Expression' },
      ]},
      { type: 'spacer', size: 8 },

      // Band selector (shown when source=band)
      { type: 'conditional', field: 'source', showWhen: 'band', children: [
        { type: 'select', name: 'displayBand', options: bandOptions },
      ]},

      // Expression input (shown when source=expression)
      { type: 'conditional', field: 'source', showWhen: 'expression', children: [
        { type: 'expression', name: 'expression', placeholder: 'e.g. (b4 - b3) / (b4 + b3)' },
        { type: 'hint', text: 'Use b1, b2, b3... Ops: + - * / > < == ? :' },
        { type: 'presetButtons', label: 'Presets:', name: 'exprPreset', presets: [
          { label: 'NDVI', value: { expr: '(b4 - b3) / (b4 + b3)', ramp: 'ndvi', min: -1, max: 1 }, disabled: bandCount < 4 },
          { label: 'NDWI', value: { expr: '(b2 - b4) / (b2 + b4)', ramp: 'bluered', min: -1, max: 1 }, disabled: bandCount < 4 },
          { label: 'NIR/R', value: { expr: 'b4 / b3', ramp: 'viridis', min: 0, max: 3 }, disabled: bandCount < 4 },
          { label: 'Thresh', value: { expr: 'b1 > 500 ? 1 : 0', ramp: 'grayscale', min: 0, max: 1 } },
        ]},
      ]},

      { type: 'spacer', size: 8 },
      { type: 'header', text: 'Color Ramp' },
      { type: 'colorRamp', name: 'colorRamp', options: rampOptions },
      { type: 'spacer', size: 8 },
      { type: 'header', text: 'Value Stretch' },
      { type: 'stretch', name: 'stretch', onAuto: () => ({ min: layer.minValue ?? 0, max: layer.maxValue ?? 255 }) },
      { type: 'spacer', size: 8 },
    ]},

    // Rendering section (always visible)
    { type: 'header', text: 'Rendering' },
    { type: 'formRow', label: 'Opacity', children: [
      { type: 'range', name: 'opacity', min: 0, max: 100, suffix: '%' },
    ]},
    { type: 'formRow', label: 'Blend', children: [
      { type: 'select', name: 'blend', options: blendModes },
    ]},
    { type: 'spacer', size: 8 },
    { type: 'row', children: [
      { type: 'boolean', name: 'showInLegend', label: 'Show in legend' },
      { type: 'spacer', flex: 1 },
      { type: 'actions', align: 'right', buttons: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Apply', action: 'apply', primary: true },
      ]},
    ]},
  ];

  // DOM element references for updates
  let rgbSection = null;
  let singlebandSection = null;
  let bandSubsection = null;
  let exprSubsection = null;
  let rampPreview = null;

  // Render schema
  const onChange = (newValue, fieldName) => {
    if (fieldName && values.hasOwnProperty(fieldName)) {
      values[fieldName] = newValue;
    }

    // Handle mode change - toggle sections
    if (fieldName === 'mode') {
      if (rgbSection) rgbSection.style.display = newValue === 'rgb' ? '' : 'none';
      if (singlebandSection) singlebandSection.style.display = newValue === 'singleband' ? '' : 'none';
    }

    // Handle source change - toggle band/expression
    if (fieldName === 'source') {
      if (bandSubsection) bandSubsection.style.display = newValue === 'band' ? '' : 'none';
      if (exprSubsection) exprSubsection.style.display = newValue === 'expression' ? '' : 'none';
    }

    // Handle opacity - apply immediately
    if (fieldName === 'opacity') {
      layer.opacity(newValue / 100);
    }

    // Handle blend - apply immediately
    if (fieldName === 'blend') {
      layer.blendMode(newValue);
    }

    // Handle color ramp change - update preview
    if (fieldName === 'colorRamp' && rampPreview) {
      const gradients = {
        grayscale: 'linear-gradient(to right, #000, #fff)',
        terrain: 'linear-gradient(to right, #0000aa, #00aa00, #ffff00, #ff8800, #ff0000, #ffffff)',
        viridis: 'linear-gradient(to right, #440154, #482878, #3e4a89, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
        inferno: 'linear-gradient(to right, #000004, #1b0c41, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9b06, #f7d13d, #fcffa4)',
        plasma: 'linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)',
        magma: 'linear-gradient(to right, #000004, #180f3d, #440f76, #721f81, #9e2f7f, #cd4071, #f1605d, #fd9668, #feca8d, #fcfdbf)',
        bluered: 'linear-gradient(to right, #0000ff, #ffffff, #ff0000)',
        ndvi: 'linear-gradient(to right, #0000ff, #ffffff, #00ff00)',
        spectral: 'linear-gradient(to right, #9e0142, #d53e4f, #f46d43, #fdae61, #fee08b, #ffffbf, #e6f598, #abdda4, #66c2a5, #3288bd, #5e4fa2)',
      };
      rampPreview.style.background = gradients[newValue] || gradients.terrain;
    }

    // Handle stretch updates
    if (fieldName === 'stretch') {
      values.stretchMin = newValue?.min ?? values.stretchMin;
      values.stretchMax = newValue?.max ?? values.stretchMax;
    }

    // Handle expression presets
    if (fieldName === 'exprPreset' && newValue && typeof newValue === 'object') {
      values.expression = newValue.expr;
      values.colorRamp = newValue.ramp;
      values.stretchMin = newValue.min;
      values.stretchMax = newValue.max;
      // Trigger re-render would be complex, so handle via DOM for presets
      const exprInput = panel.querySelector('.sp-expression-input');
      const rampSelect = panel.querySelector('.sp-colorramp-select');
      const minInput = panel.querySelector('.sp-stretch-wrapper input:first-of-type');
      const maxInput = panel.querySelector('.sp-stretch-wrapper input:last-of-type');
      if (exprInput) exprInput.value = newValue.expr;
      if (rampSelect) rampSelect.value = newValue.ramp;
      if (minInput) minInput.value = newValue.min;
      if (maxInput) maxInput.value = newValue.max;
      // Update ramp preview
      if (rampPreview) {
        onChange(newValue.ramp, 'colorRamp');
      }
    }

    // Handle RGB band presets
    if (fieldName === 'rgbPreset') {
      const r = panel.querySelector('.sp-rgb-channel:nth-child(3) select');
      const g = panel.querySelector('.sp-rgb-channel:nth-child(4) select');
      const b = panel.querySelector('.sp-rgb-channel:nth-child(5) select');
      if (newValue === 'natural' && r && g && b) {
        r.value = 3; g.value = 2; b.value = 1;
        values.bandR.band = 3; values.bandG.band = 2; values.bandB.band = 1;
      } else if (newValue === 'false-color' && r && g && b) {
        r.value = 4; g.value = 3; b.value = 2;
        values.bandR.band = 4; values.bandG.band = 3; values.bandB.band = 2;
      }
    }

    // Handle action buttons
    if (newValue === 'apply') {
      applyRasterStyleFromValues(panel);
    } else if (newValue === 'cancel') {
      const winbox = panel.closest('.winbox');
      if (winbox && winbox.winbox) {
        winbox.winbox.close();
      }
    }
  };

  // Render each schema item
  for (const item of schema) {
    const el = widgets.render(item, values[item.name] ?? item.default, (newVal, name) => {
      onChange(newVal, name || item.name);
    }, values);
    panel.appendChild(el);

    // Track top-level mode conditionals
    if (item.type === 'conditional' && item.field === 'mode') {
      if (item.showWhen === 'rgb') rgbSection = el;
      if (item.showWhen === 'singleband') singlebandSection = el;
    }
  }

  // Find nested conditionals and ramp preview using data attributes
  setTimeout(() => {
    // Find nested source conditionals inside singleband section
    bandSubsection = panel.querySelector('.sp-conditional[data-field="source"][data-show-when="band"]');
    exprSubsection = panel.querySelector('.sp-conditional[data-field="source"][data-show-when="expression"]');
    rampPreview = panel.querySelector('.sp-ramp-preview');
    // Initialize ramp preview
    if (rampPreview) {
      onChange(values.colorRamp, 'colorRamp');
    }
  }, 0);

  return panel;
}

/**
 * Wire up event handlers for raster style panel
 */
function wireRasterStylePanelEvents(panel, layer) {
  const id = layer.id || layer.name;

  // Opacity slider
  const opacitySlider = document.getElementById(`raster-opacity-${id}`);
  const opacityVal = panel.querySelector('.style-range-val');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      opacityVal.textContent = `${opacitySlider.value}%`;
      layer.opacity(parseInt(opacitySlider.value) / 100);
    });
  }

  // Blend mode selector - apply immediately
  const blendSelect = document.getElementById(`raster-blend-${id}`);
  if (blendSelect) {
    blendSelect.addEventListener('change', () => {
      layer.blendMode(blendSelect.value);
    });
  }

  // Display Mode dropdown
  const modeSelect = document.getElementById(`raster-mode-${id}`);
  const rgbSection = panel.querySelector('.raster-rgb-section');
  const singlebandSection = panel.querySelector('.raster-singleband-section');

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      const isRgb = modeSelect.value === 'rgb';
      rgbSection.style.display = isRgb ? '' : 'none';
      singlebandSection.style.display = isRgb ? 'none' : '';
    });
  }

  // Single band source toggle (Band vs Expression)
  const sourceRadios = panel.querySelectorAll(`input[name="singleband-source-${id}"]`);
  const bandRow = panel.querySelector('.singleband-band-row');
  const exprRow = panel.querySelector('.singleband-expr-row');

  sourceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const isExpr = radio.value === 'expression';
      bandRow.style.display = isExpr ? 'none' : '';
      exprRow.style.display = isExpr ? '' : 'none';
    });
  });

  // Band presets
  const presetBtns = panel.querySelectorAll('.raster-band-presets button');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const rSelect = document.getElementById(`raster-band-r-${id}`);
      const gSelect = document.getElementById(`raster-band-g-${id}`);
      const bSelect = document.getElementById(`raster-band-b-${id}`);

      if (preset === 'natural') {
        rSelect.value = 3; gSelect.value = 2; bSelect.value = 1;
      } else if (preset === 'false-color') {
        rSelect.value = 4; gSelect.value = 3; bSelect.value = 2;
      }
    });
  });

  // Expression presets
  const exprPresetBtns = panel.querySelectorAll('.raster-expr-presets button');
  exprPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const exprInput = document.getElementById(`raster-expression-${id}`);
      const rampSelect = document.getElementById(`raster-colorramp-${id}`);
      const minInput = document.getElementById(`raster-stretch-min-${id}`);
      const maxInput = document.getElementById(`raster-stretch-max-${id}`);

      if (exprInput) exprInput.value = btn.dataset.expr;
      if (rampSelect && btn.dataset.ramp) {
        rampSelect.value = btn.dataset.ramp;
        updateRasterRampPreview(layer);
      }
      if (minInput && btn.dataset.min) minInput.value = btn.dataset.min;
      if (maxInput && btn.dataset.max) maxInput.value = btn.dataset.max;
    });
  });

  // Color ramp change - update preview
  const rampSelect = document.getElementById(`raster-colorramp-${id}`);
  if (rampSelect) {
    rampSelect.addEventListener('change', () => updateRasterRampPreview(layer));
  }

  // Auto stretch button - updates inputs AND applies
  const autoBtn = document.getElementById(`raster-stretch-auto-${id}`);
  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      const minInput = document.getElementById(`raster-stretch-min-${id}`);
      const maxInput = document.getElementById(`raster-stretch-max-${id}`);
      const autoMin = layer.minValue ?? 0;
      const autoMax = layer.maxValue ?? 255;
      minInput.value = autoMin;
      maxInput.value = autoMax;
      // Also apply the stretch immediately
      layer.r.stretch(autoMin, autoMax);
    });
  }

  // Per-channel RGB stretch Auto buttons
  ['r', 'g', 'b'].forEach((channel, idx) => {
    const autoBtn = document.getElementById(`raster-stretch-${channel}-auto-${id}`);
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        const minInput = document.getElementById(`raster-stretch-${channel}-min-${id}`);
        const maxInput = document.getElementById(`raster-stretch-${channel}-max-${id}`);
        // Get the band number currently selected for this channel
        const bandSelect = document.getElementById(`raster-band-${channel}-${id}`);
        const bandNum = parseInt(bandSelect?.value) || (idx + 1);
        // Get stats for that band
        const stats = layer._bandStats?.[`band${bandNum}`] || { min: 0, max: 255 };
        minInput.value = stats.min;
        maxInput.value = stats.max;
        // Apply immediately
        applyRasterStyle(layer);
      });
    }
  });

  // Apply button
  const applyBtn = document.getElementById(`raster-apply-${id}`);
  if (applyBtn) {
    applyBtn.addEventListener('click', () => applyRasterStyle(layer));
  }

  // Cancel button - close the window
  const cancelBtn = document.getElementById(`raster-cancel-${id}`);
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Find and close the parent WinBox window
      const winbox = cancelBtn.closest('.winbox');
      if (winbox && winbox.winbox) {
        winbox.winbox.close();
      }
    });
  }
}

/**
 * Update the color ramp preview gradient
 */
function updateRasterRampPreview(layer) {
  const id = layer.id || layer.name;
  const preview = document.getElementById(`raster-ramp-preview-${id}`);
  const rampSelect = document.getElementById(`raster-colorramp-${id}`);

  if (!preview || !rampSelect) return;

  const rampName = rampSelect.value;
  // Use CSS gradients for common ramps
  const gradients = {
    terrain: 'linear-gradient(to right, #006147, #569444, #c2b977, #b38c5a, #8b5a35, #c8c8c8, #ffffff)',
    grayscale: 'linear-gradient(to right, #000000, #ffffff)',
    viridis: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
    plasma: 'linear-gradient(to right, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)',
    bluered: 'linear-gradient(to right, #081d58, #ffffff, #a50026)',
    bathymetry: 'linear-gradient(to right, #081d58, #2574a9, #86b683, #cdb279, #aa7648)',
    ndvi: 'linear-gradient(to right, #a50026, #d73027, #fee090, #a6d96a, #1a9850, #006837)',
    inferno: 'linear-gradient(to right, #000004, #57106e, #bc3754, #f98e09, #fcffa4)',
    spectral: 'linear-gradient(to right, #9e0142, #f46d43, #fee08b, #abdda4, #4575b4, #5e4fa2)'
  };

  preview.style.background = gradients[rampName] || gradients.grayscale;
}

/**
 * Apply raster style from widget values object (new widget-based approach)
 */
function applyRasterStyleFromValues(panel) {
  const values = panel._rasterValues;
  const layer = panel._rasterLayer;
  if (!values || !layer) return;

  if (values.mode === 'rgb') {
    // Clear any existing expression
    if (layer._customExpression) {
      layer.r.expression(null);
    }

    // Apply RGB settings
    const r = values.bandR?.band || 1;
    const g = values.bandG?.band || 2;
    const b = values.bandB?.band || 3;
    layer.r.bands(r, g, b);

    // Apply per-channel stretch if specified
    layer._bandStretch = {};
    if (values.bandR?.min != null && values.bandR?.max != null) {
      layer._bandStretch.r = { min: values.bandR.min, max: values.bandR.max };
    }
    if (values.bandG?.min != null && values.bandG?.max != null) {
      layer._bandStretch.g = { min: values.bandG.min, max: values.bandG.max };
    }
    if (values.bandB?.min != null && values.bandB?.max != null) {
      layer._bandStretch.b = { min: values.bandB.min, max: values.bandB.max };
    }
    layer._updateStyle();
  } else {
    // Single band mode
    const useExpression = values.source === 'expression';

    if (useExpression) {
      // Apply expression
      const expr = values.expression?.trim();
      if (expr) {
        const ramp = values.colorRamp || 'viridis';
        const stretchMin = values.stretchMin ?? -1;
        const stretchMax = values.stretchMax ?? 1;
        layer.r.expression(expr, { colorRamp: ramp, min: stretchMin, max: stretchMax });
      }
    } else {
      // Clear any existing expression
      if (layer._customExpression) {
        layer.r.expression(null);
      }

      // Apply band settings
      const ramp = values.colorRamp || 'terrain';
      const displayBand = values.displayBand || 1;
      layer.r.mode('singleband');
      layer.r.colorRamp(ramp);
      layer.r.band(displayBand);

      // Apply stretch
      if (values.stretchMin != null && values.stretchMax != null) {
        layer.r.stretch(values.stretchMin, values.stretchMax);
      }
    }
  }

  // Apply show in legend
  layer._showInLegend = values.showInLegend;
}

/**
 * Apply raster style from panel inputs (legacy ID-based approach)
 */
function applyRasterStyle(layer) {
  const id = layer.id || layer.name;

  // Get current mode from dropdown
  const modeSelect = document.getElementById(`raster-mode-${id}`);
  const mode = modeSelect?.value || 'rgb';

  if (mode === 'rgb') {
    // Clear any existing expression
    if (layer._customExpression) {
      layer.r.expression(null);
    }

    // Apply RGB settings
    const r = parseInt(document.getElementById(`raster-band-r-${id}`)?.value) || 1;
    const g = parseInt(document.getElementById(`raster-band-g-${id}`)?.value) || 2;
    const b = parseInt(document.getElementById(`raster-band-b-${id}`)?.value) || 3;
    layer.r.bands(r, g, b);

    // Apply per-channel stretch if specified
    const rMin = parseFloat(document.getElementById(`raster-stretch-r-min-${id}`)?.value);
    const rMax = parseFloat(document.getElementById(`raster-stretch-r-max-${id}`)?.value);
    const gMin = parseFloat(document.getElementById(`raster-stretch-g-min-${id}`)?.value);
    const gMax = parseFloat(document.getElementById(`raster-stretch-g-max-${id}`)?.value);
    const bMin = parseFloat(document.getElementById(`raster-stretch-b-min-${id}`)?.value);
    const bMax = parseFloat(document.getElementById(`raster-stretch-b-max-${id}`)?.value);

    // Store per-channel stretch overrides (constant keys: r, g, b)
    layer._bandStretch = {};
    if (!isNaN(rMin) && !isNaN(rMax)) layer._bandStretch.r = { min: rMin, max: rMax };
    if (!isNaN(gMin) && !isNaN(gMax)) layer._bandStretch.g = { min: gMin, max: gMax };
    if (!isNaN(bMin) && !isNaN(bMax)) layer._bandStretch.b = { min: bMin, max: bMax };
    layer._updateStyle();
  } else {
    // Single band mode - check if using band or expression
    const sourceRadio = document.querySelector(`input[name="singleband-source-${id}"]:checked`);
    const useExpression = sourceRadio?.value === 'expression';

    if (useExpression) {
      // Apply expression
      const exprInput = document.getElementById(`raster-expression-${id}`);
      const expr = exprInput?.value.trim();
      if (expr) {
        const ramp = document.getElementById(`raster-colorramp-${id}`)?.value || 'viridis';
        const stretchMin = parseFloat(document.getElementById(`raster-stretch-min-${id}`)?.value) || -1;
        const stretchMax = parseFloat(document.getElementById(`raster-stretch-max-${id}`)?.value) || 1;
        layer.r.expression(expr, { colorRamp: ramp, min: stretchMin, max: stretchMax });
      }
    } else {
      // Clear any existing expression
      if (layer._customExpression) {
        layer.r.expression(null);
      }

      // Apply band settings
      const ramp = document.getElementById(`raster-colorramp-${id}`)?.value || 'terrain';
      const displayBand = parseInt(document.getElementById(`raster-display-band-${id}`)?.value) || 1;
      layer.r.mode('singleband');
      layer.r.colorRamp(ramp);
      layer.r.band(displayBand);

      // Apply stretch
      const stretchMin = parseFloat(document.getElementById(`raster-stretch-min-${id}`)?.value);
      const stretchMax = parseFloat(document.getElementById(`raster-stretch-max-${id}`)?.value);
      if (!isNaN(stretchMin) && !isNaN(stretchMax)) {
        layer.r.stretch(stretchMin, stretchMax);
      }
    }
  }
}

/**
 * Create Style panel content with Rules/Graduated editor
 * Layout: Style type selector at top, scrollable content in middle, rendering at bottom
 */
function createStylePanel(layer) {
  // Check if raster layer
  if (layer.type === 'raster') {
    return createRasterStylePanel(layer);
  }

  const panel = document.createElement('div');
  panel.className = 'style-panel vector-style-panel';

  // Get current style settings or defaults
  const currentStyle = layer._styleOpts || {};
  const styleType = currentStyle.type === 'graduated' ? 'graduated' : 'rules';
  const currentOpacity = currentStyle.opacity ?? 0.7;

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

  // Blend mode options
  const BLEND_MODES = [
    'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
    'exclusion', 'hue', 'saturation', 'color', 'luminosity'
  ];
  const currentBlend = layer._blendMode || 'source-over';
  const blendOptions = BLEND_MODES.map(b =>
    `<option value="${b}" ${b === currentBlend ? 'selected' : ''}>${b === 'source-over' ? 'Normal' : b}</option>`
  ).join('');

  panel.innerHTML = `
    <div class="vector-style-header">
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
    </div>

    <div class="vector-style-content">
      <div class="style-common">
        <div class="style-row">
          <label>Stroke</label>
          <input type="color" class="style-color" id="style-stroke-${layer.id}" value="${currentStyle.stroke || '#000000'}">
          <label>Width</label>
          <input type="number" class="style-num" id="style-width-${layer.id}" value="${currentStyle.width || 1}" min="0" max="10" step="0.5">
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
    </div>

    <div class="vector-style-footer">
      <div class="style-section-title">Rendering</div>
      <div class="style-row">
        <label>Opacity</label>
        <input type="range" class="style-range" id="style-opacity-${layer.id}" value="${Math.round(currentOpacity * 100)}" min="0" max="100">
        <span class="style-range-val">${Math.round(currentOpacity * 100)}%</span>
      </div>
      <div class="style-row">
        <label>Blend</label>
        <select class="style-select" id="style-blend-${layer.id}">${blendOptions}</select>
      </div>
      <div class="style-actions">
        <label class="style-checkbox">
          <input type="checkbox" id="style-show-legend-${layer.id}" ${(currentStyle.showInLegend !== false) ? 'checked' : ''}>
          Show in legend
        </label>
        <div class="style-actions-buttons">
          <button class="style-btn" id="style-reset-${layer.id}">Reset</button>
          <button class="style-btn style-btn-primary" id="style-apply-${layer.id}">Apply</button>
        </div>
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

  // Blend mode selector - apply immediately
  const blendSelect = document.getElementById(`style-blend-${id}`);
  if (blendSelect) {
    blendSelect.addEventListener('change', () => {
      layer.blendMode(blendSelect.value);
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

  const disabledAttr = hasLabels ? '' : 'disabled';

  panel.innerHTML = `
    <div class="labels-header">
      <label class="style-checkbox">
        <input type="checkbox" id="labels-enabled-${layer.id}" ${hasLabels ? 'checked' : ''}>
        Enable labels
      </label>
    </div>

    <div class="labels-content" id="labels-settings-${layer.id}">
      <div class="labels-section">
        <div class="labels-section-title">Label Text</div>
        <div class="style-row">
          <label>Field</label>
          <select class="style-select" id="labels-field-${layer.id}" ${disabledAttr}>
            <option value="">-- select --</option>
            ${fieldOptions}
          </select>
        </div>
        <div class="style-row">
          <label>Or template</label>
          <input type="text" class="style-text" id="labels-template-${layer.id}"
                 placeholder="\${r.name} (\${r.value})" value="${templateExpr.replace(/"/g, '&quot;')}" ${disabledAttr}>
        </div>
        <div class="labels-hint">Template overrides field if set. Use \${r.field} syntax.</div>
      </div>

      <div class="labels-section">
        <div class="labels-section-title">Appearance</div>
        <div class="style-row">
          <label>Size</label>
          <input type="number" class="style-num" id="labels-size-${layer.id}"
                 value="${currentStyle.labelSize || 12}" min="6" max="48" ${disabledAttr}>
          <label>Color</label>
          <input type="color" class="style-color" id="labels-color-${layer.id}"
                 value="${currentStyle.labelColor || '#ffffff'}" ${disabledAttr}>
        </div>
        <div class="style-row">
          <label>Halo</label>
          <input type="color" class="style-color" id="labels-outline-${layer.id}"
                 value="${currentStyle.labelOutline || '#000000'}" ${disabledAttr}>
          <label>Width</label>
          <input type="number" class="style-num" id="labels-outline-width-${layer.id}"
                 value="${currentStyle.labelOutlineWidth ?? 3}" min="0" max="10" step="0.5" ${disabledAttr}>
        </div>
      </div>

      <div class="labels-section">
        <div class="labels-section-title">Placement</div>
        <div class="style-row">
          <label>Align</label>
          <select class="style-select" id="labels-align-${layer.id}" ${disabledAttr}>
            <option value="center" ${(currentStyle.labelAlign || 'center') === 'center' ? 'selected' : ''}>Center</option>
            <option value="left" ${currentStyle.labelAlign === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${currentStyle.labelAlign === 'right' ? 'selected' : ''}>Right</option>
          </select>
          <label>Baseline</label>
          <select class="style-select" id="labels-baseline-${layer.id}" ${disabledAttr}>
            <option value="middle" ${(currentStyle.labelBaseline || 'middle') === 'middle' ? 'selected' : ''}>Middle</option>
            <option value="top" ${currentStyle.labelBaseline === 'top' ? 'selected' : ''}>Top</option>
            <option value="bottom" ${currentStyle.labelBaseline === 'bottom' ? 'selected' : ''}>Bottom</option>
          </select>
        </div>
        <div class="style-row">
          <label>Offset X</label>
          <input type="number" class="style-num" id="labels-offsetx-${layer.id}"
                 value="${currentStyle.labelOffsetX || 0}" step="1" ${disabledAttr}>
          <label>Y</label>
          <input type="number" class="style-num" id="labels-offsety-${layer.id}"
                 value="${currentStyle.labelOffsetY || 0}" step="1" ${disabledAttr}>
        </div>
        ${layer.geomType?.includes('Line') ? `
        <div class="style-row">
          <label class="style-checkbox">
            <input type="checkbox" id="labels-follow-line-${layer.id}" ${currentStyle.labelPlacement === 'line' ? 'checked' : ''} ${disabledAttr}>
            Follow line
          </label>
        </div>
        ` : ''}
        <div class="style-row">
          <label class="style-checkbox">
            <input type="checkbox" id="labels-declutter-${layer.id}" ${layer._olLayer?.getDeclutter?.() ? 'checked' : ''} ${disabledAttr}>
            Declutter (hide overlapping)
          </label>
        </div>
      </div>
    </div>

    <div class="labels-footer">
      <div class="style-actions">
        <button class="style-btn" id="labels-clear-${layer.id}">Clear</button>
        <button class="style-btn style-btn-primary" id="labels-apply-${layer.id}">Apply</button>
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

  // Toggle settings enabled/disabled state
  const enabledCheckbox = document.getElementById(`labels-enabled-${id}`);
  const settingsDiv = document.getElementById(`labels-settings-${id}`);

  const toggleInputsDisabled = (disabled) => {
    if (!settingsDiv) return;
    // Toggle all inputs, selects, and buttons within the settings area
    settingsDiv.querySelectorAll('input, select').forEach(el => {
      el.disabled = disabled;
    });
  };

  if (enabledCheckbox) {
    enabledCheckbox.addEventListener('change', () => {
      toggleInputsDisabled(!enabledCheckbox.checked);
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