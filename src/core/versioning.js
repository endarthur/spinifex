// Spinifex - Versioning Module
// Lightweight git-like versioning for projects

import { state } from './state.js';
import { termPrint } from '../ui/terminal.js';

// Version storage folder name
const VERSIONS_FOLDER = '.versions';
const MANIFEST_FILE = 'manifest.json';

/**
 * Compress text using CompressionStream API
 * Falls back to uncompressed if not available
 */
async function compress(text) {
  if (typeof CompressionStream === 'undefined') {
    return { data: text, compressed: false };
  }

  try {
    const blob = new Blob([text]);
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(stream).blob();
    const buffer = await compressedBlob.arrayBuffer();
    return { data: buffer, compressed: true };
  } catch (e) {
    // Compression failed, store uncompressed
    return { data: text, compressed: false };
  }
}

/**
 * Decompress data
 */
async function decompress(data, isCompressed) {
  if (!isCompressed || typeof DecompressionStream === 'undefined') {
    return typeof data === 'string' ? data : new TextDecoder().decode(data);
  }

  try {
    const blob = new Blob([data]);
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressedBlob = await new Response(stream).blob();
    return await decompressedBlob.text();
  } catch (e) {
    // Decompression failed, return raw data
    return typeof data === 'string' ? data : new TextDecoder().decode(data);
  }
}

/**
 * Get workspace module (lazy import to avoid circular deps)
 */
async function getWorkspace() {
  const { workspace } = await import('./workspace.js');
  return workspace;
}

/**
 * Get the map module
 */
async function getMapModule() {
  return await import('../ui/map.js');
}

/**
 * Ensure versions folder exists
 */
async function ensureVersionsFolder(ws) {
  try {
    await ws.mkdir(VERSIONS_FOLDER);
  } catch (e) {
    // Already exists
  }
}

/**
 * Load version manifest
 */
async function loadManifest(ws) {
  const manifestPath = `${VERSIONS_FOLDER}/${MANIFEST_FILE}`;
  try {
    if (await ws.exists(manifestPath)) {
      const content = await ws.readFile(manifestPath);
      return JSON.parse(content);
    }
  } catch (e) {
    // Manifest not found or corrupt, start fresh
  }
  return { versions: [], nextId: 1 };
}

/**
 * Save version manifest
 */
