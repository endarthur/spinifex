// Spinifex - Interpolation Methods
// Spatial interpolation from point data to raster grids

import { createWebGLRasterLayer, RENDER_MODES } from './webgl-raster.js';
import { termPrint } from '../ui/terminal.js';

// Use global turf (loaded via CDN)
const turf = window.turf;

/**
 * Inverse Distance Weighting (IDW) Interpolation
 *
 * Creates a continuous raster surface from scattered point data.
 * Each cell value is a weighted average of nearby points, where
 * weights decrease with distance (inverse distance^power).
 *
 * @param {Object} layer - Vector layer with point features
 * @param {Object} options - IDW parameters
 * @param {string} options.field - Property field containing values to interpolate (required)
 * @param {number} [options.power=2] - Distance weighting exponent (higher = more local)
 * @param {number} [options.resolution=100] - Output raster width in pixels
 * @param {number[]} [options.extent] - Output extent [minX, minY, maxX, maxY]
 * @param {number} [options.searchRadius] - Maximum search distance (in degrees)
 * @param {number} [options.maxPoints] - Max number of nearest points to use
 * @param {number} [options.minPoints=1] - Min points required for valid output
 * @param {number} [options.nodata=-9999] - NoData value for cells with insufficient points
 * @param {string} [options.name] - Output layer name
 * @returns {Object} Raster layer with interpolated values
 */
export function idw(layer, options = {}) {
  // Validate inputs
  if (!layer || !layer.geojson) {
    throw new Error('IDW requires a vector layer with point data');
  }

  const field = options.field;
  if (!field) {
    throw new Error('IDW requires a "field" option specifying which property to interpolate');
  }

  // Extract point data
  const points = extractPoints(layer.geojson, field);

  if (points.length < 2) {
    throw new Error(`IDW requires at least 2 points with valid "${field}" values, found ${points.length}`);
  }

  termPrint(`IDW interpolation: ${points.length} points, field="${field}"`, 'dim');

  // Parameters
  const power = options.power ?? 2;
  const resolution = options.resolution ?? 100;
  const searchRadius = options.searchRadius ?? Infinity;
  const maxPoints = options.maxPoints ?? Infinity;
  const minPoints = options.minPoints ?? 1;
  const nodata = options.nodata ?? -9999;
  const name = options.name || `${layer.name || 'idw'}_interpolated`;

  // Calculate extent (with buffer if not specified)
  const extent = options.extent || calculateExtent(points, 0.1);
  const [minX, minY, maxX, maxY] = extent;

  // Calculate grid dimensions
  const aspectRatio = (maxY - minY) / (maxX - minX);
  const width = resolution;
  const height = Math.max(1, Math.round(resolution * aspectRatio));

  // Cell dimensions
  const cellWidth = (maxX - minX) / width;
  const cellHeight = (maxY - minY) / height;

  termPrint(`  Grid: ${width}x${height} cells (${(cellWidth * 111).toFixed(1)}km x ${(cellHeight * 111).toFixed(1)}km per cell)`, 'dim');

  // Build spatial index for faster queries (simple grid-based)
  const spatialIndex = buildSpatialIndex(points, extent, Math.ceil(width / 10));

  // Perform interpolation
  const pixelCount = width * height;
  const output = new Float32Array(pixelCount);

  let validCount = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;

      // Cell center coordinates
      const cellX = minX + (col + 0.5) * cellWidth;
      const cellY = maxY - (row + 0.5) * cellHeight; // Y flips (raster is top-down)

      // Perform IDW calculation
      const value = idwInterpolate(
        cellX, cellY, points, spatialIndex,
        power, searchRadius, maxPoints, minPoints, nodata
      );

      output[idx] = value;

      if (value !== nodata) {
        validCount++;
        if (value < minVal) minVal = value;
        if (value > maxVal) maxVal = value;
      }
    }
  }

  if (validCount === 0) {
    throw new Error('IDW interpolation produced no valid values');
  }

  termPrint(`  Interpolated ${validCount}/${pixelCount} cells, range: ${minVal.toFixed(2)} - ${maxVal.toFixed(2)}`, 'dim');

  // Create raster layer
  const metadata = {
    width,
    height,
    extent,
    bandCount: 1,
    bandStats: {
      band1: { min: minVal, max: maxVal }
    },
    min: minVal,
    max: maxVal,
    nodata,
    description: `IDW interpolation of "${field}" (power=${power})`
  };

  const rasterLayer = createWebGLRasterLayer([output], metadata, name, {
    mode: RENDER_MODES.SINGLEBAND,
    nodata
  });

  // Set sensible defaults for visualization
  rasterLayer.r.colorRamp('viridis');
  rasterLayer.r.stretch(minVal, maxVal);

  termPrint(`Created: ${name}`, 'green');

  rasterLayer.zoom();

  return rasterLayer;
}

