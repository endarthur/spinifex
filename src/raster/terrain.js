// Spinifex - Terrain Analysis
// Pure JavaScript implementations for DEM analysis (hillshade, slope, aspect, etc.)
// Faster than GDAL WebAssembly for in-memory rasters
// Supports both projected (meters) and geographic (degrees) coordinate systems

import { termPrint } from '../ui/terminal.js';
import { createWebGLRasterLayer } from './webgl-raster.js';
import { getSetting } from '../core/settings.js';

/**
 * Detect if extent is in geographic coordinates (degrees)
 * @param {number[]} extent - [west, south, east, north]
 * @returns {boolean} True if geographic coordinates
 */
function isGeographic(extent) {
  const [west, south, east, north] = extent;
  // Geographic if extent values are within typical lat/lon ranges
  return west >= -180 && east <= 180 && south >= -90 && north <= 90 &&
         (east - west) < 360 && (north - south) < 180;
}

/**
 * Calculate cell size in meters, handling both projected and geographic coordinates
 * For geographic, uses latitude-based correction (1° lon shrinks toward poles)
 *
 * Respects rc settings:
 *   rc.terrain.autoDetectCRS - Enable/disable auto-detection (default: true)
 *   rc.terrain.assumeProjected - Force projected interpretation (default: false)
 *
 * @param {number[]} extent - [west, south, east, north]
 * @param {number} width - Raster width in pixels
 * @param {number} height - Raster height in pixels
 * @param {Object} options - Override options
 * @param {boolean} options.geographic - Force geographic interpretation
 * @param {boolean} options.projected - Force projected interpretation
 * @returns {{cellSizeX: number, cellSizeY: number, isGeo: boolean}}
 */
function getCellSizeMeters(extent, width, height, options = {}) {
  const [west, south, east, north] = extent;

  // Determine if geographic - check options first, then rc settings, then auto-detect
  let isGeo;
  if (options.geographic === true) {
    isGeo = true;
  } else if (options.projected === true || getSetting('terrain.assumeProjected')) {
    isGeo = false;
  } else if (getSetting('terrain.autoDetectCRS') !== false) {
    isGeo = isGeographic(extent);
  } else {
    isGeo = false;  // Default to projected if auto-detect disabled
  }

  if (!isGeo) {
    // Projected coordinates - assume already in meters (or consistent linear units)
    return {
      cellSizeX: (east - west) / width,
      cellSizeY: (north - south) / height,
      isGeo: false
    };
  }

  // Geographic coordinates - convert degrees to approximate meters
  // Using WGS84 ellipsoid approximation
  const DEG_TO_M_LAT = 111320; // meters per degree latitude (fairly constant)

  // Calculate at center latitude for longitude scaling
  const centerLat = (south + north) / 2;
  const latRad = centerLat * Math.PI / 180;
  const DEG_TO_M_LON = DEG_TO_M_LAT * Math.cos(latRad);

  return {
    cellSizeX: ((east - west) / width) * DEG_TO_M_LON,
    cellSizeY: ((north - south) / height) * DEG_TO_M_LAT,
    isGeo: true
  };
}

/**
 * Generate hillshade from DEM
 * Uses Horn's method for slope/aspect calculation
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - Hillshade options
 * @param {number} options.azimuth - Light azimuth in degrees (default: rc.terrain.defaultAzimuth)
 * @param {number} options.altitude - Light altitude in degrees (default: rc.terrain.defaultAltitude)
 * @param {number} options.zFactor - Vertical exaggeration (default: rc.terrain.defaultZFactor)
 * @param {boolean} options.projected - Force projected coordinate interpretation
 * @param {boolean} options.geographic - Force geographic coordinate interpretation
 * @param {string} options.name - Output layer name
 * @returns {Object} New hillshade layer
 */
