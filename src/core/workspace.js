// Spinifex - Workspace Module
// File System Access API integration for persistent workspace

import { state } from './state.js';
import { getMap, getBasemapConfig, setBasemap } from '../ui/map.js';
import { termPrint } from '../ui/terminal.js';
import { VFSLite } from '../lib/xterm-kit/vfs-lite.js';
import { setProjectDirHandle } from '../ui/drag-drop.js';

// Workspace state
let directoryHandle = null;
let projectName = null;
let vfs = null;

// Check if File System Access API is available
const hasFileSystemAccess = 'showDirectoryPicker' in window;

// IndexedDB for storing file handles (workspace history)
const HANDLE_DB_NAME = 'spinifex-handles';
const HANDLE_STORE_NAME = 'handles';
const MAX_WORKSPACE_HISTORY = 10;

/**
 * Open IndexedDB database
 */
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 2);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store directory handle in workspace history
 */
async function storeHandle(handle) {
  const db = await openHandleDB();

  return new Promise(async (resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE_NAME);

    // Get existing history
    const getRequest = store.get('history');
    getRequest.onsuccess = async () => {
      let history = getRequest.result || [];

      // Migrate from old format (single 'workspace' key)
      if (!Array.isArray(history)) {
        const oldHandle = await new Promise(r => {
          const oldReq = store.get('workspace');
          oldReq.onsuccess = () => r(oldReq.result);
          oldReq.onerror = () => r(null);
        });
        history = oldHandle ? [{ handle: oldHandle, name: oldHandle.name, lastAccessed: Date.now() }] : [];
      }

      // Remove existing entry for same workspace (by name)
      history = history.filter(entry => entry.name !== handle.name);

      // Add new entry at the front
      history.unshift({
        handle,
        name: handle.name,
        lastAccessed: Date.now()
      });

      // Keep only MAX_WORKSPACE_HISTORY entries
      history = history.slice(0, MAX_WORKSPACE_HISTORY);

      // Save updated history
      store.put(history, 'history');
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get workspace history (all stored workspaces)
 */
async function getWorkspaceHistory() {
  const db = await openHandleDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const getRequest = store.get('history');

    getRequest.onsuccess = async () => {
      let history = getRequest.result;

      // Handle migration from old format
      if (!history || !Array.isArray(history)) {
        const oldReq = store.get('workspace');
        const oldHandle = await new Promise(r => {
          const req = store.get('workspace');
          req.onsuccess = () => r(req.result);
          req.onerror = () => r(null);
        });
        history = oldHandle ? [{ handle: oldHandle, name: oldHandle.name, lastAccessed: Date.now() }] : [];
      }

      resolve(history);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove a workspace from history by name
 */
async function removeFromHistory(name) {
  const db = await openHandleDB();

  return new Promise(async (resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE_NAME);

    const getRequest = store.get('history');
    getRequest.onsuccess = () => {
      let history = getRequest.result || [];
      history = history.filter(entry => entry.name !== name);
      store.put(history, 'history');
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve the most recent stored directory handle from IndexedDB
 */
async function getStoredHandle() {
  const history = await getWorkspaceHistory();
  return history.length > 0 ? history[0].handle : null;
}

/**
 * Try to reconnect to previously used workspace
 */
async function tryReconnect() {
  if (!hasFileSystemAccess) return false;

  try {
    const handle = await getStoredHandle();
    if (!handle) return false;

    // Request permission (will prompt user if needed)
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      termPrint('Workspace access denied. Use ws.connect() to reconnect.', 'yellow');
      return false;
    }

    directoryHandle = handle;
    projectName = handle.name;
    setProjectDirHandle(handle, writeFile);
    termPrint(`Reconnected to workspace: ${projectName}`, 'green');

    // Load project
    await loadProjectConfig();
    return true;
  } catch (e) {
    // No stored handle or permission denied
    return false;
  }
}

/**
 * Initialize VFS fallback for browsers without File System Access API
 */
async function initVFSFallback() {
  if (!vfs) {
    vfs = new VFSLite({ backend: 'indexeddb', dbName: 'spinifex-workspace' });
    await vfs.ready;

    // Create default directories
    try {
      await vfs.mkdir('/projects');
    } catch (e) {
      // Already exists
    }
  }
  return vfs;
}

/**
 * Create the standard project folder structure
 */
async function createProjectStructure() {
  const folders = ['vectors', 'rasters', 'data', 'scripts'];
  for (const folder of folders) {
    try {
      await directoryHandle.getDirectoryHandle(folder, { create: true });
    } catch (e) {
      // Ignore errors - folder might already exist
    }
  }
}

/**
 * Start a new project - clears current state and connects to a folder
 */
async function newProject() {
  if (!hasFileSystemAccess) {
    termPrint('File System Access API not available.', 'red');
    return false;
  }

  try {
    // Pick folder first (before clearing, in case user cancels)
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });

    // Clear existing layers
    const { clear } = await import('./api.js');
    clear();

    directoryHandle = handle;
    projectName = handle.name;
    setProjectDirHandle(handle, writeFile);

    // Store handle for persistence
    await storeHandle(handle);

    // Create project folder structure
    await createProjectStructure();

    termPrint(`New project: ${projectName}`, 'green');

    // Don't load existing project.json - this is a fresh start
    // But do run startup.js if it exists
    await runStartupScript();

    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      termPrint(`Error: ${e.message}`, 'red');
    }
    return false;
  }
}

/**
 * Connect to a workspace folder (File System Access API)
 */
async function connect() {
  if (!hasFileSystemAccess) {
    termPrint('File System Access API not available. Using browser storage.', 'yellow');
    await initVFSFallback();
    return false;
  }

  try {
    directoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });

    projectName = directoryHandle.name;
    setProjectDirHandle(directoryHandle, writeFile);

    // Store handle for persistence across sessions
    await storeHandle(directoryHandle);

    termPrint(`Connected to workspace: ${projectName}`, 'green');

    // Check for startup.js and run it
    await runStartupScript();

    // Check for project.json and load it
    await loadProjectConfig();

    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      termPrint(`Error connecting to workspace: ${e.message}`, 'red');
    }
    return false;
  }
}

/**
 * Read a file from the workspace
 */
async function readFile(path) {
  if (directoryHandle) {
    try {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      // Navigate to parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      // Get file
      const fileHandle = await handle.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      throw new Error(`Cannot read file: ${path}`);
    }
  } else if (vfs) {
    return await vfs.readFile(path);
  }
  throw new Error('No workspace connected');
}

/**
 * Get a file handle from the workspace
 * @param {string} path - File path relative to workspace root
 * @returns {FileSystemFileHandle|null}
 */
async function getFileHandle(path) {
  if (directoryHandle) {
    try {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      // Navigate to parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      // Get file handle
      return await handle.getFileHandle(parts[parts.length - 1]);
    } catch (e) {
      throw new Error(`Cannot get file handle: ${path}`);
    }
  }
  throw new Error('No workspace connected or file system access not available');
}

/**
 * Write a file to the workspace
 * @param {string} path - File path relative to workspace root
 * @param {string|ArrayBuffer} content - File content (string for text, ArrayBuffer for binary)
 */
async function writeFile(path, content) {
  if (directoryHandle) {
    try {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      // Navigate/create parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i], { create: true });
      }

      // Create/overwrite file
      const fileHandle = await handle.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (e) {
      throw new Error(`Cannot write file: ${path} - ${e.message}`);
    }
  } else if (vfs) {
    // Ensure parent directories exist
    const parts = path.split('/').filter(p => p);
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i];
      try {
        await vfs.mkdir(currentPath);
      } catch (e) {
        // Already exists
      }
    }
    await vfs.writeFile(path, content);
  } else {
    throw new Error('No workspace connected');
  }
}