/**
 * Extract point coordinates and values from GeoJSON
 */
function extractPoints(geojson, field) {
  const points = [];

  for (const feature of geojson.features) {
    // Skip non-point geometries
    const geom = feature.geometry;
    if (!geom) continue;

    let coords;
    if (geom.type === 'Point') {
      coords = [geom.coordinates];
    } else if (geom.type === 'MultiPoint') {
      coords = geom.coordinates;
    } else {
      // For polygons/lines, use centroid
      try {
        const centroid = turf.centroid(feature);
        coords = [centroid.geometry.coordinates];
      } catch {
        continue;
      }
    }

    // Get value
    const value = feature.properties?.[field];
    if (value === undefined || value === null || isNaN(Number(value))) {
      continue;
    }

    const numValue = Number(value);

    // Add each coordinate
    for (const [x, y] of coords) {
      points.push({ x, y, value: numValue });
    }
  }

  return points;
}

/**
 * Calculate extent from points with optional buffer
 */
function calculateExtent(points, bufferFraction = 0.1) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Add buffer
  const bufferX = (maxX - minX) * bufferFraction;
  const bufferY = (maxY - minY) * bufferFraction;

  // Ensure minimum extent (avoid zero-size)
  const minSize = 0.001; // ~100m in degrees
  if (maxX - minX < minSize) {
    const mid = (maxX + minX) / 2;
    minX = mid - minSize / 2;
    maxX = mid + minSize / 2;
  }
  if (maxY - minY < minSize) {
    const mid = (maxY + minY) / 2;
    minY = mid - minSize / 2;
    maxY = mid + minSize / 2;
  }

  return [
    minX - bufferX,
    minY - bufferY,
    maxX + bufferX,
    maxY + bufferY
  ];
}

/**
 * Build simple grid-based spatial index
 */
function buildSpatialIndex(points, extent, gridSize = 10) {
  const [minX, minY, maxX, maxY] = extent;
  const cellWidth = (maxX - minX) / gridSize;
  const cellHeight = (maxY - minY) / gridSize;

  // Initialize grid
  const grid = [];
  for (let i = 0; i < gridSize * gridSize; i++) {
    grid.push([]);
  }

  // Assign points to grid cells
  for (const p of points) {
    let col = Math.floor((p.x - minX) / cellWidth);
    let row = Math.floor((p.y - minY) / cellHeight);

    // Clamp to grid bounds
    col = Math.max(0, Math.min(gridSize - 1, col));
    row = Math.max(0, Math.min(gridSize - 1, row));

    grid[row * gridSize + col].push(p);
  }

  return {
    grid,
    gridSize,
    extent,
    cellWidth,
    cellHeight
  };
}

/**
 * Find points within search radius using spatial index
 */
function findNearbyPoints(x, y, index, searchRadius) {
  const { grid, gridSize, extent, cellWidth, cellHeight } = index;
  const [minX, minY] = extent;

  // If no radius limit, return all points
  if (!isFinite(searchRadius)) {
    return grid.flat();
  }

  // Calculate grid cells to search
  const cellsToSearch = Math.ceil(searchRadius / Math.min(cellWidth, cellHeight)) + 1;

  let col = Math.floor((x - minX) / cellWidth);
  let row = Math.floor((y - minY) / cellHeight);

  col = Math.max(0, Math.min(gridSize - 1, col));
  row = Math.max(0, Math.min(gridSize - 1, row));

  // Gather points from nearby cells
  const nearby = [];
  const radiusSq = searchRadius * searchRadius;

  for (let dr = -cellsToSearch; dr <= cellsToSearch; dr++) {
    for (let dc = -cellsToSearch; dc <= cellsToSearch; dc++) {
      const nr = row + dr;
      const nc = col + dc;

      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;

      const cellPoints = grid[nr * gridSize + nc];
      for (const p of cellPoints) {
        const dx = p.x - x;
        const dy = p.y - y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= radiusSq) {
          nearby.push(p);
        }
      }
    }
  }

  return nearby;
}

