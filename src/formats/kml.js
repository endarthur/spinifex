// Spinifex - KML Export
// Convert GeoJSON to KML format (pure JavaScript)

import { termPrint } from '../ui/terminal.js';

/**
 * Convert coordinates to KML coordinate string
 * @param {Array} coords - [lon, lat] or [lon, lat, alt]
 */
function coordsToString(coords) {
  if (coords.length >= 3) {
    return `${coords[0]},${coords[1]},${coords[2]}`;
  }
  return `${coords[0]},${coords[1]},0`;
}

/**
 * Convert coordinate array to KML coordinates element
 * @param {Array} coordArray - Array of [lon, lat] coordinates
 */
function coordsArrayToString(coordArray) {
  return coordArray.map(c => coordsToString(c)).join(' ');
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert feature properties to KML extended data
 */
function propsToExtendedData(props) {
  if (!props || Object.keys(props).length === 0) return '';

  const data = Object.entries(props)
    .filter(([key, val]) => val !== null && val !== undefined)
    .map(([key, val]) => {
      return `      <Data name="${escapeXml(key)}"><value>${escapeXml(val)}</value></Data>`;
    })
    .join('\n');

  if (!data) return '';
  return `    <ExtendedData>\n${data}\n    </ExtendedData>`;
}

/**
 * Get a name for a feature (from properties)
 */
function getFeatureName(props) {
  if (!props) return 'Feature';
  return props.name || props.Name || props.NAME ||
         props.id || props.Id || props.ID ||
         props.label || props.Label || 'Feature';
}

/**
 * Convert Point geometry to KML
 */
function pointToKml(coords) {
  return `    <Point>
      <coordinates>${coordsToString(coords)}</coordinates>
    </Point>`;
}

/**
 * Convert LineString geometry to KML
 */
function lineStringToKml(coords) {
  return `    <LineString>
      <coordinates>${coordsArrayToString(coords)}</coordinates>
    </LineString>`;
}

/**
 * Convert Polygon geometry to KML
 */
function polygonToKml(coords) {
  const outer = coords[0];
  const inners = coords.slice(1);

  let kml = `    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${coordsArrayToString(outer)}</coordinates>
        </LinearRing>
      </outerBoundaryIs>`;

  for (const inner of inners) {
    kml += `
      <innerBoundaryIs>
        <LinearRing>
          <coordinates>${coordsArrayToString(inner)}</coordinates>
        </LinearRing>
      </innerBoundaryIs>`;
  }

  kml += '\n    </Polygon>';
  return kml;
}

/**
 * Convert MultiPoint geometry to KML
 */
function multiPointToKml(coords) {
  const points = coords.map(c => `      <Point><coordinates>${coordsToString(c)}</coordinates></Point>`);
  return `    <MultiGeometry>\n${points.join('\n')}\n    </MultiGeometry>`;
}

/**
 * Convert MultiLineString geometry to KML
 */
function multiLineStringToKml(coords) {
  const lines = coords.map(line =>
    `      <LineString><coordinates>${coordsArrayToString(line)}</coordinates></LineString>`
  );
  return `    <MultiGeometry>\n${lines.join('\n')}\n    </MultiGeometry>`;
}

/**
 * Convert MultiPolygon geometry to KML
 */
function multiPolygonToKml(coords) {
  const polygons = coords.map(polygon => {
    const outer = polygon[0];
    let kml = `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsArrayToString(outer)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>`;

    for (const inner of polygon.slice(1)) {
      kml += `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsArrayToString(inner)}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
    }
    kml += '\n      </Polygon>';
    return kml;
  });

  return `    <MultiGeometry>\n${polygons.join('\n')}\n    </MultiGeometry>`;
}

/**
 * Convert geometry to KML
 */
function geometryToKml(geometry) {
  if (!geometry || !geometry.type) return '';

  switch (geometry.type) {
    case 'Point':
      return pointToKml(geometry.coordinates);
    case 'LineString':
      return lineStringToKml(geometry.coordinates);
    case 'Polygon':
      return polygonToKml(geometry.coordinates);
    case 'MultiPoint':
      return multiPointToKml(geometry.coordinates);
    case 'MultiLineString':
      return multiLineStringToKml(geometry.coordinates);
    case 'MultiPolygon':
      return multiPolygonToKml(geometry.coordinates);
    case 'GeometryCollection':
      const geoms = geometry.geometries.map(g => geometryToKml(g)).filter(k => k);
      return `    <MultiGeometry>\n${geoms.join('\n')}\n    </MultiGeometry>`;
    default:
      termPrint(`Unsupported geometry type: ${geometry.type}`, 'yellow');
      return '';
  }
}

/**
 * Convert GeoJSON feature to KML Placemark
 */
function featureToKml(feature, index) {
  const props = feature.properties || {};
  const name = getFeatureName(props);
  const description = props.description || props.Description || props.desc || '';
  const extendedData = propsToExtendedData(props);
  const geometry = geometryToKml(feature.geometry);

  if (!geometry) return '';

  let kml = `  <Placemark>
    <name>${escapeXml(name)}</name>`;

  if (description) {
    kml += `\n    <description>${escapeXml(description)}</description>`;
  }

  if (extendedData) {
    kml += '\n' + extendedData;
  }

  kml += '\n' + geometry;
  kml += '\n  </Placemark>';

  return kml;
}

/**
 * Export GeoJSON to KML string
 * @param {Object} geojson - GeoJSON FeatureCollection or Feature
 * @param {string} name - Document name
 * @param {Object} options - Export options
 * @returns {string} KML string
 */
export function geojsonToKml(geojson, name = 'Export', options = {}) {
  let features = [];

  if (geojson.type === 'FeatureCollection') {
    features = geojson.features || [];
  } else if (geojson.type === 'Feature') {
    features = [geojson];
  } else if (geojson.type && geojson.coordinates) {
    // Raw geometry
    features = [{ type: 'Feature', properties: {}, geometry: geojson }];
  }

  const placemarks = features
    .map((f, i) => featureToKml(f, i))
    .filter(k => k)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(name)}</name>
${placemarks}
</Document>
</kml>`;
}

/**
 * Export GeoJSON to KML blob
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {string} name - Document/file name
 * @param {Object} options - Export options
 * @returns {Blob} KML blob
 */
export function exportKml(geojson, name = 'export', options = {}) {
  try {
    termPrint('Generating KML...', 'dim');
    const kmlString = geojsonToKml(geojson, name, options);
    const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
    termPrint('KML generated', 'green');
    return blob;
  } catch (e) {
    termPrint(`KML export error: ${e.message}`, 'red');
    throw e;
  }
}

/**
 * Download layer as KML
 * @param {Object} layer - Vector layer to export
 * @param {string} filename - Output filename
 * @param {Object} options - Export options
 */
export function downloadKml(layer, filename, options = {}) {
  const name = filename || layer.name || 'export';
  const geojson = layer.geojson || layer._geojson;

  if (!geojson || !geojson.features) {
    termPrint('No vector data to export', 'red');
    return null;
  }

  try {
    const blob = exportKml(geojson, name, options);

    // Download the blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    termPrint(`Downloaded: ${name}.kml`, 'green');
    return `${name}.kml`;
  } catch (e) {
    termPrint(`KML download error: ${e.message}`, 'red');
    return null;
  }
}
