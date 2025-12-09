// Spinifex - Map Tools Manager
// Manages interactive map tools (draw, select, measure)

import { events } from './events.js';
import { termPrint } from '../ui/terminal.js';

/**
 * Map Tools Manager
 * Handles activation/deactivation of interactive map tools
 */
export const mapTools = {
  _current: null,
  _currentTool: null,
  _interactions: [],
  _overlays: [],
  _map: null,

  /**
   * Get current active tool ID
   */
  get current() {
    return this._current;
  },

  /**
   * Get current tool object
   */
  get currentTool() {
    return this._currentTool;
  },

  /**
   * Initialize with map reference
   */
  init(map) {
    this._map = map;

    // Global keyboard handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._current) {
        this.cancel();
      }

      if (this._currentTool?.onKeyDown) {
        this._currentTool.onKeyDown(e.key, e);
      }
    });
  },

  /**
   * Activate a tool
   * @param {Object} tool - Tool definition object
   * @param {Object} options - Tool options (layer, etc.)
   * @returns {boolean} Success
   */
  activate(tool, options = {}) {
    if (!tool) {
      termPrint('Invalid tool', 'error');
      return false;
    }

    // Deactivate current tool first
    if (this._current) {
      this.deactivate();
    }

    this._current = tool.id;
    this._currentTool = tool;

    // Set cursor
    if (tool.cursor) {
      const mapEl = document.getElementById('map');
      if (mapEl) {
        mapEl.style.cursor = tool.cursor;
      }
    }

    // Create OpenLayers interactions
    if (tool.interactions && this._map) {
      this._interactions = tool.interactions(options);
      this._interactions.forEach(i => this._map.addInteraction(i));
    }

    // Store overlays for cleanup
    if (tool.overlays && this._map) {
      this._overlays = tool.overlays(options);
      this._overlays.forEach(o => this._map.addOverlay(o));
    }

    // Call activate hook
    if (tool.activate) {
      tool.activate({
        map: this._map,
        ...options
      });
    }

    events.emit('maptool:activated', tool.id, tool);
    termPrint(`Tool: ${tool.name}`, 'dim');
    return true;
  },

  /**
   * Activate a tool by ID (looks up from toolbox)
   * @param {string} toolId - Tool ID
   * @param {Object} options - Tool options
   * @returns {boolean} Success
   */
  async activateById(toolId, options = {}) {
    const { toolbox } = await import('./toolbox.js');
    const tool = toolbox.get(toolId);

    if (!tool || tool.type !== 'interactive') {
      termPrint(`Invalid interactive tool: ${toolId}`, 'error');
      return false;
    }

    return this.activate(tool, options);
  },

  /**
   * Deactivate current tool
   */
  deactivate() {
    if (!this._current) return;

    const tool = this._currentTool;

    // Remove interactions
    if (this._map) {
      this._interactions.forEach(i => this._map.removeInteraction(i));
      this._overlays.forEach(o => this._map.removeOverlay(o));
    }
    this._interactions = [];
    this._overlays = [];

    // Reset cursor
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.style.cursor = '';
    }

    // Call deactivate hook
    if (tool?.deactivate) {
      tool.deactivate();
    }

    events.emit('maptool:deactivated', this._current);
    this._current = null;
    this._currentTool = null;
  },

  /**
   * Check if a tool is active
   * @param {string} toolId - Tool ID to check
   * @returns {boolean}
   */
  isActive(toolId) {
    return this._current === toolId;
  },

  /**
   * Cancel current operation
   */
  cancel() {
    const tool = this._currentTool;
    if (tool?.onCancel) {
      tool.onCancel();
    }
    this.deactivate();
    termPrint('Tool cancelled', 'dim');
  }
};

// ─────────────────────────────────────────────────────────────
// Built-in Interactive Tools
// ─────────────────────────────────────────────────────────────

/**
 * Select tool - click to select features
 */
