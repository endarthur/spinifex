// Spinifex - Widget Registry
// Schema-driven UI widgets for tool parameter forms

import { state } from './state.js';

/**
 * Widget registry storage
 */
const widgetTypes = new Map();

/**
 * Create a wrapper element for a widget with label
 * @param {Object} param - Parameter definition
 * @param {HTMLElement} inputEl - The input element
 * @returns {HTMLElement}
 */
function createWrapper(param, inputEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sp-widget';
  if (param.required) {
    wrapper.classList.add('required');
  }

  // Label
  const label = document.createElement('label');
  label.textContent = param.label || param.name;
  if (param.required) {
    label.innerHTML += ' <span class="required-mark">*</span>';
  }
  wrapper.appendChild(label);

  // Input
  wrapper.appendChild(inputEl);

  // Description
  if (param.description) {
    const desc = document.createElement('div');
    desc.className = 'sp-widget-desc';
    desc.textContent = param.description;
    wrapper.appendChild(desc);
  }

  return wrapper;
}

/**
 * The widgets object - public API
 */
export const widgets = {
  /**
   * Register a widget type
   * @param {Object} widget - Widget definition
   */
  register(widget) {
    if (!widget.type) {
      throw new Error('Widget must have a type');
    }
    if (!widget.render || typeof widget.render !== 'function') {
      throw new Error('Widget must have a render function');
    }
    if (widgetTypes.has(widget.type)) {
      throw new Error(`Widget type '${widget.type}' is already registered`);
    }

    widgetTypes.set(widget.type, widget);
    return this;
  },

  /**
   * Get a widget by type
   * @param {string} type - Widget type
   * @returns {Object|undefined}
   */
  get(type) {
    return widgetTypes.get(type);
  },

  /**
   * List all registered widgets
   * @returns {Array}
   */
  list() {
    return Array.from(widgetTypes.values());
  },

  /**
   * Render a widget for a parameter
   * @param {Object} param - Parameter definition
   * @param {*} value - Current value (or values object for layout widgets)
   * @param {Function} onChange - Callback when value changes
   * @param {Object} [allValues] - Full values object (used by conditional/layout widgets)
   * @returns {HTMLElement}
   */
  render(param, value, onChange, allValues) {
    const widget = widgetTypes.get(param.type) || widgetTypes.get('string');
    if (!widget) {
      // Ultimate fallback
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value || '';
      input.addEventListener('input', (e) => onChange(e.target.value));
      return createWrapper(param, input);
    }

    // For layout widgets, pass the full values object instead of individual value
    const valueToPass = widget.isLayout ? (allValues || value) : value;
    const inputEl = widget.render(param, valueToPass, onChange);

    // Layout widgets don't get wrapped with label
    if (widget.isLayout || param.noWrapper) {
      return inputEl;
    }

    return createWrapper(param, inputEl);
  },

  /**
   * Render a collapsible section
   * @param {Object} section - Section definition
   * @param {Object} values - Current parameter values
   * @param {Function} onChange - Callback when any value changes
   * @returns {HTMLElement}
   */
  renderSection(section, values, onChange) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'sp-form-section';
    if (section.collapsible) {
      sectionEl.classList.add('collapsible');
    }
    if (section.collapsed) {
      sectionEl.classList.add('collapsed');
    }

    // Section header
    const header = document.createElement('div');
    header.className = 'sp-section-header';

    const title = document.createElement('span');
    title.className = 'sp-section-title';
    title.textContent = section.label || section.name;

    const toggle = document.createElement('span');
    toggle.className = 'sp-section-toggle';
    toggle.innerHTML = section.collapsed ? '&#9654;' : '&#9660;'; // ▶ or ▼

    header.appendChild(toggle);
    header.appendChild(title);

    // Toggle on click
    if (section.collapsible) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        sectionEl.classList.toggle('collapsed');
        toggle.innerHTML = sectionEl.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
      });
    }

    sectionEl.appendChild(header);

    // Section content
    const content = document.createElement('div');
    content.className = 'sp-section-content';

    for (const param of (section.fields || [])) {
      const currentValue = values[param.name] ?? param.default ?? '';
      const widgetEl = this.render(param, currentValue, (newValue) => {
        values[param.name] = newValue;
        onChange(values);
      });
      content.appendChild(widgetEl);
    }

    sectionEl.appendChild(content);
    return sectionEl;
  },

  /**
   * Render a complete form for a tool's parameters
   * @param {Object} tool - Tool definition
   * @param {Object} values - Current parameter values
   * @param {Function} onChange - Callback when any value changes
   * @returns {HTMLElement}
   */
  renderToolForm(tool, values, onChange) {
    const form = document.createElement('div');
    form.className = 'sp-tool-form';

    // Collect parameters: main parameters and advanced parameters
    const mainParams = [];
    const advancedParams = [];

    for (const param of (tool.parameters || [])) {
      if (param.advanced) {
        advancedParams.push(param);
      } else {
        mainParams.push(param);
      }
    }

    // Render main parameters
    for (const param of mainParams) {
      const currentValue = values[param.name] ?? param.default ?? '';

      const widgetEl = this.render(param, currentValue, (newValue) => {
        values[param.name] = newValue;
        onChange(values);
      });

      form.appendChild(widgetEl);
    }

    // Render explicit sections from tool definition
    for (const section of (tool.sections || [])) {
      const sectionEl = this.renderSection(section, values, onChange);
      form.appendChild(sectionEl);
    }

    // Auto-create Advanced section for parameters with advanced: true
    if (advancedParams.length > 0) {
      const advancedSection = this.renderSection({
        name: 'advanced',
        label: 'Advanced Options',
        collapsible: true,
        collapsed: true,
        fields: advancedParams,
      }, values, onChange);
      form.appendChild(advancedSection);
    }

    return form;
  },

  /**
   * Get widget count
   * @returns {number}
   */
  get count() {
    return widgetTypes.size;
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Built-in Widgets
// ═══════════════════════════════════════════════════════════════════════════

// String widget
widgets.register({
  type: 'string',
  label: 'Text Input',
  render(param, value, onChange) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = param.placeholder || '';
    if (param.pattern) {
      input.pattern = param.pattern.source || param.pattern;
    }
    input.addEventListener('input', (e) => onChange(e.target.value));
    return input;
  },
});

