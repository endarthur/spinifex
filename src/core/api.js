// Spinifex - Main API
// The sp namespace and all public API functions

import { events } from './events.js';  // Event bus (also sets window.events)
import { config } from './config.js';  // Centralized config (also sets window.config)
import { state } from './state.js';
import { Layer } from './layer.js';
import { sample, sampleStyles } from './sample-data.js';
import { loadGeoJSON } from '../formats/geojson.js';
import { applyStyle } from './styling.js';
import { loadFile, getFormatFromExtension, downloadShapefile, exportShapefile, downloadKml, exportKml, geojsonToKml } from '../formats/index.js';
import {
  buffer, intersect, union, centroid, clip, dissolve, voronoi,
  // Spatial queries
  within, contains, selectByLocation, disjoint, nearest,
  // Geoprocessing
  simplify, convexHull, envelope, difference, calcArea, calcLength, pointsAlongLine
} from './commands.js';
import { help } from './help.js';
import { getMap, setBasemap, listBasemaps } from '../ui/map.js';
import { termPrint, setExecuteCallback } from '../ui/terminal.js';
import { workspace, ws, fs, getDirectoryHandle } from './workspace.js';
import { measure, distance, area, bearing } from '../ui/measure.js';
import { openLegend, openWorkspacesWindow } from '../ui/windows.js';
import { BLEND_MODES } from './basemap-layer.js';
import { srtm } from '../data/srtm.js';
import { loadCOG } from '../formats/geotiff.js';
import {
  toCOG, downloadCOG, toGeoTiff, reproject, gdalInfo, ensureGdal, listDrivers,
  hillshade, slope, aspect, contours, rasterize, clip as gdalClip, mosaic, resample,
  convert, downloadVector, tri, tpi, roughness
} from '../raster/gdal.js';
import { calc, rasterOps, parseExpression } from '../raster/algebra.js';
import { idw, idwToBand, rbf } from '../raster/interpolation.js';
import { sampleRaster, generateSampleRaster } from './sample-raster.js';
import { RasterData } from './raster-data.js';
import { rc } from './settings.js';
import { versioning, v } from './versioning.js';
import { box, point, line, polygon, BoundingBox } from '../ui/input.js';
import { createTileLayer } from './tile-layer.js';
import { createGroupLayer } from './group-layer.js';
import { toolbox } from './toolbox.js';
import { widgets } from './widgets.js';
import { openToolPanel } from '../ui/tool-panel.js';
import { mapTools, interactiveTools } from './map-tools.js';
import {
  addColorRamp, removeColorRamp, getColorRamp, listColorRamps, isCustomRamp,
  createRamp, reverseRamp, interpolateColor, generatePalette, generatePaletteHex,
  parseColor, rgbToHex, colorScales, exportCustomRamps, importCustomRamps
} from './color-ramps.js';
import { crs, epsg } from './crs.js';

// === Layer namespace ===
// All layers are accessible via ly["name"] or ly.name (if valid identifier)
// This avoids polluting globals and handles any layer name
export const ly = {};

/**
 * Open recent workspaces window
 */
function workspaces() {
  openWorkspacesWindow();
}

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
 * Rename a layer
 * @param {Layer} layer - The layer to rename
 * @param {string} newName - New name for the layer
 */
function rename(layer, newName) {
  if (!layer || !layer._name) {
    termPrint('Usage: rename(layer, "newName")', 'yellow');
    return null;
  }

  if (!newName || typeof newName !== 'string') {
    termPrint('New name must be a non-empty string', 'red');
    return null;
  }

  // Check if new name already exists
  if (ly[newName]) {
    termPrint(`Layer "${newName}" already exists`, 'red');
    return null;
  }

  const oldName = layer._name;

  // Update ly namespace
  delete ly[oldName];
  ly[newName] = layer;

  // Update layer's internal name
  layer._name = newName;

  // Update layers panel
  import('../ui/layers-panel.js').then(({ updateLayerPanel }) => {
    updateLayerPanel();
  });

  // Update legend if visible
  import('../ui/windows.js').then(({ updateLegendContent }) => {
    updateLegendContent();
  });

  termPrint(`Renamed: "${oldName}" → "${newName}"`, 'green');
  return layer;
}

/**
 * Clear all layers
 */
