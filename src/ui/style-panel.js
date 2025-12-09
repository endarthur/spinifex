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

let currentPanel = null;
let currentLayer = null;
let currentValues = {};

/**
 * Inject styles for the style panel
 */
function injectStyles() {
  if (document.getElementById('sp-style-panel-styles')) return;

  const style = document.createElement('style');
  style.id = 'sp-style-panel-styles';
  style.textContent = `
    .sp-style-panel {
      font-family: var(--sp-font, system-ui, sans-serif);
      font-size: 13px;
      color: var(--sp-text, #e0e0e0);
      background: var(--sp-bg, #1e1e1e);
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

  // Initialize values from current style
  const existingStyle = layer._styleOpts || {};
  currentValues = {
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
  };

  const container = document.createElement('div');
  container.className = 'sp-style-panel';

  const body = document.createElement('div');
  body.className = 'sp-style-panel-body';

  // Handler for value changes
  const handleChange = (param, value) => {
    currentValues[param] = value;

    // Rebuild dynamic sections when style type changes
    if (param === 'styleType') {
      rebuildDynamicContent();
    }

    // Update field stats when graduated field changes
    if (param === 'field' && currentValues.styleType === 'graduated' && value) {
      const stats = getFieldStats(layer, value);
      if (stats) {
        currentValues.min = stats.min;
        currentValues.max = stats.max;
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

    const styleType = currentValues.styleType;

    // === Style Type Section ===
    const { section: typeSection, content: typeContent } = createSection('Style Type');
    typeContent.appendChild(createSelectRow('Type', 'styleType', [
      { value: 'single', label: 'Single Symbol' },
      { value: 'categorical', label: 'Categorized' },
      { value: 'graduated', label: 'Graduated' },
    ], styleType, handleChange));
    dynamicArea.appendChild(typeSection);

    // === Type-specific content ===
    if (styleType === 'single') {
      const { section: fillSection, content: fillContent } = createSection('Fill');
      if (!isLine) {
        fillContent.appendChild(createColorRow('Fill Color', 'fill', currentValues.fill, handleChange));
      }
      dynamicArea.appendChild(fillSection);

    } else if (styleType === 'categorical') {
      const { section: catSection, content: catContent } = createSection('Categorize By');

      if (hasFields) {
        catContent.appendChild(createSelectRow('Field', 'field', getFieldOptions(layer), currentValues.field, handleChange));
        catContent.appendChild(createSelectRow('Palette', 'palette', getScaleOptions(), currentValues.palette, handleChange));

        const previewContainer = document.createElement('div');
        previewContainer.id = 'palette-preview-container';
        previewContainer.appendChild(createPalettePreview(currentValues.palette));
        catContent.appendChild(previewContainer);

        catContent.appendChild(createColorRow('Default Color', 'default', currentValues.default, handleChange));
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
        gradContent.appendChild(createSelectRow('Field', 'field', numericOptions, currentValues.field, handleChange));
        gradContent.appendChild(createSelectRow('Color Ramp', 'scale', getScaleOptions(), currentValues.scale, handleChange));

        const previewContainer = document.createElement('div');
        previewContainer.id = 'ramp-preview-container';
        previewContainer.appendChild(createRampPreview(currentValues.scale));
        gradContent.appendChild(previewContainer);

        // Auto-populate min/max from field stats
        if (currentValues.field) {
          const stats = getFieldStats(layer, currentValues.field);
          if (stats) {
            if (currentValues.min === undefined) currentValues.min = stats.min;
            if (currentValues.max === undefined) currentValues.max = stats.max;
          }
        }

        gradContent.appendChild(createNumberRow('Min', 'min', currentValues.min ?? 0, -999999, 999999, 0.1, handleChange));
        gradContent.appendChild(createNumberRow('Max', 'max', currentValues.max ?? 100, -999999, 999999, 0.1, handleChange));
        gradContent.appendChild(createColorRow('Default Color', 'default', currentValues.default, handleChange));
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
    strokeContent.appendChild(createColorRow('Stroke Color', 'stroke', currentValues.stroke, handleChange));
    strokeContent.appendChild(createNumberRow('Width', 'width', currentValues.width, 0, 10, 0.5, handleChange));

    if (isPoint) {
      strokeContent.appendChild(createNumberRow('Radius', 'radius', currentValues.radius, 1, 50, 1, handleChange));
    }
    dynamicArea.appendChild(strokeSection);

    // === Display Section ===
    const { section: displaySection, content: displayContent } = createSection('Display');
    displayContent.appendChild(createSliderRow('Opacity', 'opacity', currentValues.opacity, 0, 1, 0.05, handleChange));
    displayContent.appendChild(createSelectRow('Blend Mode', 'blendMode', getBlendModeOptions(), currentValues.blendMode, handleChange));
    dynamicArea.appendChild(displaySection);

    // === Labels Section ===
    if (hasFields) {
      const { section: labelSection, content: labelContent } = createSection('Labels', true);
      labelContent.appendChild(createSelectRow('Label Field', 'labelField', [
        { value: '', label: '(none)' },
        ...layer.fields.map(f => ({ value: f, label: f }))
      ], currentValues.labelField, handleChange));
      labelContent.appendChild(createColorRow('Color', 'labelColor', currentValues.labelColor, handleChange));
      labelContent.appendChild(createNumberRow('Size', 'labelSize', currentValues.labelSize, 8, 32, 1, handleChange));
      labelContent.appendChild(createColorRow('Outline', 'labelOutline', currentValues.labelOutline, handleChange));
      labelContent.appendChild(createNumberRow('Outline Width', 'labelOutlineWidth', currentValues.labelOutlineWidth, 0, 10, 0.5, handleChange));
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
    currentPanel?.close();
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
  const styleType = currentValues.styleType;

  const styleOpts = {
    type: styleType,
    stroke: currentValues.stroke,
    width: currentValues.width,
    opacity: currentValues.opacity,
    radius: currentValues.radius,
    labelField: currentValues.labelField || undefined,
    labelColor: currentValues.labelColor,
    labelSize: currentValues.labelSize,
    labelOutline: currentValues.labelOutline,
    labelOutlineWidth: currentValues.labelOutlineWidth,
    default: currentValues.default,
  };

  if (styleType === 'single') {
    styleOpts.fill = currentValues.fill;
  } else if (styleType === 'categorical') {
    styleOpts.field = currentValues.field;
    styleOpts.palette = currentValues.palette;
  } else if (styleType === 'graduated') {
    styleOpts.field = currentValues.field;
    styleOpts.scale = currentValues.scale;
    styleOpts.min = currentValues.min;
    styleOpts.max = currentValues.max;
  }

  // Apply style
  applyStyle(layer, styleOpts);

  // Apply blend mode separately (not part of vector styling)
  if (currentValues.blendMode && layer.blendMode) {
    layer.blendMode(currentValues.blendMode);
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

  // Close existing panel
  if (currentPanel) {
    try {
      currentPanel.close();
    } catch (e) {
      // Panel already closed
    }
  }

  currentLayer = layer;
  const content = buildPanelContent(layer);

  currentPanel = new WinBox({
    title: `Style: ${layer.name}`,
    width: '320px',
    height: '500px',
    x: 'center',
    y: 'center',
    class: ['no-full'],
    mount: content,
    onclose: () => {
      currentPanel = null;
      currentLayer = null;
      currentValues = {};
    },
  });

  return currentPanel;
}

/**
 * Get current panel state
 */
export function getStylePanelState() {
  return {
    isOpen: currentPanel !== null,
    layer: currentLayer?.name || null,
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
 * Build raster style panel content
 */
function buildRasterPanelContent(layer) {
  // Initialize values from current layer state
  currentValues = {
    mode: layer._mode || 'singleband',
    colorRamp: layer._colorRamp || 'terrain',
    band: layer._selectedBand || 1,
    redBand: layer._bandMapping?.[0] || 1,
    greenBand: layer._bandMapping?.[1] || 2,
    blueBand: layer._bandMapping?.[2] || 3,
    min: layer.minValue,
    max: layer.maxValue,
    opacity: layer.opacity?.() || 1,
    blendMode: layer._blendMode || 'source-over',
  };

  const container = document.createElement('div');
  container.className = 'sp-style-panel';

  const body = document.createElement('div');
  body.className = 'sp-style-panel-body';

  // Handler for value changes
  const handleChange = (param, value) => {
    currentValues[param] = value;

    // Rebuild content when mode changes
    if (param === 'mode') {
      rebuildDynamicContent();
    }

    // Update ramp preview
    if (param === 'colorRamp') {
      const previewContainer = container.querySelector('#raster-ramp-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.appendChild(createRasterRampPreview(value));
      }
    }
  };

  // Dynamic content area
  const dynamicArea = document.createElement('div');
  dynamicArea.id = 'raster-dynamic-area';

  const rebuildDynamicContent = () => {
    dynamicArea.innerHTML = '';
    const mode = currentValues.mode;
    const bandCount = layer.bands || 1;

    // === Render Mode Section ===
    const { section: modeSection, content: modeContent } = createSection('Render Mode');
    modeContent.appendChild(createSelectRow('Mode', 'mode', [
      { value: 'singleband', label: 'Single Band' },
      { value: 'rgb', label: 'RGB Composite' },
      { value: 'grayscale', label: 'Grayscale' },
    ], mode, handleChange));
    dynamicArea.appendChild(modeSection);

    // === Mode-specific content ===
    if (mode === 'singleband' || mode === 'grayscale') {
      const { section: bandSection, content: bandContent } = createSection('Band Selection');

      if (bandCount > 1) {
        bandContent.appendChild(createSelectRow('Display Band', 'band', getBandOptions(layer), currentValues.band, handleChange));
      }

      if (mode === 'singleband') {
        const previewContainer = document.createElement('div');
        previewContainer.id = 'raster-ramp-preview-container';
        previewContainer.appendChild(createRasterRampPreview(currentValues.colorRamp));

        // Use custom ramp row with "+ New" button
        bandContent.appendChild(createRampSelectRow('Color Ramp', 'colorRamp', getRampOptions(), currentValues.colorRamp, handleChange, (newRampName) => {
          // Update preview when new ramp is created
          previewContainer.innerHTML = '';
          previewContainer.appendChild(createRasterRampPreview(newRampName));
        }));

        bandContent.appendChild(previewContainer);
      }

      dynamicArea.appendChild(bandSection);

    } else if (mode === 'rgb') {
      const { section: rgbSection, content: rgbContent } = createSection('Band Mapping');

      if (bandCount >= 3) {
        rgbContent.appendChild(createSelectRow('Red Band', 'redBand', getBandOptions(layer), currentValues.redBand, handleChange));
        rgbContent.appendChild(createSelectRow('Green Band', 'greenBand', getBandOptions(layer), currentValues.greenBand, handleChange));
        rgbContent.appendChild(createSelectRow('Blue Band', 'blueBand', getBandOptions(layer), currentValues.blueBand, handleChange));
      } else {
        const hint = document.createElement('div');
        hint.className = 'sp-style-hint';
        hint.textContent = `RGB mode requires 3+ bands. This raster has ${bandCount} band(s).`;
        rgbContent.appendChild(hint);
      }

      dynamicArea.appendChild(rgbSection);
    }

    // === Value Stretch Section ===
    const { section: stretchSection, content: stretchContent } = createSection('Value Stretch');
    stretchContent.appendChild(createNumberRow('Min', 'min', currentValues.min, -999999, 999999, 1, handleChange));
    stretchContent.appendChild(createNumberRow('Max', 'max', currentValues.max, -999999, 999999, 1, handleChange));
    dynamicArea.appendChild(stretchSection);

    // === Display Section ===
    const { section: displaySection, content: displayContent } = createSection('Display', true);
    displayContent.appendChild(createSliderRow('Opacity', 'opacity', currentValues.opacity, 0, 1, 0.05, handleChange));
    displayContent.appendChild(createSelectRow('Blend Mode', 'blendMode', getBlendModeOptions(), currentValues.blendMode, handleChange));
    dynamicArea.appendChild(displaySection);
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
    currentPanel?.close();
  });

  const applyBtn = document.createElement('button');
  applyBtn.className = 'sp-style-btn sp-apply-btn';
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
  const mode = currentValues.mode;

  // Apply mode and color ramp
  if (mode === 'singleband') {
    layer.r.mode('singleband');
    layer.r.colorRamp(currentValues.colorRamp);
    if (layer.bands > 1) {
      layer.r.band(parseInt(currentValues.band));
    }
  } else if (mode === 'grayscale') {
    layer.r.mode('grayscale');
    if (layer.bands > 1) {
      layer.r.band(parseInt(currentValues.band));
    }
  } else if (mode === 'rgb') {
    layer.r.bands(
      parseInt(currentValues.redBand),
      parseInt(currentValues.greenBand),
      parseInt(currentValues.blueBand)
    );
  }

  // Apply stretch
  if (currentValues.min !== undefined && currentValues.max !== undefined) {
    layer.r.stretch(currentValues.min, currentValues.max);
  }

  // Apply opacity
  if (currentValues.opacity !== undefined) {
    layer.opacity(currentValues.opacity);
  }

  // Apply blend mode
  if (currentValues.blendMode && layer.blendMode) {
    layer.blendMode(currentValues.blendMode);
  }

  termPrint(`Raster style applied to ${layer.name}`, 'green');
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

  // Close existing panel
  if (currentPanel) {
    try {
      currentPanel.close();
    } catch (e) {
      // Panel already closed
    }
  }

  currentLayer = layer;
  const content = buildRasterPanelContent(layer);

  currentPanel = new WinBox({
    title: `Style: ${layer.name}`,
    width: '320px',
    height: '450px',
    x: 'center',
    y: 'center',
    class: ['no-full'],
    mount: content,
    onclose: () => {
      currentPanel = null;
      currentLayer = null;
      currentValues = {};
    },
  });

  return currentPanel;
}