export function hillshade(layer, options = {}) {
  if (!layer._data) {
    throw new Error('Invalid raster layer - no data');
  }

  const azimuth = options.azimuth ?? getSetting('terrain.defaultAzimuth');
  const altitude = options.altitude ?? getSetting('terrain.defaultAltitude');
  const zFactor = options.zFactor ?? getSetting('terrain.defaultZFactor');
  const name = options.name || `${layer.name || layer._name}_hillshade`;

  termPrint(`Generating hillshade (az=${azimuth}°, alt=${altitude}°)...`, 'dim');

  // Get metadata from layer - try multiple accessor patterns
  const width = layer.width ?? layer._metadata?.width ?? layer._width;
  const height = layer.height ?? layer._metadata?.height ?? layer._height;
  const extent = layer.extent ?? layer._metadata?.extent ?? layer._extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  if (!extent || !Array.isArray(extent)) {
    throw new Error('Invalid raster layer - no extent');
  }
  if (!width || !height) {
    throw new Error('Invalid raster layer - no dimensions');
  }

  // Calculate cell size in meters (handles geographic coords)
  const { cellSizeX, cellSizeY, isGeo } = getCellSizeMeters(extent, width, height, options);
  if (isGeo) {
    termPrint('  (geographic coords detected, converting to meters)', 'dim');
  }

  // Convert angles to radians
  const azimuthRad = (360 - azimuth + 90) * Math.PI / 180;
  const altitudeRad = altitude * Math.PI / 180;

  // Pre-compute light vector components
  const sinAlt = Math.sin(altitudeRad);
  const cosAlt = Math.cos(altitudeRad);
  const sinAz = Math.sin(azimuthRad);
  const cosAz = Math.cos(azimuthRad);

  // Output array (0-255 grayscale)
  const output = new Uint8Array(width * height);

  // Process each cell using Horn's method (3x3 window)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Get 3x3 neighborhood values (clamp at edges)
      const getVal = (dx, dy) => {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        return data[ny * width + nx] * zFactor;
      };

      const a = getVal(-1, -1), b = getVal(0, -1), c = getVal(1, -1);
      const d = getVal(-1, 0),                      f = getVal(1, 0);
      const g = getVal(-1, 1),  h = getVal(0, 1),  i = getVal(1, 1);

      // Calculate slope using Horn's method
      const dzdx = ((c + 2*f + i) - (a + 2*d + g)) / (8 * cellSizeX);
      const dzdy = ((g + 2*h + i) - (a + 2*b + c)) / (8 * cellSizeY);

      // Calculate slope and aspect
      const slopeRad = Math.atan(Math.sqrt(dzdx*dzdx + dzdy*dzdy));
      const aspectRad = Math.atan2(dzdy, -dzdx);

      // Calculate hillshade value
      const hs = sinAlt * Math.cos(slopeRad) +
                 cosAlt * Math.sin(slopeRad) * Math.cos(azimuthRad - aspectRad);

      // Scale to 0-255
      output[idx] = Math.max(0, Math.min(255, Math.round(hs * 255)));
    }
  }

  // Create new layer - signature is (data, metadata, name, options)
  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: 0
  }, name, {
    colorRamp: 'grayscale',
    mode: 'singleband'
  });

  termPrint(`Hillshade created: ${name}`, 'green');
  return newLayer;
}

/**
 * Calculate slope from DEM
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - Slope options
 * @param {string} options.units - 'degrees' or 'percent' (default: degrees)
 * @param {boolean} options.projected - Force projected coordinate interpretation
 * @param {boolean} options.geographic - Force geographic coordinate interpretation
 * @param {string} options.name - Output layer name
 * @returns {Object} New slope layer
 */
