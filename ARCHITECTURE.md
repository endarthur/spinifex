# Spinifex Architecture Design

## Overview

This document outlines the schema-driven UI and tool system architecture, inspired by QGIS Processing Framework.

---

## 1. Parameter Types

Core types that map to UI widgets:

### Basic Types
| Type | Widget | Description |
|------|--------|-------------|
| `string` | text input | Free text |
| `number` | number input | Float values |
| `integer` | number input | Whole numbers, step=1 |
| `boolean` | checkbox | True/false |
| `text` | textarea | Multi-line text |

### Selection Types
| Type | Widget | Description |
|------|--------|-------------|
| `select` | dropdown | Single choice from options |
| `multiselect` | checkbox group | Multiple choices |
| `radio` | radio buttons | Single choice, all visible |

### GIS Types
| Type | Widget | Description |
|------|--------|-------------|
| `layer` | layer dropdown | Select from loaded layers |
| `field` | field dropdown | Select field from a layer |
| `band` | band dropdown | Select band from raster |
| `distance` | number + unit | Value with unit selector (m, km, ft) |
| `extent` | extent picker | Bounding box selector |
| `crs` | CRS selector | Coordinate reference system |
| `expression` | expression builder | Field/band expression |
| `color` | color picker | Color selection |
| `colorRamp` | ramp selector | Predefined color ramps |

### File Types
| Type | Widget | Description |
|------|--------|-------------|
| `file` | file picker | Single file input |
| `files` | file picker | Multiple files |
| `folder` | folder picker | Directory selection |
| `output` | save path | Output file location |

---

## 2. Parameter Schema

```javascript
{
  // Required
  name: 'distance',           // Unique identifier
  type: 'distance',           // Parameter type (see above)

  // Display
  label: 'Buffer Distance',   // Human-readable label
  description: 'Distance to buffer around features',
  placeholder: 'Enter distance...',

  // Validation
  required: true,             // Must have value
  default: 100,               // Default value
  min: 0,                     // Minimum (numbers)
  max: 10000,                 // Maximum (numbers)
  pattern: /^[a-z_]+$/,       // Regex validation (strings)
  validate: (value, params) => {  // Custom validation
    if (value < 0) return 'Distance must be positive';
    return null; // null = valid
  },

  // Type-specific options
  options: ['a', 'b', 'c'],   // For select/multiselect
  units: ['m', 'km', 'mi'],   // For distance type
  layerType: 'vector',        // For layer type: 'vector' | 'raster' | 'any'
  geometryType: 'point',      // For layer type: 'point' | 'line' | 'polygon' | 'any'
  parentLayer: 'input',       // For field type: which layer param to get fields from
  parentRaster: 'input',      // For band type: which raster param to get bands from
  fileTypes: ['.geojson', '.shp'],  // For file type

  // Conditional display
  visible: true,              // Show/hide
  enabled: true,              // Enable/disable
  advanced: false,            // Show in "Advanced" section
  condition: (params) => params.mode === 'advanced',  // Dynamic visibility

  // Behavior
  onChange: (value, form) => {
    // React to value changes
    form.setVisible('segments', value > 1000);
  }
}
```

---

## 3. Tool Schema