async function saveManifest(ws, manifest) {
  const manifestPath = `${VERSIONS_FOLDER}/${MANIFEST_FILE}`;
  await ws.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Capture current project state as a version snapshot
 */
async function captureState(ws, options = {}) {
  const { full = false } = options;
  const { getMap, getBasemapConfig } = await getMapModule();
  const map = getMap();
  const view = map.getView();
  const center = ol.proj.toLonLat(view.getCenter());

  const snapshot = {
    crs: state.crs,
    view: {
      center,
      zoom: view.getZoom()
    },
    layers: [],
    basemaps: []
  };

  // Capture basemaps
  for (const layer of state.layers.values()) {
    if (layer.isBasemap && layer.toJSON) {
      snapshot.basemaps.push(layer.toJSON());
    }
  }

  // Capture layers
  for (const layer of state.layers.values()) {
    if (layer.isBasemap) continue;

    const layerData = {
      name: layer.name,
      type: layer.type || (layer.width !== undefined ? 'raster' : 'vector'),
      visible: layer.visible,
      zIndex: layer.zIndex ? layer.zIndex() : 0
    };

    // Style
    if (layer._styleOpts) {
      layerData.style = layer._styleOpts;
    }

    // Blend mode
    if (layer._blendMode && layer._blendMode !== 'source-over') {
      layerData.blendMode = layer._blendMode;
    }

    // Vector layers
    if (layer.geojson) {
      if (full) {
        // Full mode: store data inline (will be saved as separate file)
        layerData.storage = 'inline';
      } else if (layer.sourcePath) {
        // Reference mode: just reference the source file
        layerData.storage = 'reference';
        layerData.source = layer.sourcePath;
        layerData.format = layer.sourceFormat;
      } else {
        // In-memory layer without source: must store inline
        layerData.storage = 'inline';
      }
    }

    // Raster layers
    if (layer.width !== undefined) {
      if (layer._metadata) {
        layerData.nodata = layer._metadata.nodata;
        layerData.min = layer._metadata.min;
        layerData.max = layer._metadata.max;
      }
      if (layer._colorRamp) layerData.colorRamp = layer._colorRamp;
      if (layer._mode) layerData.mode = layer._mode;
      if (layer._selectedBand) layerData.selectedBand = layer._selectedBand;
      if (layer._bandMapping) layerData.bandMapping = layer._bandMapping;
      if (layer._bandStretch) layerData.bandStretch = layer._bandStretch;
      if (layer._expression) layerData.expression = layer._expression;

      if (full) {
        // Full mode: export as COG (handled separately)
        layerData.storage = 'cog';
      } else if (layer.sourcePath) {
        layerData.storage = 'reference';
        layerData.source = layer.sourcePath;
        layerData.format = layer.sourceFormat;
      } else if (layer._expression && layer._expressionInputs) {
        // Derived raster: store recipe
        layerData.storage = 'derived';
        layerData.expression = layer._expression;
        layerData.inputs = layer._expressionInputs;
      } else if (layer._sampleParams) {
        // Sample raster: store generation params
        layerData.storage = 'sample';
        layerData.sampleParams = layer._sampleParams;
      } else {
        // Unknown raster source - reference only
        layerData.storage = 'reference';
        layerData.source = null;
      }
    }

    snapshot.layers.push(layerData);
  }

  return snapshot;
}

/**
 * Save a new version
 * @param {string} message - Version message/description
 * @param {Object} options - { full: boolean } - full snapshot vs lightweight
 * @returns {Object} Version info
 */
async function save(message = '', options = {}) {
  const { full = false } = options;
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return null;
  }

  await ensureVersionsFolder(ws);
  const manifest = await loadManifest(ws);

  const versionId = manifest.nextId;
  const versionFolder = `${VERSIONS_FOLDER}/v${String(versionId).padStart(3, '0')}`;

  // Create version folder
  await ws.mkdir(versionFolder);

  // Capture state
  const snapshot = await captureState(ws, { full });

  // Save layer data files
  const layerFiles = {};

  for (const layerData of snapshot.layers) {
    const layer = state.layers.get(layerData.name);
    if (!layer) continue;

    if (layerData.storage === 'inline' && layer.geojson) {
      // Save vector as compressed GeoJSON
      const filename = `${layerData.name}.geojson`;
      const geojsonStr = JSON.stringify(layer.geojson);
      const { data, compressed } = await compress(geojsonStr);

      const savePath = `${versionFolder}/${compressed ? filename + '.gz' : filename}`;
      await ws.writeFile(savePath, data);

      layerData.file = compressed ? filename + '.gz' : filename;
      layerData.compressed = compressed;
      delete layerData.storage;
    } else if (layerData.storage === 'cog' && full && layer._data) {
      // Full mode: export raster as COG
      try {
        const filename = `${layerData.name}.tif`;
        termPrint(`  Exporting raster: ${layerData.name}...`, 'dim');
        const { toCOG } = await import('../raster/gdal.js');
        const cogBlob = await toCOG(layer, { compress: 'DEFLATE' });
        const cogBuffer = await cogBlob.arrayBuffer();
        await ws.writeFile(`${versionFolder}/${filename}`, cogBuffer);
        layerData.file = filename;
      } catch (e) {
        termPrint(`  Could not export raster ${layerData.name}: ${e.message}`, 'yellow');
        // Fall back to reference
        if (layer.sourcePath) {
          layerData.storage = 'reference';
          layerData.source = layer.sourcePath;
        }
      }
      delete layerData.storage;
    } else {
      // Reference or derived - no file to save
      delete layerData.storage;
    }
  }

  // Save version metadata
  const versionMeta = {
    id: versionId,
    message: message || `Version ${versionId}`,
    timestamp: new Date().toISOString(),
    full: full,
    snapshot
  };

  await ws.writeFile(`${versionFolder}/version.json`, JSON.stringify(versionMeta, null, 2));

  // Update manifest
  manifest.versions.push({
    id: versionId,
    message: versionMeta.message,
    timestamp: versionMeta.timestamp,
    full: full,
    layerCount: snapshot.layers.length
  });
  manifest.nextId = versionId + 1;

  await saveManifest(ws, manifest);

  const modeLabel = full ? 'full snapshot' : 'lightweight';
  termPrint(`Version ${versionId} saved (${modeLabel}): ${versionMeta.message}`, 'green');

  return versionMeta;
}

