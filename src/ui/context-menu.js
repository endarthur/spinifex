// Spinifex - Context Menu & Style Modal
// UI components for layer management

import { state } from '../core/state.js';
import { termPrint } from './terminal.js';
import { colorScales, getUniqueValues, getFieldStats } from '../core/styling.js';
import { openLayerProperties } from './windows.js';

let currentContextMenu = null;
let currentModal = null;

/**
 * Show context menu at position
 */
export function showContextMenu(x, y, items) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      menu.appendChild(sep);
    } else {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      if (item.danger) menuItem.classList.add('danger');
      menuItem.textContent = item.label;
      menuItem.onclick = () => {
        hideContextMenu();
        item.action();
      };
      menu.appendChild(menuItem);
    }
  });

  document.body.appendChild(menu);
  currentContextMenu = menu;

  // Adjust position if menu goes off screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${y - rect.height}px`;
  }

  // Close on click outside or escape
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', handleEscape);
  }, 0);
}

/**
 * Hide context menu
 */
export function hideContextMenu() {
  if (currentContextMenu) {
    currentContextMenu.remove();
    currentContextMenu = null;
    document.removeEventListener('click', hideContextMenu);
    document.removeEventListener('keydown', handleEscape);
  }
}

function handleEscape(e) {
  if (e.key === 'Escape') {
    hideContextMenu();
    hideModal();
  }
}

/**
 * Show a modal dialog
 */
export function showModal(title, content, buttons = []) {
  hideModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.onclick = (e) => {
    if (e.target === backdrop) hideModal();
  };

  const modal = document.createElement('div');
  modal.className = 'modal';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = hideModal;

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }

  // Footer with buttons
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = 'btn' + (btn.primary ? ' btn-primary' : '');
    button.textContent = btn.label;
    button.onclick = () => {
      if (btn.action) btn.action();
      if (btn.close !== false) hideModal();
    };
    footer.appendChild(button);
  });

  modal.appendChild(header);
  modal.appendChild(body);
  if (buttons.length > 0) {
    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  currentModal = backdrop;

  // Close on escape
  document.addEventListener('keydown', handleEscape);

  return { backdrop, modal, body };
}

/**
 * Hide modal
 */
export function hideModal() {
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
  }
}

/**
 * Get current style from layer (extract from OL style)
 */
function getCurrentStyle(layer) {
  const defaults = {
    fill: '#4a9eff',
    stroke: '#000000',
    width: 1,
    opacity: 0.7,
    radius: 6,
    labelField: '',
    labelColor: '#ffffff',
    labelSize: 12,
    labelOutline: '#000000',
    labelOutlineWidth: 3
  };

  // Try to get from layer's stored style
  if (layer._styleOpts) {
    return { ...defaults, ...layer._styleOpts };
  }

  return defaults;
}

/**
 * Show style editor modal for a layer
 */
