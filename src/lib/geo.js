// Spinifex - Geometry Utilities
// Constants and helper functions for geometric and CRS operations

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate Reference Systems
// ─────────────────────────────────────────────────────────────────────────────

/** WGS84 geographic coordinate system (lat/lon) */
export const WGS84 = 'EPSG:4326';

/** Web Mercator projection (Google/OSM) */
export const WEB_MERCATOR = 'EPSG:3857';

/** Default CRS for geographic data */
export const DEFAULT_CRS = WGS84;

/** Default CRS for map display */
export const MAP_CRS = WEB_MERCATOR;

// ─────────────────────────────────────────────────────────────────────────────
// Angular Conversion
// ─────────────────────────────────────────────────────────────────────────────

/** Degrees to radians conversion factor */
export const DEG_TO_RAD = Math.PI / 180;

/** Radians to degrees conversion factor */
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function toRadians(degrees) {
  return degrees * DEG_TO_RAD;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function toDegrees(radians) {
  return radians * RAD_TO_DEG;
}

// ─────────────────────────────────────────────────────────────────────────────
// Distance Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Earth's mean radius in meters */
export const EARTH_RADIUS_M = 6371008.8;

/** Earth's mean radius in kilometers */
export const EARTH_RADIUS_KM = 6371.0088;

/** Meters per degree of latitude (approximate) */
export const METERS_PER_DEG_LAT = 111320;

/**
 * Calculate meters per degree of longitude at given latitude
 * @param {number} lat - Latitude in degrees
 * @returns {number} Meters per degree of longitude
 */
export function metersPerDegLon(lat) {
  return METERS_PER_DEG_LAT * Math.cos(toRadians(lat));
}

// ─────────────────────────────────────────────────────────────────────────────
// CRS Transformation Helpers
// Uses OpenLayers proj module when available
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform extent from WGS84 to Web Mercator
 * @param {number[]} extent - [minX, minY, maxX, maxY] in WGS84
 * @returns {number[]} Extent in Web Mercator
 */
export function extentToWebMercator(extent) {
  if (typeof ol !== 'undefined' && ol.proj?.transformExtent) {
    return ol.proj.transformExtent(extent, WGS84, WEB_MERCATOR);
  }
  // Fallback: simple projection (may be inaccurate at high latitudes)
  const [minLon, minLat, maxLon, maxLat] = extent;
  return [
    minLon * 20037508.34 / 180,
    Math.log(Math.tan((90 + minLat) * DEG_TO_RAD / 2)) * 20037508.34 / Math.PI,
    maxLon * 20037508.34 / 180,
    Math.log(Math.tan((90 + maxLat) * DEG_TO_RAD / 2)) * 20037508.34 / Math.PI
  ];
}

/**
 * Transform extent from Web Mercator to WGS84
 * @param {number[]} extent - [minX, minY, maxX, maxY] in Web Mercator
 * @returns {number[]} Extent in WGS84
 */
export function extentToWGS84(extent) {
  if (typeof ol !== 'undefined' && ol.proj?.transformExtent) {
    return ol.proj.transformExtent(extent, WEB_MERCATOR, WGS84);
  }
  // Fallback
  const [minX, minY, maxX, maxY] = extent;
  return [
    minX * 180 / 20037508.34,
    (2 * Math.atan(Math.exp(minY * Math.PI / 20037508.34)) - Math.PI / 2) * RAD_TO_DEG,
    maxX * 180 / 20037508.34,
    (2 * Math.atan(Math.exp(maxY * Math.PI / 20037508.34)) - Math.PI / 2) * RAD_TO_DEG
  ];
}

/**
 * Transform coordinate from WGS84 to Web Mercator
 * @param {number[]} coord - [lon, lat] in WGS84
 * @returns {number[]} [x, y] in Web Mercator
 */
export function coordToWebMercator(coord) {
  if (typeof ol !== 'undefined' && ol.proj?.transform) {
    return ol.proj.transform(coord, WGS84, WEB_MERCATOR);
  }
  const [lon, lat] = coord;
  return [
    lon * 20037508.34 / 180,
    Math.log(Math.tan((90 + lat) * DEG_TO_RAD / 2)) * 20037508.34 / Math.PI
  ];
}

/**
 * Transform coordinate from Web Mercator to WGS84
 * @param {number[]} coord - [x, y] in Web Mercator
 * @returns {number[]} [lon, lat] in WGS84
 */
export function coordToWGS84(coord) {
  if (typeof ol !== 'undefined' && ol.proj?.transform) {
    return ol.proj.transform(coord, WEB_MERCATOR, WGS84);
  }
  const [x, y] = coord;
  return [
    x * 180 / 20037508.34,
    (2 * Math.atan(Math.exp(y * Math.PI / 20037508.34)) - Math.PI / 2) * RAD_TO_DEG
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate bounding box from array of coordinates
 * @param {number[][]} coords - Array of [x, y] coordinates
 * @returns {number[]} [minX, minY, maxX, maxY]
 */
export function getBbox(coords) {
  if (!coords || coords.length === 0) return [0, 0, 0, 0];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const coord of coords) {
    const [x, y] = coord;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return [minX, minY, maxX, maxY];
}

/**
 * Calculate center of extent
 * @param {number[]} extent - [minX, minY, maxX, maxY]
 * @returns {number[]} [centerX, centerY]
 */
export function getCenter(extent) {
  const [minX, minY, maxX, maxY] = extent;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Check if point is within extent
 * @param {number[]} point - [x, y]
 * @param {number[]} extent - [minX, minY, maxX, maxY]
 * @returns {boolean}
 */
export function pointInExtent(point, extent) {
  const [x, y] = point;
  const [minX, minY, maxX, maxY] = extent;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Expand extent by buffer distance
 * @param {number[]} extent - [minX, minY, maxX, maxY]
 * @param {number} buffer - Buffer distance (same units as extent)
 * @returns {number[]} Expanded extent
 */
export function bufferExtent(extent, buffer) {
  const [minX, minY, maxX, maxY] = extent;
  return [minX - buffer, minY - buffer, maxX + buffer, maxY + buffer];
}

/**
 * Clamp latitude to valid range (-90 to 90)
 * @param {number} lat - Latitude
 * @returns {number} Clamped latitude
 */
export function clampLatitude(lat) {
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Normalize longitude to -180 to 180 range
 * @param {number} lon - Longitude
 * @returns {number} Normalized longitude
 */
export function normalizeLongitude(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}
