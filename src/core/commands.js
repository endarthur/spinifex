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