```javascript
{
  // Identity
  id: 'vector.buffer',        // Unique tool ID (category.name)
  name: 'Buffer',             // Display name
  description: 'Create buffer zones around features',
  icon: 'buffer',             // Icon identifier
  category: 'Vector',         // Tool category
  tags: ['geometry', 'proximity'],  // Search tags

  // Documentation
  docs: `
    ## Buffer Tool

    Creates a buffer polygon around input features.

    ### Parameters
    - **Input**: Vector layer to buffer
    - **Distance**: Buffer distance with units

    ### Example
    \`\`\`javascript
    await sp.run('vector.buffer', {
      input: ly.points,
      distance: '500m'
    });
    \`\`\`
  `,

  // Parameters
  parameters: [
    {
      name: 'input',
      type: 'layer',
      layerType: 'vector',
      label: 'Input layer',
      required: true
    },
    {
      name: 'distance',
      type: 'distance',
      label: 'Distance',
      default: 100,
      units: ['m', 'km', 'ft', 'mi'],
      required: true
    },
    {
      name: 'segments',
      type: 'integer',
      label: 'Segments',
      description: 'Number of segments for curved sections',
      default: 8,
      min: 1,
      max: 100,
      advanced: true
    },
    {
      name: 'endCapStyle',
      type: 'select',
      label: 'End cap style',
      options: [
        { value: 'round', label: 'Round' },
        { value: 'flat', label: 'Flat' },
        { value: 'square', label: 'Square' }
      ],
      default: 'round',
      advanced: true
    },
    {
      name: 'output',
      type: 'string',
      label: 'Output layer name',
      default: '{input}_buffer',
      required: true
    }
  ],

  // Execution
  execute: async (params, context) => {
    const { input, distance, segments, endCapStyle, output } = params;
    // ... implementation
    return resultLayer;
  },

  // Lifecycle hooks
  onOpen: (form) => { },      // When tool dialog opens
  onClose: (form) => { },     // When tool dialog closes
  onValidate: (params) => { } // Additional validation
}
```

---

## 4. Form/Panel Schema

For property panels and dialogs (not just tools):

```javascript
{
  id: 'raster.style',
  title: 'Raster Style',

  // Sections group related fields
  sections: [
    {
      id: 'display',
      label: 'Display Mode',
      collapsible: false,
      fields: [
        {
          name: 'mode',
          type: 'select',
          label: 'Mode',
          options: [
            { value: 'rgb', label: 'RGB Composite' },
            { value: 'singleband', label: 'Single Band' }
          ],
          onChange: (value, form) => {
            form.setVisible('rgb', value === 'rgb');
            form.setVisible('singleband', value === 'singleband');
          }
        }
      ]
    },
    {
      id: 'rgb',
      label: 'RGB Channels',
      visible: false,  // Controlled by mode onChange
      fields: [
        { name: 'redBand', type: 'band', label: 'Red', parentRaster: '@layer' },
        { name: 'greenBand', type: 'band', label: 'Green', parentRaster: '@layer' },
        { name: 'blueBand', type: 'band', label: 'Blue', parentRaster: '@layer' }
      ]
    },
    {
      id: 'singleband',
      label: 'Single Band',
      visible: false,
      fields: [
        { name: 'band', type: 'band', label: 'Band', parentRaster: '@layer' },
        { name: 'colorRamp', type: 'colorRamp', label: 'Color ramp' },
        { name: 'min', type: 'number', label: 'Min' },
        { name: 'max', type: 'number', label: 'Max' }
      ]
    },
    {
      id: 'rendering',
      label: 'Rendering',
      collapsible: true,
      fields: [
        { name: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 100, default: 100 },
        { name: 'blendMode', type: 'select', label: 'Blend', options: '@blendModes' }
      ]
    }
  ],

  // Actions (buttons at bottom)
  actions: [
    { id: 'cancel', label: 'Cancel', action: 'close' },
    { id: 'apply', label: 'Apply', primary: true, action: 'apply' }
  ],

  // Data binding
  getData: (layer) => ({
    mode: layer.r.mode(),
    redBand: layer._bandMapping[0],
    // ...
  }),

  setData: (layer, data) => {
    if (data.mode === 'rgb') {
      layer.r.bands(data.redBand, data.greenBand, data.blueBand);
    }
    // ...
  }
}
```

---

## 5. Widget Registry

Custom widgets can be registered:

```javascript
widgets.register('distance', {
  // Render the widget HTML
  render: (param, value) => `
    <div class="sp-distance-widget">
      <input type="number" value="${value?.value || param.default || 0}" />
      <select>
        ${param.units.map(u => `<option value="${u}">${u}</option>`).join('')}
      </select>
    </div>
  `,

  // Get value from DOM
  getValue: (element) => ({
    value: parseFloat(element.querySelector('input').value),
    unit: element.querySelector('select').value
  }),

  // Set value to DOM
  setValue: (element, value) => {
    element.querySelector('input').value = value?.value || 0;
    element.querySelector('select').value = value?.unit || 'm';
  },

  // Validate
  validate: (value, param) => {
    if (param.required && !value?.value) return 'Required';
    if (param.min !== undefined && value.value < param.min) return `Min: ${param.min}`;
    return null;
  },

  // Parse string input (for scripting)
  parse: (str) => {
    const match = str.match(/^([\d.]+)\s*(m|km|ft|mi)?$/);
    if (!match) return null;
    return { value: parseFloat(match[1]), unit: match[2] || 'm' };
  }
});
```

---

## 6. Tool Registry

```javascript
// Register a tool
toolbox.register(bufferTool);

// Get tool by ID
const tool = toolbox.get('vector.buffer');

// List tools by category
const vectorTools = toolbox.list('Vector');

// Search tools
const results = toolbox.search('buffer');

// Open tool UI
toolbox.open('vector.buffer');

// Run tool programmatically
const result = await toolbox.run('vector.buffer', {
  input: ly.points,
  distance: { value: 500, unit: 'm' }
});

// Shorthand (sp.run)
await sp.run('vector.buffer', { input: ly.points, distance: '500m' });
```

---

## 7. Form Generator API

```javascript
// Create form from schema
const form = new SchemaForm(schema, {
  target: document.getElementById('panel'),
  data: initialValues,
  context: { layer: currentLayer }
});

// Form methods
form.getData();                    // Get all values
form.setData(values);              // Set values
form.validate();                   // Run validation, returns errors
form.setVisible('fieldName', bool);
form.setEnabled('fieldName', bool);
form.setOptions('fieldName', opts);
form.showSection('sectionId');
form.hideSection('sectionId');

// Events
form.on('change', (name, value, allData) => { });
form.on('submit', (data) => { });
form.on('cancel', () => { });
form.on('validate', (errors) => { });
```

---

## 8. Event System

Central event bus for decoupling:

```javascript
// Core events
events.on('layer:added', (layer) => { });
events.on('layer:removed', (layer) => { });
events.on('layer:renamed', (layer, oldName, newName) => { });
events.on('layer:style-changed', (layer) => { });
events.on('layer:visibility-changed', (layer, visible) => { });

