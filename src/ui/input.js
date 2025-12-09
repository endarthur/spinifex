// Spinifex - Interactive Map Input
// Functions for getting user input from the map (box, point, line, polygon)
// Returns Promises that resolve when user completes the interaction

import { getMap } from './map.js';
import { termPrint } from './terminal.js';

/**
 * BoundingBox - A smart bounding box object with projection support
 */
class BoundingBox {
  /**
   * @param {number} west - Western longitude
   * @param {number} south - Southern latitude
   * @param {number} east - Eastern longitude
   * @param {number} north - Northern latitude
   * @param {string} crs - Coordinate reference system (default: EPSG:4326)
   */
  constructor(west, south, east, north, crs = 'EPSG:4326') {
    this._west = west;
    this._south = south;
    this._east = east;
    this._north = north;
    this._crs = crs;
  }

  // === Extent formats ===

  /** [west, south, east, north] - Standard GIS/OGC format */
  get extent() {
    return [this._west, this._south, this._east, this._north];
  }

  /** [south, west, north, east] - SRTM/some APIs format */
  get bounds() {
    return [this._south, this._west, this._north, this._east];
  }

  /** [minX, minY, maxX, maxY] - Same as extent, explicit naming */
  get bbox() {
    return this.extent;
  }

  // === Individual accessors ===

  get west() { return this._west; }
  get south() { return this._south; }
  get east() { return this._east; }
  get north() { return this._north; }
  get minX() { return this._west; }
  get minY() { return this._south; }
  get maxX() { return this._east; }
  get maxY() { return this._north; }

  // === Computed properties ===

  get center() {
    return [(this._west + this._east) / 2, (this._south + this._north) / 2];
  }

  get width() {
    return this._east - this._west;
  }

  get height() {
    return this._north - this._south;
  }

  get crs() {
    return this._crs;
  }

  /** Approximate area in square meters (using haversine for geographic) */
  get area() {
    if (this._crs === 'EPSG:4326') {
      // Approximate using latitude correction
      const midLat = (this._south + this._north) / 2;
      const latRad = midLat * Math.PI / 180;
      const mPerDegLat = 111320;
      const mPerDegLon = 111320 * Math.cos(latRad);
      return (this.width * mPerDegLon) * (this.height * mPerDegLat);
    }
    // Projected - assume meters
    return this.width * this.height;
  }

  // === Conversion methods ===

  /** Convert to GeoJSON Polygon */
  get geojson() {
    return {
      type: 'Feature',
      properties: { type: 'bbox' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [this._west, this._south],
          [this._east, this._south],
          [this._east, this._north],
          [this._west, this._north],
          [this._west, this._south]
        ]]
      }
    };
  }

  /** Convert to WKT */
  get wkt() {
    return `POLYGON((${this._west} ${this._south}, ${this._east} ${this._south}, ${this._east} ${this._north}, ${this._west} ${this._north}, ${this._west} ${this._south}))`;
  }

  /**
   * Reproject to a different CRS
   * @param {string} targetCrs - Target CRS (e.g., 'EPSG:3857')
   * @returns {BoundingBox} New BoundingBox in target CRS
   */
  to(targetCrs) {
    if (targetCrs === this._crs) return this;

    const sw = ol.proj.transform([this._west, this._south], this._crs, targetCrs);
    const ne = ol.proj.transform([this._east, this._north], this._crs, targetCrs);

    return new BoundingBox(sw[0], sw[1], ne[0], ne[1], targetCrs);
  }

  /**
   * Buffer the box by a distance
   * @param {number} distance - Buffer distance in CRS units (degrees for 4326)
   * @returns {BoundingBox} New buffered BoundingBox
   */
  buffer(distance) {
    return new BoundingBox(
      this._west - distance,
      this._south - distance,
      this._east + distance,
      this._north + distance,
      this._crs
    );
  }

  /**
   * Check if a point is inside the box
   * @param {number} x - X coordinate (longitude)
   * @param {number} y - Y coordinate (latitude)
   * @returns {boolean}
   */
  contains(x, y) {
    return x >= this._west && x <= this._east &&
           y >= this._south && y <= this._north;
  }

  /**
   * Check if this box intersects another
   * @param {BoundingBox|Array} other - Other box
   * @returns {boolean}
   */
  intersects(other) {
    const [w, s, e, n] = other.extent || other;
    return !(this._east < w || this._west > e ||
             this._north < s || this._south > n);
  }

  // === Output ===

  toString() {
    return `BoundingBox(${this._west.toFixed(4)}, ${this._south.toFixed(4)}, ${this._east.toFixed(4)}, ${this._north.toFixed(4)}) [${this._crs}]`;
  }

  toJSON() {
    return {
      extent: this.extent,
      crs: this._crs
    };
  }

  // Make it work with srtm() which expects [s, w, n, e]
  // When passed to functions that check Array.isArray, this won't match
  // But we provide .bounds for explicit SRTM format
}

