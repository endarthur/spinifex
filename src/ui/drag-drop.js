// Spinifex - Drag & Drop Handler
// File drop support for loading various geospatial formats

import { loadFile, getFormatFromExtension } from '../formats/index.js';
import { termPrint, termPrompt } from './terminal.js';

// Store directory handle and writeFile reference for project operations
let projectDirHandle = null;
let writeFileFunc = null;

export function setProjectDirHandle(handle, writeFile) {
  projectDirHandle = handle;
  writeFileFunc = writeFile;
}

/**
 * Initialize drag and drop on the map element
 */
export function initDragDrop() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  mapEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    mapEl.style.outline = '2px dashed var(--accent)';
  });

  mapEl.addEventListener('dragleave', () => {
    mapEl.style.outline = 'none';
  });

  mapEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    mapEl.style.outline = 'none';

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    termPrint('');

    for (const item of items) {
      if (item.kind === 'file') {
        // Try to get file system handle (for checking if in project)
        let fileHandle = null;
        if (item.getAsFileSystemHandle) {
          try {
            fileHandle = await item.getAsFileSystemHandle();
          } catch (e) {
            // Fall back to regular file
          }
        }

        const file = item.getAsFile();
        if (file) {
          await handleFile(file, fileHandle);
        }
      }
    }

    termPrompt();
  });
}

/**
 * Get the appropriate subfolder for a file format
 */
function getSubfolder(format) {
  if (format === 'geotiff') return 'rasters';
  return 'vectors';
}

/**
 * Check if a file handle is inside the project folder
 * Returns the relative path if inside, null if outside
 */
async function getRelativePathInProject(fileHandle) {
  if (!projectDirHandle || !fileHandle) return null;

  try {
    // resolve() returns path segments if file is descendant, null otherwise
    const relativePath = await projectDirHandle.resolve(fileHandle);
    if (relativePath && relativePath.length > 0) {
      return relativePath.join('/');
    }
  } catch (e) {
    // resolve() not supported or other error
  }
  return null;
}

/**
 * Handle a dropped file
 * @param {File} file - The file object
 * @param {FileSystemFileHandle} fileHandle - Optional file system handle for path resolution
 */
async function handleFile(file, fileHandle = null) {
  try {
    const format = getFormatFromExtension(file.name);
    const subfolder = getSubfolder(format);
    let sourcePath = null;

    // If workspace connected, check if file is already in project
    if (projectDirHandle && writeFileFunc) {
      // First check if file is already in project folder
      const existingPath = await getRelativePathInProject(fileHandle);

      if (existingPath) {
        // File is already in project - just reference it
        sourcePath = existingPath;
        termPrint(`Found in project: ${sourcePath}`, 'dim');
      } else {
        // File is outside project - copy it in
        try {
          const content = await file.arrayBuffer();
          const destPath = `${subfolder}/${file.name}`;
          await writeFileFunc(destPath, content);
          sourcePath = destPath;
          termPrint(`Copied to project: ${destPath}`, 'dim');
        } catch (e) {
          termPrint(`Could not copy to project: ${e.message}`, 'yellow');
        }
      }
    }

    const result = await loadFile(file);

    if (result) {
      // Handle single layer or array of layers
      const layers = Array.isArray(result) ? result : [result];

      for (const layer of layers) {
        if (layer && layer.zoom) {
          // Set source path if we have one
          if (sourcePath && layer.setSource) {
            layer.setSource(sourcePath, format);
          }

          layer.zoom();
          // Handle both vector and raster layers
          if (layer.count !== undefined) {
            termPrint(`Loaded: ${layer.name} (${layer.count} features)`, 'green');
          } else if (layer.width !== undefined) {
            termPrint(`Loaded: ${layer.name} (${layer.width}x${layer.height}, ${layer.bands} band${layer.bands > 1 ? 's' : ''})`, 'green');
          } else {
            termPrint(`Loaded: ${layer.name}`, 'green');
          }
        }
      }
    }
  } catch (err) {
    termPrint(`Error loading ${file.name}: ${err.message}`, 'red');
  }
}
