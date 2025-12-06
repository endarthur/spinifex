// Spinifex - Measurement Tools
// Interactive distance, area, and bearing measurement

import { getMap } from './map.js';
import { termPrint } from './terminal.js';

// Measurement state
let measureMode = null; // 'distance', 'area', 'bearing', null
let measurePoints = [];
let measureLayer = null;
let measureSource = null;

// Style for measurement features
const measureStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: 'rgba(74, 158, 255, 0.2)'
  }),
  stroke: new ol.style.Stroke({
    color: '#4a9eff',
    width: 2,
    lineDash: [5, 5]
  }),
  image: new ol.style.Circle({
    radius: 5,
    fill: new ol.style.Fill({ color: '#4a9eff' }),
    stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
  })
});

/**
 * Initialize measurement layer
 */
function ensureMeasureLayer() {
  if (measureLayer) return;

  measureSource = new ol.source.Vector();
  measureLayer = new ol.layer.Vector({
    source: measureSource,
    style: measureStyle,
    zIndex: 1000
  });

  getMap().addLayer(measureLayer);
}

/**
 * Clear measurement features
 */
function clearMeasure() {
  measurePoints = [];
  if (measureSource) {
    measureSource.clear();
  }
}

/**
 * Format distance for display
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  }
  return `${(meters / 1000).toFixed(3)} km`;
}

/**
 * Format area for display
 */