events.on('map:click', (coord, pixel) => { });
events.on('map:extent-changed', (extent) => { });

events.on('tool:started', (toolId, params) => { });
events.on('tool:completed', (toolId, result) => { });
events.on('tool:failed', (toolId, error) => { });

events.on('ui:panel-opened', (panelId) => { });
events.on('ui:panel-closed', (panelId) => { });

// Emit events
events.emit('layer:added', newLayer);

// One-time listener
events.once('tool:completed', (id, result) => { });

// Remove listener
events.off('layer:added', handler);
```

---

## 9. Terminal System

Structured logging with helpers:

```javascript
// Log levels
terminal.debug('Detailed info for debugging');
terminal.info('General information');
terminal.success('Operation completed');
terminal.warn('Warning message');
terminal.error('Error occurred');

// Structured output
terminal.log('Processing...', { type: 'progress' });
terminal.log('Layer: points (54 features)', { type: 'result' });

// Interactive elements
terminal.prompt('Enter layer name: ').then(name => { });
terminal.confirm('Delete layer?').then(yes => { });
terminal.select('Choose format:', ['GeoJSON', 'Shapefile']).then(choice => { });

// Progress
const progress = terminal.progress('Buffering...', { total: 100 });
progress.update(50);  // 50%
progress.complete();

// Groups
terminal.group('Buffer operation');
terminal.info('Input: points');
terminal.info('Distance: 500m');
terminal.groupEnd();

// Preserve prompt
terminal.info('Message');  // Doesn't clear prompt
terminal.blockPrompt();    // Hide prompt for interactive mode
terminal.unblockPrompt();  // Restore prompt
```

---

## 10. Configuration

Centralized config:

```javascript
// src/core/config.js
export const config = {
  // Color ramps
  colorRamps: {
    terrain: { stops: [...], colors: [...] },
    viridis: { ... },
    // ...
  },

  // Blend modes
  blendModes: ['normal', 'multiply', 'screen', ...],

  // Default values
  defaults: {
    raster: {
      colorRamp: 'terrain',
      nodata: -32768
    },
    vector: {
      fillColor: '#3388ff',
      strokeColor: '#000000',
      strokeWidth: 1
    },
    buffer: {
      segments: 8,
      units: 'm'
    }
  },

  // Units and conversions
  units: {
    distance: {
      m: 1,
      km: 1000,
      ft: 0.3048,
      mi: 1609.34
    }
  },

  // UI settings
  ui: {
    panelWidth: 350,
    terminalHeight: 200
  }
};

// Access
import { config } from './config.js';
const ramp = config.colorRamps.viridis;
```

---

## 11. Layer Hierarchy

```
BaseLayer (abstract)
├── VectorLayer      - GeoJSON, editable, selectable
├── RasterLayer      - GeoTIFF, local pixel data
├── TileLayer        - WMS, WMTS, XYZ (remote, not queryable)
└── GroupLayer       - Contains child layers
```

### BaseLayer Additions

```javascript
class BaseLayer {
  // ... existing ...

  // Coordinate reference system (null for non-spatial data)
  get crs() { return this._crs || null; }
  set crs(value) { this._crs = value; }

  // Default to WGS84 for geo layers
  // Non-spatial layers (charts, tables) have crs = null
}
```

### TileLayer

For remote tile services (WMS, WMTS, XYZ):

```javascript
class TileLayer extends BaseLayer {
  constructor(id, name, olLayer, options = {}) {
    super(id, name, olLayer, options.zIndex);
    this._crs = options.crs || 'EPSG:3857';
    this._serviceUrl = options.url;
    this._serviceType = options.type; // 'wms' | 'wmts' | 'xyz'
  }

  get type() { return 'tile'; }

  // Limited API - can't query pixels, no local data
  // Mostly just visibility, opacity, z-index
}

