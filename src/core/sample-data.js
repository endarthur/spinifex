// Spinifex - Sample Data
// Built-in sample datasets for testing and demos
// Located in the Ribeira Belt, SE Brazil (Apiaí region)

export const sample = {
  geology: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { unit: 'Granite', age_ma: 580, lithology: 'Biotite granite', area_km2: 42 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-49.12, -24.42], [-49.08, -24.40], [-49.03, -24.41], [-49.00, -24.44],
            [-49.02, -24.48], [-49.06, -24.51], [-49.11, -24.49], [-49.14, -24.46],
            [-49.12, -24.42]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { unit: 'Metasediments', age_ma: 630, lithology: 'Phyllite and schist', area_km2: 68 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-49.00, -24.44], [-48.94, -24.42], [-48.88, -24.44], [-48.86, -24.49],
            [-48.89, -24.54], [-48.95, -24.56], [-49.02, -24.53], [-49.02, -24.48],
            [-49.00, -24.44]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { unit: 'Carbonate', age_ma: 620, lithology: 'Marble and dolomite', area_km2: 31 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-49.06, -24.51], [-49.02, -24.53], [-48.98, -24.55], [-48.96, -24.60],
            [-49.01, -24.63], [-49.08, -24.61], [-49.12, -24.57], [-49.10, -24.53],
            [-49.06, -24.51]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { unit: 'Metavolcanic', age_ma: 640, lithology: 'Metabasalt', area_km2: 25 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-48.95, -24.56], [-48.89, -24.54], [-48.84, -24.57], [-48.85, -24.62],
            [-48.90, -24.65], [-48.96, -24.63], [-48.96, -24.60], [-48.95, -24.56]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { unit: 'Gneiss', age_ma: 2100, lithology: 'Banded gneiss', area_km2: 55 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-49.14, -24.46], [-49.11, -24.49], [-49.10, -24.53], [-49.12, -24.57],
            [-49.18, -24.58], [-49.23, -24.54], [-49.22, -24.48], [-49.18, -24.45],
            [-49.14, -24.46]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { unit: 'Quartzite', age_ma: 650, lithology: 'Massive quartzite', area_km2: 18 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-48.88, -24.44], [-48.82, -24.46], [-48.80, -24.51], [-48.84, -24.54],
            [-48.89, -24.54], [-48.86, -24.49], [-48.88, -24.44]
          ]]
        }
      }
    ]
  },
  drillholes: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { id: 'RB-001', depth_m: 145, pb_ppm: 2450, zn_ppm: 8200, target: 'Carbonate-hosted' }, geometry: { type: 'Point', coordinates: [-49.04, -24.58] } },
      { type: 'Feature', properties: { id: 'RB-002', depth_m: 92, pb_ppm: 890, zn_ppm: 3100, target: 'Carbonate-hosted' }, geometry: { type: 'Point', coordinates: [-49.00, -24.60] } },
      { type: 'Feature', properties: { id: 'RB-003', depth_m: 178, pb_ppm: 3200, zn_ppm: 12500, target: 'Carbonate-hosted' }, geometry: { type: 'Point', coordinates: [-49.06, -24.56] } },
      { type: 'Feature', properties: { id: 'RB-004', depth_m: 65, pb_ppm: 420, zn_ppm: 1800, target: 'VMS' }, geometry: { type: 'Point', coordinates: [-48.90, -24.59] } },
      { type: 'Feature', properties: { id: 'RB-005', depth_m: 112, pb_ppm: 1650, zn_ppm: 5400, target: 'Carbonate-hosted' }, geometry: { type: 'Point', coordinates: [-48.97, -24.62] } },
      { type: 'Feature', properties: { id: 'RB-006', depth_m: 88, pb_ppm: 280, zn_ppm: 950, target: 'VMS' }, geometry: { type: 'Point', coordinates: [-48.87, -24.61] } },
      { type: 'Feature', properties: { id: 'RB-007', depth_m: 135, pb_ppm: 1890, zn_ppm: 7800, target: 'Carbonate-hosted' }, geometry: { type: 'Point', coordinates: [-49.02, -24.55] } }
    ]
  }
};

// Built-in styles for sample data
export const sampleStyles = {
  geology: {
    type: 'rules',
    stroke: '#1a1a1a',
    width: 1,
    opacity: 0.75,
    rules: [
      { filter: 'r.unit == "Granite"', fill: '#e8a4a4', label: 'Granite' },
      { filter: 'r.unit == "Metasediments"', fill: '#b8d4b8', label: 'Metasediments' },
      { filter: 'r.unit == "Carbonate"', fill: '#7ec8e3', label: 'Carbonate' },
      { filter: 'r.unit == "Metavolcanic"', fill: '#8b7355', label: 'Metavolcanic' },
      { filter: 'r.unit == "Gneiss"', fill: '#d4a5d4', label: 'Gneiss' },
      { filter: 'r.unit == "Quartzite"', fill: '#f5deb3', label: 'Quartzite' },
      { filter: '', fill: '#888888', label: 'Other' }
    ],
    labelField: 'unit',
    labelColor: '#ffffff',
    labelOutline: '#000000',
    labelSize: 11
  },
  drillholes: {
    type: 'graduated',
    field: 'zn_ppm',
    scale: 'viridis',
    stroke: '#000000',
    width: 2,
    opacity: 0.9,
    radius: 7
  }
};
