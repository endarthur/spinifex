// Spinifex - Workspace Module
// File System Access API integration for persistent workspace

import { state } from './state.js';
import { getMap } from '../ui/map.js';
import { termPrint } from '../ui/terminal.js';
import { VFSLite } from '../lib/xterm-kit/vfs-lite.js';
import { setProjectDirHandle } from '../ui/drag-drop.js';

// Workspace state
let directoryHandle = null;
let projectName = null;
let vfs = null;

// Check if File System Access API is available
const hasFileSystemAccess = 'showDirectoryPicker' in window;

// IndexedDB for storing file handle
const HANDLE_DB_NAME = 'spinifex-handles';
const HANDLE_STORE_NAME = 'handles';

/**
 * Store directory handle in IndexedDB for persistence
 */
async function storeHandle(handle) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      tx.objectStore(HANDLE_STORE_NAME).put(handle, 'workspace');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve stored directory handle from IndexedDB
 */
async function getStoredHandle() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const getRequest = tx.objectStore(HANDLE_STORE_NAME).get('workspace');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
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
            const layer = await loadFromContent(fileContent, layerConfig.name, format);

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
          layerConfigs.push(config);
          termPrint(`Saved new layer: ${layer.name}`, 'dim');
        } catch (e) {
          termPrint(`Could not save layer: ${layer.name} - ${e.message}`, 'yellow');
        }
      } else if (layer.width !== undefined) {
        // Raster without source - can't save
        termPrint(`Raster ${layer.name} has no source file - cannot save`, 'yellow');
      }
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

// Export workspace API
export const workspace = {
  new: newProject,
  connect,
  reconnect: tryReconnect,
  save,
  load,
  list,
  export: exportProject,
  import: importProject,
  readFile,
  writeFile,
  exists,
  listDir,

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

// Shorthand alias
export const ws = workspace;