// Usage
const osm = await loadXYZ('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'OpenStreetMap');
const wms = await loadWMS('https://example.com/wms', 'geology', { layers: 'formations' });
```

### GroupLayer

Container for organizing layers:

```javascript
class GroupLayer extends BaseLayer {
  constructor(id, name) {
    super(id, name, null, 0);
    this._children = [];
  }

  get type() { return 'group'; }
  get children() { return [...this._children]; }
  get count() { return this._children.length; }

  add(layer) {
    this._children.push(layer);
    layer._parent = this;
    events.emit('group:layer-added', this, layer);
  }

  remove(layer) {
    const idx = this._children.indexOf(layer);
    if (idx >= 0) {
      this._children.splice(idx, 1);
      layer._parent = null;
      events.emit('group:layer-removed', this, layer);
    }
  }

  // Override show/hide to affect children
  show() {
    this._children.forEach(l => l.show());
    return super.show();
  }

  hide() {
    this._children.forEach(l => l.hide());
    return super.hide();
  }
}

// Usage
const basemaps = new GroupLayer('basemaps', 'Basemaps');
basemaps.add(osmLayer);
basemaps.add(satelliteLayer);
```

---

## 12. Selection Model

Selection support for VectorLayer:

```javascript
class VectorLayer extends BaseLayer {
  constructor(...) {
    // ...
    this._selection = new Set();  // Feature IDs
    this._selectionStyle = null;  // Override style for selected
  }

  // Selection API
  get selection() { return [...this._selection]; }
  get hasSelection() { return this._selection.size > 0; }
  get selectedCount() { return this._selection.size; }

  select(featureOrId, options = {}) {
    const id = typeof featureOrId === 'object' ? featureOrId.id : featureOrId;
    const add = options.add || false;  // Add to selection vs replace

    if (!add) this._selection.clear();
    this._selection.add(id);

    this._updateSelectionStyle();
    events.emit('selection:changed', this, this.selection);
    return this;
  }

  selectMultiple(featuresOrIds, options = {}) {
    if (!options.add) this._selection.clear();
    for (const f of featuresOrIds) {
      const id = typeof f === 'object' ? f.id : f;
      this._selection.add(id);
    }
    this._updateSelectionStyle();
    events.emit('selection:changed', this, this.selection);
    return this;
  }

  deselect(featureOrId) {
    const id = typeof featureOrId === 'object' ? featureOrId.id : featureOrId;
    this._selection.delete(id);
    this._updateSelectionStyle();
    events.emit('selection:changed', this, this.selection);
    return this;
  }

  clearSelection() {
    if (this._selection.size > 0) {
      this._selection.clear();
      this._updateSelectionStyle();
      events.emit('selection:changed', this, []);
    }
    return this;
  }

  isSelected(featureOrId) {
    const id = typeof featureOrId === 'object' ? featureOrId.id : featureOrId;
    return this._selection.has(id);
  }

  getSelected() {
    return this._geojson.features.filter(f => this._selection.has(f.id));
  }

  selectByExpression(predicate) {
    const matching = this._geojson.features.filter(predicate);
    return this.selectMultiple(matching);
  }

  invertSelection() {
    const allIds = new Set(this._geojson.features.map(f => f.id));
    const newSelection = [...allIds].filter(id => !this._selection.has(id));
    this._selection = new Set(newSelection);
    this._updateSelectionStyle();
    events.emit('selection:changed', this, this.selection);
    return this;
  }

  // Selection styling
  setSelectionStyle(style) {
    this._selectionStyle = style;
    this._updateSelectionStyle();
  }

  _updateSelectionStyle() {
    // Apply highlight style to selected features
    // Implementation depends on OpenLayers styling approach
  }
}
```

### Selection Events

```javascript
// Listen for selection changes
events.on('selection:changed', (layer, selectedIds) => {
  updateStatusBar(`${selectedIds.length} features selected`);
  updateAttributeTable(layer);
});

// Global selection helpers
selection.clearAll();  // Clear selection on all layers
selection.getAll();    // Get all selected features across layers
```

---

## 13. Edit Mode & Layer Mutability

VectorLayer editing support with undo:

```javascript
class VectorLayer extends BaseLayer {
  constructor(...) {
    // ...
    this._editing = false;
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndoSteps = 50;
  }

  // Edit mode
  get isEditing() { return this._editing; }

  startEditing() {
    if (this._editing) return this;
    this._editing = true;
    this._undoStack = [];
    this._redoStack = [];
    events.emit('layer:edit-started', this);
    termPrint(`Editing: ${this._name}`, 'info');
    return this;
  }

  stopEditing(save = true) {
    if (!this._editing) return this;

    if (!save && this._undoStack.length > 0) {
      // Revert all changes
      while (this._undoStack.length > 0) {
        this.undo();
      }
    }

    this._editing = false;
    this._undoStack = [];
    this._redoStack = [];
    events.emit('layer:edit-stopped', this, save);
    termPrint(`Editing ${save ? 'saved' : 'cancelled'}: ${this._name}`, 'info');
    return this;
  }

  // Undo/Redo
  _pushUndo(action) {
    this._undoStack.push(action);
    if (this._undoStack.length > this._maxUndoSteps) {
      this._undoStack.shift();
    }
    this._redoStack = [];  // Clear redo on new action
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return this;
    const action = this._undoStack.pop();
    this._applyAction(action.undo);
    this._redoStack.push(action);
    events.emit('layer:edit-undo', this, action);
    return this;
  }

  redo() {
    if (!this.canRedo()) return this;
    const action = this._redoStack.pop();
    this._applyAction(action.redo);
    this._undoStack.push(action);
    events.emit('layer:edit-redo', this, action);
    return this;
  }

  // Feature manipulation (only when editing)
  addFeature(geometry, properties = {}) {
    if (!this._editing) {
      termPrint('Layer not in edit mode', 'warn');
      return null;
    }

    const feature = {
      type: 'Feature',
      id: crypto.randomUUID(),
      geometry,
      properties
    };

    this._geojson.features.push(feature);
    this._syncToSource();

    this._pushUndo({
      type: 'add',
      redo: { action: 'add', feature },
      undo: { action: 'delete', featureId: feature.id }
    });

    events.emit('layer:feature-added', this, feature);
    return feature;
  }

  updateFeature(featureId, changes) {
    if (!this._editing) {
      termPrint('Layer not in edit mode', 'warn');
      return null;
    }

    const feature = this._geojson.features.find(f => f.id === featureId);
    if (!feature) return null;

    const before = JSON.parse(JSON.stringify(feature));

    if (changes.geometry) feature.geometry = changes.geometry;
    if (changes.properties) Object.assign(feature.properties, changes.properties);

    this._syncToSource();

    this._pushUndo({
      type: 'update',
      redo: { action: 'update', featureId, changes },
      undo: { action: 'replace', featureId, feature: before }
    });

    events.emit('layer:feature-updated', this, feature);
    return feature;
  }

  deleteFeature(featureId) {
    if (!this._editing) {
      termPrint('Layer not in edit mode', 'warn');
      return false;
    }

    const idx = this._geojson.features.findIndex(f => f.id === featureId);
    if (idx < 0) return false;

    const feature = this._geojson.features[idx];
    this._geojson.features.splice(idx, 1);
    this._selection.delete(featureId);
    this._syncToSource();

    this._pushUndo({
      type: 'delete',
      redo: { action: 'delete', featureId },
      undo: { action: 'add', feature, index: idx }
    });

    events.emit('layer:feature-deleted', this, feature);
    return true;
  }

  _applyAction(action) {
    // Apply undo/redo action without pushing to stack
    switch (action.action) {
      case 'add':
        if (action.index !== undefined) {
          this._geojson.features.splice(action.index, 0, action.feature);
        } else {
          this._geojson.features.push(action.feature);
        }
        break;
      case 'delete':
        const idx = this._geojson.features.findIndex(f => f.id === action.featureId);
        if (idx >= 0) this._geojson.features.splice(idx, 1);
        break;
      case 'replace':
        const replaceIdx = this._geojson.features.findIndex(f => f.id === action.featureId);
        if (replaceIdx >= 0) this._geojson.features[replaceIdx] = action.feature;
        break;
      case 'update':
        const feat = this._geojson.features.find(f => f.id === action.featureId);
        if (feat) {
          if (action.changes.geometry) feat.geometry = action.changes.geometry;
          if (action.changes.properties) Object.assign(feat.properties, action.changes.properties);
        }
        break;
    }
    this._syncToSource();
  }

  _syncToSource() {
    // Update OpenLayers source from GeoJSON
    const format = new ol.format.GeoJSON();
    this._source.clear();
    this._source.addFeatures(format.readFeatures(this._geojson, {
      featureProjection: 'EPSG:3857'
    }));
  }
}
```

---

## 14. Interactive Tools & Map Mode

### Tool Types

```javascript
// Tool schema extended with type
{
  id: 'sketching.polygon',
  name: 'Draw Polygon',
  type: 'interactive',  // 'processing' | 'interactive'

  // For processing tools
  execute: async (params) => result,

  // For interactive tools
  activate: (context) => { /* setup */ },
  deactivate: () => { /* cleanup */ },
  cursor: 'crosshair',

  // Map event handlers
  onMapClick: (coord, event) => { },
  onMapDoubleClick: (coord, event) => { },
  onMapPointerMove: (coord, event) => { },
  onMapDragStart: (coord, event) => { },
  onMapDrag: (coord, event) => { },
  onMapDragEnd: (coord, event) => { },
  onKeyDown: (key, event) => { },

  // Lifecycle
  onComplete: (result) => { },
  onCancel: () => { }
}
```

### Map Tools Manager

```javascript
// src/core/map-tools.js

const mapTools = {
  _current: null,
  _interactions: [],

  // Get current tool
  get current() { return this._current; },

  // Activate a tool
  activate(toolId, options = {}) {
    // Deactivate current tool first
    if (this._current) {
      this.deactivate();
    }

    const tool = toolbox.get(toolId);
    if (!tool || tool.type !== 'interactive') {
      termPrint(`Invalid interactive tool: ${toolId}`, 'error');
      return false;
    }

    this._current = toolId;

    // Set cursor
    if (tool.cursor) {
      document.getElementById('map').style.cursor = tool.cursor;
    }

    // Create OpenLayers interactions if specified
    if (tool.interactions) {
      this._interactions = tool.interactions(options);
      const map = getMap();
      this._interactions.forEach(i => map.addInteraction(i));
    }

    // Call activate hook
    if (tool.activate) {
      tool.activate({ map: getMap(), ...options });
    }

    events.emit('maptool:activated', toolId);
    termPrint(`Tool: ${tool.name}`, 'dim');
    return true;
  },

  // Deactivate current tool
  deactivate() {
    if (!this._current) return;

    const tool = toolbox.get(this._current);

    // Remove interactions
    const map = getMap();
    this._interactions.forEach(i => map.removeInteraction(i));
    this._interactions = [];

    // Reset cursor
    document.getElementById('map').style.cursor = '';

    // Call deactivate hook
    if (tool?.deactivate) {
      tool.deactivate();
    }

    events.emit('maptool:deactivated', this._current);
    this._current = null;
  },

  // Check if a tool is active
  isActive(toolId) {
    return this._current === toolId;
  },

  // Cancel current operation
  cancel() {
    const tool = toolbox.get(this._current);
    if (tool?.onCancel) {
      tool.onCancel();
    }
    this.deactivate();
  }
};

// Keyboard handling
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mapTools.current) {
    mapTools.cancel();
  }

  const tool = toolbox.get(mapTools.current);
  if (tool?.onKeyDown) {
    tool.onKeyDown(e.key, e);
  }
});
```

### Example Interactive Tools

```javascript
// Sketching tool
const drawPolygonTool = {
  id: 'sketching.polygon',
  name: 'Draw Polygon',
  type: 'interactive',
  category: 'sketching',
  cursor: 'crosshair',

  interactions: (options) => {
    const layer = options.layer;
    if (!layer || layer.type !== 'vector') return [];

    const draw = new ol.interaction.Draw({
      source: layer._source,
      type: 'Polygon'
    });

    draw.on('drawend', (e) => {
      const format = new ol.format.GeoJSON();
      const geojson = format.writeFeatureObject(e.feature, {
        featureProjection: 'EPSG:3857'
      });
      layer.addFeature(geojson.geometry, {});
    });

    const snap = new ol.interaction.Snap({ source: layer._source });

    return [draw, snap];
  },

  activate: (context) => {
    if (!context.layer?.isEditing) {
      context.layer?.startEditing();
    }
  }
};