/**
 * List all versions
 */
async function list() {
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return [];
  }

  const manifest = await loadManifest(ws);

  if (manifest.versions.length === 0) {
    termPrint('No versions saved yet. Use sp.v.save("message") to create one.', 'dim');
    return [];
  }

  termPrint('Versions:', 'cyan');
  for (const v of manifest.versions) {
    const date = new Date(v.timestamp).toLocaleString();
    const mode = v.full ? '●' : '○';  // Filled = full, empty = lightweight
    const layerInfo = `${v.layerCount} layer${v.layerCount !== 1 ? 's' : ''}`;
    termPrint(`  ${mode} v${v.id}: ${v.message} (${date}, ${layerInfo})`, 'dim');
  }

  termPrint('', 'dim');
  termPrint('● = full snapshot, ○ = lightweight', 'dim');

  return manifest.versions;
}

/**
 * Show details of a specific version
 */
async function show(versionId) {
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected.', 'yellow');
    return null;
  }

  const versionFolder = `${VERSIONS_FOLDER}/v${String(versionId).padStart(3, '0')}`;
  const versionPath = `${versionFolder}/version.json`;

  try {
    if (!await ws.exists(versionPath)) {
      termPrint(`Version ${versionId} not found.`, 'red');
      return null;
    }

    const content = await ws.readFile(versionPath);
    const version = JSON.parse(content);

    termPrint(`Version ${version.id}: ${version.message}`, 'cyan');
    termPrint(`  Created: ${new Date(version.timestamp).toLocaleString()}`, 'dim');
    termPrint(`  Mode: ${version.full ? 'Full snapshot' : 'Lightweight'}`, 'dim');
    termPrint(`  Layers:`, 'dim');

    for (const layer of version.snapshot.layers) {
      const storage = layer.file ? 'stored' : (layer.source ? 'reference' : 'derived');
      termPrint(`    - ${layer.name} (${layer.type}, ${storage})`, 'dim');
    }

    return version;
  } catch (e) {
    termPrint(`Error reading version: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Restore a version
 */
async function restore(versionId) {
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected.', 'yellow');
    return false;
  }

  const versionFolder = `${VERSIONS_FOLDER}/v${String(versionId).padStart(3, '0')}`;
  const versionPath = `${versionFolder}/version.json`;

  try {
    if (!await ws.exists(versionPath)) {
      termPrint(`Version ${versionId} not found.`, 'red');
      return false;
    }

    termPrint(`Restoring version ${versionId}...`, 'dim');

    const content = await ws.readFile(versionPath);
    const version = JSON.parse(content);
    const snapshot = version.snapshot;

    // Clear existing layers
    const { clear } = await import('./api.js');
    clear();

    // Restore CRS
    if (snapshot.crs) {
      state.crs = snapshot.crs;
    }

    // Restore view
    if (snapshot.view) {
      const { getMap } = await getMapModule();
      const map = getMap();
      if (snapshot.view.center) {
        map.getView().setCenter(ol.proj.fromLonLat(snapshot.view.center));
      }
      if (snapshot.view.zoom) {
        map.getView().setZoom(snapshot.view.zoom);
      }
    }

    // Restore basemaps
    if (snapshot.basemaps && snapshot.basemaps.length > 0) {
      const { clearBasemaps, setBasemap } = await getMapModule();
      clearBasemaps();
      for (const bm of snapshot.basemaps) {
        let layer = null;
        if (bm.basemapKey) {
          layer = setBasemap(bm.basemapKey);
        } else if (bm.url) {
          layer = setBasemap(bm.url, bm.attribution);
        } else if (bm.name && bm.name !== 'none') {
          layer = setBasemap(bm.name);
        }
        if (layer) {
          if (bm.visible === false) layer.hide();
          if (bm.opacity !== undefined) layer.opacity(bm.opacity);
          if (bm.blendMode && bm.blendMode !== 'source-over') layer.blendMode(bm.blendMode);
        }
      }
    }

    // Restore layers
    const { loadFromContent } = await import('../formats/index.js');
    let restoredCount = 0;
    let failedLayers = [];

    for (const layerData of snapshot.layers) {
      try {
        let layer = null;

        // Case 1: Inline file stored in version folder
        if (layerData.file) {
          const filePath = `${versionFolder}/${layerData.file}`;

          if (layerData.type === 'raster' || layerData.file.endsWith('.tif')) {
            // Raster file
            const { loadCOGFromWorkspace } = await import('../formats/geotiff.js');
            const handle = await ws.getFileHandle ?
              await getFileHandleFromPath(ws, filePath) : null;
            if (handle) {
              layer = await loadCOGFromWorkspace(handle, layerData.name, layerData);
            }
          } else {
            // Vector file (possibly compressed)
            let geojsonStr;
            if (layerData.compressed) {
              const buffer = await ws.readFileBuffer(filePath);
              geojsonStr = await decompress(buffer, true);
            } else {
              geojsonStr = await ws.readFile(filePath);
            }
            const geojson = JSON.parse(geojsonStr);
            const { load } = await import('./api.js');
            layer = load(geojson, layerData.name);
          }
        }
        // Case 2: Reference to source file
        else if (layerData.source) {
          if (await ws.exists(layerData.source)) {
            const format = layerData.format || 'geojson';

            if (format === 'cog' || format === 'geotiff') {
              const { loadCOGFromWorkspace } = await import('../formats/geotiff.js');
              const handle = await getFileHandleFromPath(ws, layerData.source);
              if (handle) {
                layer = await loadCOGFromWorkspace(handle, layerData.name, layerData);
              }
            } else {
              const content = await ws.readFile(layerData.source);
              layer = await loadFromContent(content, layerData.name, format);
            }

            if (layer && layer.setSource) {
              layer.setSource(layerData.source, layerData.format);
            }
          } else {
            failedLayers.push(`${layerData.name} (source not found: ${layerData.source})`);
            continue;
          }
        }
        // Case 3: Derived raster (recipe)
        else if (layerData.expression && layerData.inputs) {
          // Check if input layers are available
          const inputsAvailable = layerData.inputs.every(name => state.layers.has(name));
          if (inputsAvailable) {
            const { calc } = await import('./commands.js');
            const inputs = {};
            layerData.inputs.forEach((name, i) => {
              inputs[String.fromCharCode(97 + i)] = state.layers.get(name); // a, b, c...
            });
            layer = await calc(layerData.expression, inputs, { name: layerData.name });
          } else {
            failedLayers.push(`${layerData.name} (missing inputs for derived raster)`);
            continue;
          }
        }
        // Case 4: Sample raster
        else if (layerData.sampleParams) {
          const { sampleRaster } = await import('./sample-raster.js');
          layer = sampleRaster(layerData.sampleParams);
        }

        // Apply layer settings
        if (layer) {
          if (layerData.style && layer.style) {
            layer.style(layerData.style);
          }
          if (layerData.visible === false) {
            layer.hide();
          }
          if (layerData.zIndex !== undefined && layer.zIndex) {
            layer.zIndex(layerData.zIndex);
          }
          if (layerData.blendMode && layer.blendMode) {
            layer.blendMode(layerData.blendMode);
          }
          // Raster-specific
          if (layerData.colorRamp && layer.colorRamp) {
            layer.colorRamp(layerData.colorRamp);
          }
          if (layerData.bandMapping && layer.bands) {
            layer.bands(...layerData.bandMapping);
          }

          restoredCount++;
        }
      } catch (e) {
        failedLayers.push(`${layerData.name} (${e.message})`);
        console.error(`Error restoring layer ${layerData.name}:`, e);
      }
    }

    termPrint(`Restored version ${versionId}: ${restoredCount} layer(s)`, 'green');

    if (failedLayers.length > 0) {
      termPrint(`Could not restore: ${failedLayers.join(', ')}`, 'yellow');
    }

    return true;
  } catch (e) {
    termPrint(`Error restoring version: ${e.message}`, 'red');
    console.error(e);
    return false;
  }
}

/**
 * Helper to get file handle from path
 */
async function getFileHandleFromPath(ws, path) {
  try {
    if (ws.getFileHandle) {
      return await ws.getFileHandle(path);
    }
  } catch (e) {
    // File handle not available
  }
  return null;
}

/**
 * Delete a version
 */
async function remove(versionId) {
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected.', 'yellow');
    return false;
  }

  const manifest = await loadManifest(ws);
  const versionIndex = manifest.versions.findIndex(v => v.id === versionId);

  if (versionIndex === -1) {
    termPrint(`Version ${versionId} not found.`, 'red');
    return false;
  }

  const versionFolder = `${VERSIONS_FOLDER}/v${String(versionId).padStart(3, '0')}`;

  try {
    // Remove version folder
    await ws.rm(versionFolder);

    // Update manifest
    manifest.versions.splice(versionIndex, 1);
    await saveManifest(ws, manifest);

    termPrint(`Version ${versionId} deleted.`, 'green');
    return true;
  } catch (e) {
    termPrint(`Error deleting version: ${e.message}`, 'red');
    return false;
  }
}

/**
 * Compare two versions (basic diff)
 */
async function diff(versionId1, versionId2) {
  const ws = await getWorkspace();

  if (!ws.connected) {
    termPrint('No workspace connected.', 'yellow');
    return null;
  }

  const v1 = await show(versionId1);
  const v2 = await show(versionId2);

  if (!v1 || !v2) return null;

  const layers1 = new Set(v1.snapshot.layers.map(l => l.name));
  const layers2 = new Set(v2.snapshot.layers.map(l => l.name));

  const added = [...layers2].filter(l => !layers1.has(l));
  const removed = [...layers1].filter(l => !layers2.has(l));
  const common = [...layers1].filter(l => layers2.has(l));

  // Check for style/visibility changes in common layers
  const modified = [];
  for (const name of common) {
    const l1 = v1.snapshot.layers.find(l => l.name === name);
    const l2 = v2.snapshot.layers.find(l => l.name === name);

    if (JSON.stringify(l1.style) !== JSON.stringify(l2.style) ||
        l1.visible !== l2.visible ||
        l1.zIndex !== l2.zIndex) {
      modified.push(name);
    }
  }

  termPrint(`\nDiff: v${versionId1} → v${versionId2}`, 'cyan');

  if (added.length > 0) {
    termPrint(`  Added: ${added.join(', ')}`, 'green');
  }
  if (removed.length > 0) {
    termPrint(`  Removed: ${removed.join(', ')}`, 'red');
  }
  if (modified.length > 0) {
    termPrint(`  Modified: ${modified.join(', ')}`, 'yellow');
  }
  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    termPrint('  No changes', 'dim');
  }

  return { added, removed, modified };
}

// Export versioning API
export const versioning = {
  save,
  list,
  show,
  restore,
  remove,
  diff,

  // Aliases
  snapshot: (message) => save(message, { full: true }),

  get VERSIONS_FOLDER() {
    return VERSIONS_FOLDER;
  }
};

// Short alias
export const v = versioning;