/**
 * Perform IDW interpolation for a single cell
 */
function idwInterpolate(x, y, allPoints, spatialIndex, power, searchRadius, maxPoints, minPoints, nodata) {
  // Get candidate points
  let points = findNearbyPoints(x, y, spatialIndex, searchRadius);

  // If not enough points within radius, return nodata
  if (points.length < minPoints) {
    // Fall back to all points if search radius was limiting
    if (isFinite(searchRadius)) {
      points = allPoints;
    }
    if (points.length < minPoints) {
      return nodata;
    }
  }

  // Calculate distances and check for exact matches
  const withDist = [];
  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If we're exactly at a point, return its value
    if (dist < 1e-10) {
      return p.value;
    }

    withDist.push({ point: p, dist });
  }

  // Sort by distance and limit to maxPoints
  if (withDist.length > maxPoints) {
    withDist.sort((a, b) => a.dist - b.dist);
    withDist.length = maxPoints;
  }

  // Calculate IDW weighted average
  let sumWeightedValue = 0;
  let sumWeight = 0;

  for (const { point, dist } of withDist) {
    const weight = 1 / Math.pow(dist, power);
    sumWeightedValue += weight * point.value;
    sumWeight += weight;
  }

  if (sumWeight === 0) {
    return nodata;
  }

  return sumWeightedValue / sumWeight;
}

/**
 * Add IDW result as a new band to an existing raster
 *
 * @param {Object} rasterLayer - Existing raster layer to add band to
 * @param {Object} pointLayer - Vector layer with point data
 * @param {Object} options - IDW options (same as idw())
 * @returns {Object} The raster layer with new band added
 */
export function idwToBand(rasterLayer, pointLayer, options = {}) {
  if (!rasterLayer || !rasterLayer.r) {
    throw new Error('idwToBand requires a raster layer');
  }

  const field = options.field;
  if (!field) {
    throw new Error('idwToBand requires a "field" option');
  }

  // Extract points
  const points = extractPoints(pointLayer.geojson, field);
  if (points.length < 2) {
    throw new Error(`Need at least 2 points, found ${points.length}`);
  }

  // Get raster geometry
  const rasterData = rasterLayer.r.data();
  const { width, height, extent } = rasterData;
  const [minX, minY, maxX, maxY] = extent;

  const cellWidth = (maxX - minX) / width;
  const cellHeight = (maxY - minY) / height;

  // IDW parameters
  const power = options.power ?? 2;
  const searchRadius = options.searchRadius ?? Infinity;
  const maxPoints = options.maxPoints ?? Infinity;
  const minPoints = options.minPoints ?? 1;
  const nodata = options.nodata ?? rasterData.noData;
  const bandName = options.name || `idw_${field}`;

  // Build spatial index
  const spatialIndex = buildSpatialIndex(points, extent, Math.ceil(width / 10));

  // Interpolate
  const pixelCount = width * height;
  const output = new Float32Array(pixelCount);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const cellX = minX + (col + 0.5) * cellWidth;
      const cellY = maxY - (row + 0.5) * cellHeight;

      output[idx] = idwInterpolate(
        cellX, cellY, points, spatialIndex,
        power, searchRadius, maxPoints, minPoints, nodata
      );
    }
  }

  // Add as new band
  rasterLayer.r.addBand(output, bandName, { noData: nodata });

  termPrint(`Added band "${bandName}" to ${rasterLayer.name || 'raster'}`, 'green');

  return rasterLayer;
}

