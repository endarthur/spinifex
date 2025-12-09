// Spinifex - Layer Styling
// Style creation and application for OpenLayers layers
// Two style types: Rules (discrete) and Graduated (continuous)

import { state, geologyColors, defaultColors } from './state.js';
import { termPrint } from '../ui/terminal.js';

// Preset color scales (chroma.js compatible)
export const colorScales = {
  // Categorical/qualitative
  default: ['#4a9eff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3', '#a8d8ea', '#ffaaa5'],
  earth: ['#8b4513', '#d2691e', '#deb887', '#f4a460', '#d2b48c', '#bc8f8f', '#cd853f', '#a0522d', '#b8860b', '#daa520'],
  pastel: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec'],
  bold: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'],

  // Sequential (for graduated)
  viridis: 'viridis',
  plasma: 'plasma',
  inferno: 'inferno',
  magma: 'magma',
  blues: ['#f7fbff', '#6baed6', '#2171b5', '#08306b'],
  greens: ['#f7fcf5', '#74c476', '#238b45', '#00441b'],
  reds: ['#fff5f0', '#fb6a4a', '#cb181d', '#67000d'],
  oranges: ['#fff5eb', '#fd8d3c', '#d94701', '#7f2704'],
  purples: ['#fcfbfd', '#9e9ac8', '#6a51a3', '#3f007d'],

  // Diverging
  redBlue: ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'],
  redYellowGreen: ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'],
  spectral: 'Spectral',
  coolwarm: ['#3b4cc0', '#7092d0', '#aac7fd', '#dddddd', '#f6b69b', '#d6604d', '#b40426']
};

// Preset transformations for graduated styles
export const transformations = {
  linear: { label: 'Linear', fn: (v, min, max) => (v - min) / (max - min || 1) },
  log: { label: 'Logarithmic', fn: (v, min, max) => Math.log(v - min + 1) / Math.log(max - min + 1 || 1) },
  sqrt: { label: 'Square Root', fn: (v, min, max) => Math.sqrt((v - min) / (max - min || 1)) },
  square: { label: 'Square', fn: (v, min, max) => Math.pow((v - min) / (max - min || 1), 2) }
};

/**
 * Convert hex color to rgba string
 */
export function hexToRgba(hex, opacity) {
  if (!hex) return `rgba(128, 128, 128, ${opacity})`;
  if (hex.startsWith('rgb')) return hex;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get a chroma scale from preset name or color array
 */
function getChromaScale(scale) {
  if (typeof scale === 'string') {
    // Check if it's a preset name
    const preset = colorScales[scale];
    if (preset) {
      return typeof preset === 'string'
        ? chroma.scale(preset).mode('lab')
        : chroma.scale(preset).mode('lab');
    }
    // Try as chroma built-in
    try {
      return chroma.scale(scale).mode('lab');
    } catch (e) {
      return chroma.scale('viridis').mode('lab');
    }
  }
  if (Array.isArray(scale)) {
    return chroma.scale(scale).mode('lab');
  }
  return chroma.scale('viridis').mode('lab');
}

/**
 * Evaluate a label template or simple field name
 * Supports: "fieldName" or "${r.field1} - ${r.field2}"
 */
function evaluateLabel(labelField, properties) {
  if (!labelField) return null;

  // Check if it's a template (contains ${)
  if (labelField.includes('${')) {
    try {
      // Create a template function: r => `template`
      const fn = new Function('r', `return \`${labelField}\`;`);
      return fn(properties);
    } catch (e) {
      // Invalid template expression
      return null;
    }
  }

  // Simple field name
  const value = properties[labelField];
  return value !== null && value !== undefined ? value : null;
}

/**
 * Create text style for labels
 */
function createTextStyle(text, opts) {
  if (!text && text !== 0) return null;

  const labelColor = opts.labelColor || '#ffffff';
  const labelSize = opts.labelSize || 12;
  const labelOutline = opts.labelOutline || '#000000';
  const labelOutlineWidth = opts.labelOutlineWidth ?? 3;
  const labelAlign = opts.labelAlign || 'center';
  const labelBaseline = opts.labelBaseline || 'middle';
  const labelOffsetX = opts.labelOffsetX || 0;
  const labelOffsetY = opts.labelOffsetY || 0;
  const labelPlacement = opts.labelPlacement || 'point';

  return new ol.style.Text({
    text: String(text),
    font: `${labelSize}px 'IBM Plex Mono', monospace`,
    fill: new ol.style.Fill({ color: labelColor }),
    stroke: new ol.style.Stroke({ color: labelOutline, width: labelOutlineWidth }),
    textAlign: labelAlign,
    textBaseline: labelBaseline,
    offsetX: labelOffsetX,
    offsetY: labelOffsetY,
    placement: labelPlacement,
    overflow: true
  });
}

/**
 * Create an OpenLayers style object
 */
function createOLStyle(geomType, fillColor, stroke, width, radius, textStyle) {
  if (geomType && geomType.includes('Point')) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius,
        fill: new ol.style.Fill({ color: fillColor }),
        stroke: new ol.style.Stroke({ color: stroke, width })
      }),
      text: textStyle
    });
  } else {
    return new ol.style.Style({
      fill: new ol.style.Fill({ color: fillColor }),
      stroke: new ol.style.Stroke({ color: stroke, width }),
      text: textStyle
    });
  }
}

