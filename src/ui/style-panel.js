// Spinifex - Schema-Driven Style Panel
// Uses widget system for layer styling UI

import { widgets } from '../core/widgets.js';
import { applyStyle, colorScales, getFieldStats, generateRulesFromField } from '../core/styling.js';
import { termPrint } from './terminal.js';
import { COLOR_RAMPS, RENDER_MODES } from '../core/raster-layer.js';
import {
  addColorRamp, listColorRamps, isCustomRamp, removeColorRamp,
  createRamp, parseColor, rgbToHex
} from '../core/color-ramps.js';
import { BLEND_MODES } from '../core/base-layer.js';

// Track open panels per layer (allows multiple style windows)
// openPanels: Map<layerName, WinBox>
// panelStates: Map<layerName, { layer, values }>
const openPanels = new Map();
const panelStates = new Map();

// Clipboard for copy/paste style
let styleClipboard = null;

/**
 * Inject styles for the style panel
 */
function injectStyles() {
  if (document.getElementById('sp-style-panel-styles')) return;

  const style = document.createElement('style');
  style.id = 'sp-style-panel-styles';
  style.textContent = `
    /* Map sp-* variables to global theme variables */
    .sp-style-panel {
      --sp-font: var(--font, system-ui, sans-serif);
      --sp-text: var(--text, #e0e0e0);
      --sp-text-dim: var(--text-dim, #888);
      --sp-bg: var(--bg-panel, #252525);
      --sp-bg-alt: var(--bg-dark, #1a1a1a);
      --sp-input-bg: var(--bg-input, #3c3c3c);
      --sp-border: var(--border, #3a3a3a);
      --sp-accent: var(--accent, #4a9eff);
      --sp-accent-hover: var(--accent-dim, #2d5a8a);
      --sp-hover: var(--bg-input, #3c3c3c);
    }

    .sp-style-panel {
      font-family: var(--sp-font);
      font-size: 13px;
      color: var(--sp-text);
      background: var(--sp-bg);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sp-style-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    /* Global form element styling for all elements in style panel */
    .sp-style-panel select,
    .sp-style-panel input[type="text"],
    .sp-style-panel input[type="number"] {
      background: var(--sp-input-bg);
      border: 1px solid var(--sp-border);
      border-radius: 4px;
      color: var(--sp-text);
      font-size: 12px;
      padding: 6px 8px;
      box-sizing: border-box;
    }

    .sp-style-panel select:focus,
    .sp-style-panel input:focus {
      outline: none;
      border-color: var(--sp-accent);
    }

    .sp-style-section {
      margin-bottom: 16px;
    }

    .sp-style-section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--sp-text-dim, #888);
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--sp-border, #333);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sp-style-section-header:hover {
      color: var(--sp-text, #e0e0e0);
    }

    .sp-style-section-header .collapse-icon {
      transition: transform 0.2s;
    }

    .sp-style-section.collapsed .collapse-icon {
      transform: rotate(-90deg);
    }

    .sp-style-section.collapsed .sp-style-section-content {
      display: none;
    }

    .sp-style-row {
      margin-bottom: 10px;
    }

    .sp-style-row label {
      display: block;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--sp-text, #e0e0e0);
    }

    .sp-style-row input,
    .sp-style-row select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 12px;
      box-sizing: border-box;
    }

    .sp-style-row input:focus,
    .sp-style-row select:focus {
      outline: none;
      border-color: var(--sp-accent, #4a9eff);
    }

    .sp-style-row input[type="color"] {
      width: 40px;
      height: 28px;
      padding: 2px;
      cursor: pointer;
    }

    .sp-style-row input[type="range"] {
      padding: 0;
    }

    .sp-color-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .sp-color-row input[type="color"] {
      flex-shrink: 0;
    }

    .sp-color-row input[type="text"] {
      flex: 1;
      font-family: monospace;
    }

    .sp-slider-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .sp-slider-row input[type="range"] {
      flex: 1;
    }

    .sp-slider-row .sp-slider-value {
      width: 40px;
      text-align: right;
      font-size: 11px;
      color: var(--sp-text-dim, #888);
    }

    .sp-palette-preview {
      display: flex;
      gap: 2px;
      margin-top: 4px;
    }

    .sp-palette-preview .swatch {
      width: 20px;
      height: 16px;
      border-radius: 2px;
    }

    .sp-ramp-preview {
      height: 16px;
      border-radius: 4px;
      margin-top: 4px;
    }

    .sp-style-footer {
      padding: 12px;
      border-top: 1px solid var(--sp-border, #333);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .sp-style-btn {
      padding: 8px 16px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 12px;
      cursor: pointer;
    }

    .sp-style-btn:hover {
      background: var(--sp-hover, #333);
    }

    .sp-apply-btn {
      background: var(--sp-accent, #4a9eff);
      border-color: var(--sp-accent, #4a9eff);
      color: white;
    }

    .sp-apply-btn:hover {
      background: var(--sp-accent-hover, #3a8eef);
    }

    .sp-style-hint {
      font-size: 11px;
      color: var(--sp-text-dim, #666);
      font-style: italic;
      padding: 8px;
    }

    /* Custom ramp editor */
    .sp-ramp-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .sp-ramp-row select {
      flex: 1;
    }

    .sp-ramp-btn-small {
      padding: 4px 8px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }

    .sp-ramp-btn-small:hover {
      background: var(--sp-hover, #333);
    }

    .sp-ramp-editor {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: var(--sp-bg, #1e1e1e);
      border: 1px solid var(--sp-border, #444);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 10001;
      padding: 16px;
    }

    .sp-ramp-editor-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
    }

    .sp-ramp-editor h3 {
      margin: 0 0 16px 0;
      font-size: 14px;
      color: var(--sp-text, #e0e0e0);
    }

    .sp-ramp-name-input {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 12px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }

    .sp-color-stops {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .sp-color-stop {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .sp-color-stop input[type="color"] {
      width: 40px;
      height: 28px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      cursor: pointer;
      padding: 0;
    }

    .sp-color-stop input[type="number"] {
      width: 60px;
      padding: 4px 6px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 11px;
    }

    .sp-color-stop .sp-remove-stop {
      padding: 2px 6px;
      font-size: 14px;
      color: #f55;
      background: transparent;
      border: none;
      cursor: pointer;
    }

    .sp-add-stop-btn {
      width: 100%;
      padding: 6px;
      border: 1px dashed var(--sp-border, #444);
      border-radius: 4px;
      background: transparent;
      color: var(--sp-text-dim, #888);
      cursor: pointer;
      font-size: 12px;
    }

    .sp-add-stop-btn:hover {
      border-color: var(--sp-accent, #4a9eff);
      color: var(--sp-accent, #4a9eff);
    }

    .sp-ramp-preview-large {
      height: 24px;
      border-radius: 4px;
      margin: 12px 0;
    }

    .sp-ramp-editor-footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    /* Rules table styles */
    .sp-rules-container {
      margin-top: 8px;
    }

    .sp-rules-fill-row {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 8px;
    }

    .sp-rules-fill-row select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 12px;
      box-sizing: border-box;
    }

    .sp-rules-fill-row select:focus {
      outline: none;
      border-color: var(--sp-accent, #4a9eff);
    }

    .sp-rules-fill-row button {
      padding: 6px 12px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }

    .sp-rules-fill-row button:hover {
      background: var(--sp-hover, #333);
    }

    .sp-rules-table-wrap {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--sp-border, #333);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .sp-rules-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .sp-rules-table th {
      background: var(--sp-bg-alt, #252525);
      padding: 6px 8px;
      text-align: left;
      font-weight: 500;
      color: var(--sp-text-dim, #888);
      text-transform: uppercase;
      font-size: 10px;
      position: sticky;
      top: 0;
    }

    .sp-rules-table td {
      padding: 4px 6px;
      border-top: 1px solid var(--sp-border, #333);
      vertical-align: middle;
    }

    .sp-rules-table input[type="text"] {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 3px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 11px;
      font-family: monospace;
      box-sizing: border-box;
    }

    .sp-rules-table input[type="color"] {
      width: 32px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--sp-border, #444);
      border-radius: 3px;
      cursor: pointer;
    }

    .sp-rules-table .sp-rule-remove {
      background: transparent;
      border: none;
      color: #f55;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
    }

    .sp-rules-table .sp-rule-remove:hover {
      color: #ff7777;
    }

    .sp-rules-footer {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }

    .sp-add-rule-btn {
      padding: 6px 12px;
      border: 1px dashed var(--sp-border, #444);
      border-radius: 4px;
      background: transparent;
      color: var(--sp-text-dim, #888);
      font-size: 12px;
      cursor: pointer;
    }

    .sp-add-rule-btn:hover {
      border-color: var(--sp-accent, #4a9eff);
      color: var(--sp-accent, #4a9eff);
    }

    .sp-default-color {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 11px;
      color: var(--sp-text-dim, #888);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Open custom ramp editor dialog
 * @param {Function} onSave - Callback with new ramp name when saved
 */
function openRampEditor(onSave) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sp-ramp-editor-overlay';

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'sp-ramp-editor';

  // Initial color stops
  let colorStops = [
    { color: '#000000', position: 0 },
    { color: '#ffffff', position: 100 }
  ];

  // Build dialog content
  function render() {
    dialog.innerHTML = `
      <h3>Create Custom Color Ramp</h3>
      <input type="text" class="sp-ramp-name-input" placeholder="Ramp name (e.g., my_ramp)" value="">
      <div class="sp-color-stops"></div>
      <button class="sp-add-stop-btn">+ Add Color Stop</button>
      <div class="sp-ramp-preview-large"></div>
      <div class="sp-ramp-editor-footer">
        <button class="sp-style-btn sp-cancel-btn">Cancel</button>
        <button class="sp-style-btn sp-apply-btn sp-save-ramp-btn">Save Ramp</button>
      </div>
    `;

    // Populate color stops
    const stopsContainer = dialog.querySelector('.sp-color-stops');
    colorStops.forEach((stop, index) => {
      const stopRow = document.createElement('div');
      stopRow.className = 'sp-color-stop';
      stopRow.innerHTML = `
        <input type="color" value="${stop.color}" data-index="${index}">
        <input type="number" min="0" max="100" value="${stop.position}" data-index="${index}">
        <span style="font-size: 11px; color: #888;">%</span>
        <button class="sp-remove-stop" data-index="${index}">&times;</button>
      `;
      stopsContainer.appendChild(stopRow);
    });

    updatePreview();
  }

  // Update the preview gradient
  function updatePreview() {
    const preview = dialog.querySelector('.sp-ramp-preview-large');
    if (!preview) return;

    const sorted = [...colorStops].sort((a, b) => a.position - b.position);
    const gradientStops = sorted.map(s => `${s.color} ${s.position}%`);
    preview.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
  }

  render();

  // Event handlers
  dialog.addEventListener('input', (e) => {
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;

    if (e.target.type === 'color') {
      colorStops[index].color = e.target.value;
    } else if (e.target.type === 'number') {
      colorStops[index].position = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
    }
    updatePreview();
  });

  dialog.addEventListener('click', (e) => {
    // Remove stop
    if (e.target.classList.contains('sp-remove-stop')) {
      const index = parseInt(e.target.dataset.index);
      if (colorStops.length > 2) {
        colorStops.splice(index, 1);
        render();
      }
      return;
    }

    // Add stop
    if (e.target.classList.contains('sp-add-stop-btn')) {
      // Add at midpoint
      const sorted = [...colorStops].sort((a, b) => a.position - b.position);
      const lastPos = sorted[sorted.length - 1]?.position || 100;
      const newPos = Math.min(100, lastPos + 10);
      colorStops.push({ color: '#888888', position: newPos });
      render();
      return;
    }

    // Cancel
    if (e.target.classList.contains('sp-cancel-btn')) {
      document.body.removeChild(overlay);
      document.body.removeChild(dialog);
      return;
    }

    // Save
    if (e.target.classList.contains('sp-save-ramp-btn')) {
      const nameInput = dialog.querySelector('.sp-ramp-name-input');
      const name = nameInput.value.trim();

      if (!name) {
        nameInput.style.borderColor = '#f55';
        nameInput.focus();
        return;
      }

      // Sort and normalize stops
      const sorted = [...colorStops].sort((a, b) => a.position - b.position);
      const colors = sorted.map(s => s.color);
      const stops = sorted.map(s => s.position / 100);

      try {
        addColorRamp(name, colors, stops);
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        if (onSave) onSave(name.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
      } catch (err) {
        termPrint(`Error: ${err.message}`, 'red');
      }
      return;
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });

  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  // Focus name input
  dialog.querySelector('.sp-ramp-name-input').focus();
}

/**
 * Create ramp select row with "Create" button
 */
function createRampSelectRow(label, param, options, value, onChange, onRampCreated) {
  const row = document.createElement('div');
  row.className = 'sp-param-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'sp-param-label';
  labelEl.textContent = label;

  const controlsRow = document.createElement('div');
  controlsRow.className = 'sp-ramp-row';

  const select = document.createElement('select');
  select.className = 'sp-param-select';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => onChange(select.value, param));

  const createBtn = document.createElement('button');
  createBtn.className = 'sp-ramp-btn-small';
  createBtn.textContent = '+ New';
  createBtn.title = 'Create custom color ramp';
  createBtn.addEventListener('click', () => {
    openRampEditor((newRampName) => {
      // Add new option to select
      const newOption = document.createElement('option');
      newOption.value = newRampName;
      newOption.textContent = newRampName.charAt(0).toUpperCase() + newRampName.slice(1);
      select.appendChild(newOption);
      select.value = newRampName;
      onChange(newRampName, param);
      if (onRampCreated) onRampCreated(newRampName);
    });
  });

  controlsRow.appendChild(select);
  controlsRow.appendChild(createBtn);
  row.appendChild(labelEl);
  row.appendChild(controlsRow);
  return row;
}

/**
 * Get color scale options for select
 */
function getScaleOptions() {
  return Object.keys(colorScales).map(name => ({
    value: name,
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }));
}

/**
 * Get field options for a layer
 */
function getFieldOptions(layer) {
  if (!layer?.fields || layer.fields.length === 0) {
    return [{ value: '', label: '(no fields)' }];
  }
  return [
    { value: '', label: '(select field)' },
    ...layer.fields.map(f => ({ value: f, label: f }))
  ];
}

/**
 * Get blend mode options
 */
function getBlendModeOptions() {
  return BLEND_MODES.map(mode => ({
    value: mode,
    label: mode === 'source-over' ? 'Normal' : mode
  }));
}

/**
 * Get numeric field options for graduated styling
 */
function getNumericFieldOptions(layer) {
  if (!layer?.fields) return [{ value: '', label: '(no numeric fields)' }];

  const numericFields = layer.fields.filter(f => {
    const stats = getFieldStats(layer, f);
    return stats !== null;
  });

  if (numericFields.length === 0) {
    return [{ value: '', label: '(no numeric fields)' }];
  }

  return [
    { value: '', label: '(select field)' },
    ...numericFields.map(f => ({ value: f, label: f }))
  ];
}

/**
 * Create a color input row
 */
function createColorRow(label, param, value, onChange) {
  const row = document.createElement('div');
  row.className = 'sp-style-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const colorRow = document.createElement('div');
  colorRow.className = 'sp-color-row';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = value || '#4a9eff';
  colorInput.dataset.param = param;

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.value = value || '#4a9eff';
  textInput.dataset.param = param + '_text';

  // Sync inputs
  colorInput.addEventListener('input', () => {
    textInput.value = colorInput.value;
    onChange(param, colorInput.value);
  });

  textInput.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/i.test(textInput.value)) {
      colorInput.value = textInput.value;
      onChange(param, textInput.value);
    }
  });

  colorRow.appendChild(colorInput);
  colorRow.appendChild(textInput);
  row.appendChild(colorRow);

  return row;
}

/**
 * Create a slider row
 */
function createSliderRow(label, param, value, min, max, step, onChange) {
  const row = document.createElement('div');
  row.className = 'sp-style-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'sp-slider-row';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;
  slider.dataset.param = param;

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'sp-slider-value';
  valueDisplay.textContent = value;

  slider.addEventListener('input', () => {
    valueDisplay.textContent = slider.value;
    onChange(param, parseFloat(slider.value));
  });

  sliderRow.appendChild(slider);
  sliderRow.appendChild(valueDisplay);
  row.appendChild(sliderRow);

  return row;
}

/**
 * Create a number input row
 */
function createNumberRow(label, param, value, min, max, step, onChange) {
  const row = document.createElement('div');
  row.className = 'sp-style-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const input = document.createElement('input');
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.dataset.param = param;

  input.addEventListener('input', () => {
    onChange(param, parseFloat(input.value));
  });

  row.appendChild(input);
  return row;
}

/**
 * Create a select row
 */
function createSelectRow(label, param, options, value, onChange) {
  const row = document.createElement('div');
  row.className = 'sp-style-row';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const select = document.createElement('select');
  select.dataset.param = param;

  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    onChange(param, select.value);
  });

  row.appendChild(select);
  return row;
}

/**
 * Create palette preview
 */
function createPalettePreview(scaleName) {
  const preview = document.createElement('div');
  preview.className = 'sp-palette-preview';

  const scale = colorScales[scaleName] || colorScales.default;
  let colors;

  if (Array.isArray(scale)) {
    colors = scale.slice(0, 8);
  } else {
    try {
      colors = [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1].map(t =>
        chroma.scale(scale)(t).hex()
      );
    } catch (e) {
      colors = colorScales.default.slice(0, 8);
    }
  }

  colors.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = c;
    preview.appendChild(swatch);
  });

  return preview;
}

/**
 * Create ramp preview
 */
function createRampPreview(scaleName) {
  const preview = document.createElement('div');
  preview.className = 'sp-ramp-preview';

  const scale = colorScales[scaleName] || colorScales.viridis;
  let colors;

  if (Array.isArray(scale)) {
    colors = scale;
  } else {
    try {
      colors = [0, 0.25, 0.5, 0.75, 1].map(t => chroma.scale(scale)(t).hex());
    } catch (e) {
      colors = ['#440154', '#31688e', '#35b779', '#fde725'];
    }
  }

  preview.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
  return preview;
}

/**
 * Create a collapsible section
 */
function createSection(title, collapsed = false) {
  const section = document.createElement('div');
  section.className = 'sp-style-section' + (collapsed ? ' collapsed' : '');

  const header = document.createElement('div');
  header.className = 'sp-style-section-header';
  header.innerHTML = `<span>${title}</span><span class="collapse-icon">▼</span>`;
  header.addEventListener('click', () => {
    section.classList.toggle('collapsed');
  });

  const content = document.createElement('div');
  content.className = 'sp-style-section-content';

  section.appendChild(header);
  section.appendChild(content);

  return { section, content };
}

/**
 * Build the style panel content
 */
function buildPanelContent(layer) {
  const isPoint = layer.geomType?.includes('Point');
  const isLine = layer.geomType?.includes('Line');
  const hasFields = layer.fields && layer.fields.length > 0;

  // Initialize values from current style (per-panel state)
  const existingStyle = layer._styleOpts || {};
  const values = {
    styleType: existingStyle.type || 'single',
    fill: existingStyle.fill || existingStyle.rules?.[0]?.fill || '#4a9eff',
    stroke: existingStyle.stroke || '#000000',
    width: existingStyle.width || 1,
    opacity: existingStyle.opacity ?? 0.7,
    blendMode: layer._blendMode || 'source-over',
    radius: existingStyle.radius || 6,
    field: existingStyle.field || '',
    palette: existingStyle.palette || 'default',
    scale: existingStyle.scale || 'viridis',
    min: existingStyle.min,
    max: existingStyle.max,
    default: existingStyle.default || '#888888',
    labelField: existingStyle.labelField || '',
    labelColor: existingStyle.labelColor || '#ffffff',
    labelSize: existingStyle.labelSize || 12,
    labelOutline: existingStyle.labelOutline || '#000000',
    labelOutlineWidth: existingStyle.labelOutlineWidth ?? 3,
    rules: existingStyle.rules || [],
  };

  // Store in per-panel state
  panelStates.set(layer.name, { layer, values });

  const container = document.createElement('div');
  container.className = 'sp-style-panel';

  const body = document.createElement('div');
  body.className = 'sp-style-panel-body';

  // Handler for value changes (uses closure to access this panel's values)
  const handleChange = (param, value) => {
    values[param] = value;

    // Rebuild dynamic sections when style type changes
    if (param === 'styleType') {
      rebuildDynamicContent();
    }

    // Update field stats when graduated field changes
    if (param === 'field' && values.styleType === 'graduated' && value) {
      const stats = getFieldStats(layer, value);
      if (stats) {
        values.min = stats.min;
        values.max = stats.max;
        // Update inputs
        const minInput = container.querySelector('[data-param="min"]');
        const maxInput = container.querySelector('[data-param="max"]');
        if (minInput) minInput.value = stats.min;
        if (maxInput) maxInput.value = stats.max;
      }
    }

    // Update palette preview
    if (param === 'palette') {
      const previewContainer = container.querySelector('#palette-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.appendChild(createPalettePreview(value));
      }
    }

    // Update ramp preview
    if (param === 'scale') {
      const previewContainer = container.querySelector('#ramp-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.appendChild(createRampPreview(value));
      }
    }
  };

  // Dynamic content area (changes based on style type)
  const dynamicArea = document.createElement('div');
  dynamicArea.id = 'style-dynamic-area';

  const rebuildDynamicContent = () => {
    dynamicArea.innerHTML = '';

    const styleType = values.styleType;

    // === Style Type Section ===
    const { section: typeSection, content: typeContent } = createSection('Style Type');
    typeContent.appendChild(createSelectRow('Type', 'styleType', [
      { value: 'single', label: 'Single Symbol' },
      { value: 'rules', label: 'Rules (Discrete)' },
      { value: 'categorical', label: 'Categorized' },
      { value: 'graduated', label: 'Graduated' },
    ], styleType, handleChange));
    dynamicArea.appendChild(typeSection);

    // === Type-specific content ===
    if (styleType === 'single') {
      const { section: fillSection, content: fillContent } = createSection('Fill');
      if (!isLine) {
        fillContent.appendChild(createColorRow('Fill Color', 'fill', values.fill, handleChange));
      }
      dynamicArea.appendChild(fillSection);

    } else if (styleType === 'rules') {
      const { section: rulesSection, content: rulesContent } = createSection('Rules');

      if (hasFields) {
        // Fill from field row
        const fillRow = document.createElement('div');
        fillRow.className = 'sp-rules-fill-row';

        const fieldSelect = document.createElement('select');
        fieldSelect.innerHTML = '<option value="">-- select field --</option>' +
          layer.fields.map(f => `<option value="${f}">${f}</option>`).join('');

        const scaleSelect = document.createElement('select');
        const scaleOpts = getScaleOptions();
        scaleSelect.innerHTML = scaleOpts.map(s => `<option value="${s.value}">${s.label}</option>`).join('');

        const fillBtn = document.createElement('button');
        fillBtn.textContent = 'Fill';
        fillBtn.addEventListener('click', () => {
          const field = fieldSelect.value;
          const scale = scaleSelect.value;
          if (!field) return;

          // Generate rules from field
          const generatedRules = generateRulesFromField(layer, field, scale);
          values.rules = generatedRules;

          // Rebuild rules table
          rulesTableBody.innerHTML = '';
          generatedRules.forEach(rule => addRuleRow(rule));
        });

        fillRow.appendChild(fieldSelect);
        fillRow.appendChild(scaleSelect);
        fillRow.appendChild(fillBtn);
        rulesContent.appendChild(fillRow);

        // Rules table
        const tableWrap = document.createElement('div');
        tableWrap.className = 'sp-rules-table-wrap';

        const table = document.createElement('table');
        table.className = 'sp-rules-table';
        table.innerHTML = `
          <thead>
            <tr>
              <th style="width: 45%">Filter</th>
              <th style="width: 50px">Color</th>
              <th style="width: 30%">Label</th>
              <th style="width: 30px"></th>
            </tr>
          </thead>
        `;

        const rulesTableBody = document.createElement('tbody');
        table.appendChild(rulesTableBody);

        // Function to add a rule row
        const addRuleRow = (rule = { filter: '', fill: '#4a9eff', label: '' }) => {
          const tr = document.createElement('tr');

          const filterTd = document.createElement('td');
          const filterInput = document.createElement('input');
          filterInput.type = 'text';
          filterInput.placeholder = "r.field == 'value'";
          filterInput.value = rule.filter || '';
          filterInput.addEventListener('input', () => {
            updateRulesFromTable();
          });
          filterTd.appendChild(filterInput);

          const colorTd = document.createElement('td');
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.value = rule.fill || '#4a9eff';
          colorInput.addEventListener('input', () => {
            updateRulesFromTable();
          });
          colorTd.appendChild(colorInput);

          const labelTd = document.createElement('td');
          const labelInput = document.createElement('input');
          labelInput.type = 'text';
          labelInput.placeholder = 'Label';
          labelInput.value = rule.label || '';
          labelInput.addEventListener('input', () => {
            updateRulesFromTable();
          });
          labelTd.appendChild(labelInput);

          const removeTd = document.createElement('td');
          const removeBtn = document.createElement('button');
          removeBtn.className = 'sp-rule-remove';
          removeBtn.innerHTML = '&times;';
          removeBtn.addEventListener('click', () => {
            tr.remove();
            updateRulesFromTable();
          });
          removeTd.appendChild(removeBtn);

          tr.appendChild(filterTd);
          tr.appendChild(colorTd);
          tr.appendChild(labelTd);
          tr.appendChild(removeTd);
          rulesTableBody.appendChild(tr);
        };

        // Function to update values.rules from table
        const updateRulesFromTable = () => {
          const rows = rulesTableBody.querySelectorAll('tr');
          values.rules = Array.from(rows).map(row => ({
            filter: row.querySelector('input[type="text"]').value,
            fill: row.querySelector('input[type="color"]').value,
            label: row.querySelectorAll('input[type="text"]')[1]?.value || ''
          }));
        };

        tableWrap.appendChild(table);
        rulesContent.appendChild(tableWrap);

        // Footer with Add Rule button and Default color
        const footer = document.createElement('div');
        footer.className = 'sp-rules-footer';

        const addBtn = document.createElement('button');
        addBtn.className = 'sp-add-rule-btn';
        addBtn.textContent = '+ Add Rule';
        addBtn.addEventListener('click', () => {
          addRuleRow();
        });

        const defaultRow = document.createElement('div');
        defaultRow.className = 'sp-default-color';
        defaultRow.innerHTML = '<span>Default</span>';
        const defaultColor = document.createElement('input');
        defaultColor.type = 'color';
        defaultColor.value = values.default;
        defaultColor.addEventListener('input', (e) => {
          handleChange('default', e.target.value);
        });
        defaultRow.appendChild(defaultColor);

        footer.appendChild(addBtn);
        footer.appendChild(defaultRow);
        rulesContent.appendChild(footer);

        // Populate existing rules
        if (values.rules && values.rules.length > 0) {
          values.rules.forEach(rule => addRuleRow(rule));
        }

      } else {
        const hint = document.createElement('div');
        hint.className = 'sp-style-hint';
        hint.textContent = 'No fields available for rule-based styling';
        rulesContent.appendChild(hint);
      }

      dynamicArea.appendChild(rulesSection);

    } else if (styleType === 'categorical') {
      const { section: catSection, content: catContent } = createSection('Categorize By');

      if (hasFields) {
        catContent.appendChild(createSelectRow('Field', 'field', getFieldOptions(layer), values.field, handleChange));
        catContent.appendChild(createSelectRow('Palette', 'palette', getScaleOptions(), values.palette, handleChange));

        const previewContainer = document.createElement('div');
        previewContainer.id = 'palette-preview-container';
        previewContainer.appendChild(createPalettePreview(values.palette));
        catContent.appendChild(previewContainer);

        catContent.appendChild(createColorRow('Default Color', 'default', values.default, handleChange));
      } else {
        const hint = document.createElement('div');
        hint.className = 'sp-style-hint';
        hint.textContent = 'No fields available for categorization';
        catContent.appendChild(hint);
      }

      dynamicArea.appendChild(catSection);

    } else if (styleType === 'graduated') {
      const { section: gradSection, content: gradContent } = createSection('Graduate By');

      const numericOptions = getNumericFieldOptions(layer);
      if (numericOptions.length > 1) {
        gradContent.appendChild(createSelectRow('Field', 'field', numericOptions, values.field, handleChange));
        gradContent.appendChild(createSelectRow('Color Ramp', 'scale', getScaleOptions(), values.scale, handleChange));

        const previewContainer = document.createElement('div');
        previewContainer.id = 'ramp-preview-container';
        previewContainer.appendChild(createRampPreview(values.scale));
        gradContent.appendChild(previewContainer);

        // Auto-populate min/max from field stats
        if (values.field) {
          const stats = getFieldStats(layer, values.field);
          if (stats) {
            if (values.min === undefined) values.min = stats.min;
            if (values.max === undefined) values.max = stats.max;
          }
        }

        gradContent.appendChild(createNumberRow('Min', 'min', values.min ?? 0, -999999, 999999, 0.1, handleChange));
        gradContent.appendChild(createNumberRow('Max', 'max', values.max ?? 100, -999999, 999999, 0.1, handleChange));
        gradContent.appendChild(createColorRow('Default Color', 'default', values.default, handleChange));
      } else {
        const hint = document.createElement('div');
        hint.className = 'sp-style-hint';
        hint.textContent = 'No numeric fields available for graduation';
        gradContent.appendChild(hint);
      }

      dynamicArea.appendChild(gradSection);
    }

    // === Stroke Section ===
    const { section: strokeSection, content: strokeContent } = createSection('Stroke');
    strokeContent.appendChild(createColorRow('Stroke Color', 'stroke', values.stroke, handleChange));
    strokeContent.appendChild(createNumberRow('Width', 'width', values.width, 0, 10, 0.5, handleChange));

    if (isPoint) {
      strokeContent.appendChild(createNumberRow('Radius', 'radius', values.radius, 1, 50, 1, handleChange));
    }
    dynamicArea.appendChild(strokeSection);

    // === Display Section ===
    const { section: displaySection, content: displayContent } = createSection('Display');
    displayContent.appendChild(createSliderRow('Opacity', 'opacity', values.opacity, 0, 1, 0.05, handleChange));
    displayContent.appendChild(createSelectRow('Blend Mode', 'blendMode', getBlendModeOptions(), values.blendMode, handleChange));
    dynamicArea.appendChild(displaySection);

    // === Labels Section ===
    if (hasFields) {
      const { section: labelSection, content: labelContent } = createSection('Labels', true);
      labelContent.appendChild(createSelectRow('Label Field', 'labelField', [
        { value: '', label: '(none)' },
        ...layer.fields.map(f => ({ value: f, label: f }))
      ], values.labelField, handleChange));
      labelContent.appendChild(createColorRow('Color', 'labelColor', values.labelColor, handleChange));
      labelContent.appendChild(createNumberRow('Size', 'labelSize', values.labelSize, 8, 32, 1, handleChange));
      labelContent.appendChild(createColorRow('Outline', 'labelOutline', values.labelOutline, handleChange));
      labelContent.appendChild(createNumberRow('Outline Width', 'labelOutlineWidth', values.labelOutlineWidth, 0, 10, 0.5, handleChange));
      dynamicArea.appendChild(labelSection);
    }
  };

  // Initial build
  rebuildDynamicContent();
  body.appendChild(dynamicArea);

  // Footer with buttons
  const footer = document.createElement('div');
  footer.className = 'sp-style-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sp-style-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    // Close this specific layer's panel
    const panel = openPanels.get(layer.name);
    if (panel) panel.close();
  });

  const applyBtn = document.createElement('button');
  applyBtn.className = 'sp-style-btn sp-apply-btn';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    applyCurrentStyle(layer);
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(applyBtn);

  container.appendChild(body);
  container.appendChild(footer);

  return container;
}

/**
 * Apply the current style values to the layer
 */
function applyCurrentStyle(layer) {
  // Look up values from per-panel state
  const state = panelStates.get(layer.name);
  if (!state) {
    termPrint('No style panel state found', 'red');
    return;
  }
  const values = state.values;
  const styleType = values.styleType;

  const styleOpts = {
    type: styleType,
    stroke: values.stroke,
    width: values.width,
    opacity: values.opacity,
    radius: values.radius,
    labelField: values.labelField || undefined,
    labelColor: values.labelColor,
    labelSize: values.labelSize,
    labelOutline: values.labelOutline,
    labelOutlineWidth: values.labelOutlineWidth,
    default: values.default,
  };

  if (styleType === 'single') {
    styleOpts.fill = values.fill;
  } else if (styleType === 'rules') {
    styleOpts.rules = values.rules;
  } else if (styleType === 'categorical') {
    styleOpts.field = values.field;
    styleOpts.palette = values.palette;
  } else if (styleType === 'graduated') {
    styleOpts.field = values.field;
    styleOpts.scale = values.scale;
    styleOpts.min = values.min;
    styleOpts.max = values.max;
  }

  // Apply style
  applyStyle(layer, styleOpts);

  // Apply blend mode separately (not part of vector styling)
  if (values.blendMode && layer.blendMode) {
    layer.blendMode(values.blendMode);
  }

  // Store style opts on layer for persistence
  layer._styleOpts = styleOpts;

  termPrint(`Style applied to ${layer.name}`, 'green');
}

/**
 * Open the style panel for a layer
 * @param {Layer} layer - The layer to style
 * @returns {WinBox} The panel window
 */
export function openStylePanel(layer) {
  if (!layer) {
    termPrint('No layer specified', 'red');
    return null;
  }

  if (layer.type !== 'vector') {
    termPrint('Style panel currently only supports vector layers', 'yellow');
    return null;
  }

  injectStyles();

  // If panel for this layer already exists, focus it
  const existingPanel = openPanels.get(layer.name);
  if (existingPanel) {
    try {
      existingPanel.focus();
      return existingPanel;
    } catch (e) {
      // Panel was closed, remove from map
      openPanels.delete(layer.name);
    }
  }

  const content = buildPanelContent(layer);

  // Offset position based on number of open panels
  const offset = openPanels.size * 30;

  const panel = new WinBox({
    title: `Style: ${layer.name}`,
    width: '400px',
    height: '500px',
    x: 'center',
    y: 'center',
    top: 0,
    left: 100 + offset,
    class: ['no-full'],
    mount: content,
    onclose: () => {
      openPanels.delete(layer.name);
      panelStates.delete(layer.name);
    },
  });

  openPanels.set(layer.name, panel);
  return panel;
}

/**
 * Get current panel state
 */
export function getStylePanelState() {
  return {
    isOpen: openPanels.size > 0,
    openLayers: Array.from(openPanels.keys()),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RASTER STYLE PANEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get color ramp options
 */
function getRampOptions() {
  return Object.keys(COLOR_RAMPS).map(name => ({
    value: name,
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }));
}

/**
 * Get band options for a raster
 */
function getBandOptions(layer) {
  const bandCount = layer.bands || 1;
  const options = [];
  for (let i = 1; i <= bandCount; i++) {
    options.push({ value: i, label: `Band ${i}` });
  }
  return options;
}

/**
 * Create ramp preview element
 */
function createRasterRampPreview(rampName) {
  const preview = document.createElement('div');
  preview.className = 'sp-ramp-preview';

  const ramp = COLOR_RAMPS[rampName];
  if (!ramp) {
    preview.style.background = '#888';
    return preview;
  }

  const gradientStops = ramp.stops.map((stop, i) => {
    const [r, g, b] = ramp.colors[i];
    return `rgb(${r},${g},${b}) ${stop * 100}%`;
  });

  preview.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
  return preview;
}

/**
 * Build raster style panel content using widget system
 */
function buildRasterPanelContent(layer) {
  // Check if layer currently uses an expression
  const currentExpr = layer._customExpression || '';
  const usesExpression = !!currentExpr;

  // Initialize values from current layer state (per-panel state)
  const values = {
    mode: layer._mode || 'singleband',
    source: usesExpression ? 'expression' : 'band',
    colorRamp: layer._colorRamp || 'terrain',
    band: layer._selectedBand || 1,
    expression: currentExpr,
    redBand: layer._bandMapping?.[0] || 1,
    greenBand: layer._bandMapping?.[1] || 2,
    blueBand: layer._bandMapping?.[2] || 3,
    min: layer.minValue,
    max: layer.maxValue,
    opacity: layer.opacity?.() || 1,
    blendMode: layer._blendMode || 'source-over',
  };

  // Store in per-panel state
  panelStates.set(layer.name, { layer, values });

  const container = document.createElement('div');
  container.className = 'sp-style-panel raster-style-panel';

  const body = document.createElement('div');
  body.className = 'sp-style-panel-body';

  // Handler for value changes from widget system (receives full values object)
  const handleChange = (updatedValues) => {
    // Check what changed by comparing with current values
    const modeChanged = updatedValues.mode !== values.mode;
    const rampChanged = updatedValues.colorRamp !== values.colorRamp;
    const sourceChanged = updatedValues.source !== values.source;

    // Update our local values object
    Object.assign(values, updatedValues);

    // Rebuild content when mode or source changes
    if (modeChanged || sourceChanged) {
      rebuildDynamicContent();
    }

    // Update ramp preview
    if (rampChanged) {
      const previewContainer = container.querySelector('#raster-ramp-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.appendChild(createRasterRampPreview(values.colorRamp));
      }
    }
  };

  // Dynamic content area
  const dynamicArea = document.createElement('div');
  dynamicArea.id = 'raster-dynamic-area';

  const rebuildDynamicContent = () => {
    dynamicArea.innerHTML = '';
    const mode = values.mode;
    const bandCount = layer.bands || 1;

    // === Render Mode Section (using widget system) ===
    const modeSection = widgets.renderSection({
      label: 'Render Mode',
      collapsible: true,
      collapsed: false,
      fields: [{
        name: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'singleband', label: 'Single Band' },
          { value: 'rgb', label: 'RGB Composite' },
          { value: 'grayscale', label: 'Grayscale' },
        ],
      }],
    }, values, handleChange);
    dynamicArea.appendChild(modeSection);

    // === Mode-specific content ===
    if (mode === 'singleband' || mode === 'grayscale') {
      // For singleband mode, show source toggle (Band vs Expression)
      if (mode === 'singleband') {
        // Source toggle section (Band vs Expression)
        const sourceSection = widgets.renderSection({
          label: 'Data Source',
          collapsible: true,
          collapsed: false,
          fields: [{
            name: 'source',
            type: 'radioGroup',
            options: [
              { value: 'band', label: 'Band' },
              { value: 'expression', label: 'Expression' },
            ],
          }],
        }, values, handleChange);
        dynamicArea.appendChild(sourceSection);

        // Show Band selection OR Expression input based on source
        if (values.source === 'band') {
          // === Band Selection Section ===
          const bandFields = [];
          if (bandCount > 1) {
            bandFields.push({
              name: 'band',
              label: 'Display Band',
              type: 'select',
              options: getBandOptions(layer),
            });
          }

          const bandSection = widgets.renderSection({
            label: 'Band Selection',
            collapsible: true,
            collapsed: false,
            fields: bandFields,
          }, values, handleChange);

          // Add custom ramp row with "+ New" button
          const bandContent = bandSection.querySelector('.sp-section-content');
          if (bandContent) {
            const previewContainer = document.createElement('div');
            previewContainer.id = 'raster-ramp-preview-container';
            previewContainer.appendChild(createRasterRampPreview(values.colorRamp));

            bandContent.appendChild(createRampSelectRow('Color Ramp', 'colorRamp', getRampOptions(), values.colorRamp,
              (name, val) => {
                values[name] = val;
                handleChange(values);
              },
              (newRampName) => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(createRasterRampPreview(newRampName));
              }
            ));
            bandContent.appendChild(previewContainer);
          }
          dynamicArea.appendChild(bandSection);

        } else {
          // === Expression Builder Section ===
          // Define expression presets based on band count
          const exprPresets = [
            { label: 'NDVI', expr: '(b4 - b3) / (b4 + b3)', ramp: 'ndvi', min: -1, max: 1, disabled: bandCount < 4 },
            { label: 'NDWI', expr: '(b2 - b4) / (b2 + b4)', ramp: 'bluered', min: -1, max: 1, disabled: bandCount < 4 },
            { label: 'NIR/R', expr: 'b4 / b3', ramp: 'viridis', min: 0, max: 3, disabled: bandCount < 4 },
            { label: 'Thresh', expr: 'b1 > 0.5 ? 1 : 0', ramp: 'grayscale', min: 0, max: 1, disabled: false },
          ];

          // Custom expression handler that also applies preset ramp/stretch
          const handleExpressionChange = (exprValue, preset) => {
            values.expression = exprValue;
            // If a preset was clicked, apply its ramp and stretch values
            if (preset && typeof preset === 'object' && preset.ramp) {
              values.colorRamp = preset.ramp;
              values.min = preset.min;
              values.max = preset.max;
              // Trigger UI update for ramp preview
              const previewContainer = container.querySelector('#raster-ramp-preview-container');
              if (previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(createRasterRampPreview(values.colorRamp));
              }
              // Update ramp select
              const rampSelect = container.querySelector('select[data-name="colorRamp"]');
              if (rampSelect) rampSelect.value = values.colorRamp;
              // Update stretch inputs
              const minInput = container.querySelector('input[data-name="min"]');
              const maxInput = container.querySelector('input[data-name="max"]');
              if (minInput) minInput.value = values.min;
              if (maxInput) maxInput.value = values.max;
            }
          };

          const exprSection = widgets.renderSection({
            label: 'Expression Builder',
            collapsible: true,
            collapsed: false,
            fields: [
              {
                name: 'expression',
                type: 'expression',
                placeholder: 'e.g. (b4 - b3) / (b4 + b3)',
                presets: exprPresets,
              },
              {
                type: 'hint',
                text: 'Use b1, b2, b3... for bands. Ops: + - * / > < == ? :',
              },
            ],
          }, values, (updatedValues, ...args) => {
            // Check if this is an expression field change with preset data
            if (args.length > 0 && args[0] && typeof args[0] === 'object' && args[0].ramp) {
              handleExpressionChange(updatedValues.expression, args[0]);
            } else {
              handleChange(updatedValues);
            }
          });

          // Add custom ramp row for expression mode too
          const exprContent = exprSection.querySelector('.sp-section-content');
          if (exprContent) {
            const previewContainer = document.createElement('div');
            previewContainer.id = 'raster-ramp-preview-container';
            previewContainer.appendChild(createRasterRampPreview(values.colorRamp));

            exprContent.appendChild(createRampSelectRow('Color Ramp', 'colorRamp', getRampOptions(), values.colorRamp,
              (name, val) => {
                values[name] = val;
                handleChange(values);
              },
              (newRampName) => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(createRasterRampPreview(newRampName));
              }
            ));
            exprContent.appendChild(previewContainer);
          }
          dynamicArea.appendChild(exprSection);
        }

      } else {
        // Grayscale mode - just band selection, no expression
        const bandFields = [];
        if (bandCount > 1) {
          bandFields.push({
            name: 'band',
            label: 'Display Band',
            type: 'select',
            options: getBandOptions(layer),
          });
        }
        if (bandFields.length > 0) {
          const bandSection = widgets.renderSection({
            label: 'Band Selection',
            collapsible: true,
            collapsed: false,
            fields: bandFields,
          }, values, handleChange);
          dynamicArea.appendChild(bandSection);
        }
      }

    } else if (mode === 'rgb') {
      if (bandCount >= 3) {
        const rgbSection = widgets.renderSection({
          label: 'Band Mapping',
          collapsible: true,
          collapsed: false,
          fields: [
            { name: 'redBand', label: 'Red Band', type: 'select', options: getBandOptions(layer) },
            { name: 'greenBand', label: 'Green Band', type: 'select', options: getBandOptions(layer) },
            { name: 'blueBand', label: 'Blue Band', type: 'select', options: getBandOptions(layer) },
          ],
        }, values, handleChange);
        dynamicArea.appendChild(rgbSection);
      } else {
        // Not enough bands - show hint
        const rgbSection = widgets.renderSection({
          label: 'Band Mapping',
          collapsible: true,
          collapsed: false,
          fields: [{
            name: '_hint',
            type: 'hint',
            text: `RGB mode requires 3+ bands. This raster has ${bandCount} band(s).`,
          }],
        }, values, handleChange);
        dynamicArea.appendChild(rgbSection);
      }
    }

    // === Value Stretch Section (using widget system) ===
    const stretchSection = widgets.renderSection({
      label: 'Value Stretch',
      collapsible: true,
      collapsed: false,
      fields: [
        { name: 'min', label: 'Min', type: 'number', min: -999999, max: 999999, step: 1 },
        { name: 'max', label: 'Max', type: 'number', min: -999999, max: 999999, step: 1 },
      ],
    }, values, handleChange);
    dynamicArea.appendChild(stretchSection);

    // === Display Section (using widget system) ===
    const displaySection = widgets.renderSection({
      label: 'Display',
      collapsible: true,
      collapsed: false,
      fields: [
        { name: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
        { name: 'blendMode', label: 'Blend Mode', type: 'select', options: getBlendModeOptions() },
      ],
    }, values, handleChange);
    dynamicArea.appendChild(displaySection);
  };

  // Initial build
  rebuildDynamicContent();
  body.appendChild(dynamicArea);

  // Footer with action buttons (using widget system actions pattern)
  const footer = document.createElement('div');
  footer.className = 'sp-style-footer sp-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sp-style-btn sp-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    const panel = openPanels.get(layer.name);
    if (panel) panel.close();
  });

  const applyBtn = document.createElement('button');
  applyBtn.className = 'sp-style-btn sp-apply-btn sp-btn sp-btn-primary';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    applyRasterStyle(layer);
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(applyBtn);

  container.appendChild(body);
  container.appendChild(footer);

  return container;
}

/**
 * Apply raster style from panel values
 */
function applyRasterStyle(layer) {
  // Look up values from per-panel state
  const state = panelStates.get(layer.name);
  if (!state) {
    termPrint('No style panel state found', 'red');
    return;
  }
  const values = state.values;
  const mode = values.mode;

  // Apply mode and color ramp
  if (mode === 'singleband') {
    // Check if using expression or band source
    const useExpression = values.source === 'expression';

    if (useExpression) {
      // Apply expression with color ramp and stretch
      const expr = values.expression?.trim();
      if (expr) {
        const ramp = values.colorRamp || 'viridis';
        const stretchMin = values.min ?? -1;
        const stretchMax = values.max ?? 1;
        layer.r.expression(expr, { colorRamp: ramp, min: stretchMin, max: stretchMax });
        termPrint(`Expression applied to ${layer.name}`, 'green');
      } else {
        termPrint('No expression specified', 'yellow');
      }
    } else {
      // Clear any existing expression
      if (layer._customExpression) {
        layer.r.expression(null);
      }
      // Apply band settings
      layer.r.mode('singleband');
      layer.r.colorRamp(values.colorRamp);
      if (layer.bands > 1) {
        layer.r.band(parseInt(values.band));
      }
      // Apply stretch for band mode
      if (values.min !== undefined && values.max !== undefined) {
        layer.r.stretch(values.min, values.max);
      }
      termPrint(`Raster style applied to ${layer.name}`, 'green');
    }
  } else if (mode === 'grayscale') {
    // Clear any existing expression
    if (layer._customExpression) {
      layer.r.expression(null);
    }
    layer.r.mode('grayscale');
    if (layer.bands > 1) {
      layer.r.band(parseInt(values.band));
    }
    // Apply stretch
    if (values.min !== undefined && values.max !== undefined) {
      layer.r.stretch(values.min, values.max);
    }
    termPrint(`Raster style applied to ${layer.name}`, 'green');
  } else if (mode === 'rgb') {
    // Clear any existing expression
    if (layer._customExpression) {
      layer.r.expression(null);
    }
    layer.r.bands(
      parseInt(values.redBand),
      parseInt(values.greenBand),
      parseInt(values.blueBand)
    );
    // Apply stretch for RGB
    if (values.min !== undefined && values.max !== undefined) {
      layer.r.stretch(values.min, values.max);
    }
    termPrint(`Raster style applied to ${layer.name}`, 'green');
  }

  // Apply opacity
  if (values.opacity !== undefined) {
    layer.opacity(values.opacity);
  }

  // Apply blend mode
  if (values.blendMode && layer.blendMode) {
    layer.blendMode(values.blendMode);
  }
}

/**
 * Open raster style panel
 */
export function openRasterStylePanel(layer) {
  if (!layer) {
    termPrint('No layer specified', 'red');
    return null;
  }

  if (layer.type !== 'raster') {
    termPrint('This panel is for raster layers', 'yellow');
    return null;
  }

  injectStyles();

  // If panel for this layer already exists, focus it
  const existingPanel = openPanels.get(layer.name);
  if (existingPanel) {
    try {
      existingPanel.focus();
      return existingPanel;
    } catch (e) {
      // Panel was closed, remove from map
      openPanels.delete(layer.name);
    }
  }

  const content = buildRasterPanelContent(layer);

  // Offset position based on number of open panels
  const offset = openPanels.size * 30;

  const panel = new WinBox({
    title: `Style: ${layer.name}`,
    width: '400px',
    height: '450px',
    x: 'center',
    y: 'center',
    top: 0,
    left: 100 + offset,
    class: ['no-full'],
    mount: content,
    onclose: () => {
      openPanels.delete(layer.name);
      panelStates.delete(layer.name);
    },
  });

  openPanels.set(layer.name, panel);
  return panel;
}

// ═══════════════════════════════════════════════════════════════════════════
// COPY/PASTE STYLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Copy style from a layer to clipboard
 * @param {Layer} layer - The layer to copy style from
 */
export function copyStyle(layer) {
  if (!layer) {
    termPrint('No layer specified', 'red');
    return;
  }

  styleClipboard = {
    type: layer.type,
    styleOpts: layer._styleOpts ? { ...layer._styleOpts } : null,
    blendMode: layer._blendMode || 'source-over',
    opacity: layer.opacity?.() ?? 1,
  };

  // For rasters, also copy raster-specific settings
  if (layer.type === 'raster') {
    styleClipboard.raster = {
      mode: layer._mode,
      colorRamp: layer._colorRamp,
      selectedBand: layer._selectedBand,
      bandMapping: layer._bandMapping ? [...layer._bandMapping] : null,
      min: layer.minValue,
      max: layer.maxValue,
    };
  }

  termPrint(`Style copied from "${layer.name}"`, 'green');
}

/**
 * Paste style to a layer from clipboard
 * @param {Layer} layer - The layer to paste style to
 */
export function pasteStyle(layer) {
  if (!layer) {
    termPrint('No layer specified', 'red');
    return;
  }

  if (!styleClipboard) {
    termPrint('No style in clipboard. Copy a style first.', 'yellow');
    return;
  }

  // Check type compatibility
  if (layer.type !== styleClipboard.type) {
    termPrint(`Cannot paste ${styleClipboard.type} style to ${layer.type} layer`, 'yellow');
    return;
  }

  // Apply common settings
  if (styleClipboard.blendMode && layer.blendMode) {
    layer.blendMode(styleClipboard.blendMode);
  }
  if (styleClipboard.opacity !== undefined && layer.opacity) {
    layer.opacity(styleClipboard.opacity);
  }

  // Apply type-specific settings
  if (layer.type === 'vector' && styleClipboard.styleOpts) {
    applyStyle(layer, styleClipboard.styleOpts);
    layer._styleOpts = { ...styleClipboard.styleOpts };
  } else if (layer.type === 'raster' && styleClipboard.raster) {
    const r = styleClipboard.raster;
    if (r.mode && layer.r?.mode) layer.r.mode(r.mode);
    if (r.colorRamp && layer.r?.colorRamp) layer.r.colorRamp(r.colorRamp);
    if (r.selectedBand && layer.r?.band) layer.r.band(r.selectedBand);
    if (r.bandMapping && layer.r?.bands) layer.r.bands(...r.bandMapping);
    if (r.min !== undefined && r.max !== undefined && layer.r?.stretch) {
      layer.r.stretch(r.min, r.max);
    }
  }

  termPrint(`Style pasted to "${layer.name}"`, 'green');
}

/**
 * Check if clipboard has a style that can be pasted to a layer
 * @param {Layer} layer - The layer to check compatibility with
 * @returns {boolean} True if style can be pasted
 */
export function canPasteStyle(layer) {
  if (!styleClipboard || !layer) return false;
  return styleClipboard.type === layer.type;
}
