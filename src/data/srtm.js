// Spinifex - SRTM Elevation Data Downloader
// Downloads SRTM tiles from AWS Terrain Tiles (public, no auth required)
// https://registry.opendata.aws/terrain-tiles/

import { termPrint } from '../ui/terminal.js';
import { getMap } from '../ui/map.js';
import { createWebGLRasterLayer, COLOR_RAMPS, RENDER_MODES } from '../raster/webgl-raster.js';

// Dynamic import to avoid circular dependency (api.js -> srtm.js -> workspace.js -> api.js)
async function getWorkspace() {
  const { ws } = await import('../core/workspace.js');
  return ws;
}

// AWS Terrain Tiles - Skadi format (SRTM-style 1°×1° tiles)
const SRTM_BASE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/skadi';

// SRTM GL1 (30m) dimensions: 3601 × 3601 (includes 1px overlap)
const SRTM_SIZE = 3601;
const SRTM_NODATA = -32768;

/**
 * Calculate which SRTM tiles cover a bounding box
 * @param {number} south - Southern latitude
 * @param {number} west - Western longitude
 * @param {number} north - Northern latitude
 * @param {number} east - Eastern longitude
 * @returns {Array<{lat: number, lon: number, name: string, url: string}>}
 */
function calculateTiles(south, west, north, east) {
  const tiles = [];

  // SRTM tiles are named by their SW corner
  // Floor for positive values, floor for negative (towards -infinity)
  const minLat = Math.floor(south);
  const maxLat = Math.floor(north);
  const minLon = Math.floor(west);
  const maxLon = Math.floor(east);

  for (let lat = minLat; lat <= maxLat; lat++) {
    for (let lon = minLon; lon <= maxLon; lon++) {
      const name = getTileName(lat, lon);
      const dir = name.substring(0, 3); // e.g., "N35" or "S33"
      tiles.push({
        lat,
        lon,
        name,
        url: `${SRTM_BASE_URL}/${dir}/${name}.hgt.gz`
      });
    }
  }

  return tiles;
}

/**
 * Get SRTM tile name from lat/lon
 * @param {number} lat - Latitude of SW corner
 * @param {number} lon - Longitude of SW corner
 * @returns {string} Tile name (e.g., "N35E139", "S33W071")
 */
function getTileName(lat, lon) {
  const latPrefix = lat >= 0 ? 'N' : 'S';
  const lonPrefix = lon >= 0 ? 'E' : 'W';
  const latStr = String(Math.abs(lat)).padStart(2, '0');
  const lonStr = String(Math.abs(lon)).padStart(3, '0');
  return `${latPrefix}${latStr}${lonPrefix}${lonStr}`;
}

/**
 * Fetch and decompress a .hgt.gz file
 * @param {string} url - URL to the .hgt.gz file
 * @returns {Promise<Int16Array>} Raw elevation data
 */
async function fetchHGT(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  // Decompress gzip using native DecompressionStream
  const ds = new DecompressionStream('gzip');
  const decompressedStream = response.body.pipeThrough(ds);
  const decompressedData = await new Response(decompressedStream).arrayBuffer();

  // HGT format: 16-bit signed big-endian integers
  const dataView = new DataView(decompressedData);
  const elevations = new Int16Array(SRTM_SIZE * SRTM_SIZE);

  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = dataView.getInt16(i * 2, false); // false = big-endian
  }

  return elevations;
}

/**
 * Calculate min/max elevation stats from data
 * @param {Int16Array} elevations - Elevation data
 * @returns {{min: number, max: number}}
 */
function calculateStats(elevations) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < elevations.length; i++) {
    const val = elevations[i];
    if (val !== SRTM_NODATA) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  return { min, max };
}


/**
 * Mosaic multiple SRTM tiles into a single elevation array
 * @param {Array<{elevations: Int16Array, lat: number, lon: number}>} tiles
 * @param {number} south
 * @param {number} west
 * @param {number} north
 * @param {number} east
 * @returns {{min: number, max: number, elevations: Int16Array, width: number, height: number}}
 */