// Current interaction state
let activeInteraction = null;
let activeOverlay = null;

/**
 * Clean up any active interaction
 */
function cleanupInteraction() {
  const map = getMap();
  if (activeInteraction) {
    map.removeInteraction(activeInteraction);
    activeInteraction = null;
  }
  if (activeOverlay) {
    map.removeLayer(activeOverlay);
    activeOverlay = null;
  }
  // Reset cursor
  map.getTargetElement().style.cursor = '';
}

/**
 * Draw a bounding box on the map
 * @param {Object} options - Options
 * @param {string} options.message - Prompt message (default: "Draw a box on the map")
 * @returns {Promise<BoundingBox>} Resolves with BoundingBox when complete
 */
export function box(options = {}) {
  return new Promise((resolve, reject) => {
    const map = getMap();
    const message = options.message || 'Draw a box on the map (drag to define, Esc to cancel)';

    // Clean up any previous interaction
    cleanupInteraction();

    termPrint(message, 'yellow');

    // Create a vector layer for the drawn box
    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source: source,
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(66, 153, 225, 0.2)'
        }),
        stroke: new ol.style.Stroke({
          color: '#4299e5',
          width: 2,
          lineDash: [5, 5]
        })
      })
    });
    map.addLayer(vector);
    activeOverlay = vector;

    // Create draw interaction for box
    const draw = new ol.interaction.Draw({
      source: source,
      type: 'Circle',
      geometryFunction: ol.interaction.Draw.createBox()
    });

    // Set cursor to crosshair
    map.getTargetElement().style.cursor = 'crosshair';

    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const extent3857 = geometry.getExtent();

      // Transform to EPSG:4326
      const extent4326 = ol.proj.transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
      const [west, south, east, north] = extent4326;

      // Clean up
      cleanupInteraction();

      const bbox = new BoundingBox(west, south, east, north);
      termPrint(`Box: ${bbox}`, 'green');
      resolve(bbox);
    });

    // Handle escape key to cancel
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        cleanupInteraction();
        document.removeEventListener('keydown', keyHandler);
        termPrint('Box drawing cancelled', 'yellow');
        reject(new Error('Cancelled'));
      }
    };
    document.addEventListener('keydown', keyHandler);

    // Store for cleanup
    activeInteraction = draw;
    map.addInteraction(draw);

    // Clean up key handler when resolved
    draw.on('drawend', () => {
      document.removeEventListener('keydown', keyHandler);
    });
  });
}

/**
 * Pick a point on the map
 * @param {Object} options - Options
 * @param {string} options.message - Prompt message
 * @returns {Promise<{lon: number, lat: number, x: number, y: number}>}
 */
export function point(options = {}) {
  return new Promise((resolve, reject) => {
    const map = getMap();
    const message = options.message || 'Click a point on the map (Esc to cancel)';

    cleanupInteraction();
    termPrint(message, 'yellow');

    map.getTargetElement().style.cursor = 'crosshair';

    const clickHandler = (event) => {
      const coord3857 = event.coordinate;
      const coord4326 = ol.proj.transform(coord3857, 'EPSG:3857', 'EPSG:4326');

      map.un('click', clickHandler);
      map.getTargetElement().style.cursor = '';
      document.removeEventListener('keydown', keyHandler);

      const result = {
        lon: coord4326[0],
        lat: coord4326[1],
        x: coord4326[0],
        y: coord4326[1],
        coordinate: coord4326,
        toString() {
          return `Point(${this.lon.toFixed(6)}, ${this.lat.toFixed(6)})`;
        }
      };

      termPrint(`Point: ${result}`, 'green');
      resolve(result);
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        map.un('click', clickHandler);
        map.getTargetElement().style.cursor = '';
        document.removeEventListener('keydown', keyHandler);
        termPrint('Point selection cancelled', 'yellow');
        reject(new Error('Cancelled'));
      }
    };

    map.on('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
  });
}