// Measure distance tool
const measureDistanceTool = {
  id: 'measure.distance',
  name: 'Measure Distance',
  type: 'interactive',
  category: 'measure',
  cursor: 'crosshair',

  _overlay: null,
  _sketch: null,

  interactions: () => {
    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source,
      style: measureStyle
    });
    getMap().addLayer(vector);

    const draw = new ol.interaction.Draw({
      source,
      type: 'LineString'
    });

    draw.on('drawstart', (e) => {
      this._sketch = e.feature;
    });

    draw.on('drawend', () => {
      const geom = this._sketch.getGeometry();
      const length = ol.sphere.getLength(geom);
      termPrint(`Distance: ${formatDistance(length)}`, 'green');
      this._sketch = null;
    });

    return [draw];
  },

  deactivate: () => {
    // Remove measurement layer
  }
};

// Select tool
const selectTool = {
  id: 'select.click',
  name: 'Select Features',
  type: 'interactive',
  category: 'selection',
  cursor: 'pointer',

  interactions: (options) => {
    const select = new ol.interaction.Select({
      condition: ol.events.condition.click,
      multi: options.multi || false
    });

    select.on('select', (e) => {
      const layer = getLayerForFeature(e.selected[0]);
      if (layer) {
        const ids = e.selected.map(f => f.getId());
        layer.selectMultiple(ids, { add: e.mapBrowserEvent.shiftKey });
      }
    });

    return [select];
  }
};
```

---

## 15. File Structure

```
src/
├── core/
│   ├── config.js           # Centralized configuration
│   ├── events.js           # Event bus
│   ├── settings.js         # Persistent key-value store
│   ├── state.js            # Application state
│   ├── base-layer.js       # Abstract base layer class
│   ├── vector-layer.js     # Vector layer (editable, selectable)
│   ├── raster-layer.js     # Raster layer (GeoTIFF)
│   ├── tile-layer.js       # Tile layer (WMS, WMTS, XYZ)
│   ├── group-layer.js      # Layer groups
│   ├── map-tools.js        # Interactive tool manager
│   └── api.js              # Public API
│
├── schema/
│   ├── types.js            # Parameter type definitions
│   ├── widgets.js          # Widget registry
│   ├── form.js             # SchemaForm class
│   ├── tool-registry.js    # Tool registry (processing + interactive)
│   ├── validators.js       # Validation helpers
│   ├── presets.js          # Parameter presets
│   ├── history.js          # Tool execution history
│   └── shortcuts.js        # Keyboard shortcuts
│
├── tools/
│   ├── vector/
│   │   ├── buffer.js
│   │   ├── dissolve.js
│   │   ├── clip.js
│   │   ├── intersect.js
│   │   └── ...
│   ├── raster/
│   │   ├── calc.js
│   │   ├── ndvi.js
│   │   └── ...
│   ├── sketching/
│   │   ├── draw-point.js
│   │   ├── draw-line.js
│   │   ├── draw-polygon.js
│   │   └── modify.js
│   ├── selection/
│   │   ├── click-select.js
│   │   ├── box-select.js
│   │   └── polygon-select.js
│   ├── measure/
│   │   ├── distance.js
│   │   ├── area.js
│   │   └── bearing.js
│   └── gdal/
│       ├── contours.js
│       ├── hillshade.js
│       └── ...
│
├── ui/
│   ├── terminal.js         # Terminal with structured logging
│   ├── map.js
│   ├── layers-panel.js
│   ├── toolbox.js          # Tool browser UI
│   ├── toolbar.js          # Interactive tool buttons
│   └── panels/
│       ├── layer-info.js   # Schema-based panels
│       ├── layer-style.js
│       ├── attribute-table.js
│       └── ...
│
└── formats/
    ├── geojson.js
    ├── geotiff.js
    ├── wms.js
    ├── wmts.js
    └── ...