function formatArea(sqMeters) {
  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(1)} m²`;
  }
  if (sqMeters < 1000000) {
    return `${(sqMeters / 10000).toFixed(3)} ha`;
  }
  return `${(sqMeters / 1000000).toFixed(3)} km²`;
}

/**
 * Format bearing for display
 */
function formatBearing(degrees) {
  const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return `${degrees.toFixed(1)}° (${cardinal[index]})`;
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(lon1, lat1, lon2, lat2) {
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Handle map click during measurement
 */
function handleMeasureClick(evt) {
  const coord = ol.proj.toLonLat(evt.coordinate);
  measurePoints.push(coord);

  // Add point feature
  const pointFeature = new ol.Feature({
    geometry: new ol.geom.Point(evt.coordinate)
  });
  measureSource.addFeature(pointFeature);

  if (measureMode === 'distance') {
    if (measurePoints.length >= 2) {
      updateDistanceLine();
    }
  } else if (measureMode === 'area') {
    if (measurePoints.length >= 3) {
      updateAreaPolygon();
    }
  } else if (measureMode === 'bearing') {
    if (measurePoints.length === 2) {
      const [p1, p2] = measurePoints;
      const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
      const distance = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });

      termPrint(`Bearing: ${formatBearing(bearing)}`, 'cyan');
      termPrint(`Distance: ${formatDistance(distance)}`, 'cyan');

      // Draw line
      updateDistanceLine();

      // Stop measuring
      stopMeasure();
    }
  }
}

/**
 * Update distance line feature
 */
function updateDistanceLine() {
  // Remove existing line
  measureSource.getFeatures().forEach(f => {
    if (f.getGeometry().getType() === 'LineString') {
      measureSource.removeFeature(f);
    }
  });

  if (measurePoints.length < 2) return;

  // Create line
  const coords = measurePoints.map(p => ol.proj.fromLonLat(p));
  const lineFeature = new ol.Feature({
    geometry: new ol.geom.LineString(coords)
  });
  measureSource.addFeature(lineFeature);

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < measurePoints.length; i++) {
    totalDistance += turf.distance(
      turf.point(measurePoints[i - 1]),
      turf.point(measurePoints[i]),
      { units: 'meters' }
    );
  }

  termPrint(`Distance: ${formatDistance(totalDistance)}`, 'cyan');
}

/**
 * Update area polygon feature
 */
function updateAreaPolygon() {
  // Remove existing polygon
  measureSource.getFeatures().forEach(f => {
    if (f.getGeometry().getType() === 'Polygon') {
      measureSource.removeFeature(f);
    }
  });

  if (measurePoints.length < 3) return;

  // Close the polygon
  const closedCoords = [...measurePoints, measurePoints[0]];
  const coords = closedCoords.map(p => ol.proj.fromLonLat(p));

  const polygonFeature = new ol.Feature({
    geometry: new ol.geom.Polygon([coords])
  });
  measureSource.addFeature(polygonFeature);

  // Calculate area
  const polygon = turf.polygon([closedCoords]);
  const area = turf.area(polygon);

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 1; i < closedCoords.length; i++) {
    perimeter += turf.distance(
      turf.point(closedCoords[i - 1]),
      turf.point(closedCoords[i]),
      { units: 'meters' }
    );
  }

  termPrint(`Area: ${formatArea(area)}`, 'cyan');
  termPrint(`Perimeter: ${formatDistance(perimeter)}`, 'dim');
}

/**
 * Handle double-click to finish measurement
 */
function handleMeasureDoubleClick(evt) {
  evt.preventDefault();
  evt.stopPropagation();

  if (measureMode === 'distance' && measurePoints.length >= 2) {
    termPrint('Measurement complete. Click to start new measurement.', 'dim');
    clearMeasure();
  } else if (measureMode === 'area' && measurePoints.length >= 3) {
    termPrint('Measurement complete. Click to start new measurement.', 'dim');
    clearMeasure();
  }
}

// Store event handlers for removal
let clickHandler = null;
let dblClickHandler = null;

/**
 * Start distance measurement mode
 */
export function measureDistance() {
  ensureMeasureLayer();
  clearMeasure();

  measureMode = 'distance';
  const map = getMap();

  // Remove existing handlers
  if (clickHandler) {
    map.un('singleclick', clickHandler);
  }
  if (dblClickHandler) {
    map.un('dblclick', dblClickHandler);
  }

  // Add new handlers
  clickHandler = handleMeasureClick;
  dblClickHandler = handleMeasureDoubleClick;

  map.on('singleclick', clickHandler);
  map.on('dblclick', dblClickHandler);

  termPrint('Distance mode: Click points to measure. Double-click to finish.', 'yellow');
}

/**
 * Start area measurement mode
 */
export function measureArea() {
  ensureMeasureLayer();
  clearMeasure();

  measureMode = 'area';
  const map = getMap();

  if (clickHandler) {
    map.un('singleclick', clickHandler);
  }
  if (dblClickHandler) {
    map.un('dblclick', dblClickHandler);
  }

  clickHandler = handleMeasureClick;
  dblClickHandler = handleMeasureDoubleClick;

  map.on('singleclick', clickHandler);
  map.on('dblclick', dblClickHandler);

  termPrint('Area mode: Click 3+ points to measure. Double-click to finish.', 'yellow');
}

/**
 * Start bearing measurement mode
 */
export function measureBearing() {
  ensureMeasureLayer();
  clearMeasure();

  measureMode = 'bearing';
  const map = getMap();

  if (clickHandler) {
    map.un('singleclick', clickHandler);
  }

  clickHandler = handleMeasureClick;
  map.on('singleclick', clickHandler);

  termPrint('Bearing mode: Click start point, then end point.', 'yellow');
}

/**
 * Stop measurement and clear
 */
export function stopMeasure() {
  const map = getMap();

  if (clickHandler) {
    map.un('singleclick', clickHandler);
    clickHandler = null;
  }
  if (dblClickHandler) {
    map.un('dblclick', dblClickHandler);
    dblClickHandler = null;
  }

  measureMode = null;
  clearMeasure();

  termPrint('Measurement stopped.', 'dim');
}

/**
 * Quick distance between two points (non-interactive)
 */
export function distance(point1, point2) {
  let p1, p2;

  if (Array.isArray(point1)) {
    p1 = turf.point(point1);
  } else if (point1.geometry) {
    p1 = point1;
  }

  if (Array.isArray(point2)) {
    p2 = turf.point(point2);
  } else if (point2.geometry) {
    p2 = point2;
  }

  const dist = turf.distance(p1, p2, { units: 'meters' });
  return {
    meters: dist,
    kilometers: dist / 1000,
    formatted: formatDistance(dist)
  };
}

/**
 * Quick area calculation (non-interactive)
 */
export function area(feature) {
  let geom;

  if (feature.geojson) {
    // It's a Layer
    geom = feature.geojson;
  } else if (feature.type === 'FeatureCollection') {
    geom = feature;
  } else if (feature.type === 'Feature') {
    geom = feature;
  } else if (feature.type === 'Polygon' || feature.type === 'MultiPolygon') {
    geom = turf.feature(feature);
  }

  const sqm = turf.area(geom);
  return {
    sqMeters: sqm,
    hectares: sqm / 10000,
    sqKilometers: sqm / 1000000,
    formatted: formatArea(sqm)
  };
}

/**
 * Quick bearing calculation (non-interactive)
 */
export function bearing(point1, point2) {
  let p1 = Array.isArray(point1) ? point1 : point1.geometry.coordinates;
  let p2 = Array.isArray(point2) ? point2 : point2.geometry.coordinates;

  const deg = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
  return {
    degrees: deg,
    formatted: formatBearing(deg)
  };
}

// Export measurement tools
export const measure = {
  distance: measureDistance,
  area: measureArea,
  bearing: measureBearing,
  stop: stopMeasure
};
