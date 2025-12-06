// Spinifex - Map Module
// OpenLayers map initialization and interactions

import { state } from '../core/state.js';

// Map instance - will be initialized in init()
let _map = null;

// Getter for map instance (avoids circular dependency issues)
export function getMap() {
  return _map;
}

// For backwards compatibility
export { _map as map };

// Popup elements
let popupEl = null;
let popupContent = null;
let popup = null;

/**
 * Initialize the OpenLayers map
 */
export function initMap() {
  // Middle mouse button panning (like QGIS)
  const middleMouseDragPan = new ol.interaction.DragPan({
    condition: function(event) {
      // Button 1 = middle mouse
      return event.originalEvent.button === 1;
    }
  });

  _map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          attributions: '© CartoDB © OpenStreetMap'
        })
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([117.5, -22.5]),  // Pilbara, WA
      zoom: 9
    }),
    controls: ol.control.defaults.defaults({ attribution: false }).extend([
      new ol.control.ScaleLine()
    ])
  });

  // Add middle mouse panning
  _map.addInteraction(middleMouseDragPan);

  // Setup popup
  popupEl = document.getElementById('popup');
  popupContent = document.getElementById('popup-content');

  popup = new ol.Overlay({
    element: popupEl,
    positioning: 'bottom-center',
    offset: [0, -10],
    autoPan: false
  });
  _map.addOverlay(popup);
  popupEl.style.display = 'none';

  // Track mouse position
  _map.on('pointermove', (evt) => {
    const coords = ol.proj.toLonLat(evt.coordinate);
    document.getElementById('status-coords').textContent =
      `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
  });

  // Click to identify features
  _map.on('singleclick', (evt) => {
    const features = [];
    _map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      for (const [id, lyr] of state.layers) {
        if (lyr.olLayer === layer) {
          features.push({ feature, layerName: lyr.name });
          break;
        }
      }
    });

    if (features.length > 0) {
      let html = '';
      features.forEach(({ feature, layerName }) => {
        const props = feature.getProperties();
        html += `<div class="popup-title">${layerName}</div>`;
        for (const [key, val] of Object.entries(props)) {
          if (key === 'geometry') continue;
          html += `<div class="popup-row">
            <span class="popup-key">${key}</span>
            <span class="popup-value">${val}</span>
          </div>`;
        }
      });
      popupContent.innerHTML = html;
      popup.setPosition(evt.coordinate);
      popupEl.style.display = 'block';
    } else {
      closePopup();
    }
  });

  return _map;
}

/**
 * Close the popup overlay
 */
export function closePopup() {
  if (popup) {
    popup.setPosition(undefined);
  }
  if (popupEl) {
    popupEl.style.display = 'none';
  }
}

// Expose closePopup globally for onclick handler
window.closePopup = closePopup;