export const selectTool = {
  id: 'select.click',
  name: 'Select Features',
  type: 'interactive',
  category: 'selection',
  cursor: 'pointer',

  _select: null,

  interactions: (options) => {
    const select = new ol.interaction.Select({
      condition: ol.events.condition.click,
      multi: options.multi || false,
      layers: options.layers || undefined,
    });

    select.on('select', (e) => {
      // Find which layer the selected features belong to
      e.selected.forEach(olFeature => {
        const layer = findLayerForOLFeature(olFeature);
        if (layer) {
          const id = olFeature.getId();
          if (id) {
            if (e.mapBrowserEvent?.originalEvent?.shiftKey) {
              layer.select(id, { add: true });
            } else {
              layer.select(id);
            }
          }
        }
      });

      e.deselected.forEach(olFeature => {
        const layer = findLayerForOLFeature(olFeature);
        if (layer) {
          const id = olFeature.getId();
          if (id) {
            layer.deselect(id);
          }
        }
      });
    });

    selectTool._select = select;
    return [select];
  },

  deactivate: () => {
    if (selectTool._select) {
      selectTool._select.getFeatures().clear();
      selectTool._select = null;
    }
  }
};

/**
 * Box select tool - drag to select features
 */
export const boxSelectTool = {
  id: 'select.box',
  name: 'Box Select',
  type: 'interactive',
  category: 'selection',
  cursor: 'crosshair',

  _dragBox: null,

  interactions: (options) => {
    const dragBox = new ol.interaction.DragBox({
      condition: ol.events.condition.platformModifierKeyOnly,
    });

    dragBox.on('boxend', () => {
      const extent = dragBox.getGeometry().getExtent();

      // Find features in the extent
      import('./api.js').then(({ ly }) => {
        for (const name in ly) {
          const layer = ly[name];
          if (layer.type === 'vector' && layer._source) {
            const features = [];
            layer._source.forEachFeatureInExtent(extent, (f) => {
              const geom = f.getGeometry();
              if (geom && ol.extent.intersects(extent, geom.getExtent())) {
                features.push(f.getId());
              }
            });
            if (features.length > 0) {
              layer.select(features);
            }
          }
        }
      });
    });

    boxSelectTool._dragBox = dragBox;
    return [dragBox];
  },

  deactivate: () => {
    boxSelectTool._dragBox = null;
  }
};

/**
 * Measure distance tool
 */
export const measureDistanceTool = {
  id: 'measure.distance',
  name: 'Measure Distance',
  type: 'interactive',
  category: 'measure',
  cursor: 'crosshair',

  _source: null,
  _layer: null,
  _draw: null,
  _sketch: null,
  _helpTooltip: null,
  _measureTooltip: null,

  interactions: (options) => {
    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source,
      style: measureStyle,
      zIndex: 9999,
    });

    import('../ui/map.js').then(({ getMap }) => {
      getMap().addLayer(vector);
    });

    measureDistanceTool._source = source;
    measureDistanceTool._layer = vector;

    const draw = new ol.interaction.Draw({
      source,
      type: 'LineString',
      style: measureStyle,
    });

    draw.on('drawstart', (e) => {
      measureDistanceTool._sketch = e.feature;

      e.feature.getGeometry().on('change', (evt) => {
        const geom = evt.target;
        const length = ol.sphere.getLength(geom);
        updateMeasureTooltip(formatLength(length));
      });
    });

    draw.on('drawend', () => {
      const geom = measureDistanceTool._sketch.getGeometry();
      const length = ol.sphere.getLength(geom);
      termPrint(`Distance: ${formatLength(length)}`, 'green');
      measureDistanceTool._sketch = null;
    });

    measureDistanceTool._draw = draw;
    return [draw];
  },

  deactivate: () => {
    if (measureDistanceTool._layer) {
      import('../ui/map.js').then(({ getMap }) => {
        getMap().removeLayer(measureDistanceTool._layer);
      });
    }
    measureDistanceTool._source = null;
    measureDistanceTool._layer = null;
    measureDistanceTool._draw = null;
    measureDistanceTool._sketch = null;
  }
};