```

---

## 12. Migration Path

1. **Phase 1: Foundation**
   - Create `config.js` with existing constants
   - Create `events.js` with basic pub/sub
   - Update terminal with structured logging

2. **Phase 2: Schema System**
   - Create parameter types and validators
   - Create widget registry with basic widgets
   - Create `SchemaForm` class

3. **Phase 3: Tool Registry**
   - Create tool registry
   - Define schema for 2-3 existing tools (buffer, dissolve)
   - Create tool browser UI

4. **Phase 4: Migration**
   - Migrate remaining tools to schema
   - Migrate style panels to schema
   - Migrate other dialogs

5. **Phase 5: Polish**
   - Add documentation viewer
   - Add scripting API (`sp.run`)
   - Add tool history/favorites

---

## 13. Example: Complete Tool

```javascript
// src/tools/vector/buffer.js
import { config } from '../../core/config.js';

export const bufferTool = {
  id: 'vector.buffer',
  name: 'Buffer',
  category: 'Vector',
  icon: 'buffer',
  description: 'Create buffer polygons around features',

  docs: `
## Buffer

Creates a polygon layer containing buffer zones around all features in an input layer.

### Use Cases
- Create setback zones around buildings
- Define proximity areas around points of interest
- Generate corridor polygons along linear features

### Notes
- Output is always polygon geometry
- For geodetic accuracy with large distances, consider reprojecting first
  `,

  parameters: [
    {
      name: 'input',
      type: 'layer',
      layerType: 'vector',
      label: 'Input layer',
      required: true
    },
    {
      name: 'distance',
      type: 'distance',
      label: 'Distance',
      required: true,
      default: { value: 100, unit: 'm' },
      units: ['m', 'km', 'ft', 'mi']
    },
    {
      name: 'segments',
      type: 'integer',
      label: 'Segments',
      description: 'Number of segments used to approximate curves',
      default: 8,
      min: 1,
      max: 64,
      advanced: true
    },
    {
      name: 'output',
      type: 'string',
      label: 'Output layer',
      default: '{input}_buffer'
    }
  ],

  execute: async (params, context) => {
    const { input, distance, segments, output } = params;

    // Convert distance to meters
    const meters = distance.value * config.units.distance[distance.unit];

    // Use Turf.js for buffering
    const buffered = turf.buffer(input.geojson, meters / 1000, {
      units: 'kilometers',
      steps: segments
    });

    // Create output layer name
    const outputName = output.replace('{input}', input.name);

    // Load as new layer
    const { load } = await import('../../core/api.js');
    return await load(buffered, outputName);
  }
};
```

---

## 14. Settings API

Centralized key-value store for persistent settings:

```javascript
// src/core/settings.js

