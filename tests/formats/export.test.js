// Spinifex - Export Format Tests
// Tests vector export functionality (shapefile, GeoJSON, etc.)

import { test, expect } from '@playwright/test';

test.describe('Export Functions API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('downloadShapefile is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.downloadShapefile === 'function');
    expect(hasFunction).toBe(true);
  });

  test('exportShapefile is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.exportShapefile === 'function');
    expect(hasFunction).toBe(true);
  });

  test('downloadShapefile is available in sp namespace', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.sp.downloadShapefile === 'function');
    expect(hasFunction).toBe(true);
  });

  test('exportShapefile is available in sp namespace', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.sp.exportShapefile === 'function');
    expect(hasFunction).toBe(true);
  });
});

test.describe('Export Toolbox Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('export.shapefile tool is registered', async ({ page }) => {
    const tool = await page.evaluate(() => window.toolbox.get('export.shapefile'));
    expect(tool).not.toBeNull();
    expect(tool.name).toBe('Export Shapefile');
    expect(tool.category).toBe('Export');
  });

  test('export.shapefile tool has correct parameters', async ({ page }) => {
    const tool = await page.evaluate(() => {
      const t = window.toolbox.get('export.shapefile');
      return {
        params: t.parameters.map(p => p.name),
        hasLayer: t.parameters.some(p => p.name === 'layer'),
        hasFilename: t.parameters.some(p => p.name === 'filename')
      };
    });
    expect(tool.hasLayer).toBe(true);
    expect(tool.hasFilename).toBe(true);
  });

  test('export.geojson tool is registered', async ({ page }) => {
    const tool = await page.evaluate(() => window.toolbox.get('export.geojson'));
    expect(tool).not.toBeNull();
    expect(tool.name).toBe('Export GeoJSON');
  });

  test('export.gpkg tool is registered', async ({ page }) => {
    const tool = await page.evaluate(() => window.toolbox.get('export.gpkg'));
    expect(tool).not.toBeNull();
    expect(tool.name).toBe('Export GeoPackage');
  });
});

test.describe('Shapefile Export (shpwrite)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('exportShapefile generates blob from simple GeoJSON', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Create simple test GeoJSON
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Test Point', value: 42 },
            geometry: { type: 'Point', coordinates: [0, 0] }
          },
          {
            type: 'Feature',
            properties: { name: 'Test Point 2', value: 100 },
            geometry: { type: 'Point', coordinates: [1, 1] }
          }
        ]
      };

      try {
        const blob = await window.exportShapefile(geojson, 'test_export');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0,
          type: blob?.type || ''
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  test('exportShapefile handles polygon features', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { unit: 'Granite', area_km2: 10.5 },
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
            }
          }
        ]
      };

      try {
        const blob = await window.exportShapefile(geojson, 'polygon_test');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  test('exportShapefile handles line features', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Test Line', length_m: 1000 },
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0], [1, 1], [2, 0]]
            }
          }
        ]
      };

      try {
        const blob = await window.exportShapefile(geojson, 'line_test');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });
});

test.describe('Layer Export Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample data
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });
  });

  test('sample geology layer can be exported to shapefile blob', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const layer = window.ly.geology;
      const geojson = layer.geojson || layer._geojson;

      if (!geojson) {
        return { success: false, error: 'No GeoJSON data' };
      }

      try {
        const blob = await window.exportShapefile(geojson, 'geology_export');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0,
          featureCount: geojson.features?.length || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.featureCount).toBeGreaterThan(0);
  });

  test('sample drillholes layer can be exported to shapefile blob', async ({ page }) => {
    await page.waitForFunction(() => window.ly.drillholes !== undefined, { timeout: 5000 });

    const result = await page.evaluate(async () => {
      const layer = window.ly.drillholes;
      const geojson = layer.geojson || layer._geojson;

      if (!geojson) {
        return { success: false, error: 'No GeoJSON data' };
      }

      try {
        const blob = await window.exportShapefile(geojson, 'drillholes_export');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0,
          featureCount: geojson.features?.length || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KML Export Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('KML Export API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('downloadKml is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.downloadKml === 'function');
    expect(hasFunction).toBe(true);
  });

  test('exportKml is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.exportKml === 'function');
    expect(hasFunction).toBe(true);
  });

  test('geojsonToKml is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.geojsonToKml === 'function');
    expect(hasFunction).toBe(true);
  });

  test('KML functions are available in sp namespace', async ({ page }) => {
    const available = await page.evaluate(() => ({
      downloadKml: typeof window.sp.downloadKml === 'function',
      exportKml: typeof window.sp.exportKml === 'function',
      geojsonToKml: typeof window.sp.geojsonToKml === 'function'
    }));
    expect(available.downloadKml).toBe(true);
    expect(available.exportKml).toBe(true);
    expect(available.geojsonToKml).toBe(true);
  });

  test('export.kml tool is registered', async ({ page }) => {
    const tool = await page.evaluate(() => window.toolbox.get('export.kml'));
    expect(tool).not.toBeNull();
    expect(tool.name).toBe('Export KML');
    expect(tool.category).toBe('Export');
  });
});