export function slope(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const units = options.units || 'degrees';
  const name = options.name || `${layer.name}_slope`;

  termPrint(`Calculating slope (${units})...`, 'dim');

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  // Calculate cell size in meters (handles geographic coords)
  const { cellSizeX, cellSizeY, isGeo } = getCellSizeMeters(extent, width, height, options);
  if (isGeo) {
    termPrint('  (geographic coords detected, converting to meters)', 'dim');
  }

  // Output array (Float32 for precision)
  const output = new Float32Array(width * height);
  let minVal = Infinity, maxVal = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const getVal = (dx, dy) => {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        return data[ny * width + nx];
      };

      const a = getVal(-1, -1), b = getVal(0, -1), c = getVal(1, -1);
      const d = getVal(-1, 0),                      f = getVal(1, 0);
      const g = getVal(-1, 1),  h = getVal(0, 1),  i = getVal(1, 1);

      const dzdx = ((c + 2*f + i) - (a + 2*d + g)) / (8 * cellSizeX);
      const dzdy = ((g + 2*h + i) - (a + 2*b + c)) / (8 * cellSizeY);

      let slopeVal;
      if (units === 'percent') {
        slopeVal = Math.sqrt(dzdx*dzdx + dzdy*dzdy) * 100;
      } else {
        slopeVal = Math.atan(Math.sqrt(dzdx*dzdx + dzdy*dzdy)) * 180 / Math.PI;
      }

      output[idx] = slopeVal;
      if (slopeVal < minVal) minVal = slopeVal;
      if (slopeVal > maxVal) maxVal = slopeVal;
    }
  }

  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: -9999
  }, name, {
    colorRamp: 'viridis',
    mode: 'singleband',
    stretchMin: minVal,
    stretchMax: maxVal
  });

  termPrint(`Slope created: ${name} (${minVal.toFixed(1)}° - ${maxVal.toFixed(1)}°)`, 'green');
  return newLayer;
}

/**
 * Calculate aspect from DEM
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - Aspect options
 * @param {boolean} options.trigonometric - Use trigonometric convention (default: false = compass)
 * @param {boolean} options.projected - Force projected coordinate interpretation
 * @param {boolean} options.geographic - Force geographic coordinate interpretation
 * @param {string} options.name - Output layer name
 * @returns {Object} New aspect layer
 */
export function aspect(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const name = options.name || `${layer.name}_aspect`;

  termPrint('Calculating aspect...', 'dim');

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  // Calculate cell size in meters (handles geographic coords)
  const { cellSizeX, cellSizeY, isGeo } = getCellSizeMeters(extent, width, height, options);
  if (isGeo) {
    termPrint('  (geographic coords detected, converting to meters)', 'dim');
  }

  const output = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const getVal = (dx, dy) => {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        return data[ny * width + nx];
      };

      const a = getVal(-1, -1), b = getVal(0, -1), c = getVal(1, -1);
      const d = getVal(-1, 0),                      f = getVal(1, 0);
      const g = getVal(-1, 1),  h = getVal(0, 1),  i = getVal(1, 1);

      const dzdx = ((c + 2*f + i) - (a + 2*d + g)) / (8 * cellSizeX);
      const dzdy = ((g + 2*h + i) - (a + 2*b + c)) / (8 * cellSizeY);

      // Check for flat areas
      if (dzdx === 0 && dzdy === 0) {
        output[idx] = -1; // Flat
      } else {
        let aspectDeg = Math.atan2(dzdy, -dzdx) * 180 / Math.PI;

        if (!options.trigonometric) {
          // Convert to compass bearing (0 = North, clockwise)
          aspectDeg = 90 - aspectDeg;
          if (aspectDeg < 0) aspectDeg += 360;
        }

        output[idx] = aspectDeg;
      }
    }
  }

  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: -1
  }, name, {
    colorRamp: 'spectral',
    mode: 'singleband',
    stretchMin: 0,
    stretchMax: 360
  });

  termPrint(`Aspect created: ${name}`, 'green');
  return newLayer;
}

/**
 * Calculate Terrain Ruggedness Index (TRI)
 * Mean absolute difference between center cell and its 8 neighbors
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - TRI options
 * @param {string} options.name - Output layer name
 * @returns {Object} New TRI layer
 */
export function tri(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const name = options.name || `${layer.name}_tri`;

  termPrint('Calculating Terrain Ruggedness Index...', 'dim');

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  const output = new Float32Array(width * height);
  let minVal = Infinity, maxVal = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const center = data[idx];

      const getVal = (dx, dy) => {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        return data[ny * width + nx];
      };

      // Sum of absolute differences from 8 neighbors
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          sum += Math.abs(getVal(dx, dy) - center);
        }
      }

      const triVal = sum / 8;
      output[idx] = triVal;
      if (triVal < minVal) minVal = triVal;
      if (triVal > maxVal) maxVal = triVal;
    }
  }

  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: -9999
  }, name, {
    colorRamp: 'viridis',
    mode: 'singleband',
    stretchMin: minVal,
    stretchMax: maxVal
  });

  termPrint(`TRI created: ${name}`, 'green');
  return newLayer;
}