// Namespaced storage for tools, plugins, scripts
const settings = {
  // Get a value (with optional default)
  get: (key, defaultValue = null) => {
    const data = JSON.parse(localStorage.getItem('sp_settings') || '{}');
    return key.split('.').reduce((obj, k) => obj?.[k], data) ?? defaultValue;
  },

  // Set a value
  set: (key, value) => {
    const data = JSON.parse(localStorage.getItem('sp_settings') || '{}');
    const keys = key.split('.');
    const last = keys.pop();
    const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, data);
    target[last] = value;
    localStorage.setItem('sp_settings', JSON.stringify(data));
    events.emit('settings:changed', key, value);
  },

  // Remove a value
  remove: (key) => {
    const data = JSON.parse(localStorage.getItem('sp_settings') || '{}');
    const keys = key.split('.');
    const last = keys.pop();
    const target = keys.reduce((obj, k) => obj?.[k], data);
    if (target) delete target[last];
    localStorage.setItem('sp_settings', JSON.stringify(data));
  },

  // Get all settings for a namespace
  getNamespace: (namespace) => {
    const data = JSON.parse(localStorage.getItem('sp_settings') || '{}');
    return data[namespace] || {};
  },

  // Clear a namespace
  clearNamespace: (namespace) => {
    const data = JSON.parse(localStorage.getItem('sp_settings') || '{}');
    delete data[namespace];
    localStorage.setItem('sp_settings', JSON.stringify(data));
  },

  // Listen for changes
  onChange: (key, callback) => {
    return events.on('settings:changed', (changedKey, value) => {
      if (changedKey === key || changedKey.startsWith(key + '.')) {
        callback(value, changedKey);
      }
    });
  }
};

// Usage examples:

// Tool settings
settings.set('tools.buffer.defaultDistance', { value: 500, unit: 'm' });
settings.set('tools.buffer.defaultSegments', 16);
const dist = settings.get('tools.buffer.defaultDistance', { value: 100, unit: 'm' });

// Plugin settings
settings.set('plugins.my-plugin.apiKey', 'xxx');
settings.set('plugins.my-plugin.enabled', true);