test.describe('KML Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('geojsonToKml generates valid KML string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Test Point', value: 42 },
            geometry: { type: 'Point', coordinates: [10, 20] }
          }
        ]
      };

      const kml = window.geojsonToKml(geojson, 'TestDoc');
      return {
        isString: typeof kml === 'string',
        hasXmlHeader: kml.includes('<?xml version'),
        hasKmlTag: kml.includes('<kml'),
        hasDocument: kml.includes('<Document>'),
        hasPlacemark: kml.includes('<Placemark>'),
        hasPoint: kml.includes('<Point>'),
        hasCoords: kml.includes('10,20'),
        hasName: kml.includes('Test Point'),
        hasExtendedData: kml.includes('<ExtendedData>')
      };
    });

    expect(result.isString).toBe(true);
    expect(result.hasXmlHeader).toBe(true);
    expect(result.hasKmlTag).toBe(true);
    expect(result.hasDocument).toBe(true);
    expect(result.hasPlacemark).toBe(true);
    expect(result.hasPoint).toBe(true);
    expect(result.hasCoords).toBe(true);
    expect(result.hasName).toBe(true);
    expect(result.hasExtendedData).toBe(true);
  });

  test('exportKml generates blob from GeoJSON', async ({ page }) => {
    const result = await page.evaluate(() => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Test' },
            geometry: { type: 'Point', coordinates: [0, 0] }
          }
        ]
      };

      try {
        const blob = window.exportKml(geojson, 'test');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0,
          type: blob?.type || ''
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toContain('kml');
  });

  test('KML export handles LineString geometry', async ({ page }) => {
    const result = await page.evaluate(() => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Line' },
          geometry: {
            type: 'LineString',
            coordinates: [[0, 0], [1, 1], [2, 0]]
          }
        }]
      };

      const kml = window.geojsonToKml(geojson);
      return {
        hasLineString: kml.includes('<LineString>'),
        hasCoords: kml.includes('0,0,0') && kml.includes('1,1,0') && kml.includes('2,0,0')
      };
    });

    expect(result.hasLineString).toBe(true);
    expect(result.hasCoords).toBe(true);
  });

  test('KML export handles Polygon geometry', async ({ page }) => {
    const result = await page.evaluate(() => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Poly' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
          }
        }]
      };

      const kml = window.geojsonToKml(geojson);
      return {
        hasPolygon: kml.includes('<Polygon>'),
        hasOuterBoundary: kml.includes('<outerBoundaryIs>'),
        hasLinearRing: kml.includes('<LinearRing>')
      };
    });

    expect(result.hasPolygon).toBe(true);
    expect(result.hasOuterBoundary).toBe(true);
    expect(result.hasLinearRing).toBe(true);
  });

  test('KML export escapes XML special characters', async ({ page }) => {
    const result = await page.evaluate(() => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Test <>&"\'', desc: 'A & B' },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }]
      };

      const kml = window.geojsonToKml(geojson);
      return {
        hasEscapedLt: kml.includes('&lt;'),
        hasEscapedGt: kml.includes('&gt;'),
        hasEscapedAmp: kml.includes('&amp;'),
        noRawLt: !kml.includes('<>') // Should not have unescaped angle brackets in name
      };
    });

    expect(result.hasEscapedLt).toBe(true);
    expect(result.hasEscapedGt).toBe(true);
    expect(result.hasEscapedAmp).toBe(true);
    expect(result.noRawLt).toBe(true);
  });
});

test.describe('KML Layer Export Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });
  });

  test('sample geology layer can be exported to KML', async ({ page }) => {
    const result = await page.evaluate(() => {
      const layer = window.ly.geology;
      const geojson = layer.geojson || layer._geojson;

      if (!geojson) {
        return { success: false, error: 'No GeoJSON data' };
      }

      try {
        const blob = window.exportKml(geojson, 'geology_kml');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size || 0,
          featureCount: geojson.features?.length || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.isBlob).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.featureCount).toBeGreaterThan(0);
  });
});