// Number widget
widgets.register({
  type: 'number',
  label: 'Number Input',
  render(param, value, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value ?? '';
    if (param.min !== undefined) input.min = param.min;
    if (param.max !== undefined) input.max = param.max;
    if (param.step !== undefined) input.step = param.step;
    input.addEventListener('input', (e) => {
      const val = e.target.value === '' ? null : parseFloat(e.target.value);
      onChange(val);
    });
    return input;
  },
});

// Integer widget
widgets.register({
  type: 'integer',
  label: 'Integer Input',
  render(param, value, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value ?? '';
    input.step = '1';
    if (param.min !== undefined) input.min = param.min;
    if (param.max !== undefined) input.max = param.max;
    input.addEventListener('input', (e) => {
      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
      onChange(val);
    });
    return input;
  },
});

// Select widget
widgets.register({
  type: 'select',
  label: 'Dropdown',
  render(param, value, onChange) {
    const select = document.createElement('select');
    select.className = 'sp-select';

    for (const opt of (param.options || [])) {
      const option = document.createElement('option');
      if (typeof opt === 'object') {
        option.value = opt.value;
        option.textContent = opt.label || opt.value;
      } else {
        option.value = opt;
        option.textContent = opt;
      }
      if (option.value === value) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', (e) => onChange(e.target.value));
    return select;
  },
});

// Boolean widget (checkbox)
widgets.register({
  type: 'boolean',
  label: 'Checkbox',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-checkbox-wrapper';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!value;
    input.addEventListener('change', (e) => onChange(e.target.checked));

    const label = document.createElement('span');
    label.textContent = param.checkboxLabel || '';

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    return wrapper;
  },
});