export function showStyleModal(layer) {
  const currentStyle = getCurrentStyle(layer);
  const isPoint = layer.geomType === 'Point' || layer.geomType === 'MultiPoint';
  const isLine = layer.geomType === 'LineString' || layer.geomType === 'MultiLineString';
  const isPolygon = layer.geomType === 'Polygon' || layer.geomType === 'MultiPolygon';

  const content = document.createElement('div');
  content.id = 'style-modal-content';

  // Style type selector
  const styleTypes = [
    { value: 'single', label: 'Single' },
    { value: 'categorical', label: 'Categorical' },
    { value: 'graduated', label: 'Graduated' }
  ];
  // Only show rules option for advanced users (via REPL for now)
  // styleTypes.push({ value: 'rules', label: 'Rule-based' });

  content.appendChild(createSelectRow('Style Type', 'styleType', styleTypes, currentStyle.type || 'single'));

  // Dynamic content area that changes based on style type
  const dynamicContent = document.createElement('div');
  dynamicContent.id = 'style-dynamic-content';
  content.appendChild(dynamicContent);

  // Common stroke/opacity section
  const commonSection = document.createElement('div');
  commonSection.id = 'style-common-section';
  content.appendChild(commonSection);

  // Label section
  const labelSection = document.createElement('div');
  labelSection.id = 'style-label-section';
  content.appendChild(labelSection);

  // Function to rebuild dynamic content based on style type
  const rebuildContent = (styleType) => {
    dynamicContent.innerHTML = '';
    commonSection.innerHTML = '';
    labelSection.innerHTML = '';

    if (styleType === 'single') {
      // Single style: fill color
      if (isPoint || isPolygon) {
        dynamicContent.appendChild(createColorRow('Fill', 'fill', currentStyle.fill || '#4a9eff'));
      }
    } else if (styleType === 'categorical') {
      // Categorical: field + palette
      if (layer.fields && layer.fields.length > 0) {
        dynamicContent.appendChild(createSelectRow('Field', 'catField',
          [{ value: '', label: '(select field)' }, ...layer.fields.map(f => ({ value: f, label: f }))],
          currentStyle.field || ''
        ));

        const paletteOptions = Object.keys(colorScales).map(p => ({ value: p, label: p }));
        dynamicContent.appendChild(createSelectRow('Palette', 'catPalette', paletteOptions, currentStyle.palette || 'default'));

        // Show preview of palette colors
        const previewRow = document.createElement('div');
        previewRow.className = 'style-row';
        previewRow.innerHTML = `<div class="style-label">Preview</div><div class="style-control" id="palette-preview"></div>`;
        dynamicContent.appendChild(previewRow);

        // Default color for unmatched
        dynamicContent.appendChild(createColorRow('Default', 'catDefault', currentStyle.default || '#888888'));
      } else {
        dynamicContent.innerHTML = '<div class="style-hint">No fields available for categorical styling</div>';
      }
    } else if (styleType === 'graduated') {
      // Graduated: field + ramp + min/max
      const numericFields = layer.fields ? layer.fields.filter(f => {
        const stats = getFieldStats(layer, f);
        return stats !== null;
      }) : [];

      if (numericFields.length > 0) {
        dynamicContent.appendChild(createSelectRow('Field', 'gradField',
          [{ value: '', label: '(select field)' }, ...numericFields.map(f => ({ value: f, label: f }))],
          currentStyle.field || ''
        ));

        const rampOptions = Object.keys(colorScales).map(r => ({ value: r, label: r }));
        dynamicContent.appendChild(createSelectRow('Color Ramp', 'gradRamp', rampOptions, currentStyle.ramp || 'viridis'));

        // Show preview of ramp colors
        const previewRow = document.createElement('div');
        previewRow.className = 'style-row';
        previewRow.innerHTML = `<div class="style-label">Preview</div><div class="style-control" id="ramp-preview"></div>`;
        dynamicContent.appendChild(previewRow);

        // Min/max values
        const stats = currentStyle.field ? getFieldStats(layer, currentStyle.field) : null;
        dynamicContent.appendChild(createNumberRow('Min', 'gradMin', currentStyle.min ?? stats?.min ?? 0, -999999, 999999, 0.1));
        dynamicContent.appendChild(createNumberRow('Max', 'gradMax', currentStyle.max ?? stats?.max ?? 100, -999999, 999999, 0.1));

        // Default color for non-numeric
        dynamicContent.appendChild(createColorRow('Default', 'gradDefault', currentStyle.default || '#888888'));
      } else {
        dynamicContent.innerHTML = '<div class="style-hint">No numeric fields available for graduated styling</div>';
      }
    }

    // Common section: stroke, width, opacity, radius
    const strokeHeader = document.createElement('div');
    strokeHeader.className = 'style-section-header';
    strokeHeader.textContent = 'Stroke & Opacity';
    commonSection.appendChild(strokeHeader);

    commonSection.appendChild(createColorRow('Stroke', 'stroke', currentStyle.stroke || '#000000'));
    commonSection.appendChild(createNumberRow('Stroke Width', 'width', currentStyle.width || 1, 0, 10, 0.5));
    commonSection.appendChild(createSliderRow('Opacity', 'opacity', currentStyle.opacity ?? 0.7, 0, 1, 0.05));

    if (isPoint) {
      commonSection.appendChild(createNumberRow('Radius', 'radius', currentStyle.radius || 6, 1, 50, 1));
    }

    // Label section
    if (layer.fields && layer.fields.length > 0) {
      const labelHeader = document.createElement('div');
      labelHeader.className = 'style-section-header';
      labelHeader.textContent = 'Labels';
      labelSection.appendChild(labelHeader);

      labelSection.appendChild(createSelectRow('Field', 'labelField',
        [{ value: '', label: '(none)' }, ...layer.fields.map(f => ({ value: f, label: f }))],
        currentStyle.labelField || ''
      ));

      labelSection.appendChild(createColorRow('Color', 'labelColor', currentStyle.labelColor || '#ffffff'));
      labelSection.appendChild(createColorRow('Outline', 'labelOutline', currentStyle.labelOutline || '#000000'));
      labelSection.appendChild(createNumberRow('Outline Width', 'labelOutlineWidth', currentStyle.labelOutlineWidth ?? 3, 0, 10, 0.5));
      labelSection.appendChild(createNumberRow('Size', 'labelSize', currentStyle.labelSize || 12, 8, 32, 1));
    }

    // Update palette/ramp previews and wire up change handlers
    setTimeout(() => {
      updatePreviews();

      // Wire up palette change for preview
      const paletteSelect = document.getElementById('style-catPalette');
      if (paletteSelect) {
        paletteSelect.addEventListener('change', updatePreviews);
      }

      // Wire up ramp change for preview
      const rampSelect = document.getElementById('style-gradRamp');
      if (rampSelect) {
        rampSelect.addEventListener('change', updatePreviews);
      }

      // Update min/max when graduated field changes
      const gradFieldSelect = document.getElementById('style-gradField');
      if (gradFieldSelect) {
        gradFieldSelect.addEventListener('change', () => {
          const field = gradFieldSelect.value;
          if (field) {
            const stats = getFieldStats(layer, field);
            if (stats) {
              const minInput = document.getElementById('style-gradMin');
              const maxInput = document.getElementById('style-gradMax');
              if (minInput) minInput.value = stats.min;
              if (maxInput) maxInput.value = stats.max;
            }
          }
        });
      }
    }, 0);
  };

  // Function to update color previews
  const updatePreviews = () => {
    const palettePreview = document.getElementById('palette-preview');
    if (palettePreview) {
      const paletteSelect = document.getElementById('style-catPalette');
      const paletteName = paletteSelect ? paletteSelect.value : 'default';
      const scaleVal = colorScales[paletteName] || colorScales.default;
      // Handle both array and chroma scale name
      let colors;
      if (Array.isArray(scaleVal)) {
        colors = scaleVal;
      } else {
        try {
          colors = [0, 0.25, 0.5, 0.75, 1].map(t => chroma.scale(scaleVal)(t).hex());
        } catch (e) {
          colors = colorScales.default;
        }
      }
      palettePreview.innerHTML = colors.slice(0, 8).map(c =>
        `<div class="color-swatch" style="background:${c}"></div>`
      ).join('');
    }

    const rampPreview = document.getElementById('ramp-preview');
    if (rampPreview) {
      const rampSelect = document.getElementById('style-gradRamp');
      const rampName = rampSelect ? rampSelect.value : 'viridis';
      const scaleVal = colorScales[rampName] || 'viridis';
      // Handle both array and chroma scale name
      let colors;
      if (Array.isArray(scaleVal)) {
        colors = scaleVal;
      } else {
        try {
          colors = [0, 0.25, 0.5, 0.75, 1].map(t => chroma.scale(scaleVal)(t).hex());
        } catch (e) {
          colors = ['#888', '#888'];
        }
      }
      rampPreview.innerHTML = `<div class="color-ramp" style="background: linear-gradient(to right, ${colors.join(', ')})"></div>`;
    }
  };

  // Initial build
  rebuildContent(currentStyle.type || 'single');

  const { body } = showModal(`Style: ${layer.name}`, content, [
    { label: 'Cancel' },
    {
      label: 'Apply',
      primary: true,
      action: () => applyStyleFromModal(layer, body)
    }
  ]);

  // Wire up style type change
  setTimeout(() => {
    const typeSelect = document.getElementById('style-styleType');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        rebuildContent(typeSelect.value);
      });
    }
  }, 0);
}

