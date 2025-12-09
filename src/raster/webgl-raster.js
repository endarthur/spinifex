// Spinifex - WebGL Raster Rendering
// GPU-accelerated rendering for all raster data using OpenLayers WebGLTile
// Factory functions for creating RasterLayer instances

import { state } from '../core/state.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel, updateStatusBar } from '../ui/layers-panel.js';
import { termPrint } from '../ui/terminal.js';
import { RasterLayer, RENDER_MODES, COLOR_RAMPS } from '../core/raster-layer.js';

// Re-export for backward compatibility
export { RENDER_MODES, COLOR_RAMPS };

// Tile size for WebGL rendering
const TILE_SIZE = 256;

/**
 * Build RGB composite style expression
 * @param {Object} stats - Band statistics {band1: {min, max}, ...}
 * @param {Array} bandMapping - [r, g, b] band numbers (1-based)
 * @param {Object} stretchOverrides - Optional per-channel stretch overrides
 */
export function buildRGBExpression(stats, bandMapping = [1, 2, 3], stretchOverrides = {}) {
  const [rBand, gBand, bBand] = bandMapping;

  const normalize = (band, min, max) => {
    const range = max - min || 1;
    return ['clamp', ['*', 255, ['/', ['-', ['band', band], min], range]], 0, 255];
  };

  const rStats = stretchOverrides.r || stats[`band${rBand}`] || { min: 0, max: 255 };
  const gStats = stretchOverrides.g || stats[`band${gBand}`] || { min: 0, max: 255 };
  const bStats = stretchOverrides.b || stats[`band${bBand}`] || { min: 0, max: 255 };

  return [
    'color',
    normalize(rBand, rStats.min, rStats.max),
    normalize(gBand, gStats.min, gStats.max),
    normalize(bBand, bStats.min, bStats.max),
    1
  ];
}

/**
 * Create a tiled data source from raster array
 */
function createRasterTileSource(data, width, height, extent, options = {}) {
  const nodata = options.nodata ?? -32768;

  if (!extent || extent.length !== 4 ||
      !isFinite(extent[0]) || !isFinite(extent[1]) ||
      !isFinite(extent[2]) || !isFinite(extent[3]) ||
      extent[0] === extent[2] || extent[1] === extent[3]) {
    throw new Error(`Invalid raster extent: ${JSON.stringify(extent)}`);
  }

  const olExtent = ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
  const extentWidth = olExtent[2] - olExtent[0];
  const extentHeight = olExtent[3] - olExtent[1];

  if (!isFinite(extentWidth) || !isFinite(extentHeight) ||
      extentWidth <= 0 || extentHeight <= 0) {
    throw new Error(`Invalid transformed extent: ${JSON.stringify(olExtent)}`);
  }

  const resolution = Math.max(extentWidth / width, extentHeight / height);
  let maxZoom = Math.ceil(Math.log2(40075016.686 / (resolution * TILE_SIZE)));
  if (!isFinite(maxZoom) || maxZoom < 0) maxZoom = 15;
  maxZoom = Math.min(18, Math.max(0, maxZoom));
  const minZoom = Math.max(0, maxZoom - 8);

  const bands = Array.isArray(data) && data.length > 0 && ArrayBuffer.isView(data[0])
    ? data : [data];

  return new ol.source.DataTile({
    projection: 'EPSG:3857',
    tileSize: TILE_SIZE,
    minZoom,
    maxZoom,
    bandCount: bands.length,
    wrapX: false,
    transition: 0,
    interpolate: false,

    loader: function(z, x, y) {
      try {
        const tileSize = 256;
        const worldSize = 2 * Math.PI * 6378137;
        const tileResolution = worldSize / (tileSize * Math.pow(2, z));
        const originX = -worldSize / 2;
        const originY = worldSize / 2;

        const tileExtent = [
          originX + x * tileSize * tileResolution,
          originY - (y + 1) * tileSize * tileResolution,
          originX + (x + 1) * tileSize * tileResolution,
          originY - y * tileSize * tileResolution
        ];

        if (!ol.extent.intersects(tileExtent, olExtent)) return null;

        const pixelsPerTile = TILE_SIZE * TILE_SIZE;
        const bandCount = bands.length;
        const tile = new Float32Array(pixelsPerTile * bandCount);
        tile.fill(nodata);

        for (let ty = 0; ty < TILE_SIZE; ty++) {
          for (let tx = 0; tx < TILE_SIZE; tx++) {
            const mx = tileExtent[0] + (tx + 0.5) * (tileExtent[2] - tileExtent[0]) / TILE_SIZE;
            const my = tileExtent[3] - (ty + 0.5) * (tileExtent[3] - tileExtent[1]) / TILE_SIZE;

            if (mx < olExtent[0] || mx > olExtent[2] || my < olExtent[1] || my > olExtent[3]) continue;

            const sx = Math.floor(((mx - olExtent[0]) / (olExtent[2] - olExtent[0])) * width);
            const sy = Math.floor(((olExtent[3] - my) / (olExtent[3] - olExtent[1])) * height);

            if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
              const srcIdx = sy * width + sx;
              const dstIdx = ty * TILE_SIZE + tx;
              for (let b = 0; b < bandCount; b++) {
                tile[dstIdx * bandCount + b] = bands[b][srcIdx];
              }
            }
          }
        }
        return tile;
      } catch (e) {
        console.error('[WebGL Raster] Tile loader error:', e.message);
        return null;
      }
    }
  });
}