// Layer widget (dropdown of available layers)
widgets.register({
  type: 'layer',
  label: 'Layer Selector',
  render(param, value, onChange) {
    const select = document.createElement('select');

    // Add empty option
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Select Layer --';
    select.appendChild(emptyOpt);

    // Get layers from ly namespace
    const ly = window.ly || {};
    for (const [name, layer] of Object.entries(ly)) {
      // Filter by layer type if specified
      if (param.layerType && layer.type !== param.layerType) {
        continue;
      }
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === value) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', (e) => {
      const layerName = e.target.value;
      const layer = ly[layerName] || null;
      onChange(layer);
    });

    return select;
  },
});

// Field widget (dropdown of fields from a layer)
widgets.register({
  type: 'field',
  label: 'Field Selector',
  render(param, value, onChange) {
    const select = document.createElement('select');

    // Add empty option
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Select Field --';
    select.appendChild(emptyOpt);

    // Get layer from param.layer
    const ly = window.ly || {};
    const layer = ly[param.layer];

    if (layer && layer.fields) {
      for (const field of layer.fields) {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        if (field === value) {
          option.selected = true;
        }
        select.appendChild(option);
      }
    }

    select.addEventListener('change', (e) => onChange(e.target.value));
    return select;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Layout Widgets
// ═══════════════════════════════════════════════════════════════════════════

// Row widget - horizontal layout container
widgets.register({
  type: 'row',
  label: 'Row Layout',
  isLayout: true,
  render(param, values, onChange) {
    const row = document.createElement('div');
    row.className = 'sp-row';
    if (param.gap) row.style.gap = param.gap;
    if (param.align) row.style.alignItems = param.align;

    // Render child widgets
    for (const child of (param.children || [])) {
      const childValue = values?.[child.name] ?? child.default ?? '';
      const childEl = widgets.render(child, childValue, (newValue, childName) => {
        if (values && child.name) {
          values[child.name] = newValue;
        }
        onChange(newValue, childName || child.name);
      }, values);

      // Apply flex sizing if specified
      if (child.flex) childEl.style.flex = child.flex;
      if (child.width) childEl.style.width = child.width;

      row.appendChild(childEl);
    }

    return row;
  },
});

// Column widget - vertical layout container
widgets.register({
  type: 'column',
  label: 'Column Layout',
  isLayout: true,
  render(param, values, onChange) {
    const col = document.createElement('div');
    col.className = 'sp-column';
    if (param.gap) col.style.gap = param.gap;

    for (const child of (param.children || [])) {
      const childValue = values?.[child.name] ?? child.default ?? '';
      const childEl = widgets.render(child, childValue, (newValue, childName) => {
        if (values && child.name) {
          values[child.name] = newValue;
        }
        onChange(newValue, childName || child.name);
      }, values);
      col.appendChild(childEl);
    }

    return col;
  },
});

// Form row widget - label + controls in a row (common form pattern)
widgets.register({
  type: 'formRow',
  label: 'Form Row',
  isLayout: true,
  render(param, values, onChange) {
    const row = document.createElement('div');
    row.className = 'sp-form-row';
    if (param.gap) row.style.gap = param.gap;

    // Label on the left
    if (param.label) {
      const label = document.createElement('label');
      label.className = 'sp-form-row-label';
      label.textContent = param.label;
      if (param.labelWidth) label.style.width = param.labelWidth;
      row.appendChild(label);
    }

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'sp-form-row-controls';

    for (const child of (param.children || [])) {
      const childValue = values?.[child.name] ?? child.default ?? '';
      const childEl = widgets.render(child, childValue, (newValue, childName) => {
        if (values && child.name) {
          values[child.name] = newValue;
        }
        onChange(newValue, childName || child.name);
      }, values);

      // Apply flex sizing if specified
      if (child.flex) childEl.style.flex = child.flex;
      if (child.width) childEl.style.width = child.width;

      controls.appendChild(childEl);
    }

    row.appendChild(controls);
    return row;
  },
});

// Spacer widget - flexible spacing (like Qt springs)
widgets.register({
  type: 'spacer',
  label: 'Spacer',
  isLayout: true,
  render(param) {
    const spacer = document.createElement('div');
    spacer.className = 'sp-spacer';

    if (param.flex) {
      // Expanding spring - fills available space
      spacer.style.flex = param.flex;
    } else if (param.size) {
      // Fixed size spacer
      spacer.style.width = param.size;
      spacer.style.height = param.size;
      spacer.style.flexShrink = '0';
    } else {
      // Default: flexible spring
      spacer.style.flex = '1';
    }

    return spacer;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Advanced Input Widgets
// ═══════════════════════════════════════════════════════════════════════════

// Radio group widget
widgets.register({
  type: 'radioGroup',
  label: 'Radio Group',
  render(param, value, onChange) {
    const group = document.createElement('div');
    group.className = 'sp-radio-group';
    if (param.inline) group.classList.add('inline');

    const name = `radio-${param.name}-${Date.now()}`;

    for (const opt of (param.options || [])) {
      const optValue = typeof opt === 'object' ? opt.value : opt;
      const optLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt;

      const label = document.createElement('label');
      label.className = 'sp-radio-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = optValue;
      input.checked = optValue === value;
      input.addEventListener('change', () => onChange(optValue));

      const span = document.createElement('span');
      span.textContent = optLabel;

      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    }

    return group;
  },
});

// Range slider widget with value display
widgets.register({
  type: 'range',
  label: 'Range Slider',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-range-wrapper';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'sp-range';
    slider.value = value ?? param.default ?? 50;
    slider.min = param.min ?? 0;
    slider.max = param.max ?? 100;
    slider.step = param.step ?? 1;

    const display = document.createElement('span');
    display.className = 'sp-range-value';
    const suffix = param.suffix || '';
    display.textContent = `${slider.value}${suffix}`;

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      display.textContent = `${val}${suffix}`;
      onChange(val);
    });

    wrapper.appendChild(slider);
    wrapper.appendChild(display);
    return wrapper;
  },
});

// Button group widget for presets/actions
widgets.register({
  type: 'buttonGroup',
  label: 'Button Group',
  render(param, value, onChange) {
    const group = document.createElement('div');
    group.className = 'sp-button-group';

    for (const btn of (param.buttons || [])) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sp-btn';
      button.textContent = btn.label || btn.value;
      if (btn.disabled) button.disabled = true;
      if (btn.title) button.title = btn.title;

      // Mark active button
      if (btn.value === value) {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        // Update active state
        group.querySelectorAll('.sp-btn').forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        // Return the button's data or value
        onChange(btn.data || btn.value);
      });

      group.appendChild(button);
    }

    return group;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Specialized Widgets
// ═══════════════════════════════════════════════════════════════════════════

// Color ramp widget with visual preview
widgets.register({
  type: 'colorRamp',
  label: 'Color Ramp',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-colorramp-wrapper';

    const select = document.createElement('select');
    select.className = 'sp-colorramp-select';

    // Default ramps
    const ramps = param.ramps || [
      { value: 'viridis', label: 'Viridis', colors: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'] },
      { value: 'terrain', label: 'Terrain', colors: ['#00a600', '#e6e600', '#ecbe94', '#ffffff'] },
      { value: 'ndvi', label: 'NDVI', colors: ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'] },
      { value: 'grayscale', label: 'Grayscale', colors: ['#000000', '#888888', '#ffffff'] },
      { value: 'bluered', label: 'Blue-Red', colors: ['#2166ac', '#f7f7f7', '#b2182b'] },
      { value: 'hot', label: 'Hot', colors: ['#000000', '#ff0000', '#ffff00', '#ffffff'] },
    ];

    for (const ramp of ramps) {
      const option = document.createElement('option');
      option.value = ramp.value;
      option.textContent = ramp.label;
      if (ramp.value === value) option.selected = true;
      select.appendChild(option);
    }

    // Preview gradient
    const preview = document.createElement('div');
    preview.className = 'sp-colorramp-preview';

    const updatePreview = (rampValue) => {
      const ramp = ramps.find(r => r.value === rampValue) || ramps[0];
      const gradient = `linear-gradient(to right, ${ramp.colors.join(', ')})`;
      preview.style.background = gradient;
    };

    updatePreview(value || ramps[0].value);

    select.addEventListener('change', (e) => {
      updatePreview(e.target.value);
      onChange(e.target.value);
    });

    wrapper.appendChild(select);
    wrapper.appendChild(preview);
    return wrapper;
  },
});

// Color picker widget
widgets.register({
  type: 'color',
  label: 'Color Picker',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-color-wrapper';

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'sp-color-input';
    input.value = value || param.default || '#3388ff';

    const preview = document.createElement('span');
    preview.className = 'sp-color-preview';
    preview.textContent = input.value;

    input.addEventListener('input', (e) => {
      preview.textContent = e.target.value;
      onChange(e.target.value);
    });

    wrapper.appendChild(input);
    wrapper.appendChild(preview);
    return wrapper;
  },
});

// Band selector widget (for raster layers)
widgets.register({
  type: 'bandSelector',
  label: 'Band Selector',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-band-selector';

    // Channel label (R, G, B)
    if (param.channel) {
      const channelLabel = document.createElement('span');
      channelLabel.className = 'sp-band-channel';
      channelLabel.textContent = param.channel;
      channelLabel.style.color = param.channelColor || '#888';
      wrapper.appendChild(channelLabel);
    }

    // Band dropdown
    const select = document.createElement('select');
    select.className = 'sp-band-select';

    const bandCount = param.bandCount || 4;
    for (let i = 1; i <= bandCount; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Band ${i}`;
      if (i === (value?.band || value)) option.selected = true;
      select.appendChild(option);
    }

    // Min input
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'sp-band-stretch-input';
    minInput.placeholder = 'min';
    minInput.step = 'any';
    minInput.value = value?.min ?? '';

    // Max input
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'sp-band-stretch-input';
    maxInput.placeholder = 'max';
    maxInput.step = 'any';
    maxInput.value = value?.max ?? '';

    // Auto button
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'sp-btn sp-btn-sm';
    autoBtn.textContent = 'Auto';

    const emitChange = () => {
      onChange({
        band: parseInt(select.value),
        min: minInput.value ? parseFloat(minInput.value) : null,
        max: maxInput.value ? parseFloat(maxInput.value) : null,
      });
    };

    select.addEventListener('change', emitChange);
    minInput.addEventListener('change', emitChange);
    maxInput.addEventListener('change', emitChange);

    autoBtn.addEventListener('click', () => {
      // Request auto values via callback
      const autoValues = param.onAuto?.(parseInt(select.value));
      if (autoValues) {
        minInput.value = autoValues.min ?? '';
        maxInput.value = autoValues.max ?? '';
        emitChange();
      }
    });

    wrapper.appendChild(select);
    wrapper.appendChild(minInput);
    wrapper.appendChild(maxInput);
    wrapper.appendChild(autoBtn);
    return wrapper;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Structural / UI Widgets
// ═══════════════════════════════════════════════════════════════════════════

// Header/title widget for section titles
widgets.register({
  type: 'header',
  label: 'Section Header',
  isLayout: true,
  render(param) {
    const header = document.createElement('div');
    header.className = 'sp-header';
    if (param.size === 'small') header.classList.add('sp-header-sm');
    header.textContent = param.label || param.text || '';
    return header;
  },
});

// Hint/description widget
widgets.register({
  type: 'hint',
  label: 'Hint Text',
  isLayout: true,
  render(param) {
    const hint = document.createElement('div');
    hint.className = 'sp-hint';
    hint.textContent = param.text || '';
    return hint;
  },
});

// Actions widget for button rows (Apply, Cancel, etc.)
widgets.register({
  type: 'actions',
  label: 'Action Buttons',
  isLayout: true,
  render(param, value, onChange) {
    const actions = document.createElement('div');
    actions.className = 'sp-actions';
    if (param.align === 'right') actions.style.justifyContent = 'flex-end';
    if (param.align === 'center') actions.style.justifyContent = 'center';

    for (const btn of (param.buttons || [])) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sp-btn';
      if (btn.primary) button.classList.add('sp-btn-primary');
      if (btn.danger) button.classList.add('sp-btn-danger');
      button.textContent = btn.label;
      if (btn.disabled) button.disabled = true;

      button.addEventListener('click', () => {
        if (btn.action && typeof param.onAction === 'function') {
          param.onAction(btn.action);
        }
        onChange?.(btn.action);
      });

      actions.appendChild(button);
    }

    return actions;
  },
});

// Conditional widget - shows/hides children based on field value
widgets.register({
  type: 'conditional',
  label: 'Conditional Container',
  isLayout: true,
  render(param, values, onChange) {
    const container = document.createElement('div');
    container.className = 'sp-conditional';
    container.dataset.showWhen = param.showWhen || '';
    container.dataset.field = param.field || '';

    // Initial visibility check
    const fieldValue = values?.[param.field];
    const shouldShow = Array.isArray(param.showWhen)
      ? param.showWhen.includes(fieldValue)
      : fieldValue === param.showWhen;
    container.style.display = shouldShow ? '' : 'none';

    // Render children
    for (const child of (param.children || [])) {
      const childValue = values?.[child.name] ?? child.default ?? '';
      const childEl = widgets.render(child, childValue, (newValue, childName) => {
        if (values && child.name) {
          values[child.name] = newValue;
        }
        onChange(newValue, childName || child.name);
      }, values);
      container.appendChild(childEl);
    }

    return container;
  },
});

// Expression input widget with presets
widgets.register({
  type: 'expression',
  label: 'Expression Input',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-expression-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sp-expression-input';
    input.value = value || '';
    input.placeholder = param.placeholder || 'e.g. (b4 - b3) / (b4 + b3)';

    input.addEventListener('input', (e) => onChange(e.target.value));

    wrapper.appendChild(input);

    // Add presets if provided
    if (param.presets && param.presets.length > 0) {
      const presetsRow = document.createElement('div');
      presetsRow.className = 'sp-expression-presets';

      const hint = document.createElement('span');
      hint.className = 'sp-hint';
      hint.textContent = 'Presets:';
      presetsRow.appendChild(hint);

      for (const preset of param.presets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sp-btn sp-btn-sm';
        btn.textContent = preset.label;
        if (preset.disabled) btn.disabled = true;
        btn.title = preset.expr || '';

        btn.addEventListener('click', () => {
          input.value = preset.expr || '';
          onChange(preset.expr, preset); // Pass full preset data
        });

        presetsRow.appendChild(btn);
      }

      wrapper.appendChild(presetsRow);
    }

    return wrapper;
  },
});

// Stretch input widget (min/max with auto button)
widgets.register({
  type: 'stretch',
  label: 'Stretch Controls',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-stretch-wrapper';

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'sp-stretch-input';
    minInput.placeholder = 'min';
    minInput.step = 'any';
    minInput.value = value?.min ?? '';

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'sp-stretch-input';
    maxInput.placeholder = 'max';
    maxInput.step = 'any';
    maxInput.value = value?.max ?? '';

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'sp-btn sp-btn-sm';
    autoBtn.textContent = 'Auto';

    const emitChange = () => {
      onChange({
        min: minInput.value !== '' ? parseFloat(minInput.value) : null,
        max: maxInput.value !== '' ? parseFloat(maxInput.value) : null,
      });
    };

    minInput.addEventListener('change', emitChange);
    maxInput.addEventListener('change', emitChange);

    autoBtn.addEventListener('click', () => {
      const autoValues = param.onAuto?.();
      if (autoValues) {
        minInput.value = autoValues.min ?? '';
        maxInput.value = autoValues.max ?? '';
        emitChange();
      }
    });

    const minLabel = document.createElement('label');
    minLabel.textContent = 'Min';
    minLabel.className = 'sp-stretch-label';

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max';
    maxLabel.className = 'sp-stretch-label';

    wrapper.appendChild(minLabel);
    wrapper.appendChild(minInput);
    wrapper.appendChild(maxLabel);
    wrapper.appendChild(maxInput);
    wrapper.appendChild(autoBtn);

    return wrapper;
  },
});

// rgbChannel widget - specialized row for RGB band selection with stretch
widgets.register({
  type: 'rgbChannel',
  label: 'RGB Channel',
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-rgb-channel';

    // Color label
    const colorLabel = document.createElement('span');
    colorLabel.className = 'sp-rgb-label';
    colorLabel.textContent = param.channel?.toUpperCase() || 'R';
    const colors = { r: '#ff6b6b', g: '#69db7c', b: '#74c0fc' };
    colorLabel.style.color = colors[param.channel] || colors.r;
    wrapper.appendChild(colorLabel);

    // Band selector
    const bandSelect = document.createElement('select');
    bandSelect.className = 'sp-select sp-select-sm';
    for (let i = 1; i <= (param.bandCount || 1); i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Band ${i}`;
      bandSelect.appendChild(opt);
    }
    bandSelect.value = value?.band || 1;
    wrapper.appendChild(bandSelect);

    // Min input
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'sp-num sp-num-sm';
    minInput.placeholder = 'auto';
    minInput.step = 'any';
    minInput.value = value?.min ?? '';
    wrapper.appendChild(minInput);

    // Max input
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'sp-num sp-num-sm';
    maxInput.placeholder = 'auto';
    maxInput.step = 'any';
    maxInput.value = value?.max ?? '';
    wrapper.appendChild(maxInput);

    // Auto button
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'sp-btn sp-btn-sm';
    autoBtn.textContent = 'Auto';
    wrapper.appendChild(autoBtn);

    const emitChange = () => {
      onChange?.({
        band: parseInt(bandSelect.value),
        min: minInput.value !== '' ? parseFloat(minInput.value) : null,
        max: maxInput.value !== '' ? parseFloat(maxInput.value) : null,
      });
    };

    bandSelect.addEventListener('change', emitChange);
    minInput.addEventListener('change', emitChange);
    maxInput.addEventListener('change', emitChange);
    autoBtn.addEventListener('click', () => {
      if (param.onAuto) {
        const stats = param.onAuto(parseInt(bandSelect.value));
        if (stats) {
          minInput.value = stats.min;
          maxInput.value = stats.max;
          emitChange();
        }
      }
    });

    return wrapper;
  },
});

// presetButtons widget - row of preset buttons
widgets.register({
  type: 'presetButtons',
  label: 'Preset Buttons',
  isLayout: true,
  render(param, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-preset-buttons';

    if (param.label) {
      const label = document.createElement('span');
      label.className = 'sp-hint';
      label.textContent = param.label;
      wrapper.appendChild(label);
    }

    for (const preset of (param.presets || [])) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-btn sp-btn-sm';
      btn.textContent = preset.label;
      if (preset.disabled) btn.disabled = true;
      btn.addEventListener('click', () => {
        onChange?.(preset.value || preset.label);
        if (param.onPreset) param.onPreset(preset);
      });
      wrapper.appendChild(btn);
    }

    return wrapper;
  },
});

// rampPreview widget - color ramp preview gradient
widgets.register({
  type: 'rampPreview',
  label: 'Ramp Preview',
  isLayout: true,
  render(param, value, onChange) {
    const preview = document.createElement('div');
    preview.className = 'sp-ramp-preview';

    // Set gradient from ramp name
    const ramp = value || param.ramp || 'terrain';
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
    preview.style.background = gradients[ramp] || gradients.terrain;

    return preview;
  },
});

// Expose globally
if (typeof window !== 'undefined') {
  window.widgets = widgets;
}
