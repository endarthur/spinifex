// Spinifex - Spatial Commands
// Turf.js-based spatial operations

import { Layer } from './layer.js';
import { loadGeoJSON } from '../formats/geojson.js';
import { termPrint } from '../ui/terminal.js';

/**
 * Buffer features by a distance
 * @param {Layer} layer - Input layer
 * @param {string|number} distance - Distance (e.g., '500m', '1km', or number in km)
 * @param {object} opts - Options including 'as' for output name
 */
export function buffer(layer, distance, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: buffer(layer, distance)', 'red');
    return null;
  }

  let dist = distance;
  if (typeof distance === 'string') {
    const match = distance.match(/^([\d.]+)(m|km|mi|ft)?$/);
    if (match) {
      dist = parseFloat(match[1]);
      const unit = match[2] || 'km';
      if (unit === 'm') dist /= 1000;
      else if (unit === 'mi') dist *= 1.60934;
      else if (unit === 'ft') dist /= 3280.84;
    }
  }

  const buffered = turf.buffer(layer.geojson, dist, { units: 'kilometers' });
  return loadGeoJSON(opts.as || `${layer.name}_buffer`, buffered);
}

/**
 * Intersect two layers
 */
export function intersect(layer1, layer2, opts = {}) {
  if (!(layer1 instanceof Layer) || !(layer2 instanceof Layer)) {
    termPrint('Usage: intersect(layer1, layer2)', 'red');
    return null;
  }

  const results = [];
  for (const f1 of layer1.features) {
    for (const f2 of layer2.features) {
      try {
        const inter = turf.intersect(turf.featureCollection([f1, f2]));
        if (inter) results.push(inter);
      } catch (e) {
        // Skip invalid geometries
      }
    }
  }

  return loadGeoJSON(
    opts.as || `${layer1.name}_x_${layer2.name}`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Union two layers
 */
export function union(layer1, layer2, opts = {}) {
  if (!(layer1 instanceof Layer) || !(layer2 instanceof Layer)) {
    termPrint('Usage: union(layer1, layer2)', 'red');
    return null;
  }

  const combined = {
    type: 'FeatureCollection',
    features: [...layer1.features, ...layer2.features]
  };

  let result;
  try {
    result = turf.dissolve(combined);
  } catch {
    result = combined;
  }

  return loadGeoJSON(opts.as || `${layer1.name}_union`, result);
}

/**
 * Get centroids of features
 */
export function centroid(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: centroid(layer)', 'red');
    return null;
  }

  const centroids = layer.features.map(f => {
    const c = turf.centroid(f);
    c.properties = { ...f.properties };
    return c;
  });

  return loadGeoJSON(
    opts.as || `${layer.name}_centroids`,
    { type: 'FeatureCollection', features: centroids }
  );
}

/**
 * Clip layer by mask
 */
export function clip(layer, mask, opts = {}) {
  if (!(layer instanceof Layer) || !(mask instanceof Layer)) {
    termPrint('Usage: clip(layer, mask)', 'red');
    return null;
  }

  // Combine mask features into single polygon
  const maskUnion = mask.features.reduce((acc, f) => {
    if (!acc) return f;
    try {
      return turf.union(turf.featureCollection([acc, f]));
    } catch {
      return acc;
    }
  }, null);

  if (!maskUnion) {
    termPrint('Error: Could not create mask geometry', 'red');
    return null;
  }

  const results = [];
  for (const f of layer.features) {
    try {
      const clipped = turf.intersect(turf.featureCollection([f, maskUnion]));
      if (clipped) {
        clipped.properties = { ...f.properties };
        results.push(clipped);
      }
    } catch (e) {
      // Skip invalid geometries
    }
  }

  return loadGeoJSON(
    opts.as || `${layer.name}_clipped`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Dissolve features by attribute
 */
export function dissolve(layer, field, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: dissolve(layer, field)', 'red');
    return null;
  }

  try {
    const dissolved = turf.dissolve(layer.geojson, { propertyName: field });
    return loadGeoJSON(opts.as || `${layer.name}_dissolved`, dissolved);
  } catch (e) {
    termPrint(`Error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Create Voronoi polygons from points
 */
export function voronoi(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: voronoi(points)', 'red');
    return null;
  }

  if (!layer.geomType.includes('Point')) {
    termPrint('Error: voronoi requires point layer', 'red');
    return null;
  }

  try {
    const bbox = turf.bbox(layer.geojson);
    const voronoiPolygons = turf.voronoi(layer.geojson, { bbox });

    // Transfer properties from original points
    voronoiPolygons.features.forEach((vf, i) => {
      if (layer.features[i]) {
        vf.properties = { ...layer.features[i].properties };
      }
    });

    return loadGeoJSON(opts.as || `${layer.name}_voronoi`, voronoiPolygons);
  } catch (e) {
    termPrint(`Error: ${e.message}`, 'red');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spatial Query Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select features from layer that are within the mask polygon(s)
 * @param {Layer} layer - Input layer to filter
 * @param {Layer} mask - Polygon layer defining the area
 * @param {object} opts - Options including 'as' for output name
 */
export function within(layer, mask, opts = {}) {
  if (!(layer instanceof Layer) || !(mask instanceof Layer)) {
    termPrint('Usage: within(layer, maskPolygon)', 'red');
    return null;
  }

  // Combine mask features into a single geometry for testing
  const maskUnion = mask.features.reduce((acc, f) => {
    if (!acc) return f;
    try {
      return turf.union(turf.featureCollection([acc, f]));
    } catch {
      return acc;
    }
  }, null);

  if (!maskUnion) {
    termPrint('Error: Could not create mask geometry', 'red');
    return null;
  }

  const results = layer.features.filter(f => {
    try {
      return turf.booleanWithin(f, maskUnion);
    } catch {
      return false;
    }
  });

  termPrint(`Found ${results.length} of ${layer.count} features within mask`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_within`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Select features from layer1 that contain features from layer2
 * @param {Layer} layer1 - Layer with container features (polygons)
 * @param {Layer} layer2 - Layer with features to test
 * @param {object} opts - Options
 */
export function contains(layer1, layer2, opts = {}) {
  if (!(layer1 instanceof Layer) || !(layer2 instanceof Layer)) {
    termPrint('Usage: contains(containerLayer, testLayer)', 'red');
    return null;
  }

  const results = layer1.features.filter(container => {
    return layer2.features.some(f => {
      try {
        return turf.booleanContains(container, f);
      } catch {
        return false;
      }
    });
  });

  termPrint(`Found ${results.length} of ${layer1.count} features that contain test features`, 'green');

  return loadGeoJSON(
    opts.as || `${layer1.name}_contains`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Select features from layer that intersect with mask (spatial filter)
 * Unlike intersect(), this returns original features, not the intersection geometry
 * @param {Layer} layer - Input layer to filter
 * @param {Layer} mask - Layer to test intersection against
 * @param {object} opts - Options
 */
export function selectByLocation(layer, mask, opts = {}) {
  if (!(layer instanceof Layer) || !(mask instanceof Layer)) {
    termPrint('Usage: selectByLocation(layer, maskLayer)', 'red');
    return null;
  }

  const results = layer.features.filter(f => {
    return mask.features.some(m => {
      try {
        return turf.booleanIntersects(f, m);
      } catch {
        return false;
      }
    });
  });

  termPrint(`Found ${results.length} of ${layer.count} features intersecting mask`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_selected`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Select features from layer that do NOT intersect with mask
 * @param {Layer} layer - Input layer to filter
 * @param {Layer} mask - Layer to test against
 * @param {object} opts - Options
 */
export function disjoint(layer, mask, opts = {}) {
  if (!(layer instanceof Layer) || !(mask instanceof Layer)) {
    termPrint('Usage: disjoint(layer, maskLayer)', 'red');
    return null;
  }

  const results = layer.features.filter(f => {
    return !mask.features.some(m => {
      try {
        return turf.booleanIntersects(f, m);
      } catch {
        return false;
      }
    });
  });

  termPrint(`Found ${results.length} of ${layer.count} features not intersecting mask`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_disjoint`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Find nearest feature in target layer for each feature in source layer
 * @param {Layer} source - Source layer
 * @param {Layer} target - Target layer to find nearest from
 * @param {object} opts - Options including maxDistance
 */
export function nearest(source, target, opts = {}) {
  if (!(source instanceof Layer) || !(target instanceof Layer)) {
    termPrint('Usage: nearest(sourceLayer, targetLayer)', 'red');
    return null;
  }

  const maxDist = opts.maxDistance || Infinity;
  const targetCollection = target.geojson;

  const results = source.features.map(f => {
    try {
      const point = turf.centroid(f);
      const nearestPt = turf.nearestPoint(point, targetCollection);
      const distKm = nearestPt?.properties?.distanceToPoint;

      if (nearestPt && distKm !== undefined && distKm <= maxDist) {
        const nearestIdx = nearestPt.properties.featureIndex;
        const nearestFeature = target.features[nearestIdx];
        return {
          ...f,
          properties: {
            ...f.properties,
            _nearestDist: distKm,
            _nearestIndex: nearestIdx,
            _nearestProps: nearestFeature?.properties || {}
          }
        };
      }
      return f;
    } catch {
      return f;
    }
  });

  return loadGeoJSON(
    opts.as || `${source.name}_nearest`,
    { type: 'FeatureCollection', features: results }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Geoprocessing Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplify geometries using Douglas-Peucker algorithm
 * @param {Layer} layer - Input layer
 * @param {number} tolerance - Simplification tolerance in degrees (default 0.001 ~100m)
 * @param {object} opts - Options
 */
export function simplify(layer, tolerance = 0.001, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: simplify(layer, tolerance)', 'red');
    return null;
  }

  const simplified = turf.simplify(layer.geojson, {
    tolerance: tolerance,
    highQuality: opts.highQuality !== false
  });

  // Count vertex reduction
  const originalVerts = countVertices(layer.geojson);
  const newVerts = countVertices(simplified);
  const reduction = ((1 - newVerts / originalVerts) * 100).toFixed(1);

  termPrint(`Simplified: ${originalVerts} → ${newVerts} vertices (${reduction}% reduction)`, 'green');

  return loadGeoJSON(opts.as || `${layer.name}_simplified`, simplified);
}

/**
 * Count total vertices in a GeoJSON
 */
function countVertices(geojson) {
  let count = 0;
  const countCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      count++;
    } else {
      coords.forEach(countCoords);
    }
  };

  for (const f of geojson.features || [geojson]) {
    if (f.geometry?.coordinates) {
      countCoords(f.geometry.coordinates);
    }
  }
  return count;
}

/**
 * Create convex hull around features
 * @param {Layer} layer - Input layer
 * @param {object} opts - Options including 'each' to create hull per feature
 */
export function convexHull(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: convexHull(layer)', 'red');
    return null;
  }

  // combine: true (default) creates single hull, false creates hull per feature
  const combine = opts.combine !== false;

  try {
    if (!combine) {
      // Create hull for each feature
      const hulls = layer.features.map(f => {
        const hull = turf.convex(turf.featureCollection([f]));
        if (hull) {
          hull.properties = { ...f.properties };
        }
        return hull;
      }).filter(h => h !== null);

      return loadGeoJSON(
        opts.name || opts.as || `${layer.name}_hulls`,
        { type: 'FeatureCollection', features: hulls }
      );
    } else {
      // Create single hull around all features
      const hull = turf.convex(layer.geojson);
      if (!hull) {
        termPrint('Error: Could not create convex hull (need at least 3 points)', 'red');
        return null;
      }
      return loadGeoJSON(
        opts.name || opts.as || `${layer.name}_hull`,
        { type: 'FeatureCollection', features: [hull] }
      );
    }
  } catch (e) {
    termPrint(`Error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Create bounding box polygon(s) around features
 * @param {Layer} layer - Input layer
 * @param {object} opts - Options including 'each' to create bbox per feature
 */
export function envelope(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: envelope(layer)', 'red');
    return null;
  }

  try {
    if (opts.each) {
      // Create bbox for each feature
      const bboxes = layer.features.map(f => {
        const bbox = turf.bboxPolygon(turf.bbox(f));
        bbox.properties = { ...f.properties };
        return bbox;
      });

      return loadGeoJSON(
        opts.as || `${layer.name}_envelopes`,
        { type: 'FeatureCollection', features: bboxes }
      );
    } else {
      // Create single bbox around all features
      const bbox = turf.bboxPolygon(turf.bbox(layer.geojson));
      return loadGeoJSON(
        opts.as || `${layer.name}_envelope`,
        { type: 'FeatureCollection', features: [bbox] }
      );
    }
  } catch (e) {
    termPrint(`Error: ${e.message}`, 'red');
    return null;
  }
}

/**
 * Compute difference (subtract layer2 from layer1)
 * @param {Layer} layer1 - Base layer
 * @param {Layer} layer2 - Layer to subtract
 * @param {object} opts - Options
 */
export function difference(layer1, layer2, opts = {}) {
  if (!(layer1 instanceof Layer) || !(layer2 instanceof Layer)) {
    termPrint('Usage: difference(layer1, layer2)', 'red');
    return null;
  }

  // Combine layer2 features into single geometry for subtraction
  let subtractGeom = null;
  for (const f of layer2.features) {
    if (!subtractGeom) {
      subtractGeom = f;
    } else {
      try {
        // turf.union in v7 takes two features directly
        subtractGeom = turf.union(subtractGeom, f);
      } catch {
        // Keep previous geometry if union fails
      }
    }
  }

  if (!subtractGeom) {
    termPrint('Error: Could not create subtract geometry', 'red');
    return null;
  }

  const results = [];
  for (const f of layer1.features) {
    try {
      // turf.difference in v7 takes two features directly
      const diff = turf.difference(f, subtractGeom);
      if (diff) {
        diff.properties = { ...f.properties };
        results.push(diff);
      }
    } catch {
      // Skip invalid geometries
    }
  }

  return loadGeoJSON(
    opts.name || opts.as || `${layer1.name}_diff`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Calculate area for polygon features and add to properties
 * @param {Layer} layer - Input polygon layer
 * @param {object} opts - Options including 'units' (default: 'kilometers')
 */
export function calcArea(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: calcArea(layer)', 'red');
    return null;
  }

  const units = opts.units || 'kilometers';

  const results = layer.features.map(f => {
    try {
      const areaValue = turf.area(f); // Returns m²
      let convertedArea = areaValue;
      let unitLabel = 'm²';

      if (units === 'kilometers' || units === 'km') {
        convertedArea = areaValue / 1_000_000;
        unitLabel = 'km²';
      } else if (units === 'hectares' || units === 'ha') {
        convertedArea = areaValue / 10_000;
        unitLabel = 'ha';
      } else if (units === 'acres') {
        convertedArea = areaValue / 4046.86;
        unitLabel = 'acres';
      }

      return {
        ...f,
        properties: {
          ...f.properties,
          _area: convertedArea,
          _area_units: unitLabel
        }
      };
    } catch {
      return f;
    }
  });

  termPrint(`Calculated area for ${results.length} features`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_area`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Calculate length for line features and add to properties
 * @param {Layer} layer - Input line layer
 * @param {object} opts - Options including 'units' (default: 'kilometers')
 */
export function calcLength(layer, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: calcLength(layer)', 'red');
    return null;
  }

  const units = opts.units || 'kilometers';

  const results = layer.features.map(f => {
    try {
      const lengthValue = turf.length(f, { units });

      return {
        ...f,
        properties: {
          ...f.properties,
          _length: lengthValue,
          _length_units: units
        }
      };
    } catch {
      return f;
    }
  });

  termPrint(`Calculated length for ${results.length} features`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_length`,
    { type: 'FeatureCollection', features: results }
  );
}

/**
 * Create points along lines at regular intervals
 * @param {Layer} layer - Input line layer
 * @param {number} distance - Distance between points in km
 * @param {object} opts - Options
 */
export function pointsAlongLine(layer, distance = 1, opts = {}) {
  if (!(layer instanceof Layer)) {
    termPrint('Usage: pointsAlongLine(layer, distanceKm)', 'red');
    return null;
  }

  const points = [];

  for (const f of layer.features) {
    try {
      const lineLength = turf.length(f, { units: 'kilometers' });
      let currentDist = 0;

      while (currentDist <= lineLength) {
        const pt = turf.along(f, currentDist, { units: 'kilometers' });
        pt.properties = {
          ...f.properties,
          _distance_along: currentDist
        };
        points.push(pt);
        currentDist += distance;
      }
    } catch {
      // Skip invalid geometries
    }
  }

  termPrint(`Created ${points.length} points along lines`, 'green');

  return loadGeoJSON(
    opts.as || `${layer.name}_points`,
    { type: 'FeatureCollection', features: points }
  );
}