/**
 * Measure area tool
 */
export const measureAreaTool = {
  id: 'measure.area',
  name: 'Measure Area',
  type: 'interactive',
  category: 'measure',
  cursor: 'crosshair',

  _source: null,
  _layer: null,
  _draw: null,
  _sketch: null,

  interactions: (options) => {
    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source,
      style: measureStyle,
      zIndex: 9999,
    });

    import('../ui/map.js').then(({ getMap }) => {
      getMap().addLayer(vector);
    });

    measureAreaTool._source = source;
    measureAreaTool._layer = vector;

    const draw = new ol.interaction.Draw({
      source,
      type: 'Polygon',
      style: measureStyle,
    });

    draw.on('drawstart', (e) => {
      measureAreaTool._sketch = e.feature;
    });

    draw.on('drawend', () => {
      const geom = measureAreaTool._sketch.getGeometry();
      const area = ol.sphere.getArea(geom);
      termPrint(`Area: ${formatArea(area)}`, 'green');
      measureAreaTool._sketch = null;
    });

    measureAreaTool._draw = draw;
    return [draw];
  },

  deactivate: () => {
    if (measureAreaTool._layer) {
      import('../ui/map.js').then(({ getMap }) => {
        getMap().removeLayer(measureAreaTool._layer);
      });
    }
    measureAreaTool._source = null;
    measureAreaTool._layer = null;
    measureAreaTool._draw = null;
    measureAreaTool._sketch = null;
  }
};

/**
 * Draw point tool
 */
export const drawPointTool = {
  id: 'sketching.point',
  name: 'Draw Point',
  type: 'interactive',
  category: 'sketching',
  cursor: 'crosshair',

  _draw: null,

  interactions: (options) => {
    const layer = options.layer;
    if (!layer || layer.type !== 'vector') {
      termPrint('Select a vector layer first', 'warn');
      return [];
    }

    if (!layer.isEditing) {
      layer.startEditing();
    }

    const draw = new ol.interaction.Draw({
      source: layer._source,
      type: 'Point',
    });

    draw.on('drawend', (e) => {
      const format = new ol.format.GeoJSON();
      const geojson = format.writeFeatureObject(e.feature, {
        featureProjection: 'EPSG:3857',
      });
      layer.addFeature(geojson.geometry, {});
    });

    const snap = new ol.interaction.Snap({ source: layer._source });

    drawPointTool._draw = draw;
    return [draw, snap];
  },

  deactivate: () => {
    drawPointTool._draw = null;
  }
};

/**
 * Draw line tool
 */
export const drawLineTool = {
  id: 'sketching.line',
  name: 'Draw Line',
  type: 'interactive',
  category: 'sketching',
  cursor: 'crosshair',

  _draw: null,

  interactions: (options) => {
    const layer = options.layer;
    if (!layer || layer.type !== 'vector') {
      termPrint('Select a vector layer first', 'warn');
      return [];
    }

    if (!layer.isEditing) {
      layer.startEditing();
    }

    const draw = new ol.interaction.Draw({
      source: layer._source,
      type: 'LineString',
    });

    draw.on('drawend', (e) => {
      const format = new ol.format.GeoJSON();
      const geojson = format.writeFeatureObject(e.feature, {
        featureProjection: 'EPSG:3857',
      });
      layer.addFeature(geojson.geometry, {});
    });

    const snap = new ol.interaction.Snap({ source: layer._source });

    drawLineTool._draw = draw;
    return [draw, snap];
  },

  deactivate: () => {
    drawLineTool._draw = null;
  }
};

/**
 * Draw polygon tool
 */
