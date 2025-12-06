// Spinifex - Main API
// The sp namespace and all public API functions

import { state } from './state.js';
import { Layer } from './layer.js';
import { sample, sampleStyles } from './sample-data.js';
import { loadGeoJSON } from '../formats/geojson.js';
import { applyStyle } from './styling.js';
import { loadFile, getFormatFromExtension } from '../formats/index.js';
import { buffer, intersect, union, centroid, clip, dissolve, voronoi } from './commands.js';
import { help } from './help.js';
import { getMap } from '../ui/map.js';
import { termPrint, setExecuteCallback } from '../ui/terminal.js';
import { workspace, ws } from './workspace.js';
import { measure, distance, area, bearing } from '../ui/measure.js';
import { openLegend } from '../ui/windows.js';

/**
 * Load data into Spinifex
 */
function load(data, name) {
  if (data === sample) {
    const results = [];
    for (const [key, geojson] of Object.entries(sample)) {
      const layer = loadGeoJSON(key, geojson);
      // Apply built-in style if available
      if (sampleStyles[key]) {
        applyStyle(layer, sampleStyles[key]);
        layer._styleOpts = sampleStyles[key];
      }
      results.push(layer);
    }
    if (results.length > 0) results[0].zoom();
    termPrint(`Loaded ${results.length} layers: ${results.map(l => l.name).join(', ')}`, 'green');
    return results;
  }

  if (typeof data === 'object' && data.type === 'FeatureCollection') {
    const layer = loadGeoJSON(name || `layer_${state.layerCounter}`, data);
    termPrint(`Loaded: ${layer.name} (${layer.count} features)`, 'green');
    return layer;
  }

  termPrint('Usage: load(geojson, "name") or load(sample)', 'yellow');
  return null;
}

/**
 * Open file picker to load geospatial data
 */
async function open() {
  // Check for File System Access API
  if (!window.showOpenFilePicker) {
    termPrint('File picker not supported in this browser (use Chrome/Edge)', 'red');
    termPrint('Drag & drop files onto the map instead.', 'yellow');
    return null;
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Geospatial files',
          accept: {
            'application/json': ['.geojson', '.json'],
            'application/geo+json': ['.geojson'],
            'text/csv': ['.csv', '.tsv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/zip': ['.zip'],
            'image/tiff': ['.tif', '.tiff']
          }
        }
      ],
      multiple: false
    });

    const file = await fileHandle.getFile();
    termPrint(`Opening: ${file.name}`, 'dim');

    // Determine format and subfolder
    const format = getFormatFromExtension(file.name);
    const subfolder = format === 'geotiff' ? 'rasters' : 'vectors';
    let sourcePath = null;

    // If workspace connected, copy file to project folder
    if (ws.connected) {
      try {
        const content = await file.arrayBuffer();
        const destPath = `${subfolder}/${file.name}`;
        await ws.writeFile(destPath, content);
        sourcePath = destPath;
        termPrint(`Copied to project: ${destPath}`, 'dim');
      } catch (e) {
        termPrint(`Could not copy to project: ${e.message}`, 'yellow');
      }
    }

    const result = await loadFile(file);
    if (result) {
      const layers = Array.isArray(result) ? result : [result];
      for (const layer of layers) {
        if (layer) {
          // Set source path if we copied the file
          if (sourcePath && layer.setSource) {
            layer.setSource(sourcePath, format);
          }
          if (layer.zoom) {
            layer.zoom();
          }
        }
      }
    }
    return result;
  } catch (e) {
    if (e.name !== 'AbortError') {
      termPrint(`Error: ${e.message}`, 'red');
    }
    return null;
  }
}

/**
 * List all layers
 */
function layers() {
  const list = [];
  state.layers.forEach(l => list.push(l));
  return list;
}

/**
 * Alias for layers()
 */
function ls() {
  return layers();
}

/**
 * Clear all layers
 */
function clear() {
  const map = getMap();
  state.layers.forEach(layer => {
    map.removeLayer(layer.olLayer);
    delete sp[layer.name];
  });
  state.layers.clear();
  import('../ui/layers-panel.js').then(({ updateLayerPanel }) => {
    updateLayerPanel();
  });
  termPrint('Cleared all layers.', 'yellow');
}

/**
 * Zoom to a layer or extent
 */
function zoom(target) {
  if (target instanceof Layer) {
    target.zoom();
  } else if (Array.isArray(target) && target.length === 4) {
    const ext = ol.proj.transformExtent(target, 'EPSG:4326', 'EPSG:3857');
    getMap().getView().fit(ext, { padding: [50, 50, 50, 50], duration: 500 });
  }
  return target;
}

/**
 * Download a layer as GeoJSON
 */
function download(layer, filename) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: download(layer, "filename.geojson")', 'red');
    return;
  }
  const data = JSON.stringify(layer.geojson, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${layer.name}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
  termPrint(`Exported: ${a.download}`, 'green');
}

// === The sp namespace ===
// Contains all API functions and will have layers added dynamically

export const sp = {
  // Data
  sample,

  // Core functions (also exposed as globals)
  load,
  open,
  layers,
  ls,
  clear,
  zoom,
  download,
  help,
  json,
  legend: openLegend,

  // Spatial operations
  buffer,
  intersect,
  union,
  centroid,
  clip,
  dissolve,
  voronoi,

  // Direct access for power users
  get map() { return getMap(); },
  state,
  turf: window.turf,
  ol: window.ol,

  // Workspace
  workspace,
  ws,  // Shorthand for workspace

  // Measurement
  measure,
  distance,
  area,
  bearing,

  // CRS
  crs: {
    set: (code) => {
      state.crs = code;
      document.getElementById('status-crs').textContent = code;
      termPrint(`CRS set to ${code}`, 'green');
    },
    get: () => state.crs,
    transform: (layer, targetCrs) => {
      termPrint('CRS transform not yet implemented', 'yellow');
      return layer;
    }
  }
};

