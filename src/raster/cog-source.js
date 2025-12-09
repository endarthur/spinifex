// Spinifex - COG Tile Source
// Efficient tiled reading of Cloud Optimized GeoTIFFs
// Reads only the tiles needed for the current view

import { termPrint } from '../ui/terminal.js';

// Tile cache
const tileCache = new Map();
const MAX_CACHE_SIZE = 256; // Max tiles to keep in memory

/**
 * Create a DataTile source that reads from a COG file
 * @param {File|FileSystemFileHandle} file - COG file or handle
 * @param {Object} metadata - {width, height, extent, bandCount, overviews}
 * @param {Object} options - {nodata, tileSize}
 */
export async function createCOGTileSource(file, metadata, options = {}) {
  const TILE_SIZE = options.tileSize || 256;
  const nodata = options.nodata ?? -32768;

  // Get geotiff.js
  const GeoTIFF = window.GeoTIFF || await loadGeoTIFFLib();

  // Open the COG
  let tiff;
  if (file instanceof FileSystemFileHandle) {
    const f = await file.getFile();
    const buffer = await f.arrayBuffer();
    tiff = await GeoTIFF.fromArrayBuffer(buffer);
  } else if (file instanceof File) {
    const buffer = await file.arrayBuffer();
    tiff = await GeoTIFF.fromArrayBuffer(buffer);
  } else {
    throw new Error('Invalid file type');
  }

  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const samplesPerPixel = image.getSamplesPerPixel();

  // Check for overviews
  const imageCount = await tiff.getImageCount();
  const overviews = [];
  for (let i = 0; i < imageCount; i++) {
    const img = await tiff.getImage(i);
    overviews.push({
      index: i,
      width: img.getWidth(),
      height: img.getHeight(),
      image: img
    });
  }

  const extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
  const olExtent = ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857');

  // Calculate resolution
  const extentWidth = olExtent[2] - olExtent[0];
  const extentHeight = olExtent[3] - olExtent[1];
  const resolution = Math.max(extentWidth / width, extentHeight / height);

  // Determine zoom levels
  const maxZoom = Math.min(18, Math.ceil(Math.log2(40075016.686 / (resolution * TILE_SIZE))));
  const minZoom = Math.max(0, maxZoom - 8);

  // Cache key prefix
  const cachePrefix = `${file.name || 'cog'}_`;

  /**
   * Select the best overview for a given zoom level
   */
  function selectOverview(targetResolution) {
    // Find overview with resolution closest to (but not worse than) target
    let best = overviews[0];
    for (const ov of overviews) {
      const ovRes = (bbox[2] - bbox[0]) / ov.width;
      if (ovRes <= targetResolution && ov.width < best.width) {
        best = ov;
      }
    }
    return best;
  }

  /**
   * Read a window from the appropriate overview
   */
  async function readWindow(overview, window) {
    const [x, y, w, h] = window;

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(x, overview.width));
    const clampedY = Math.max(0, Math.min(y, overview.height));
    const clampedW = Math.min(w, overview.width - clampedX);
    const clampedH = Math.min(h, overview.height - clampedY);

    if (clampedW <= 0 || clampedH <= 0) {
      return null;
    }

    const rasters = await overview.image.readRasters({
      window: [clampedX, clampedY, clampedX + clampedW, clampedY + clampedH]
    });

    return {
      data: rasters,
      width: clampedW,
      height: clampedH,
      x: clampedX,
      y: clampedY
    };
  }

  // Create the DataTile source
  const source = new ol.source.DataTile({
    projection: 'EPSG:3857',
    tileSize: TILE_SIZE,
    minZoom: minZoom,
    maxZoom: maxZoom,
    bandCount: samplesPerPixel,

    loader: async function(z, x, y) {
      const cacheKey = `${cachePrefix}${z}_${x}_${y}`;

      // Check cache
      if (tileCache.has(cacheKey)) {
        return tileCache.get(cacheKey);
      }

      // Calculate tile bounds in EPSG:3857
      const tileGrid = this.getTileGrid();
      const tileExtent = tileGrid.getTileCoordExtent([z, x, y]);

      // Check if tile intersects our data extent
      if (!ol.extent.intersects(tileExtent, olExtent)) {
        const emptyTile = new Float32Array(TILE_SIZE * TILE_SIZE * samplesPerPixel).fill(nodata);
        return emptyTile;
      }

      // Calculate target resolution for this zoom level
      const tileResolution = (tileExtent[2] - tileExtent[0]) / TILE_SIZE;

      // Select appropriate overview
      const overview = selectOverview(tileResolution);
      const ovResX = (bbox[2] - bbox[0]) / overview.width;
      const ovResY = (bbox[3] - bbox[1]) / overview.height;

      // Calculate window in overview image coordinates
      // Convert tile extent from EPSG:3857 to EPSG:4326
      const tileExtent4326 = ol.proj.transformExtent(tileExtent, 'EPSG:3857', 'EPSG:4326');

      const srcX = Math.floor((tileExtent4326[0] - bbox[0]) / ovResX);
      const srcY = Math.floor((bbox[3] - tileExtent4326[3]) / ovResY);
      const srcW = Math.ceil((tileExtent4326[2] - tileExtent4326[0]) / ovResX);
      const srcH = Math.ceil((tileExtent4326[3] - tileExtent4326[1]) / ovResY);

      try {
        const result = await readWindow(overview, [srcX, srcY, srcW, srcH]);

        if (!result) {
          const emptyTile = new Float32Array(TILE_SIZE * TILE_SIZE * samplesPerPixel).fill(nodata);
          return emptyTile;
        }

        // Resample to tile size
        const tile = new Float32Array(TILE_SIZE * TILE_SIZE * samplesPerPixel);

        for (let ty = 0; ty < TILE_SIZE; ty++) {
          for (let tx = 0; tx < TILE_SIZE; tx++) {
            // Map tile pixel to source pixel
            const sx = Math.floor((tx / TILE_SIZE) * result.width);
            const sy = Math.floor((ty / TILE_SIZE) * result.height);

            if (sx >= 0 && sx < result.width && sy >= 0 && sy < result.height) {
              const srcIdx = sy * result.width + sx;
              const dstIdx = (ty * TILE_SIZE + tx) * samplesPerPixel;

              for (let b = 0; b < samplesPerPixel; b++) {
                tile[dstIdx + b] = result.data[b][srcIdx];
              }
            } else {
              const dstIdx = (ty * TILE_SIZE + tx) * samplesPerPixel;
              for (let b = 0; b < samplesPerPixel; b++) {
                tile[dstIdx + b] = nodata;
              }
            }
          }
        }

        // Cache management
        if (tileCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entries
          const keys = Array.from(tileCache.keys());
          for (let i = 0; i < 32; i++) {
            tileCache.delete(keys[i]);
          }
        }
        tileCache.set(cacheKey, tile);

        return tile;
      } catch (e) {
        console.error('COG tile read error:', e);
        return new Float32Array(TILE_SIZE * TILE_SIZE * samplesPerPixel).fill(nodata);
      }
    }
  });

  return {
    source,
    metadata: {
      width,
      height,
      extent,
      olExtent,
      bandCount: samplesPerPixel,
      overviewCount: imageCount,
      nodata: image.getGDALNoData() ?? nodata
    },
    tiff,
    close: () => {
      // Clear cache entries for this file
      for (const key of tileCache.keys()) {
        if (key.startsWith(cachePrefix)) {
          tileCache.delete(key);
        }
      }
    }
  };
}

/**
 * Load geotiff.js library
 */
async function loadGeoTIFFLib() {
  if (window.GeoTIFF) return window.GeoTIFF;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/geotiff@2.1.0/dist-browser/geotiff.js';
    script.onload = () => resolve(window.GeoTIFF);
    script.onerror = () => reject(new Error('Failed to load GeoTIFF library'));
    document.head.appendChild(script);
  });
}

/**
 * Clear tile cache
 */
export function clearTileCache() {
  tileCache.clear();
  termPrint('Tile cache cleared', 'dim');
}

/**
 * Get tile cache stats
 */
export function getTileCacheStats() {
  return {
    size: tileCache.size,
    maxSize: MAX_CACHE_SIZE
  };
}