/**
 * Create default style based on geometry type
 */
export function createDefaultStyle(geomType, layerName) {
  // Special handling for geology layer (legacy)
  if (layerName === 'geology') {
    return (feature) => {
      const unit = feature.get('unit');
      const color = geologyColors[unit] || '#888888';
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: color + 'aa' }),
        stroke: new ol.style.Stroke({ color: '#000', width: 1 })
      });
    };
  }

  const colorIndex = state.layerCounter % defaultColors.length;
  const color = defaultColors[colorIndex];

  if (geomType && geomType.includes('Point')) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color }),
        stroke: new ol.style.Stroke({ color: '#000', width: 1 })
      })
    });
  }

  return new ol.style.Style({
    fill: new ol.style.Fill({ color: color + '88' }),
    stroke: new ol.style.Stroke({ color: '#000', width: 1 })
  });
}

/**
 * Apply rules-based style to layer
 * Each rule: { filter, fill, stroke, width, radius, opacity, label }
 * First matching rule wins
 */
function applyRulesStyle(layer, opts) {
  const geomType = layer.geomType || 'Polygon';
  const rules = opts.rules || [];
  const defaultStroke = opts.stroke || '#000000';
  const defaultOpacity = parseFloat(opts.opacity) ?? 0.7;
  const defaultRadius = parseFloat(opts.radius) || 6;
  const defaultWidth = parseFloat(opts.width) || 1;
  const labelField = opts.labelField || null;
  const defaultFill = opts.default || '#888888';

  // Compile filter expressions
  // Expressions use 'r' as namespace: r.field or r["field with spaces"]
  const compiledRules = rules.map(rule => {
    let filterFn;
    if (typeof rule.filter === 'function') {
      filterFn = rule.filter;
    } else if (typeof rule.filter === 'string' && rule.filter.trim()) {
      try {
        filterFn = new Function('r', `return ${rule.filter};`);
      } catch (e) {
        termPrint(`Invalid filter expression: ${rule.filter}`, 'yellow');
        filterFn = () => false;
      }
    } else {
      // No filter = default/catch-all rule
      filterFn = () => true;
    }
    return { ...rule, filterFn };
  });

  const styleFunction = (feature) => {
    let matchedRule = null;
    const r = feature.getProperties();

    for (const rule of compiledRules) {
      try {
        if (rule.filterFn(r)) {
          matchedRule = rule;
          break;
        }
      } catch (e) {
        // Filter error, skip
      }
    }

    const fill = matchedRule?.fill || defaultFill;
    const stroke = matchedRule?.stroke || defaultStroke;
    const width = matchedRule?.width ?? defaultWidth;
    const radius = matchedRule?.radius ?? defaultRadius;
    const opacity = matchedRule?.opacity ?? defaultOpacity;
    const fillColor = hexToRgba(fill, opacity);

    let textStyle = null;
    if (labelField) {
      const labelText = evaluateLabel(labelField, r);
      // Auto-offset for points if user hasn't set a custom offset
      const autoOffsetY = (geomType.includes('Point') && !opts.labelOffsetY && !opts.labelOffsetX)
        ? radius + 12 : 0;
      textStyle = createTextStyle(labelText, {
        ...opts,
        labelOffsetY: opts.labelOffsetY || autoOffsetY
      });
    }

    return createOLStyle(geomType, fillColor, stroke, width, radius, textStyle);
  };

  layer._olLayer.setStyle(styleFunction);
}

/**
 * Apply graduated (continuous) style to layer using chroma.js
 * Expression maps feature properties to 0-1 value
 */