function clear() {
  const map = getMap();
  state.layers.forEach(layer => {
    map.removeLayer(layer.olLayer);
    delete ly[layer.name];
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
 * Get current map bounding box in WGS84 [west, south, east, north]
 * Useful for passing to functions like sampleRaster({ extent: bbox() })
 */
function bbox() {
  const map = getMap();
  const extent = map.getView().calculateExtent(map.getSize());
  const wgs84 = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
  // Return as [west, south, east, north]
  return [wgs84[0], wgs84[1], wgs84[2], wgs84[3]];
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

  // Layer namespace - access all layers via ly["name"] or ly.name
  ly,

  // Core functions (also exposed as globals)
  load,
  open,
  layers,
  ls,
  clear,
  zoom,
  bbox,
  download,
  rename,
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

  // Spatial queries
  within,
  contains,
  selectByLocation,
  disjoint,
  nearest,

  // Geoprocessing
  simplify,
  convexHull,
  envelope,
  difference,
  calcArea,
  calcLength,
  pointsAlongLine,

  // Data sources
  srtm,
  cog: loadCOG,
  tile: createTileLayer,
  group: createGroupLayer,
  sampleRaster,
  RasterData,

  // GDAL operations
  gdal: {
    // Export
    toCOG,
    downloadCOG,
    toGeoTiff,
    downloadVector,
    convert,
    // Reproject & resample
    reproject,
    resample,
    // DEM analysis
    hillshade,
    slope,
    aspect,
    contours,
    tri,
    tpi,
    roughness,
    // Raster operations
    clip: gdalClip,
    mosaic,
    rasterize,
    // Utilities
    info: gdalInfo,
    drivers: listDrivers,
    load: ensureGdal
  },

  // Raster algebra
  calc,
  ...rasterOps,  // ndvi, ndwi, difference, ratio, threshold

  // Interpolation
  idw,
  idwToBand,
  rbf,

  // Export (pure JS)
  downloadShapefile,
  exportShapefile,
  downloadKml,
  exportKml,
  geojsonToKml,

  // Color ramps
  ramps: {
    add: addColorRamp,
    remove: removeColorRamp,
    get: getColorRamp,
    list: listColorRamps,
    isCustom: isCustomRamp,
    create: createRamp,
    reverse: reverseRamp,
    interpolate: interpolateColor,
    palette: generatePalette,
    paletteHex: generatePaletteHex,
    parseColor,
    rgbToHex,
    scales: colorScales,
    export: exportCustomRamps,
    import: importCustomRamps
  },
  addColorRamp,
  createRamp,
  listColorRamps,

  // CRS / Coordinate Reference Systems
  crs,    // crs.search(), crs.get(), crs.suggest(), crs.guess()
  epsg,   // epsg("search") or epsg(4326)

  // Map
  basemap: setBasemap,
  basemaps: listBasemaps,
  BLEND_MODES,  // Available blend mode names

  // Direct access for power users
  get map() { return getMap(); },
  state,
  turf: window.turf,
  ol: window.ol,

  // Workspace & File System
  workspace,
  ws,  // Shorthand for workspace
  fs,  // File system commands
  workspaces,  // Open recent workspaces window

  // Versioning
  versioning,
  v,  // Shorthand for versioning

  // Measurement
  measure,
  distance,
  area,
  bearing,

  // Runtime configuration (like matplotlib's rcParams)
  rc,

  // Interactive map input
  box,
  point,
  line,
  polygon,
  draw: { box, point, line, polygon },  // Namespace alias
  BoundingBox,

  // Tool system
  toolbox,
  widgets,
  run: (id, params) => toolbox.run(id, params),
  tools: openToolPanel,

  // Interactive map tools
  mapTools,
  sketching: {
    point: (layer) => mapTools.activate(interactiveTools.drawPointTool, { layer }),
    line: (layer) => mapTools.activate(interactiveTools.drawLineTool, { layer }),
    polygon: (layer) => mapTools.activate(interactiveTools.drawPolygonTool, { layer }),
    modify: (layer) => mapTools.activate(interactiveTools.modifyTool, { layer }),
    cancel: () => mapTools.cancel(),
  },
  selection: {
    click: () => mapTools.activate(interactiveTools.selectTool),
    box: () => mapTools.activate(interactiveTools.boxSelectTool),
  },
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
  // Sync ly object with current layers
  // Clear old entries
  for (const key of Object.keys(ly)) {
    if (!state.layers.has(key) && ![...state.layers.values()].find(l => l.name === key)) {
      delete ly[key];
    }
  }
  // Add current layers
  state.layers.forEach(layer => {
    ly[layer.name] = layer;
  });

  // Build context with all API functions as locals
  const context = {
    // Namespace
    sp,

    // Layer namespace - ly["name"] or ly.name
    ly,

    // Convenience globals
    sample,
    load,
    open,
    layers,
    ls,
    clear,
    zoom,
    bbox,
    download,
    rename,
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

    // Spatial queries
    within,
    contains,
    selectByLocation,
    disjoint,
    nearest,

    // Geoprocessing
    simplify,
    convexHull,
    envelope,
    difference,
    calcArea,
    calcLength,
    pointsAlongLine,

    // Data sources
    srtm,
    cog: loadCOG,
    sampleRaster,

    // GDAL operations
    gdal: {
      toCOG, downloadCOG, toGeoTiff, downloadVector, convert,
      reproject, resample,
      hillshade, slope, aspect, contours, tri, tpi, roughness,
      clip: gdalClip, mosaic, rasterize,
      info: gdalInfo, drivers: listDrivers, load: ensureGdal
    },

    // Raster algebra
    calc,
    ...rasterOps,  // ndvi, ndwi, difference, ratio, threshold

    // Measurement
    measure,
    distance,
    area,
    bearing,

    // Workspace & File System
    ws,
    workspace,
    fs,
    workspaces,

    // Versioning
    versioning,
    v,

    // Map
    basemap: setBasemap,
    basemaps: listBasemaps,

    // Libraries
    turf: window.turf,
    ol: window.ol,
    map: getMap(),
    state,

    // Layer class for instanceof checks
    Layer,

    // Constants
    BLEND_MODES,

    // Runtime configuration
    rc,

    // Interactive map input
    box,
    point,
    line,
    polygon,
    draw: { box, point, line, polygon },
    BoundingBox
  };

  // Helper to display results
  const displayResult = (result) => {
    if (result !== undefined && result !== null) {
      if (typeof result === 'function') {
        const name = result.name || 'anonymous';
        termPrint(`[Function: ${name}] - use ${name}() to call`, 'yellow');
      } else if (result instanceof Layer) {
        termPrint(result.toString(), 'cyan');
      } else if (Array.isArray(result) && result[0] instanceof Layer) {
        termPrint(`[${result.map(l => l.name).join(', ')}]`, 'cyan');
      } else if (result && result.constructor && result.constructor.name === 'BoundingBox') {
        termPrint(result.toString(), 'cyan');
      } else if (typeof result === 'object') {
        termPrint(formatObject(result), 'cyan');
      } else {
        termPrint(String(result), 'cyan');
      }
    }
  };

  // Check if code contains await (needs async wrapper)
  const hasAwait = /\bawait\b/.test(code);

  if (hasAwait) {
    // Wrap in async IIFE for top-level await support
    try {
      const fn = new Function(...Object.keys(context), `
        "use strict";
        return (async () => { return (${code}); })();
      `);
      const promise = fn(...Object.values(context));
      promise.then(displayResult).catch(e => {
        termPrint(`Error: ${e.message}`, 'red');
      });
    } catch (e) {
      // Try as async statement
      try {
        const fn = new Function(...Object.keys(context), `
          "use strict";
          return (async () => { ${code} })();
        `);
        fn(...Object.values(context)).catch(e2 => {
          termPrint(`Error: ${e2.message}`, 'red');
        });
      } catch (e2) {
        termPrint(`Error: ${e2.message}`, 'red');
      }
    }
  } else {
    // Sync code path (original behavior)
    try {
      const fn = new Function(...Object.keys(context), `
        "use strict";
        return (${code});
      `);
      const result = fn(...Object.values(context));
      displayResult(result);
    } catch (e) {
      // Try as statement
      try {
        const fn = new Function(...Object.keys(context), `
          "use strict";
          ${code}
        `);
        fn(...Object.values(context));
      } catch (e2) {
        termPrint(`Error: ${e2.message}`, 'red');
      }
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
window.bbox = bbox;
window.download = download;
window.rename = rename;
window.help = help;
window.buffer = buffer;
window.intersect = intersect;
window.union = union;
window.centroid = centroid;
window.clip = clip;
window.dissolve = dissolve;
window.voronoi = voronoi;
// Spatial queries
window.within = within;
window.contains = contains;
window.selectByLocation = selectByLocation;
window.disjoint = disjoint;
window.nearest = nearest;
// Geoprocessing
window.simplify = simplify;
window.convexHull = convexHull;
window.envelope = envelope;
window.difference = difference;
window.calcArea = calcArea;
window.calcLength = calcLength;
window.pointsAlongLine = pointsAlongLine;
window.srtm = srtm;
window.cog = loadCOG;
window.sampleRaster = sampleRaster;
window.RasterData = RasterData;
window.gdal = {
  // Export
  toCOG, downloadCOG, toGeoTiff, downloadVector, convert,
  // Reproject & resample
  reproject, resample,
  // DEM analysis
  hillshade, slope, aspect, contours, tri, tpi, roughness,
  // Raster operations
  clip: gdalClip, mosaic, rasterize,
  // Utilities
  info: gdalInfo, drivers: listDrivers, load: ensureGdal
};
window.calc = calc;
window.ndvi = rasterOps.ndvi;
window.ndwi = rasterOps.ndwi;
window.difference = rasterOps.difference;
window.ratio = rasterOps.ratio;
window.threshold = rasterOps.threshold;
window.idw = idw;
window.idwToBand = idwToBand;
window.rbf = rbf;
window.sample = sample;
window.measure = measure;
window.distance = distance;
window.area = area;
window.bearing = bearing;
window.ws = ws;
window.workspace = workspace;
window.fs = fs;
window.workspaces = workspaces;
window.basemap = setBasemap;
window.basemaps = listBasemaps;
window.BLEND_MODES = BLEND_MODES;
window.ly = ly;  // Layer namespace
window.rc = rc;  // Runtime configuration
window.versioning = versioning;  // Version control
window.v = v;  // Version control shorthand
window.crs = crs;  // CRS registry
window.epsg = epsg;  // EPSG search function

// Interactive map input
window.box = box;
window.point = point;
window.line = line;
window.polygon = polygon;
window.draw = { box, point, line, polygon };
window.BoundingBox = BoundingBox;
window.toolbox = toolbox;  // Tool registry
window.downloadShapefile = downloadShapefile;  // Pure JS shapefile export (with GDAL fallback)
window.exportShapefile = exportShapefile;  // Export GeoJSON to Shapefile blob
window.downloadKml = downloadKml;  // Export layer to KML
window.exportKml = exportKml;  // Export GeoJSON to KML blob
window.geojsonToKml = geojsonToKml;  // Convert GeoJSON to KML string
window.addColorRamp = addColorRamp;  // Add custom color ramp
window.createRamp = createRamp;  // Create ramp from colors
window.listColorRamps = listColorRamps;  // List available color ramps

// === Register Built-in Tools ===
// These wrap existing sp functions as schema-driven tools

toolbox.register({
  id: 'vector.buffer',
  name: 'Buffer',
  description: 'Create buffer zones around features',
  category: 'Vector',
  tags: ['geometry', 'proximity', 'analysis'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'distance', type: 'number', required: true, min: 0, description: 'Buffer distance in kilometers' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return buffer(params.layer, params.distance, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.dissolve',
  name: 'Dissolve',
  description: 'Merge features by attribute',
  category: 'Vector',
  tags: ['geometry', 'merge', 'aggregate'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'field', type: 'string', description: 'Field to dissolve by (optional)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return dissolve(params.layer, params.field || undefined, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.centroid',
  name: 'Centroid',
  description: 'Create centroid points from polygons',
  category: 'Vector',
  tags: ['geometry', 'points', 'conversion'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input polygon layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return centroid(params.layer, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.voronoi',
  name: 'Voronoi',
  description: 'Create Voronoi polygons from points',
  category: 'Vector',
  tags: ['geometry', 'tessellation', 'polygons'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input point layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return voronoi(params.layer, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.union',
  name: 'Union',
  description: 'Merge all features into a single feature',
  category: 'Vector',
  tags: ['geometry', 'merge', 'combine'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return union(params.layer, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.clip',
  name: 'Clip',
  description: 'Clip a layer by another polygon layer',
  category: 'Vector',
  tags: ['geometry', 'extract', 'overlay'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Layer to clip' },
    { name: 'clipLayer', type: 'layer', required: true, description: 'Clip boundary layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return clip(params.layer, params.clipLayer, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.intersect',
  name: 'Intersect',
  description: 'Find intersection between two layers',
  category: 'Vector',
  tags: ['geometry', 'overlay', 'analysis'],
  parameters: [
    { name: 'layer1', type: 'layer', required: true, description: 'First layer' },
    { name: 'layer2', type: 'layer', required: true, description: 'Second layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return intersect(params.layer1, params.layer2, params.outputName || undefined);
  },
});

toolbox.register({
  id: 'vector.difference',
  name: 'Difference',
  description: 'Subtract one layer from another',
  category: 'Vector',
  tags: ['geometry', 'overlay', 'erase', 'subtract'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'subtractLayer', type: 'layer', required: true, description: 'Layer to subtract' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return difference(params.layer, params.subtractLayer, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'vector.simplify',
  name: 'Simplify',
  description: 'Reduce vertices using Douglas-Peucker algorithm',
  category: 'Vector',
  tags: ['geometry', 'generalize', 'reduce', 'smooth'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'tolerance', type: 'number', default: 0.001, min: 0, description: 'Simplification tolerance (degrees)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return simplify(params.layer, params.tolerance, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'vector.convexHull',
  name: 'Convex Hull',
  description: 'Create convex hull polygon(s)',
  category: 'Vector',
  tags: ['geometry', 'envelope', 'boundary', 'polygon'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'combine', type: 'boolean', default: true, description: 'Combine into single hull' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return convexHull(params.layer, { combine: params.combine, name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'vector.envelope',
  name: 'Bounding Box',
  description: 'Create bounding box polygon(s)',
  category: 'Vector',
  tags: ['geometry', 'extent', 'bbox', 'rectangle'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input layer' },
    { name: 'perFeature', type: 'boolean', default: false, description: 'Create box per feature' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return envelope(params.layer, { perFeature: params.perFeature, name: params.outputName || undefined });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Spatial Query Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'query.within',
  name: 'Select Within',
  description: 'Select features that fall within a mask polygon',
  category: 'Selection',
  tags: ['spatial', 'query', 'filter', 'contains'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Layer to query' },
    { name: 'maskLayer', type: 'layer', required: true, description: 'Mask polygon layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return within(params.layer, params.maskLayer, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'query.contains',
  name: 'Select Contains',
  description: 'Select features that contain other features',
  category: 'Selection',
  tags: ['spatial', 'query', 'filter'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Container layer' },
    { name: 'containedLayer', type: 'layer', required: true, description: 'Contained features layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return contains(params.layer, params.containedLayer, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'query.selectByLocation',
  name: 'Select by Location',
  description: 'Select features that intersect a mask',
  category: 'Selection',
  tags: ['spatial', 'query', 'filter', 'intersect'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Layer to query' },
    { name: 'maskLayer', type: 'layer', required: true, description: 'Selection mask layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return selectByLocation(params.layer, params.maskLayer, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'query.disjoint',
  name: 'Select Disjoint',
  description: 'Select features that do NOT intersect a mask',
  category: 'Selection',
  tags: ['spatial', 'query', 'filter', 'exclude'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Layer to query' },
    { name: 'maskLayer', type: 'layer', required: true, description: 'Exclusion mask layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return disjoint(params.layer, params.maskLayer, { name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'query.nearest',
  name: 'Nearest Features',
  description: 'Find nearest features between two layers',
  category: 'Selection',
  tags: ['spatial', 'proximity', 'distance', 'closest'],
  parameters: [
    { name: 'sourceLayer', type: 'layer', required: true, description: 'Source layer' },
    { name: 'targetLayer', type: 'layer', required: true, description: 'Target layer to find nearest' },
    { name: 'maxDistance', type: 'number', default: 0, min: 0, description: 'Max distance in km (0=unlimited)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return nearest(params.sourceLayer, params.targetLayer, {
      maxDistance: params.maxDistance > 0 ? params.maxDistance : undefined,
      name: params.outputName || undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Measurement Tools (Vector)
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'vector.calcArea',
  name: 'Calculate Area',
  description: 'Add area field to polygon features',
  category: 'Vector',
  tags: ['measurement', 'area', 'size', 'attribute'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Polygon layer' },
    { name: 'units', type: 'select', default: 'sqkm', options: [
      { value: 'sqkm', label: 'Square Kilometers' },
      { value: 'sqm', label: 'Square Meters' },
      { value: 'ha', label: 'Hectares' },
      { value: 'acres', label: 'Acres' },
    ], description: 'Area units' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return calcArea(params.layer, { units: params.units, name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'vector.calcLength',
  name: 'Calculate Length',
  description: 'Add length field to line features',
  category: 'Vector',
  tags: ['measurement', 'length', 'distance', 'attribute'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Line layer' },
    { name: 'units', type: 'select', default: 'km', options: [
      { value: 'km', label: 'Kilometers' },
      { value: 'm', label: 'Meters' },
      { value: 'mi', label: 'Miles' },
    ], description: 'Length units' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return calcLength(params.layer, { units: params.units, name: params.outputName || undefined });
  },
});

toolbox.register({
  id: 'vector.pointsAlongLine',
  name: 'Points Along Line',
  description: 'Create points at regular intervals along lines',
  category: 'Vector',
  tags: ['geometry', 'sample', 'interpolate', 'points'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Line layer' },
    { name: 'distance', type: 'number', default: 1, min: 0.001, description: 'Distance between points (km)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return pointsAlongLine(params.layer, params.distance, { name: params.outputName || undefined });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Raster Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'raster.hillshade',
  name: 'Hillshade',
  description: 'Generate shaded relief from a DEM',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'visualization'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'azimuth', type: 'number', default: 315, min: 0, max: 360, description: 'Light source azimuth (degrees)' },
    { name: 'altitude', type: 'number', default: 45, min: 0, max: 90, description: 'Light source altitude (degrees)' },
    { name: 'zFactor', type: 'number', default: 1, min: 0.1, max: 10, description: 'Vertical exaggeration' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return hillshade(params.layer, {
      azimuth: params.azimuth,
      altitude: params.altitude,
      zFactor: params.zFactor,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.slope',
  name: 'Slope',
  description: 'Calculate slope from a DEM',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'analysis'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'units', type: 'select', default: 'degrees', options: [
      { value: 'degrees', label: 'Degrees' },
      { value: 'percent', label: 'Percent Rise' },
    ], description: 'Output units' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return slope(params.layer, {
      units: params.units,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.aspect',
  name: 'Aspect',
  description: 'Calculate aspect (slope direction) from a DEM',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'direction'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return aspect(params.layer, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.contours',
  name: 'Contours',
  description: 'Generate contour lines from a DEM',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'isolines', 'vector'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'interval', type: 'number', default: 100, min: 1, description: 'Contour interval' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return contours(params.layer, {
      interval: params.interval,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.tri',
  name: 'Terrain Ruggedness Index',
  description: 'Calculate TRI (mean elevation difference from neighbors)',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'ruggedness', 'analysis'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return tri(params.layer, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.tpi',
  name: 'Topographic Position Index',
  description: 'Calculate TPI (elevation relative to neighborhood mean)',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'position', 'analysis'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return tpi(params.layer, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.roughness',
  name: 'Roughness',
  description: 'Calculate surface roughness from a DEM',
  category: 'Raster',
  tags: ['terrain', 'dem', 'elevation', 'texture', 'analysis'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input DEM layer' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return roughness(params.layer, {
      name: params.outputName || undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'interpolation.idw',
  name: 'IDW Interpolation',
  description: 'Create a continuous surface from point data using Inverse Distance Weighting',
  category: 'Interpolation',
  tags: ['interpolation', 'idw', 'surface', 'points', 'raster'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input point layer' },
    { name: 'field', type: 'string', required: true, description: 'Attribute field to interpolate' },
    { name: 'power', type: 'number', default: 2, min: 0.5, max: 6, description: 'Distance weighting power (higher = more local)' },
    { name: 'resolution', type: 'integer', default: 100, min: 10, max: 1000, description: 'Output raster width in pixels' },
    { name: 'searchRadius', type: 'number', default: 0, min: 0, description: 'Max search distance in degrees (0 = unlimited)' },
    { name: 'maxPoints', type: 'integer', default: 0, min: 0, description: 'Max points to use per cell (0 = all)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return idw(params.layer, {
      field: params.field,
      power: params.power,
      resolution: params.resolution,
      searchRadius: params.searchRadius > 0 ? params.searchRadius : Infinity,
      maxPoints: params.maxPoints > 0 ? params.maxPoints : Infinity,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'interpolation.rbf',
  name: 'RBF Interpolation',
  description: 'Create a smooth continuous surface from point data using Radial Basis Functions',
  category: 'Interpolation',
  tags: ['interpolation', 'rbf', 'surface', 'points', 'raster', 'smooth'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input point layer' },
    { name: 'field', type: 'string', required: true, description: 'Attribute field to interpolate' },
    { name: 'kernel', type: 'select', default: 'gaussian', options: [
      { value: 'gaussian', label: 'Gaussian (smooth, local)' },
      { value: 'multiquadric', label: 'Multiquadric (smooth, global)' },
      { value: 'inverse_multiquadric', label: 'Inverse Multiquadric (smooth, local)' },
      { value: 'thin_plate', label: 'Thin Plate Spline (smooth surface)' },
      { value: 'linear', label: 'Linear (piecewise)' },
    ], description: 'Kernel function type' },
    { name: 'resolution', type: 'integer', default: 100, min: 10, max: 500, description: 'Output raster width in pixels' },
    { name: 'smooth', type: 'number', default: 0, min: 0, max: 10, description: 'Smoothing factor (0 = exact interpolation)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rbf(params.layer, {
      field: params.field,
      kernel: params.kernel,
      resolution: params.resolution,
      smooth: params.smooth,
      name: params.outputName || undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GDAL Processing Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'raster.reproject',
  name: 'Reproject',
  description: 'Reproject raster to a different coordinate system',
  category: 'Raster',
  tags: ['crs', 'projection', 'transform', 'gdal'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input raster layer' },
    { name: 'targetCRS', type: 'string', required: true, default: 'EPSG:4326', description: 'Target CRS (e.g., EPSG:4326)' },
    { name: 'resampling', type: 'select', default: 'bilinear', options: [
      { value: 'nearest', label: 'Nearest Neighbor' },
      { value: 'bilinear', label: 'Bilinear' },
      { value: 'cubic', label: 'Cubic' },
      { value: 'lanczos', label: 'Lanczos' },
    ], description: 'Resampling method' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return reproject(params.layer, params.targetCRS, {
      resampling: params.resampling,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.resample',
  name: 'Resample',
  description: 'Change raster resolution',
  category: 'Raster',
  tags: ['resolution', 'scale', 'gdal'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input raster layer' },
    { name: 'resolution', type: 'number', required: true, min: 0.1, description: 'Target resolution' },
    { name: 'method', type: 'select', default: 'bilinear', options: [
      { value: 'nearest', label: 'Nearest Neighbor' },
      { value: 'bilinear', label: 'Bilinear' },
      { value: 'cubic', label: 'Cubic' },
      { value: 'average', label: 'Average' },
    ], description: 'Resampling method' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return resample(params.layer, {
      resolution: params.resolution,
      method: params.method,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.clip',
  name: 'Clip Raster',
  description: 'Clip raster by vector boundary',
  category: 'Raster',
  tags: ['extract', 'mask', 'crop', 'gdal'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Raster layer to clip' },
    { name: 'clipLayer', type: 'layer', required: true, description: 'Vector clip boundary' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return gdalClip(params.layer, params.clipLayer, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.mosaic',
  name: 'Mosaic',
  description: 'Combine multiple rasters into one',
  category: 'Raster',
  tags: ['merge', 'combine', 'stitch', 'gdal'],
  parameters: [
    { name: 'layers', type: 'string', required: true, description: 'Comma-separated layer names to mosaic' },
    { name: 'resampling', type: 'select', default: 'bilinear', options: [
      { value: 'nearest', label: 'Nearest Neighbor' },
      { value: 'bilinear', label: 'Bilinear' },
      { value: 'cubic', label: 'Cubic' },
    ], description: 'Resampling method' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    // Parse layer names and get layer objects
    const layerNames = params.layers.split(',').map(n => n.trim());
    const layers = layerNames.map(name => {
      const layer = context.layers?.get(name) || window.ly?.[name];
      if (!layer) throw new Error(`Layer not found: ${name}`);
      return layer;
    });
    return mosaic(layers, {
      resampling: params.resampling,
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.rasterize',
  name: 'Rasterize',
  description: 'Convert vector layer to raster',
  category: 'Raster',
  tags: ['convert', 'vector', 'gdal'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Vector layer to rasterize' },
    { name: 'resolution', type: 'number', default: 100, min: 1, description: 'Output resolution' },
    { name: 'attribute', type: 'string', default: '', description: 'Attribute field to burn (optional)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterize(params.layer, {
      resolution: params.resolution,
      attribute: params.attribute || undefined,
      name: params.outputName || undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Raster Algebra Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'raster.calc',
  name: 'Raster Calculator',
  description: 'Apply mathematical expression to rasters',
  category: 'Raster',
  tags: ['algebra', 'math', 'expression', 'calculate'],
  parameters: [
    { name: 'expression', type: 'string', required: true, description: 'Expression (e.g., "a + b", "a * 2")' },
    { name: 'layerA', type: 'layer', required: true, description: 'Layer "a" in expression' },
    { name: 'layerB', type: 'layer', description: 'Layer "b" in expression (optional)' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    const inputs = { a: params.layerA };
    if (params.layerB) inputs.b = params.layerB;
    return calc(params.expression, inputs, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.ndvi',
  name: 'NDVI',
  description: 'Normalized Difference Vegetation Index',
  category: 'Raster',
  tags: ['vegetation', 'index', 'remote sensing', 'spectral'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Multi-band raster' },
    { name: 'nirBand', type: 'integer', default: 4, min: 1, description: 'NIR band number' },
    { name: 'redBand', type: 'integer', default: 3, min: 1, description: 'Red band number' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterOps.ndvi(params.layer, params.nirBand, params.redBand, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.ndwi',
  name: 'NDWI',
  description: 'Normalized Difference Water Index',
  category: 'Raster',
  tags: ['water', 'index', 'remote sensing', 'spectral'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Multi-band raster' },
    { name: 'greenBand', type: 'integer', default: 2, min: 1, description: 'Green band number' },
    { name: 'nirBand', type: 'integer', default: 4, min: 1, description: 'NIR band number' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterOps.ndwi(params.layer, params.greenBand, params.nirBand, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.difference',
  name: 'Raster Difference',
  description: 'Calculate difference between two rasters',
  category: 'Raster',
  tags: ['change', 'subtract', 'compare'],
  parameters: [
    { name: 'layer1', type: 'layer', required: true, description: 'First raster' },
    { name: 'layer2', type: 'layer', required: true, description: 'Second raster' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterOps.difference(params.layer1, params.layer2, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.ratio',
  name: 'Band Ratio',
  description: 'Calculate ratio between two bands',
  category: 'Raster',
  tags: ['bands', 'ratio', 'spectral'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Multi-band raster' },
    { name: 'band1', type: 'integer', required: true, min: 1, description: 'Numerator band' },
    { name: 'band2', type: 'integer', required: true, min: 1, description: 'Denominator band' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterOps.ratio(params.layer, params.band1, params.band2, {
      name: params.outputName || undefined,
    });
  },
});

toolbox.register({
  id: 'raster.threshold',
  name: 'Threshold',
  description: 'Binary classification by threshold value',
  category: 'Raster',
  tags: ['classify', 'binary', 'mask'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Input raster' },
    { name: 'value', type: 'number', required: true, description: 'Threshold value' },
    { name: 'outputName', type: 'string', default: '', description: 'Output layer name' },
  ],
  execute: async (params, context) => {
    return rasterOps.threshold(params.layer, params.value, {
      name: params.outputName || undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Export Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'export.geotiff',
  name: 'Export GeoTIFF',
  description: 'Download raster as GeoTIFF file',
  category: 'Export',
  tags: ['download', 'save', 'tiff', 'raster'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Raster layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    return downloadCOG(params.layer, params.filename || undefined);
  },
});

toolbox.register({
  id: 'export.cog',
  name: 'Export Cloud Optimized GeoTIFF',
  description: 'Convert and download as COG',
  category: 'Export',
  tags: ['download', 'cog', 'cloud', 'optimized'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Raster layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    const cog = await toCOG(params.layer);
    return downloadCOG(cog, params.filename || undefined);
  },
});

toolbox.register({
  id: 'export.geojson',
  name: 'Export GeoJSON',
  description: 'Download vector layer as GeoJSON',
  category: 'Export',
  tags: ['download', 'save', 'vector', 'json'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Vector layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    const layer = params.layer;
    const data = JSON.stringify(layer.geojson || layer._geojson, null, 2);
    const blob = new Blob([data], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = params.filename || `${layer.name || layer._name}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    termPrint(`Downloaded: ${a.download}`, 'green');
    return a.download;
  },
});

toolbox.register({
  id: 'export.shapefile',
  name: 'Export Shapefile',
  description: 'Download vector layer as Shapefile (zip) - uses pure JS, falls back to GDAL',
  category: 'Export',
  tags: ['download', 'save', 'vector', 'shp', 'esri'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Vector layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    return downloadShapefile(params.layer, params.filename || undefined);
  },
});

toolbox.register({
  id: 'export.gpkg',
  name: 'Export GeoPackage',
  description: 'Download vector layer as GeoPackage',
  category: 'Export',
  tags: ['download', 'save', 'vector', 'geopackage'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Vector layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    return downloadVector(params.layer, 'gpkg', params.filename || undefined);
  },
});

toolbox.register({
  id: 'export.kml',
  name: 'Export KML',
  description: 'Download vector layer as KML (Google Earth format)',
  category: 'Export',
  tags: ['download', 'save', 'vector', 'google', 'earth', 'xml'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Vector layer to export' },
    { name: 'filename', type: 'string', default: '', description: 'Output filename' },
  ],
  execute: async (params, context) => {
    return downloadKml(params.layer, params.filename || undefined);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Measurement Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'measure.distance',
  name: 'Measure Distance',
  description: 'Measure distance on the map',
  category: 'Measurement',
  tags: ['length', 'line', 'interactive'],
  parameters: [],
  execute: async (params, context) => {
    return measure('distance');
  },
});

toolbox.register({
  id: 'measure.area',
  name: 'Measure Area',
  description: 'Measure area on the map',
  category: 'Measurement',
  tags: ['polygon', 'size', 'interactive'],
  parameters: [],
  execute: async (params, context) => {
    return measure('area');
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility Tools
// ─────────────────────────────────────────────────────────────────────────────

toolbox.register({
  id: 'util.info',
  name: 'Layer Info',
  description: 'Show detailed layer information',
  category: 'Utilities',
  tags: ['metadata', 'properties', 'inspect'],
  parameters: [
    { name: 'layer', type: 'layer', required: true, description: 'Layer to inspect' },
  ],
  execute: async (params, context) => {
    const layer = params.layer;
    const info = {
      name: layer.name || layer._name,
      type: layer.type,
    };

    if (layer.type === 'vector') {
      info.featureCount = layer.count;
      info.geometryType = layer.geomType;
      info.fields = layer.fields;
      info.extent = layer.extent;
    } else if (layer.type === 'raster') {
      info.width = layer.width || layer._metadata?.width;
      info.height = layer.height || layer._metadata?.height;
      info.bands = layer._data?.length || 1;
      info.extent = layer._metadata?.extent;
    }

    termPrint(JSON.stringify(info, null, 2), 'cyan');
    return info;
  },
});

// Named exports for internal use (e.g., layer.save() imports load, workspace imports clear)
export { load, clear, mapTools, interactiveTools };