function mosaicTiles(tiles, south, west, north, east) {
  const latRange = north - south;
  const lonRange = east - west;

  // Calculate output dimensions (approximation based on SRTM resolution)
  // SRTM is ~30m, which is ~0.000278° at equator
  const pixelsPerDegree = SRTM_SIZE - 1; // 3600 pixels per degree
  const width = Math.round(lonRange * pixelsPerDegree);
  const height = Math.round(latRange * pixelsPerDegree);

  const mosaicData = new Int16Array(width * height).fill(SRTM_NODATA);

  // Place each tile into the mosaic
  for (const tile of tiles) {
    const tileWest = tile.lon;
    const tileNorth = tile.lat + 1;

    // Calculate where this tile goes in the output
    for (let ty = 0; ty < SRTM_SIZE; ty++) {
      for (let tx = 0; tx < SRTM_SIZE; tx++) {
        // Tile coordinates to geographic
        const lon = tileWest + (tx / (SRTM_SIZE - 1));
        const lat = tileNorth - (ty / (SRTM_SIZE - 1));

        // Check if within output bounds
        if (lon < west || lon > east || lat < south || lat > north) continue;

        // Geographic to output pixel
        const ox = Math.floor(((lon - west) / lonRange) * (width - 1));
        const oy = Math.floor(((north - lat) / latRange) * (height - 1));

        if (ox >= 0 && ox < width && oy >= 0 && oy < height) {
          const srcIdx = ty * SRTM_SIZE + tx;
          const dstIdx = oy * width + ox;
          mosaicData[dstIdx] = tile.elevations[srcIdx];
        }
      }
    }
  }

  // Calculate stats
  const { min, max } = calculateStats(mosaicData);

  return { min, max, elevations: mosaicData, width, height };
}

/**
 * Download SRTM elevation data for an area
 * @param {Array|Object|undefined} target - Bounding box [s,w,n,e], layer, or undefined for map extent
 * @param {string} name - Optional layer name
 * @returns {Promise<Object>} SRTM layer
 */
export async function srtm(target, name) {
  let south, west, north, east;

  // Determine bounding box
  if (!target) {
    // Use current map extent
    const map = getMap();
    const extent = map.getView().calculateExtent(map.getSize());
    const bbox = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    west = bbox[0];
    south = bbox[1];
    east = bbox[2];
    north = bbox[3];
    termPrint('Using current map extent', 'dim');
  } else if (target.bounds && target.extent) {
    // BoundingBox object - use .bounds for [s,w,n,e] format
    [south, west, north, east] = target.bounds;
    termPrint(`Using drawn box: ${target}`, 'dim');
  } else if (Array.isArray(target) && target.length === 4) {
    // [south, west, north, east] format
    [south, west, north, east] = target;
  } else if (target && target.extent) {
    // Layer with extent property
    const ext = target.extent;
    if (Array.isArray(ext)) {
      // [west, south, east, north] array format
      [west, south, east, north] = ext;
    } else {
      // Object format
      south = ext.minY;
      west = ext.minX;
      north = ext.maxY;
      east = ext.maxX;
    }
    termPrint(`Using extent from: ${target.name}`, 'dim');
  } else {
    termPrint('Usage: srtm() | srtm(await box()) | srtm([s,w,n,e]) | srtm(layer)', 'yellow');
    return null;
  }

  // Validate bounds
  if (south < -60 || north > 60) {
    termPrint('SRTM coverage is limited to -60° to 60° latitude', 'red');
    return null;
  }

  // Check extent size (warn if very large)
  const latRange = north - south;
  const lonRange = east - west;
  const tileCount = Math.ceil(latRange) * Math.ceil(lonRange);

  if (tileCount > 16) {
    termPrint(`Warning: ${tileCount} tiles needed. Consider a smaller extent.`, 'yellow');
  }

  // Calculate required tiles
  const tiles = calculateTiles(south, west, north, east);
  termPrint(`Downloading ${tiles.length} SRTM tile(s)...`, 'dim');

  try {
    // Download all tiles
    const downloadedTiles = [];

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      termPrint(`  Fetching ${tile.name}... (${i + 1}/${tiles.length})`, 'dim');

      try {
        const elevations = await fetchHGT(tile.url);
        downloadedTiles.push({
          ...tile,
          elevations
        });
      } catch (e) {
        termPrint(`  Warning: ${tile.name} not available (ocean/void)`, 'yellow');
      }
    }

    if (downloadedTiles.length === 0) {
      termPrint('No SRTM data available for this area', 'red');
      return null;
    }

    // Process tiles into elevation data
    let min, max, elevations, width, height;

    if (downloadedTiles.length === 1 && latRange <= 1 && lonRange <= 1) {
      // Single tile, full extent
      const tile = downloadedTiles[0];
      const stats = calculateStats(tile.elevations);
      min = stats.min;
      max = stats.max;
      elevations = tile.elevations;
      width = SRTM_SIZE;
      height = SRTM_SIZE;
      // Adjust extent to tile bounds
      west = tile.lon;
      south = tile.lat;
      east = tile.lon + 1;
      north = tile.lat + 1;
    } else {
      // Multiple tiles or partial tile - mosaic
      const result = mosaicTiles(downloadedTiles, south, west, north, east);
      min = result.min;
      max = result.max;
      elevations = result.elevations;
      width = result.width;
      height = result.height;
    }

    const extent = [west, south, east, north];
    const layerName = name || `srtm_${getTileName(Math.floor(south), Math.floor(west))}`;

    // Create WebGL-rendered elevation layer with terrain color ramp
    const layer = createWebGLRasterLayer(elevations, {
      extent,
      width,
      height,
      min,
      max,
      nodata: SRTM_NODATA
    }, layerName, {
      colorRamp: 'terrain',
      mode: RENDER_MODES.SINGLEBAND,
      nodata: SRTM_NODATA
    });

    // Save to workspace if connected (as COG for efficiency)
    const ws = await getWorkspace();
    if (ws.connected) {
      try {
        const sourcePath = `rasters/${layerName}.tif`;

        // Convert to COG using GDAL
        const { toCOG } = await import('../raster/gdal.js');
        const cogBlob = await toCOG(layer, { compress: 'DEFLATE' });
        const cogBuffer = await cogBlob.arrayBuffer();

        // Save COG to workspace
        await ws.writeFile(sourcePath, cogBuffer);

        layer.setSource(sourcePath, 'cog');
        termPrint(`Saved to project: ${sourcePath}`, 'dim');
      } catch (e) {
        // Fall back to legacy format if GDAL fails
        termPrint(`COG save failed, using legacy format: ${e.message}`, 'yellow');
        try {
          const sourcePath = `rasters/${layerName}.srtm`;
          const buffer = new ArrayBuffer(elevations.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < elevations.length; i++) {
            view.setInt16(i * 2, elevations[i], false);
          }
          await ws.writeFile(sourcePath, buffer);
          await ws.writeFile(`${sourcePath}.json`, JSON.stringify({
            format: 'srtm', width, height, extent, min, max, nodata: SRTM_NODATA
          }, null, 2));
          layer.setSource(sourcePath, 'srtm');
        } catch (e2) {
          termPrint(`Could not save to project: ${e2.message}`, 'yellow');
        }
      }
    }

    termPrint(`Loaded SRTM: ${layerName} (${min}m - ${max}m)`, 'green');
    layer.zoom();

    return layer;
  } catch (e) {
    termPrint(`SRTM error: ${e.message}`, 'red');
    console.error(e);
    return null;
  }
}