/**
 * Calculate Topographic Position Index (TPI)
 * Difference between center cell and mean of neighborhood
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - TPI options
 * @param {number} options.radius - Neighborhood radius in cells (default: 1)
 * @param {string} options.name - Output layer name
 * @returns {Object} New TPI layer
 */
export function tpi(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const radius = options.radius || 1;
  const name = options.name || `${layer.name}_tpi`;

  termPrint(`Calculating Topographic Position Index (radius=${radius})...`, 'dim');

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  const output = new Float32Array(width * height);
  let minVal = Infinity, maxVal = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const center = data[idx];

      // Calculate mean of neighborhood
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += data[ny * width + nx];
            count++;
          }
        }
      }

      const mean = sum / count;
      const tpiVal = center - mean;
      output[idx] = tpiVal;
      if (tpiVal < minVal) minVal = tpiVal;
      if (tpiVal > maxVal) maxVal = tpiVal;
    }
  }

  // Symmetric stretch around 0
  const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));

  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: -9999
  }, name, {
    colorRamp: 'bluered',
    mode: 'singleband',
    stretchMin: -absMax,
    stretchMax: absMax
  });

  termPrint(`TPI created: ${name}`, 'green');
  return newLayer;
}

/**
 * Calculate roughness (max elevation difference in neighborhood)
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - Roughness options
 * @param {string} options.name - Output layer name
 * @returns {Object} New roughness layer
 */
export function roughness(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const name = options.name || `${layer.name}_roughness`;

  termPrint('Calculating roughness...', 'dim');

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;

  const output = new Float32Array(width * height);
  let minVal = Infinity, maxVal = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Find min and max in 3x3 neighborhood
      let localMin = Infinity, localMax = -Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const val = data[ny * width + nx];
            if (val < localMin) localMin = val;
            if (val > localMax) localMax = val;
          }
        }
      }

      const roughVal = localMax - localMin;
      output[idx] = roughVal;
      if (roughVal < minVal) minVal = roughVal;
      if (roughVal > maxVal) maxVal = roughVal;
    }
  }

  const newLayer = createWebGLRasterLayer(output, {
    width,
    height,
    extent,
    bandCount: 1,
    nodata: -9999
  }, name, {
    colorRamp: 'viridis',
    mode: 'singleband',
    stretchMin: minVal,
    stretchMax: maxVal
  });

  termPrint(`Roughness created: ${name}`, 'green');
  return newLayer;
}

/**
 * Generate contour lines from DEM using marching squares
 * @param {Object} layer - Spinifex raster layer (DEM)
 * @param {Object} options - Contour options
 * @param {number} options.interval - Contour interval (default: auto)
 * @param {number} options.base - Base contour value (default: 0)
 * @param {string} options.attribute - Elevation attribute name (default: 'elev')
 * @param {string} options.name - Output layer name
 * @returns {Object} New vector layer with contours
 */