function applyGraduatedStyle(layer, opts) {
  const geomType = layer.geomType || 'Polygon';
  const stroke = opts.stroke || '#000000';
  const opacity = parseFloat(opts.opacity) ?? 0.7;
  const radius = parseFloat(opts.radius) || 6;
  const width = parseFloat(opts.width) || 1;
  const labelField = opts.labelField || null;
  const defaultColor = opts.default || '#888888';
  const scale = opts.scale || 'viridis';

  // Get the chroma scale
  const chromaScale = getChromaScale(scale);

  // Build the value function
  // Expressions use 'r' as namespace: r.field or r["field with spaces"]
  let valueFn;

  if (typeof opts.expression === 'function') {
    // Direct function
    valueFn = opts.expression;
  } else if (typeof opts.expression === 'string' && opts.expression.trim()) {
    // Custom expression string
    try {
      valueFn = new Function('r', `return ${opts.expression};`);
    } catch (e) {
      termPrint(`Invalid expression: ${opts.expression}`, 'yellow');
      valueFn = () => 0.5;
    }
  } else if (opts.field) {
    // Simple field-based with transformation
    const field = opts.field;
    const transform = opts.transform || 'linear';
    const transformFn = transformations[transform]?.fn || transformations.linear.fn;

    // Auto-calculate min/max if not provided
    let minVal = opts.min;
    let maxVal = opts.max;

    if ((minVal === undefined || maxVal === undefined) && layer.geojson) {
      const values = layer.geojson.features
        .map(f => f.properties[field])
        .filter(v => typeof v === 'number' && isFinite(v));

      if (values.length > 0) {
        if (minVal === undefined) minVal = Math.min(...values);
        if (maxVal === undefined) maxVal = Math.max(...values);
      }
    }

    minVal = minVal ?? 0;
    maxVal = maxVal ?? 100;

    valueFn = (r) => {
      const v = r[field];
      if (typeof v !== 'number' || !isFinite(v)) return null;
      return Math.max(0, Math.min(1, transformFn(v, minVal, maxVal)));
    };
  } else {
    valueFn = () => 0.5;
  }

  const styleFunction = (feature) => {
    const r = feature.getProperties();
    let fillColor;

    try {
      const normalized = valueFn(r);
      if (normalized !== null && normalized !== undefined && isFinite(normalized)) {
        const color = chromaScale(Math.max(0, Math.min(1, normalized))).hex();
        fillColor = hexToRgba(color, opacity);
      } else {
        fillColor = hexToRgba(defaultColor, opacity);
      }
    } catch (e) {
      fillColor = hexToRgba(defaultColor, opacity);
    }

    let textStyle = null;
    if (labelField) {
      const labelText = evaluateLabel(labelField, r);
      // Auto-offset for points if user hasn't set a custom offset
      const autoOffsetY = (geomType.includes('Point') && !opts.labelOffsetY && !opts.labelOffsetX)
        ? radius + 12 : 0;
      textStyle = createTextStyle(labelText, {
        ...opts,
        labelOffsetY: opts.labelOffsetY || autoOffsetY
      });
    }

    return createOLStyle(geomType, fillColor, stroke, width, radius, textStyle);
  };

  layer._olLayer.setStyle(styleFunction);
}

/**
 * Generate rules from unique field values
 * Helper for UI to populate rules table
 */
export function generateRulesFromField(layer, field, scale = 'default') {
  if (layer.type !== 'vector' || !field) return [];

  const uniqueValues = [...new Set(
    layer.geojson.features
      .map(f => f.properties[field])
      .filter(v => v !== null && v !== undefined)
  )];

  // Get colors from scale
  const scaleColors = colorScales[scale] || colorScales.default;
  const chromaScaleObj = Array.isArray(scaleColors)
    ? null
    : chroma.scale(scaleColors).mode('lab');

  return uniqueValues.map((value, i) => {
    let color;
    if (chromaScaleObj) {
      color = chromaScaleObj(i / Math.max(1, uniqueValues.length - 1)).hex();
    } else {
      color = scaleColors[i % scaleColors.length];
    }

    // Create filter expression using r["field"] syntax for safety
    const fieldAccess = `r["${field.replace(/"/g, '\\"')}"]`;
    const filter = typeof value === 'string'
      ? `${fieldAccess} == '${value.replace(/'/g, "\\'")}'`
      : `${fieldAccess} == ${value}`;

    return {
      filter,
      fill: color,
      label: String(value),
      _value: value,
      _count: layer.geojson.features.filter(f => f.properties[field] === value).length
    };
  });
}

/**
 * Apply style to a layer - main entry point
 * Types: 'rules' (discrete) or 'graduated' (continuous)
 */
export function applyStyle(layer, opts) {
  const styleType = opts.type || 'rules';

  // Handle legacy style types for backwards compatibility
  if (opts.type === 'single') {
    // Single = rules with one default rule
    applyRulesStyle(layer, {
      ...opts,
      rules: [{ fill: opts.fill || '#4a9eff' }]
    });
  } else if (opts.type === 'categorical') {
    // Categorical = auto-generate rules from field
    const rules = generateRulesFromField(layer, opts.field, opts.palette || 'default');
    applyRulesStyle(layer, { ...opts, rules });
  } else if (styleType === 'graduated') {
    applyGraduatedStyle(layer, opts);
  } else {
    // Default to rules
    applyRulesStyle(layer, opts);
  }
}

/**
 * Get unique values for a field
 */
export function getUniqueValues(layer, field, limit = 50) {
  if (layer.type !== 'vector' || !field) return [];
  const values = [...new Set(layer.geojson.features.map(f => f.properties[field]))];
  return values.filter(v => v !== null && v !== undefined).slice(0, limit);
}

/**
 * Get field statistics
 */
export function getFieldStats(layer, field) {
  if (layer.type !== 'vector' || !field) return null;
  const values = layer.geojson.features
    .map(f => f.properties[field])
    .filter(v => typeof v === 'number' && isFinite(v));

  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const sorted = [...values].sort((a, b) => a - b);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    count: values.length
  };
}

/**
 * Get list of available color scales
 */
export function getColorScaleNames() {
  return Object.keys(colorScales);
}

/**
 * Get list of available transformations
 */
export function getTransformationNames() {
  return Object.entries(transformations).map(([key, val]) => ({
    value: key,
    label: val.label
  }));
}