/**
 * Read a file as ArrayBuffer (for binary files)
 */
async function readFileBuffer(path) {
  if (directoryHandle) {
    try {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      // Navigate to parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      // Get file
      const fileHandle = await handle.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    } catch (e) {
      throw new Error(`Cannot read file: ${path}`);
    }
  } else if (vfs) {
    const text = await vfs.readFile(path);
    return new TextEncoder().encode(text).buffer;
  }
  throw new Error('No workspace connected');
}

/**
 * Check if a file exists
 */
async function exists(path) {
  if (directoryHandle) {
    try {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      await handle.getFileHandle(parts[parts.length - 1]);
      return true;
    } catch (e) {
      return false;
    }
  } else if (vfs) {
    return await vfs.exists(path);
  }
  return false;
}

/**
 * List files in a directory
 */
async function listDir(path = '') {
  if (directoryHandle) {
    try {
      let handle = directoryHandle;

      if (path) {
        const parts = path.split('/').filter(p => p);
        for (const part of parts) {
          handle = await handle.getDirectoryHandle(part);
        }
      }

      const entries = [];
      for await (const entry of handle.values()) {
        entries.push({
          name: entry.name,
          type: entry.kind === 'directory' ? 'directory' : 'file'
        });
      }
      return entries;
    } catch (e) {
      return [];
    }
  } else if (vfs) {
    return await vfs.readdir(path || '/');
  }
  return [];
}