export async function contours(layer, options = {}) {
  if (!layer._data || !layer._metadata) {
    throw new Error('Invalid raster layer');
  }

  const width = layer.width || layer._metadata?.width;
  const height = layer.height || layer._metadata?.height;
  const extent = layer.extent || layer._metadata?.extent;
  const data = Array.isArray(layer._data) ? layer._data[0] : layer._data;
  const [west, south, east, north] = extent;

  // Calculate reasonable interval if not specified
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < minZ) minZ = data[i];
    if (data[i] > maxZ) maxZ = data[i];
  }

  const interval = options.interval ?? Math.pow(10, Math.floor(Math.log10((maxZ - minZ) / 10)));
  const base = options.base ?? 0;
  const attribute = options.attribute || 'elev';
  const name = options.name || `${layer.name}_contours`;

  termPrint(`Generating contours (interval=${interval})...`, 'dim');

  const cellWidth = (east - west) / width;
  const cellHeight = (north - south) / height;

  // Generate contour levels
  const levels = [];
  let level = Math.ceil(minZ / interval) * interval;
  while (level <= maxZ) {
    if (level >= base) levels.push(level);
    level += interval;
  }

  // Marching squares contour extraction
  const features = [];

  for (const z of levels) {
    const segments = [];

    // Process each cell
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        // Get corner values
        const tl = data[y * width + x];
        const tr = data[y * width + x + 1];
        const bl = data[(y + 1) * width + x];
        const br = data[(y + 1) * width + x + 1];

        // Calculate case (4-bit index based on which corners are above threshold)
        let caseIndex = 0;
        if (tl >= z) caseIndex |= 8;
        if (tr >= z) caseIndex |= 4;
        if (br >= z) caseIndex |= 2;
        if (bl >= z) caseIndex |= 1;

        // Skip if all corners same side
        if (caseIndex === 0 || caseIndex === 15) continue;

        // Interpolate edge crossings
        const lerp = (v1, v2, t) => v1 + t * (v2 - v1);
        const t = (val1, val2) => (z - val1) / (val2 - val1);

        // Cell corners in map coords
        const x0 = west + x * cellWidth;
        const x1 = west + (x + 1) * cellWidth;
        const y0 = north - y * cellHeight;
        const y1 = north - (y + 1) * cellHeight;

        // Edge midpoints (interpolated)
        const top = [lerp(x0, x1, t(tl, tr)), y0];
        const right = [x1, lerp(y0, y1, t(tr, br))];
        const bottom = [lerp(x0, x1, t(bl, br)), y1];
        const left = [x0, lerp(y0, y1, t(tl, bl))];

        // Generate line segments based on case
        const addSeg = (p1, p2) => segments.push([p1, p2]);

        switch (caseIndex) {
          case 1: case 14: addSeg(left, bottom); break;
          case 2: case 13: addSeg(bottom, right); break;
          case 3: case 12: addSeg(left, right); break;
          case 4: case 11: addSeg(top, right); break;
          case 5: addSeg(left, top); addSeg(bottom, right); break;
          case 6: case 9: addSeg(top, bottom); break;
          case 7: case 8: addSeg(left, top); break;
          case 10: addSeg(top, right); addSeg(left, bottom); break;
        }
      }
    }

    // Connect segments into lines
    if (segments.length > 0) {
      const lines = connectSegments(segments);
      for (const coords of lines) {
        if (coords.length >= 2) {
          features.push({
            type: 'Feature',
            properties: { [attribute]: z },
            geometry: { type: 'LineString', coordinates: coords }
          });
        }
      }
    }
  }

  // Create vector layer
  const geojson = { type: 'FeatureCollection', features };

  const { loadGeoJSON } = await import('../formats/geojson.js');
  const newLayer = loadGeoJSON(name, geojson);

  termPrint(`Contours created: ${name} (${features.length} lines)`, 'green');
  return newLayer;
}

/**
 * Connect line segments into continuous lines
 */
function connectSegments(segments) {
  const lines = [];
  const used = new Set();
  const eps = 1e-10;

  const eq = (p1, p2) => Math.abs(p1[0] - p2[0]) < eps && Math.abs(p1[1] - p2[1]) < eps;

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;

    const line = [...segments[i]];
    used.add(i);

    // Extend line in both directions
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const seg = segments[j];

        if (eq(line[line.length - 1], seg[0])) {
          line.push(seg[1]);
          used.add(j);
          changed = true;
        } else if (eq(line[line.length - 1], seg[1])) {
          line.push(seg[0]);
          used.add(j);
          changed = true;
        } else if (eq(line[0], seg[1])) {
          line.unshift(seg[0]);
          used.add(j);
          changed = true;
        } else if (eq(line[0], seg[0])) {
          line.unshift(seg[1]);
          used.add(j);
          changed = true;
        }
      }
    }

    lines.push(line);
  }

  return lines;
}