/**
 * Radial Basis Function (RBF) Interpolation
 *
 * Creates a continuous raster surface from scattered point data using
 * radial basis functions. RBF interpolation produces smoother surfaces
 * than IDW and can extrapolate beyond the convex hull of input points.
 *
 * @param {Object} layer - Vector layer with point features
 * @param {Object} options - RBF parameters
 * @param {string} options.field - Property field containing values to interpolate (required)
 * @param {string} [options.kernel='gaussian'] - Kernel function: 'gaussian', 'multiquadric', 'inverse_multiquadric', 'thin_plate', 'linear'
 * @param {number} [options.epsilon] - Shape parameter (auto-calculated if not specified)
 * @param {number} [options.resolution=100] - Output raster width in pixels
 * @param {number[]} [options.extent] - Output extent [minX, minY, maxX, maxY]
 * @param {number} [options.smooth=0] - Smoothing factor (0 = exact interpolation)
 * @param {number} [options.nodata=-9999] - NoData value
 * @param {string} [options.name] - Output layer name
 * @returns {Object} Raster layer with interpolated values
 */
export function rbf(layer, options = {}) {
  // Validate inputs
  if (!layer || !layer.geojson) {
    throw new Error('RBF requires a vector layer with point data');
  }

  const field = options.field;
  if (!field) {
    throw new Error('RBF requires a "field" option specifying which property to interpolate');
  }

  // Extract point data (reuse helper from IDW)
  const points = extractPoints(layer.geojson, field);

  if (points.length < 3) {
    throw new Error(`RBF requires at least 3 points with valid "${field}" values, found ${points.length}`);
  }

  termPrint(`RBF interpolation: ${points.length} points, field="${field}"`, 'dim');

  // Parameters
  const kernel = options.kernel || 'gaussian';
  const resolution = options.resolution ?? 100;
  const smooth = options.smooth ?? 0;
  const nodata = options.nodata ?? -9999;
  const name = options.name || `${layer.name || 'rbf'}_interpolated`;

  // Calculate extent (with buffer if not specified)
  const extent = options.extent || calculateExtent(points, 0.1);
  const [minX, minY, maxX, maxY] = extent;

  // Calculate grid dimensions
  const aspectRatio = (maxY - minY) / (maxX - minX);
  const width = resolution;
  const height = Math.max(1, Math.round(resolution * aspectRatio));

  // Cell dimensions
  const cellWidth = (maxX - minX) / width;
  const cellHeight = (maxY - minY) / height;

  termPrint(`  Kernel: ${kernel}, Grid: ${width}x${height}`, 'dim');

  // Auto-calculate epsilon (shape parameter) based on average point spacing
  let epsilon = options.epsilon;
  if (!epsilon) {
    epsilon = calculateAutoEpsilon(points);
    termPrint(`  Auto epsilon: ${epsilon.toFixed(4)}`, 'dim');
  }

  // Get kernel function
  const kernelFn = getKernelFunction(kernel);

  // Build distance matrix and solve for weights
  const n = points.length;
  const distMatrix = new Float64Array(n * n);
  const values = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    values[i] = points[i].value;
    for (let j = 0; j < n; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const r = Math.sqrt(dx * dx + dy * dy);
      distMatrix[i * n + j] = kernelFn(r, epsilon);
    }
    // Add smoothing to diagonal
    distMatrix[i * n + i] += smooth;
  }

  // Solve linear system for weights using Gaussian elimination
  const weights = solveLinearSystem(distMatrix, values, n);

  if (!weights) {
    throw new Error('RBF: Failed to solve linear system (matrix may be singular)');
  }

  // Perform interpolation
  const pixelCount = width * height;
  const output = new Float32Array(pixelCount);

  let validCount = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;

      // Cell center coordinates
      const cellX = minX + (col + 0.5) * cellWidth;
      const cellY = maxY - (row + 0.5) * cellHeight;

      // Calculate RBF value
      let value = 0;
      for (let i = 0; i < n; i++) {
        const dx = cellX - points[i].x;
        const dy = cellY - points[i].y;
        const r = Math.sqrt(dx * dx + dy * dy);
        value += weights[i] * kernelFn(r, epsilon);
      }

      output[idx] = value;
      validCount++;

      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    }
  }

  termPrint(`  Interpolated ${validCount} cells, range: ${minVal.toFixed(2)} - ${maxVal.toFixed(2)}`, 'dim');

  // Create raster layer
  const metadata = {
    width,
    height,
    extent,
    bandCount: 1,
    bandStats: {
      band1: { min: minVal, max: maxVal }
    },
    min: minVal,
    max: maxVal,
    nodata,
    description: `RBF interpolation of "${field}" (kernel=${kernel}, epsilon=${epsilon.toFixed(4)})`
  };

  const rasterLayer = createWebGLRasterLayer([output], metadata, name, {
    mode: RENDER_MODES.SINGLEBAND,
    nodata
  });

  // Set sensible defaults for visualization
  rasterLayer.r.colorRamp('viridis');
  rasterLayer.r.stretch(minVal, maxVal);

  termPrint(`Created: ${name}`, 'green');

  rasterLayer.zoom();

  return rasterLayer;
}