/**
 * Run startup.js if it exists
 */
async function runStartupScript() {
  try {
    if (await exists('startup.js')) {
      const script = await readFile('startup.js');
      termPrint('Running startup.js...', 'dim');

      // Execute the script in the API context
      const { sp } = await import('./api.js');
      const fn = new Function('sp', 'load', 'sample', script);
      fn(sp, sp.load, sp.sample);

      termPrint('startup.js completed', 'green');
    }
  } catch (e) {
    termPrint(`Error in startup.js: ${e.message}`, 'red');
  }
}

/**
 * Load project configuration
 * Re-parses all files from disk using their original format
 */
async function loadProjectConfig() {
  try {
    if (await exists('project.json')) {
      const content = await readFile('project.json');
      const config = JSON.parse(content);

      termPrint(`Loading project: ${config.name || 'Untitled'}`, 'dim');

      // Set CRS if specified
      if (config.crs) {
        state.crs = config.crs;
      }

      // Set view if specified
      if (config.view) {
        const map = getMap();
        if (config.view.center) {
          map.getView().setCenter(ol.proj.fromLonLat(config.view.center));
        }
        if (config.view.zoom) {
          map.getView().setZoom(config.view.zoom);
        }
      }

      // Clear existing basemaps before loading project basemaps
      const { clearBasemaps } = await import('../ui/map.js');

      // Set basemaps if specified (new format: array)
      if (config.basemaps && Array.isArray(config.basemaps)) {
        clearBasemaps();
        for (const bm of config.basemaps) {
          let layer = null;

          // Prefer basemapKey for named basemaps (handles "stamen-terrain" style keys)
          if (bm.basemapKey) {
            layer = setBasemap(bm.basemapKey);
          } else if (bm.url) {
            // Custom basemap with URL
            layer = setBasemap(bm.url, bm.attribution);
          } else if (bm.name && bm.name !== 'none') {
            // Fallback to name (for backwards compatibility)
            layer = setBasemap(bm.name);
          }

          if (layer) {
            if (bm.visible === false) layer.hide();
            if (bm.opacity !== undefined) layer.opacity(bm.opacity);
            if (bm.blendMode && bm.blendMode !== 'source-over') layer.blendMode(bm.blendMode);
          }
        }
      }
      // Legacy single basemap format
      else if (config.basemap) {
        clearBasemaps();
        if (config.basemap.name === 'custom' && config.basemap.url) {
          setBasemap(config.basemap.url, config.basemap.attribution);
        } else if (config.basemap.name && config.basemap.name !== 'none') {
          setBasemap(config.basemap.name);
        }
      }

      // Load layers
      if (config.layers) {
        const { loadFromContent } = await import('../formats/index.js');
        let loadedCount = 0;

        for (const layerConfig of config.layers) {
          try {
            if (!layerConfig.source) {
              termPrint(`Skipped (no source): ${layerConfig.name}`, 'dim');
              continue;
            }

            const filePath = layerConfig.source.replace('./', '');

            if (!await exists(filePath)) {
              termPrint(`File not found: ${layerConfig.name} (${filePath})`, 'yellow');
              continue;
            }

            // Determine format
            const format = layerConfig.format || getFormatFromPath(filePath);

            let layer;

            // Special handling for SRTM (legacy format, needs metadata sidecar)
            if (format === 'srtm') {
              const { loadSRTMFromWorkspace } = await import('../data/srtm.js');
              layer = await loadSRTMFromWorkspace(filePath, layerConfig.name);
            } else if (format === 'cog') {
              // COG files - use tiled loading for efficiency
              const { loadCOGFromWorkspace } = await import('../formats/geotiff.js');
              const fileHandle = await getFileHandle(filePath);
              layer = await loadCOGFromWorkspace(fileHandle, layerConfig.name, layerConfig);
            } else {
              // Read file content based on format
              let fileContent;
              if (format === 'geotiff' || format === 'xlsx' || format === 'shapefile') {
                // Binary formats
                fileContent = await readFileBuffer(filePath);
              } else {
                // Text formats
                fileContent = await readFile(filePath);
                if (!fileContent || fileContent.trim() === '') {
                  termPrint(`Empty file: ${layerConfig.name}`, 'yellow');
                  continue;
                }
              }

              // Load using format loader
              layer = await loadFromContent(fileContent, layerConfig.name, format);
            }

            if (layer) {
              // Set source reference
              if (layer.setSource) {
                layer.setSource(filePath, format);
              }

              // Apply saved settings
              if (layerConfig.style && layer.style) {
                layer.style(layerConfig.style);
              }
              if (layerConfig.visible === false) {
                layer.hide();
              }
              if (layerConfig.zIndex !== undefined && layer.zIndex) {
                layer.zIndex(layerConfig.zIndex);
              }
              if (layerConfig.blendMode && layerConfig.blendMode !== 'source-over' && layer.blendMode) {
                layer.blendMode(layerConfig.blendMode);
              }
              loadedCount++;
            }
          } catch (e) {
            termPrint(`Could not load layer: ${layerConfig.name} - ${e.message}`, 'yellow');
          }
        }

        if (loadedCount > 0) {
          termPrint(`Loaded ${loadedCount} layer(s)`, 'dim');
        }
      }

      termPrint('Project loaded', 'green');
    }
  } catch (e) {
    termPrint(`Error loading project: ${e.message}`, 'red');
  }
}