export const drawPolygonTool = {
  id: 'sketching.polygon',
  name: 'Draw Polygon',
  type: 'interactive',
  category: 'sketching',
  cursor: 'crosshair',

  _draw: null,

  interactions: (options) => {
    const layer = options.layer;
    if (!layer || layer.type !== 'vector') {
      termPrint('Select a vector layer first', 'warn');
      return [];
    }

    if (!layer.isEditing) {
      layer.startEditing();
    }

    const draw = new ol.interaction.Draw({
      source: layer._source,
      type: 'Polygon',
    });

    draw.on('drawend', (e) => {
      const format = new ol.format.GeoJSON();
      const geojson = format.writeFeatureObject(e.feature, {
        featureProjection: 'EPSG:3857',
      });
      layer.addFeature(geojson.geometry, {});
    });

    const snap = new ol.interaction.Snap({ source: layer._source });

    drawPolygonTool._draw = draw;
    return [draw, snap];
  },

  deactivate: () => {
    drawPolygonTool._draw = null;
  }
};

/**
 * Modify features tool
 */
export const modifyTool = {
  id: 'sketching.modify',
  name: 'Modify Features',
  type: 'interactive',
  category: 'sketching',
  cursor: 'pointer',

  _modify: null,
  _select: null,

  interactions: (options) => {
    const layer = options.layer;
    if (!layer || layer.type !== 'vector') {
      termPrint('Select a vector layer first', 'warn');
      return [];
    }

    if (!layer.isEditing) {
      layer.startEditing();
    }

    const select = new ol.interaction.Select({
      condition: ol.events.condition.click,
      layers: [layer._olLayer],
    });

    const modify = new ol.interaction.Modify({
      features: select.getFeatures(),
    });

    modify.on('modifyend', (e) => {
      e.features.forEach(olFeature => {
        const format = new ol.format.GeoJSON();
        const geojson = format.writeFeatureObject(olFeature, {
          featureProjection: 'EPSG:3857',
        });
        const id = olFeature.getId();
        if (id) {
          layer.updateFeature(id, { geometry: geojson.geometry });
        }
      });
    });

    const snap = new ol.interaction.Snap({ source: layer._source });

    modifyTool._modify = modify;
    modifyTool._select = select;

    return [select, modify, snap];
  },

  deactivate: () => {
    if (modifyTool._select) {
      modifyTool._select.getFeatures().clear();
    }
    modifyTool._modify = null;
    modifyTool._select = null;
  }
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Find which layer contains an OpenLayers feature
 */
async function findLayerForOLFeature(olFeature) {
  const { ly } = await import('./api.js');
  for (const name in ly) {
    const layer = ly[name];
    if (layer.type === 'vector' && layer._source) {
      if (layer._source.hasFeature(olFeature)) {
        return layer;
      }
    }
  }
  return null;
}

/**
 * Measure style
 */
const measureStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: 'rgba(255, 255, 0, 0.2)',
  }),
  stroke: new ol.style.Stroke({
    color: '#ffcc33',
    lineDash: [10, 10],
    width: 2,
  }),
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: '#ffcc33',
    }),
    fill: new ol.style.Fill({
      color: '#ffcc33',
    }),
  }),
});

/**
 * Format length for display
 */
function formatLength(length) {
  if (length > 1000) {
    return `${(length / 1000).toFixed(2)} km`;
  }
  return `${length.toFixed(1)} m`;
}

/**
 * Format area for display
 */
function formatArea(area) {
  if (area > 1000000) {
    return `${(area / 1000000).toFixed(2)} km\u00b2`;
  } else if (area > 10000) {
    return `${(area / 10000).toFixed(2)} ha`;
  }
  return `${area.toFixed(1)} m\u00b2`;
}

/**
 * Update measure tooltip (placeholder - could show tooltip on map)
 */
function updateMeasureTooltip(text) {
  // Could show a tooltip on the map
  // For now, just log to console for debugging
}

// Export all built-in tools
export const interactiveTools = {
  selectTool,
  boxSelectTool,
  measureDistanceTool,
  measureAreaTool,
  drawPointTool,
  drawLineTool,
  drawPolygonTool,
  modifyTool,
};