/**
 * Get kernel function by name
 */
function getKernelFunction(kernel) {
  const kernels = {
    // Gaussian: e^(-(r/ε)²) - smooth, localized influence
    gaussian: (r, epsilon) => Math.exp(-(r * r) / (epsilon * epsilon)),

    // Multiquadric: sqrt(1 + (r/ε)²) - smooth, global influence
    multiquadric: (r, epsilon) => Math.sqrt(1 + (r * r) / (epsilon * epsilon)),

    // Inverse Multiquadric: 1/sqrt(1 + (r/ε)²) - smooth, localized
    inverse_multiquadric: (r, epsilon) => 1 / Math.sqrt(1 + (r * r) / (epsilon * epsilon)),

    // Thin Plate Spline: r²·ln(r) - smooth, good for surfaces
    thin_plate: (r, epsilon) => {
      if (r < 1e-10) return 0;
      const re = r / epsilon;
      return re * re * Math.log(re + 1e-10);
    },

    // Linear: r - simple, piecewise linear
    linear: (r, epsilon) => r / epsilon,
  };

  const fn = kernels[kernel.toLowerCase()];
  if (!fn) {
    const available = Object.keys(kernels).join(', ');
    throw new Error(`Unknown kernel "${kernel}". Available: ${available}`);
  }
  return fn;
}

/**
 * Calculate automatic epsilon based on average nearest-neighbor distance
 */
function calculateAutoEpsilon(points) {
  const n = points.length;
  if (n < 2) return 1;

  // For each point, find distance to nearest neighbor
  let sumMinDist = 0;
  for (let i = 0; i < n; i++) {
    let minDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    sumMinDist += minDist;
  }

  // Use average nearest-neighbor distance as epsilon
  // Multiply by factor to ensure smooth interpolation
  return (sumMinDist / n) * 1.5;
}

/**
 * Solve linear system Ax = b using Gaussian elimination with partial pivoting
 * Returns null if matrix is singular
 */
function solveLinearSystem(A, b, n) {
  // Create augmented matrix [A|b]
  const augmented = new Float64Array((n + 1) * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      augmented[i * (n + 1) + j] = A[i * n + j];
    }
    augmented[i * (n + 1) + n] = b[i];
  }

  // Forward elimination with partial pivoting
  for (let k = 0; k < n; k++) {
    // Find pivot
    let maxVal = Math.abs(augmented[k * (n + 1) + k]);
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      const val = Math.abs(augmented[i * (n + 1) + k]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = i;
      }
    }

    // Check for singular matrix
    if (maxVal < 1e-12) {
      return null;
    }

    // Swap rows
    if (maxRow !== k) {
      for (let j = k; j <= n; j++) {
        const temp = augmented[k * (n + 1) + j];
        augmented[k * (n + 1) + j] = augmented[maxRow * (n + 1) + j];
        augmented[maxRow * (n + 1) + j] = temp;
      }
    }

    // Eliminate column
    for (let i = k + 1; i < n; i++) {
      const factor = augmented[i * (n + 1) + k] / augmented[k * (n + 1) + k];
      for (let j = k; j <= n; j++) {
        augmented[i * (n + 1) + j] -= factor * augmented[k * (n + 1) + j];
      }
    }
  }

  // Back substitution
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i * (n + 1) + n];
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i * (n + 1) + j] * x[j];
    }
    x[i] = sum / augmented[i * (n + 1) + i];
  }

  return x;
}

export default idw;