/**
 * Get format from file path
 */
function getFormatFromPath(path) {
  const ext = path.toLowerCase().split('.').pop();
  switch (ext) {
    case 'geojson':
    case 'json':
      return 'geojson';
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'zip':
      return 'shapefile';
    case 'tif':
    case 'tiff':
      return 'geotiff';
    case 'srtm':
      return 'srtm';
    default:
      return 'geojson';
  }
}

/**
 * Save current project state
 * Only saves project.json with references - data files are already in project folder
 */
async function save(name) {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return null;
  }

  const map = getMap();
  const view = map.getView();
  const center = ol.proj.toLonLat(view.getCenter());

  // Build layer configs from source references
  const layerConfigs = [];
  const unsavedLayers = [];

  for (const layer of state.layers.values()) {
    // Skip basemap layers - they're saved separately
    if (layer.isBasemap) {
      continue;
    }

    if (layer.sourcePath) {
      // Layer has a source file in project - just reference it
      const config = {
        name: layer.name,
        type: layer.width !== undefined ? 'raster' : 'vector',
        source: layer.sourcePath,
        format: layer.sourceFormat,
        visible: layer.visible,
        zIndex: layer.zIndex ? layer.zIndex() : 0
      };
      // Save style if set
      if (layer._styleOpts) {
        config.style = layer._styleOpts;
      }
      // Save blend mode if not default
      if (layer._blendMode && layer._blendMode !== 'source-over') {
        config.blendMode = layer._blendMode;
      }
      // Save raster-specific properties
      if (layer.width !== undefined) {
        if (layer._metadata) {
          config.nodata = layer._metadata.nodata;
          config.min = layer._metadata.min;
          config.max = layer._metadata.max;
        }
        if (layer._colorRamp) {
          config.colorRamp = layer._colorRamp;
        }
        if (layer._mode) {
          config.mode = layer._mode;
        }
        if (layer._selectedBand) {
          config.selectedBand = layer._selectedBand;
        }
        if (layer._bandMapping) {
          config.bandMapping = layer._bandMapping;
        }
        if (layer._bandStretch) {
          config.bandStretch = layer._bandStretch;
        }
      }
      layerConfigs.push(config);
    } else {
      // Layer was created in-memory (e.g., from buffer operation, sample data, etc.)
      // These need to be saved as new files
      unsavedLayers.push(layer.name);

      if (layer.geojson) {
        // Vector layer - save as GeoJSON
        const sourcePath = `vectors/${layer.name}.geojson`;
        try {
          await writeFile(sourcePath, JSON.stringify(layer.geojson, null, 2));
          layer.setSource(sourcePath, 'geojson');
          const config = {
            name: layer.name,
            type: 'vector',
            source: sourcePath,
            format: 'geojson',
            visible: layer.visible,
            zIndex: layer.zIndex ? layer.zIndex() : 0
          };
          if (layer._styleOpts) {
            config.style = layer._styleOpts;
          }
          if (layer._blendMode && layer._blendMode !== 'source-over') {
            config.blendMode = layer._blendMode;
          }
          layerConfigs.push(config);
          termPrint(`Saved new layer: ${layer.name}`, 'dim');
        } catch (e) {
          termPrint(`Could not save layer: ${layer.name} - ${e.message}`, 'yellow');
        }
      } else if (layer.width !== undefined && layer._data) {
        // Raster without source - save as COG
        const sourcePath = `rasters/${layer.name}.tif`;
        try {
          termPrint(`Saving raster: ${layer.name}...`, 'dim');
          const { toCOG } = await import('../raster/gdal.js');
          const cogBlob = await toCOG(layer, { compress: 'DEFLATE' });
          const cogBuffer = await cogBlob.arrayBuffer();
          await writeFile(sourcePath, cogBuffer);
          layer.setSource(sourcePath, 'cog');

          const config = {
            name: layer.name,
            type: 'raster',
            source: sourcePath,
            format: 'cog',
            visible: layer.visible,
            zIndex: layer.zIndex ? layer.zIndex() : 0
          };
          // Save raster-specific properties
          if (layer._metadata) {
            config.nodata = layer._metadata.nodata;
            config.min = layer._metadata.min;
            config.max = layer._metadata.max;
          }
          if (layer._colorRamp) {
            config.colorRamp = layer._colorRamp;
          }
          if (layer._mode) {
            config.mode = layer._mode;
          }
          if (layer._selectedBand) {
            config.selectedBand = layer._selectedBand;
          }
          if (layer._bandMapping) {
            config.bandMapping = layer._bandMapping;
          }
          if (layer._bandStretch) {
            config.bandStretch = layer._bandStretch;
          }
          layerConfigs.push(config);
          termPrint(`Saved raster: ${layer.name}`, 'dim');
        } catch (e) {
          termPrint(`Could not save raster: ${layer.name} - ${e.message}`, 'yellow');
          console.error(e);
        }
      }
    }
  }

  // Collect basemap configs
  const basemapConfigs = [];
  for (const layer of state.layers.values()) {
    if (layer.isBasemap && layer.toJSON) {
      basemapConfigs.push(layer.toJSON());
    }
  }

  const project = {
    name: name || projectName || 'Untitled',
    version: '1.0',
    created: new Date().toISOString(),
    crs: state.crs,
    view: {
      center: center,
      zoom: view.getZoom()
    },
    basemaps: basemapConfigs,  // Array of basemap configs
    layers: layerConfigs
  };

  // Save project.json
  await writeFile('project.json', JSON.stringify(project, null, 2));

  termPrint(`Project saved: ${project.name} (${layerConfigs.length} layers)`, 'green');
  return project;
}