/**
 * Create a color picker row
 */
function createColorRow(label, id, value) {
  const row = document.createElement('div');
  row.className = 'style-row';
  row.innerHTML = `
    <div class="style-label">${label}</div>
    <div class="style-control">
      <input type="color" class="style-color-input" id="style-${id}" value="${value}">
      <input type="text" class="style-text-input" id="style-${id}-text" value="${value}">
    </div>
  `;

  // Sync color picker and text input
  setTimeout(() => {
    const colorInput = row.querySelector(`#style-${id}`);
    const textInput = row.querySelector(`#style-${id}-text`);

    colorInput.addEventListener('input', () => {
      textInput.value = colorInput.value;
    });

    textInput.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(textInput.value)) {
        colorInput.value = textInput.value;
      }
    });
  }, 0);

  return row;
}

/**
 * Create a number input row
 */
function createNumberRow(label, id, value, min, max, step) {
  const row = document.createElement('div');
  row.className = 'style-row';
  row.innerHTML = `
    <div class="style-label">${label}</div>
    <div class="style-control">
      <input type="number" class="style-text-input" id="style-${id}"
        value="${value}" min="${min}" max="${max}" step="${step}">
    </div>
  `;
  return row;
}

/**
 * Create a slider row
 */
function createSliderRow(label, id, value, min, max, step) {
  const row = document.createElement('div');
  row.className = 'style-row';
  row.innerHTML = `
    <div class="style-label">${label}</div>
    <div class="style-control">
      <input type="range" class="style-slider" id="style-${id}"
        value="${value}" min="${min}" max="${max}" step="${step}">
      <span class="style-value" id="style-${id}-value">${Math.round(value * 100)}%</span>
    </div>
  `;

  // Update value display
  setTimeout(() => {
    const slider = row.querySelector(`#style-${id}`);
    const valueDisplay = row.querySelector(`#style-${id}-value`);
    slider.addEventListener('input', () => {
      valueDisplay.textContent = `${Math.round(slider.value * 100)}%`;
    });
  }, 0);

  return row;
}