/**
 * Load SRTM data from a saved .srtm file
 * @param {ArrayBuffer} buffer - The binary elevation data
 * @param {string} name - Layer name
 * @param {Object} metadata - Metadata from sidecar or project.json
 * @returns {Object} SRTM layer
 */
export function loadSRTMFromBuffer(buffer, name, metadata) {
  const { width, height, extent, min, max } = metadata;

  // Parse binary data (big-endian Int16)
  const dataView = new DataView(buffer);
  const elevations = new Int16Array(width * height);

  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = dataView.getInt16(i * 2, false); // false = big-endian
  }

  // Create WebGL raster layer with terrain color ramp
  const layer = createWebGLRasterLayer(elevations, {
    extent,
    width,
    height,
    min,
    max,
    nodata: metadata.nodata || -32768
  }, name, {
    colorRamp: 'terrain',
    mode: RENDER_MODES.SINGLEBAND,
    nodata: metadata.nodata || -32768
  });

  return layer;
}

/**
 * Load SRTM data from workspace files
 * @param {string} sourcePath - Path to .srtm file in workspace
 * @param {string} name - Layer name
 * @returns {Promise<Object>} SRTM layer
 */
export async function loadSRTMFromWorkspace(sourcePath, name) {
  try {
    const ws = await getWorkspace();

    // Load binary data
    const buffer = await ws.readFile(sourcePath);

    // Load metadata sidecar
    const metadataPath = sourcePath + '.json';
    let metadata;

    try {
      const metadataStr = await ws.readFile(metadataPath);
      metadata = JSON.parse(typeof metadataStr === 'string' ? metadataStr : new TextDecoder().decode(metadataStr));
    } catch (e) {
      termPrint(`Could not load SRTM metadata: ${metadataPath}`, 'red');
      return null;
    }

    const layer = loadSRTMFromBuffer(buffer, name, metadata);
    layer.setSource(sourcePath, 'srtm');

    termPrint(`Loaded SRTM: ${name} (${metadata.min}m - ${metadata.max}m)`, 'green');
    return layer;
  } catch (e) {
    termPrint(`Error loading SRTM: ${e.message}`, 'red');
    return null;
  }
}