// Script settings
settings.set('scripts.my-script.lastRun', Date.now());
settings.set('scripts.my-script.favorites', ['layer1', 'layer2']);

// UI preferences
settings.set('ui.terminal.height', 250);
settings.set('ui.theme', 'dark');

// Recent/history
settings.set('history.tools', ['vector.buffer', 'raster.ndvi', ...]);
settings.set('history.commands', [
  { tool: 'vector.buffer', params: { input: 'points', distance: '500m' }, time: 123456 },
  ...
]);
```

### Namespacing Convention

| Prefix | Usage |
|--------|-------|
| `tools.*` | Tool-specific settings and defaults |
| `plugins.*` | Plugin settings |
| `scripts.*` | Script settings |
| `ui.*` | UI preferences |
| `history.*` | Command/tool history |
| `presets.*` | Saved parameter presets |
| `shortcuts.*` | Keyboard shortcuts |

---

## 15. Tool History

Track tool executions for reference and re-running:

```javascript
// Automatically tracked when tools run
const history = {
  // Add entry (called by toolbox.run)
  add: (toolId, params, result) => {
    const entries = settings.get('history.tools', []);
    entries.unshift({
      id: crypto.randomUUID(),
      tool: toolId,
      params: serializeParams(params),  // Convert layers to names, etc.
      time: Date.now(),
      success: result !== null
    });
    // Keep last 100
    settings.set('history.tools', entries.slice(0, 100));
  },

  // Get recent
  recent: (limit = 10) => settings.get('history.tools', []).slice(0, limit),

  // Get by tool
  forTool: (toolId) => settings.get('history.tools', []).filter(h => h.tool === toolId),

  // Re-run entry
  rerun: async (entryId) => {
    const entry = settings.get('history.tools', []).find(h => h.id === entryId);
    if (entry) {
      return await toolbox.run(entry.tool, deserializeParams(entry.params));
    }
  },

  // Copy as script
  toScript: (entryId) => {
    const entry = settings.get('history.tools', []).find(h => h.id === entryId);
    if (entry) {
      const params = JSON.stringify(entry.params, null, 2);
      return `await sp.run('${entry.tool}', ${params});`;
    }
  },

  // Clear
  clear: () => settings.set('history.tools', [])
};

// UI: History panel shows recent tools with "Re-run" and "Copy as script" buttons
```

---

## 16. Presets

Save and load parameter presets for tools:

```javascript
const presets = {
  // Save current params as preset
  save: (toolId, name, params) => {
    const key = `presets.${toolId}`;
    const existing = settings.get(key, {});
    existing[name] = {
      params: serializeParams(params),
      created: Date.now()
    };
    settings.set(key, existing);
  },

  // Load preset
  load: (toolId, name) => {
    const preset = settings.get(`presets.${toolId}.${name}`);
    return preset ? deserializeParams(preset.params) : null;
  },

  // List presets for tool
  list: (toolId) => {
    const all = settings.get(`presets.${toolId}`, {});
    return Object.keys(all);
  },

  // Delete preset
  remove: (toolId, name) => {
    const key = `presets.${toolId}`;
    const existing = settings.get(key, {});
    delete existing[name];
    settings.set(key, existing);
  }
};

// Tool UI has "Save preset" and "Load preset" dropdown
```

---

## 17. Keyboard Shortcuts

Configurable shortcuts for tools and actions:

```javascript
const shortcuts = {
  // Default shortcuts
  defaults: {
    'tools.open': 'Ctrl+Shift+T',
    'tools.buffer': 'Ctrl+B',
    'layer.remove': 'Delete',
    'layer.zoom': 'Z',
    'map.pan': 'Space',
    // ...
  },

  // Get shortcut for action
  get: (action) => {
    return settings.get(`shortcuts.${action}`) || shortcuts.defaults[action];
  },

  // Set custom shortcut
  set: (action, keys) => {
    settings.set(`shortcuts.${action}`, keys);
    shortcuts.rebind();
  },

  // Reset to default
  reset: (action) => {
    settings.remove(`shortcuts.${action}`);
    shortcuts.rebind();
  },

  // Bind all shortcuts
  rebind: () => {
    // Clear existing
    Mousetrap.reset();

    // Bind all
    for (const [action, defaultKeys] of Object.entries(shortcuts.defaults)) {
      const keys = shortcuts.get(action);
      Mousetrap.bind(keys, () => shortcuts.execute(action));
    }
  },

  // Execute action
  execute: (action) => {
    if (action.startsWith('tools.')) {
      const toolId = action.replace('tools.', '');
      if (toolId === 'open') {
        toolbox.open();
      } else {
        toolbox.open(toolId);
      }
    }
    // ... handle other action types
  }
};
```

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Undo/Redo | No general undo - only for digitizing/sketching (like QGIS) |
| Batch Processing | Implement as a meta-tool that wraps other tools |
| Presets | Yes - save/load parameter sets per tool |
| History | Yes - track executions, enable re-run and copy-to-script |
| Keyboard Shortcuts | Yes - configurable, with sensible defaults |
| Settings Storage | Namespaced key-value store over localStorage |

---

*This is a living document - update as design evolves.*