/**
 * Create a select dropdown row
 */
function createSelectRow(label, id, options, value) {
  const row = document.createElement('div');
  row.className = 'style-row';

  const optionsHtml = options.map(opt =>
    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  row.innerHTML = `
    <div class="style-label">${label}</div>
    <div class="style-control">
      <select class="style-select" id="style-${id}">${optionsHtml}</select>
    </div>
  `;
  return row;
}

/**
 * Apply style from modal inputs
 */
function applyStyleFromModal(layer, modalBody) {
  const getValue = (id) => {
    const el = modalBody.querySelector(`#style-${id}`);
    return el ? el.value : null;
  };

  const style = {};

  // Get style type
  const styleType = getValue('styleType') || 'single';
  style.type = styleType;

  if (styleType === 'single') {
    const fill = getValue('fill');
    if (fill) style.fill = fill;
  } else if (styleType === 'categorical') {
    const field = getValue('catField');
    if (field) style.field = field;

    const palette = getValue('catPalette');
    if (palette) style.palette = palette;

    const defaultColor = getValue('catDefault');
    if (defaultColor) style.default = defaultColor;
  } else if (styleType === 'graduated') {
    const field = getValue('gradField');
    if (field) style.field = field;

    const ramp = getValue('gradRamp');
    if (ramp) style.ramp = ramp;

    const min = getValue('gradMin');
    if (min !== null && min !== '') style.min = parseFloat(min);

    const max = getValue('gradMax');
    if (max !== null && max !== '') style.max = parseFloat(max);

    const defaultColor = getValue('gradDefault');
    if (defaultColor) style.default = defaultColor;
  }

  // Common options
  const stroke = getValue('stroke');
  if (stroke) style.stroke = stroke;

  const width = getValue('width');
  if (width) style.width = parseFloat(width);

  const opacity = getValue('opacity');
  if (opacity !== null) style.opacity = parseFloat(opacity);

  const radius = getValue('radius');
  if (radius) style.radius = parseFloat(radius);

  // Label options
  const labelField = getValue('labelField');
  style.labelField = labelField || '';  // Empty string to clear labels

  const labelColor = getValue('labelColor');
  if (labelColor) style.labelColor = labelColor;

  const labelOutline = getValue('labelOutline');
  if (labelOutline) style.labelOutline = labelOutline;

  const labelOutlineWidth = getValue('labelOutlineWidth');
  if (labelOutlineWidth !== null) style.labelOutlineWidth = parseFloat(labelOutlineWidth);

  const labelSize = getValue('labelSize');
  if (labelSize) style.labelSize = parseFloat(labelSize);

  // Apply style
  layer.style(style);

  // Store for later retrieval
  layer._styleOpts = { ...getCurrentStyle(layer), ...style };

  termPrint(`Style updated: ${layer.name}`, 'dim');
}

/**
 * Show layer context menu
 */
export function showLayerContextMenu(e, layer) {
  e.preventDefault();
  e.stopPropagation();

  const items = [
    { label: 'Zoom to', action: () => layer.zoom() },
    { label: 'Properties...', action: () => openLayerProperties(layer, 'info') },
    { label: 'Style...', action: () => openLayerProperties(layer, 'style') },
    { separator: true },
    { label: 'Download', action: () => downloadLayer(layer) },
    { separator: true },
    { label: 'Remove', danger: true, action: () => layer.remove() }
  ];

  showContextMenu(e.clientX, e.clientY, items);
}

/**
 * Download layer as GeoJSON
 */
function downloadLayer(layer) {
  if (!layer.geojson) {
    termPrint('Cannot download raster layers', 'yellow');
    return;
  }

  const data = JSON.stringify(layer.geojson, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${layer.name}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
  termPrint(`Downloaded: ${layer.name}.geojson`, 'green');
}
