// Spinifex - Legend Window
// Shows layer styling legend with color ramps and categories

import { getLayersSortedByZIndex } from '../../core/state.js';
import { generateRulesFromField, getFieldStats, colorScales } from '../../core/styling.js';

// Window instance
let legendWindow = null;

// Default dimensions
const defaults = {
  width: 220,
  height: 300
};

/**
 * Get the legend window (for external access)
 */
export function getLegendWindow() {
  return legendWindow;
}

/**
 * Set the legend window reference (used when creating from main windows.js)
 */
export function setLegendWindow(win) {
  legendWindow = win;
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
    width: defaults.width,
    height: defaults.height,
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
    } else if (opts.type === 'categorical') {
      // Categorical: generate rules from field and show as legend items
      html += renderCategoricalLegend(layer, opts);
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
 * Render legend for categorical style
 */
function renderCategoricalLegend(layer, opts) {
  // Generate the rules from field and palette (same as styling does)
  const rules = generateRulesFromField(layer, opts.field, opts.palette || 'default');

  if (!rules || rules.length === 0) {
    return '<div class="legend-empty">No categories</div>';
  }

  let html = '<div class="legend-items">';

  rules.forEach(rule => {
    const label = rule.label || 'Unknown';
    const color = rule.fill || '#888888';
    html += `
      <div class="legend-item">
        <span class="legend-swatch" style="background: ${color}"></span>
        <span class="legend-label">${label}</span>
      </div>
    `;
  });

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