/**
 * Build initial style for a raster layer
 */
function buildInitialStyle(mode, colorRamp, min, max, nodata, bandStats) {
  if (mode === RENDER_MODES.RGB || mode === RENDER_MODES.RGBA) {
    return {
      variables: { nodata },
      color: [
        'case',
        ['==', ['band', 1], ['var', 'nodata']],
        [0, 0, 0, 0],
        buildRGBExpression(bandStats)
      ]
    };
  }

  const ramp = COLOR_RAMPS[colorRamp] || COLOR_RAMPS.grayscale;
  const range = max - min || 1;
  const colorStops = [];

  for (let i = 0; i < ramp.stops.length; i++) {
    const value = min + ramp.stops[i] * range;
    const color = ramp.colors[i];
    colorStops.push(value);
    colorStops.push(['color', color[0], color[1], color[2], 1]);
  }

  return {
    color: [
      'case',
      ['<', ['band', 1], nodata + 1],
      ['color', 0, 0, 0, 0],
      ['interpolate', ['linear'], ['band', 1], ...colorStops]
    ]
  };
}

/**
 * Create a WebGL raster layer
 * @param {TypedArray|Array} data - Raster data
 * @param {Object} metadata - {width, height, extent, min, max, bandStats}
 * @param {string} name - Layer name
 * @param {Object} options - {nodata, colorRamp, mode}
 * @returns {RasterLayer}
 */
export function createWebGLRasterLayer(data, metadata, name, options = {}) {
  const { width, height, extent } = metadata;
  const nodata = options.nodata ?? -32768;

  const bands = Array.isArray(data) && data.length > 0 && ArrayBuffer.isView(data[0])
    ? data : [data];
  const bandCount = bands.length;

  let mode = options.mode;
  if (!mode) {
    mode = bandCount >= 3 ? RENDER_MODES.RGB :
           (options.colorRamp ? RENDER_MODES.SINGLEBAND : RENDER_MODES.GRAYSCALE);
  }

  const min = metadata.min ?? 0;
  const max = metadata.max ?? 255;
  const bandStats = metadata.bandStats || {
    band1: { min, max },
    band2: { min, max },
    band3: { min, max }
  };

  const colorRamp = options.colorRamp || (mode === RENDER_MODES.SINGLEBAND ? 'terrain' : 'grayscale');

  // Create OpenLayers layer
  const source = createRasterTileSource(data, width, height, extent, { nodata, bandCount });
  const style = buildInitialStyle(mode, colorRamp, min, max, nodata, bandStats);

  const webglLayer = new ol.layer.WebGLTile({
    source,
    style,
    preload: 0,
    cacheSize: 128
  });

  const map = getMap();
  map.addLayer(webglLayer);

  // Create RasterLayer instance
  const id = `webgl_raster_${state.layerCounter++}`;
  const zIndex = state.zIndexCounter++;
  webglLayer.setZIndex(zIndex);

  const fullMetadata = { ...metadata, bandCount };

  const layer = new RasterLayer(id, name, webglLayer, fullMetadata, data, {
    zIndex,
    colorRamp,
    mode,
    bandStats
  });

  // Register layer
  state.layers.set(id, layer);

  import('../core/api.js').then(({ ly }) => {
    ly[name] = layer;
  });

  updateLayerPanel();
  updateStatusBar();

  return layer;
}

// Backward compatibility alias
export const createWebGLElevationLayer = createWebGLRasterLayer;
