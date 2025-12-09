// Spinifex - GeoJSON Loader
// Load and parse GeoJSON data

import { state } from '../core/state.js';
import { Layer } from '../core/layer.js';
import { createDefaultStyle } from '../core/styling.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel } from '../ui/layers-panel.js';

/**
 * Load GeoJSON data and create a layer
 * @param {string} name - Layer name (preserved as-is, accessible via ly["name"])
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {Layer} The created layer
 */
export function loadGeoJSON(name, geojson) {
  const id = `layer_${state.layerCounter++}`;
  const zIndex = state.zIndexCounter++;

  const source = new ol.source.Vector({
    features: new ol.format.GeoJSON().readFeatures(geojson, {
      featureProjection: 'EPSG:3857'
    })
  });

  const geomType = geojson.features[0]?.geometry?.type || 'Point';
  const style = createDefaultStyle(geomType, name);

  const olLayer = new ol.layer.Vector({ source, style });
  getMap().addLayer(olLayer);

  const layer = new Layer(id, name, geojson, olLayer, source, zIndex);
  state.layers.set(id, layer);

  // Add to ly namespace (accessible via ly["name"] or ly.name if valid identifier)
  import('../core/api.js').then(({ ly }) => {
    ly[name] = layer;
  });

  updateLayerPanel();
  return layer;
}