/**
 * List saved projects (VFS mode only)
 */
async function list() {
  if (directoryHandle) {
    termPrint('Workspace connected to: ' + projectName, 'cyan');
    return [projectName];
  }

  await initVFSFallback();
  const entries = await vfs.readdir('/projects');
  const projects = entries
    .filter(e => e.type === 'directory')
    .map(e => e.name);

  if (projects.length === 0) {
    termPrint('No saved projects', 'dim');
  } else {
    termPrint('Saved projects:', 'cyan');
    projects.forEach(p => termPrint(`  ${p}`, 'dim'));
  }

  return projects;
}

/**
 * Load a project (VFS mode only)
 */
async function load(name) {
  await initVFSFallback();

  const projectPath = `/projects/${name}`;
  if (!await vfs.exists(projectPath)) {
    termPrint(`Project not found: ${name}`, 'red');
    return false;
  }

  projectName = name;

  // Load project.json
  try {
    const content = await vfs.readFile(`${projectPath}/project.json`);
    const config = JSON.parse(content);

    // Clear existing layers
    const { clear, load: loadLayer } = await import('./api.js');
    clear();

    // Set CRS
    if (config.crs) {
      state.crs = config.crs;
    }

    // Set view
    if (config.view) {
      const map = getMap();
      if (config.view.center) {
        map.getView().setCenter(ol.proj.fromLonLat(config.view.center));
      }
      if (config.view.zoom) {
        map.getView().setZoom(config.view.zoom);
      }
    }

    // Load layers
    if (config.layers) {
      for (const layerConfig of config.layers) {
        try {
          const dataPath = `${projectPath}/${layerConfig.source.replace('./', '')}`;
          const data = await vfs.readFile(dataPath);
          const geojson = JSON.parse(data);
          const layer = loadLayer(geojson, layerConfig.name);

          if (layerConfig.style) {
            layer.style(layerConfig.style);
          }
          if (layerConfig.visible === false) {
            layer.hide();
          }
        } catch (e) {
          termPrint(`Could not load layer: ${layerConfig.name}`, 'yellow');
        }
      }
    }

    termPrint(`Project loaded: ${name}`, 'green');
    return true;
  } catch (e) {
    termPrint(`Error loading project: ${e.message}`, 'red');
    return false;
  }
}