/**
 * Draw a line on the map
 * @param {Object} options - Options
 * @param {string} options.message - Prompt message
 * @returns {Promise<{coordinates: Array, length: number, geojson: Object}>}
 */
export function line(options = {}) {
  return new Promise((resolve, reject) => {
    const map = getMap();
    const message = options.message || 'Draw a line on the map (double-click to finish, Esc to cancel)';

    cleanupInteraction();
    termPrint(message, 'yellow');

    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source: source,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#4299e5',
          width: 2
        })
      })
    });
    map.addLayer(vector);
    activeOverlay = vector;

    const draw = new ol.interaction.Draw({
      source: source,
      type: 'LineString'
    });

    map.getTargetElement().style.cursor = 'crosshair';

    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const coords3857 = geometry.getCoordinates();
      const coords4326 = coords3857.map(c => ol.proj.transform(c, 'EPSG:3857', 'EPSG:4326'));

      // Calculate length using turf
      const lineGeoJSON = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords4326
        }
      };
      const lengthKm = window.turf ? window.turf.length(lineGeoJSON) : 0;

      cleanupInteraction();

      const result = {
        coordinates: coords4326,
        length: lengthKm * 1000, // meters
        lengthKm,
        geojson: lineGeoJSON,
        toString() {
          return `Line(${this.coordinates.length} points, ${this.lengthKm.toFixed(2)} km)`;
        }
      };

      termPrint(`Line: ${result}`, 'green');
      resolve(result);
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        cleanupInteraction();
        document.removeEventListener('keydown', keyHandler);
        termPrint('Line drawing cancelled', 'yellow');
        reject(new Error('Cancelled'));
      }
    };
    document.addEventListener('keydown', keyHandler);

    activeInteraction = draw;
    map.addInteraction(draw);

    draw.on('drawend', () => {
      document.removeEventListener('keydown', keyHandler);
    });
  });
}

/**
 * Draw a polygon on the map
 * @param {Object} options - Options
 * @param {string} options.message - Prompt message
 * @returns {Promise<{coordinates: Array, area: number, geojson: Object}>}
 */
export function polygon(options = {}) {
  return new Promise((resolve, reject) => {
    const map = getMap();
    const message = options.message || 'Draw a polygon on the map (double-click to finish, Esc to cancel)';

    cleanupInteraction();
    termPrint(message, 'yellow');

    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
      source: source,
      style: new ol.style.Style({
        fill: new ol.style.Fill({
          color: 'rgba(66, 153, 225, 0.2)'
        }),
        stroke: new ol.style.Stroke({
          color: '#4299e5',
          width: 2
        })
      })
    });
    map.addLayer(vector);
    activeOverlay = vector;

    const draw = new ol.interaction.Draw({
      source: source,
      type: 'Polygon'
    });

    map.getTargetElement().style.cursor = 'crosshair';

    draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const coords3857 = geometry.getCoordinates();
      const coords4326 = coords3857.map(ring =>
        ring.map(c => ol.proj.transform(c, 'EPSG:3857', 'EPSG:4326'))
      );

      const polyGeoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: coords4326
        }
      };
      const areaM2 = window.turf ? window.turf.area(polyGeoJSON) : 0;

      cleanupInteraction();

      const result = {
        coordinates: coords4326,
        area: areaM2,
        areaKm2: areaM2 / 1e6,
        geojson: polyGeoJSON,
        toString() {
          return `Polygon(${this.coordinates[0].length} vertices, ${this.areaKm2.toFixed(2)} km²)`;
        }
      };

      termPrint(`Polygon: ${result}`, 'green');
      resolve(result);
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        cleanupInteraction();
        document.removeEventListener('keydown', keyHandler);
        termPrint('Polygon drawing cancelled', 'yellow');
        reject(new Error('Cancelled'));
      }
    };
    document.addEventListener('keydown', keyHandler);

    activeInteraction = draw;
    map.addInteraction(draw);

    draw.on('drawend', () => {
      document.removeEventListener('keydown', keyHandler);
    });
  });
}

// Export BoundingBox class for external use
export { BoundingBox };