// === JavaScript REPL Executor ===

/**
 * Format an object for compact terminal display
 */
function formatObject(obj, maxDepth = 3, maxItems = 8, maxLen = 60) {
  const seen = new WeakSet();

  function format(val, depth) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';

    const type = typeof val;
    if (type === 'string') {
      const truncated = val.length > maxLen ? val.slice(0, maxLen - 3) + '...' : val;
      return `"${truncated}"`;
    }
    if (type === 'number' || type === 'boolean') return String(val);
    if (type === 'function') return `[Function: ${val.name || 'anonymous'}]`;

    if (type !== 'object') return String(val);

    // Prevent circular references
    if (seen.has(val)) return '[Circular]';
    seen.add(val);

    // Handle GeoJSON FeatureCollection specially - show as summary
    if (val.type === 'FeatureCollection' && Array.isArray(val.features)) {
      const count = val.features.length;
      const geomTypes = [...new Set(val.features.map(f => f.geometry?.type).filter(Boolean))];
      return `FeatureCollection(${count} ${geomTypes.join('/')})`;
    }

    // Handle GeoJSON Feature specially
    if (val.type === 'Feature' && val.geometry) {
      const propKeys = Object.keys(val.properties || {});
      return `Feature<${val.geometry.type}>{${propKeys.slice(0, 3).join(', ')}${propKeys.length > 3 ? '...' : ''}}`;
    }

    // Depth limit
    if (depth >= maxDepth) {
      return Array.isArray(val) ? `Array(${val.length})` : `Object(${Object.keys(val).length})`;
    }

    // Arrays
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.slice(0, maxItems).map(v => format(v, depth + 1));
      const suffix = val.length > maxItems ? `, +${val.length - maxItems}` : '';
      return `[${items.join(', ')}${suffix}]`;
    }

    // Objects
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    const items = keys.slice(0, maxItems).map(k => `${k}: ${format(val[k], depth + 1)}`);
    const suffix = keys.length > maxItems ? `, +${keys.length - maxItems}` : '';
    return `{${items.join(', ')}${suffix}}`;
  }

  return format(obj, 0);
}

/**
 * Print full JSON of an object (use when you need to see everything)
 */
function json(obj, indent = 2) {
  termPrint(JSON.stringify(obj, null, indent), 'cyan');
}

function executeJS(code) {
  // Build context with all API functions as locals
  const context = {
    // Namespace
    sp,

    // Convenience globals
    sample,
    load,
    open,
    layers,
    ls,
    clear,
    zoom,
    download,
    help,
    json,
    legend: openLegend,
    buffer,
    intersect,
    union,
    centroid,
    clip,
    dissolve,
    voronoi,

    // Measurement
    measure,
    distance,
    area,
    bearing,

    // Workspace
    ws,
    workspace,

    // Libraries
    turf: window.turf,
    ol: window.ol,
    map: getMap(),
    state,

    // Layer class for instanceof checks
    Layer
  };

  // Add all current layers to context
  state.layers.forEach(layer => {
    context[layer.name] = layer;
  });

  try {
    // Try as expression first
    const fn = new Function(...Object.keys(context), `
      "use strict";
      return (${code});
    `);
    const result = fn(...Object.values(context));

    if (result !== undefined && result !== null) {
      if (typeof result === 'function') {
        // Don't print raw function source - show helpful message
        const name = result.name || 'anonymous';
        termPrint(`[Function: ${name}] - use ${name}() to call`, 'yellow');
      } else if (result instanceof Layer) {
        termPrint(result.toString(), 'cyan');
      } else if (Array.isArray(result) && result[0] instanceof Layer) {
        termPrint(`[${result.map(l => l.name).join(', ')}]`, 'cyan');
      } else if (typeof result === 'object') {
        termPrint(formatObject(result), 'cyan');
      } else {
        termPrint(String(result), 'cyan');
      }
    }
  } catch (e) {
    // Try as statement
    try {
      const fn = new Function(...Object.keys(context), `
        "use strict";
        ${code}
      `);
      fn(...Object.values(context));
    } catch (e2) {
      termPrint(`Error: ${e.message}`, 'red');
    }
  }
}

// Register the executor with the terminal
setExecuteCallback(executeJS);

// Debug function to test terminal width
function testWidth() {
  const widths = [40, 60, 80, 100, 120];
  termPrint('Testing terminal line width:', 'yellow');
  termPrint('');
  widths.forEach(w => {
    termPrint(`${'='.repeat(w)} (${w} chars)`);
  });
  termPrint('');
  termPrint('0123456789'.repeat(12) + ' (120 chars)');
  termPrint('');
  termPrint('If lines wrap before the edge, wordWrap may be too aggressive.', 'dim');
}
window.testWidth = testWidth;

// Expose API globally for convenience
window.sp = sp;
window.load = load;
window.spOpen = open;  // Don't override window.open (browser native)
window.layers = layers;
window.ls = ls;
window.clear = clear;
window.zoom = zoom;
window.download = download;
window.help = help;
window.buffer = buffer;
window.intersect = intersect;
window.union = union;
window.centroid = centroid;
window.clip = clip;
window.dissolve = dissolve;
window.voronoi = voronoi;
window.sample = sample;
window.measure = measure;
window.distance = distance;
window.area = area;
window.bearing = bearing;
window.ws = ws;
window.workspace = workspace;