/**
 * Export project as downloadable file
 */
async function exportProject() {
  const map = getMap();
  const view = map.getView();
  const center = ol.proj.toLonLat(view.getCenter());

  const project = {
    name: projectName || 'spinifex-project',
    version: '1.0',
    created: new Date().toISOString(),
    crs: state.crs,
    view: {
      center: center,
      zoom: view.getZoom()
    },
    layers: []
  };

  // Include layer data inline
  state.layers.forEach(layer => {
    project.layers.push({
      name: layer.name,
      visible: layer.visible,
      data: layer.geojson
    });
  });

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}.spinifex`;
  a.click();
  URL.revokeObjectURL(url);

  termPrint(`Exported: ${project.name}.spinifex`, 'green');
}

/**
 * Import project from file
 */
async function importProject(file) {
  try {
    const text = await file.text();
    const project = JSON.parse(text);

    if (!project.layers) {
      throw new Error('Invalid project file');
    }

    // Clear existing
    const { clear, load: loadLayer } = await import('./api.js');
    clear();

    projectName = project.name;

    // Set CRS
    if (project.crs) {
      state.crs = project.crs;
    }

    // Set view
    if (project.view) {
      const map = getMap();
      if (project.view.center) {
        map.getView().setCenter(ol.proj.fromLonLat(project.view.center));
      }
      if (project.view.zoom) {
        map.getView().setZoom(project.view.zoom);
      }
    }

    // Load layers
    for (const layerConfig of project.layers) {
      if (layerConfig.data) {
        const layer = loadLayer(layerConfig.data, layerConfig.name);
        if (layerConfig.visible === false) {
          layer.hide();
        }
      }
    }

    termPrint(`Imported project: ${project.name}`, 'green');
    return true;
  } catch (e) {
    termPrint(`Error importing project: ${e.message}`, 'red');
    return false;
  }
}

// ============================================
// Shell-like file system commands
// ============================================

/**
 * List directory contents (shell-style ls)
 */
async function ls(path = '') {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return [];
  }

  const entries = await listDir(path);

  if (entries.length === 0) {
    termPrint(path ? `Empty directory: ${path}` : 'Empty workspace', 'dim');
    return entries;
  }

  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Format output
  const lines = entries.map(e => {
    if (e.type === 'directory') {
      return `\x1b[34m${e.name}/\x1b[0m`;  // Blue for directories
    }
    return e.name;
  });

  // Print in columns if terminal is wide enough
  const maxLen = Math.max(...entries.map(e => e.name.length)) + 2;
  const cols = Math.floor(60 / maxLen) || 1;

  for (let i = 0; i < lines.length; i += cols) {
    const row = lines.slice(i, i + cols);
    term.writeln('  ' + row.map(s => s.padEnd(maxLen)).join(''));
  }

  return entries;
}

/**
 * Print file contents (shell-style cat)
 */
async function cat(path) {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return null;
  }

  try {
    const content = await readFile(path);
    termPrint(content);
    return content;
  } catch (e) {
    termPrint(`cat: ${path}: No such file`, 'red');
    return null;
  }
}

/**
 * Create directory (shell-style mkdir)
 */
async function mkdir(path) {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return false;
  }

  try {
    if (directoryHandle) {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;
      for (const part of parts) {
        handle = await handle.getDirectoryHandle(part, { create: true });
      }
    } else if (vfs) {
      await vfs.mkdir(path.startsWith('/') ? path : '/' + path);
    }
    termPrint(`Created: ${path}`, 'green');
    return true;
  } catch (e) {
    termPrint(`mkdir: cannot create '${path}': ${e.message}`, 'red');
    return false;
  }
}

/**
 * Copy file (shell-style cp)
 */
async function cp(src, dest) {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return false;
  }

  try {
    const content = await readFile(src);
    await writeFile(dest, content);
    termPrint(`Copied: ${src} -> ${dest}`, 'green');
    return true;
  } catch (e) {
    termPrint(`cp: cannot copy '${src}' to '${dest}': ${e.message}`, 'red');
    return false;
  }
}

/**
 * Move/rename file (shell-style mv)
 */
async function mv(src, dest) {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return false;
  }

  try {
    const content = await readFile(src);
    await writeFile(dest, content);
    await rm(src, true);  // Silent delete
    termPrint(`Moved: ${src} -> ${dest}`, 'green');
    return true;
  } catch (e) {
    termPrint(`mv: cannot move '${src}' to '${dest}': ${e.message}`, 'red');
    return false;
  }
}

/**
 * Remove file (shell-style rm)
 */
async function rm(path, silent = false) {
  if (!directoryHandle && !vfs) {
    if (!silent) termPrint('No workspace connected. Use ws.connect() first.', 'yellow');
    return false;
  }

  try {
    if (directoryHandle) {
      const parts = path.split('/').filter(p => p);
      let handle = directoryHandle;

      // Navigate to parent directory
      for (let i = 0; i < parts.length - 1; i++) {
        handle = await handle.getDirectoryHandle(parts[i]);
      }

      // Remove the file or directory
      const name = parts[parts.length - 1];
      await handle.removeEntry(name, { recursive: true });
    } else if (vfs) {
      await vfs.unlink(path.startsWith('/') ? path : '/' + path);
    }

    if (!silent) termPrint(`Removed: ${path}`, 'green');
    return true;
  } catch (e) {
    if (!silent) termPrint(`rm: cannot remove '${path}': ${e.message}`, 'red');
    return false;
  }
}

/**
 * Print working directory (shell-style pwd)
 */
function pwd() {
  if (!directoryHandle && !vfs) {
    termPrint('No workspace connected', 'yellow');
    return null;
  }

  const name = projectName || '(unnamed workspace)';
  termPrint(name, 'cyan');
  return name;
}

/**
 * Get directory handle (for internal use and tab completion)
 */
export function getDirectoryHandle() {
  return directoryHandle;
}

/**
 * Connect to a workspace from history by name
 */
async function connectToWorkspace(name) {
  const history = await getWorkspaceHistory();
  const entry = history.find(e => e.name === name);

  if (!entry) {
    termPrint(`Workspace not found: ${name}`, 'red');
    return false;
  }

  try {
    const permission = await entry.handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      termPrint(`Permission denied for: ${name}`, 'red');
      return false;
    }

    directoryHandle = entry.handle;
    projectName = entry.name;
    setProjectDirHandle(directoryHandle, writeFile);

    // Update lastAccessed in history
    await storeHandle(entry.handle);

    termPrint(`Connected to workspace: ${projectName}`, 'green');

    await runStartupScript();
    await loadProjectConfig();

    return true;
  } catch (e) {
    termPrint(`Error connecting: ${e.message}`, 'red');
    return false;
  }
}

/**
 * Open recent workspaces window
 */
async function recent() {
  const { openWorkspacesWindow } = await import('../ui/windows.js');
  openWorkspacesWindow();
}

// Export workspace API
export const workspace = {
  new: newProject,
  connect,
  connectTo: connectToWorkspace,
  reconnect: tryReconnect,
  recent,
  save,
  load,
  list,
  export: exportProject,
  import: importProject,
  readFile,
  readFileBuffer,
  writeFile,
  exists,
  listDir,
  getFileHandle,

  // Shell-like commands
  ls,
  cat,
  mkdir,
  cp,
  mv,
  rm,
  pwd,

  get connected() {
    return directoryHandle !== null || vfs !== null;
  },

  get name() {
    return projectName;
  },

  get hasFileSystemAccess() {
    return hasFileSystemAccess;
  }
};

// Export history functions for windows.js
export { getWorkspaceHistory, removeFromHistory, connectToWorkspace };

// Shorthand alias
export const ws = workspace;

// File system namespace (same commands)
export const fs = {
  ls,
  cat,
  mkdir,
  cp,
  mv,
  rm,
  pwd,
  read: readFile,
  write: writeFile,
  exists,
  listDir
};
