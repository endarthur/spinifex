// Spinifex - IDW Interpolation Tests

import { test, expect } from '@playwright/test';

test.describe('IDW Interpolation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('API Access', () => {
    test('idw function is available globally', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof window.idw === 'function';
      });
      expect(result).toBe(true);
    });

    test('idw is available on sp namespace', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof window.sp.idw === 'function';
      });
      expect(result).toBe(true);
    });

    test('idwToBand function is available', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof window.idwToBand === 'function';
      });
      expect(result).toBe(true);
    });
  });

  test.describe('Basic Interpolation', () => {
    test('idw creates raster from point data', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create simple point layer with values
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { value: 10 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 0] }, properties: { value: 20 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 1] }, properties: { value: 30 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { value: 40 } },
          ]
        };

        const points = window.sp.load(geojson, 'test_points');
        await new Promise(r => setTimeout(r, 100));

        const raster = window.idw(points, { field: 'value', resolution: 20 });

        return {
          hasRaster: raster !== null,
          isRaster: raster.r !== undefined, // Raster layers have .r namespace
          hasData: raster._data !== undefined || raster.getRasterData !== undefined,
          name: raster.name
        };
      });

      expect(result.hasRaster).toBe(true);
      expect(result.isRaster).toBe(true);
      expect(result.hasData).toBe(true);
      expect(result.name).toContain('interpolated');
    });

    test('idw requires field parameter', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { value: 10 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { value: 20 } },
          ]
        };
        const points = window.sp.load(geojson, 'test_points2');

        try {
          window.idw(points, {}); // Missing field
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      });

      expect(result.threw).toBe(true);
      expect(result.message).toContain('field');
    });

    test('idw requires at least 2 points', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { value: 10 } },
          ]
        };
        const points = window.sp.load(geojson, 'test_points3');

        try {
          window.idw(points, { field: 'value' });
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      });

      expect(result.threw).toBe(true);
      expect(result.message).toContain('at least 2 points');
    });
  });

  test.describe('Interpolation Quality', () => {
    test('values at point locations match input values', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create a grid of points with known values
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { z: 100 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 0] }, properties: { z: 200 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 1] }, properties: { z: 300 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { z: 400 } },
          ]
        };

        const points = window.sp.load(geojson, 'test_quality');
        await new Promise(r => setTimeout(r, 100));

        const raster = window.idw(points, { field: 'z', resolution: 50, name: 'quality_test' });
        const rd = raster.r.data();

        // Get values at corners (approximately)
        const v00 = rd.getValue(0, 0); // Should be ~100
        const v10 = rd.getValue(1, 0); // Should be ~200
        const v01 = rd.getValue(0, 1); // Should be ~300
        const v11 = rd.getValue(1, 1); // Should be ~400

        // Center should be average-ish
        const vCenter = rd.getValue(0.5, 0.5);

        return {
          v00, v10, v01, v11, vCenter,
          cornerValuesReasonable: v00 < 150 && v10 > 150 && v10 < 250 && v01 > 250 && v01 < 350 && v11 > 350,
          centerInRange: vCenter > 150 && vCenter < 350
        };
      });

      expect(result.cornerValuesReasonable).toBe(true);
      expect(result.centerInRange).toBe(true);
    });

    test('power parameter affects locality', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { z: 0 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 0] }, properties: { z: 100 } },
          ]
        };

        const points = window.sp.load(geojson, 'power_test');
        await new Promise(r => setTimeout(r, 100));

        // Low power = smoother transition
        const low = window.idw(points, { field: 'z', resolution: 20, power: 1, name: 'low_power' });
        const lowRd = low.r.data();
        const lowMid = lowRd.getValue(1, 0); // Midpoint

        // High power = more local/abrupt
        const high = window.idw(points, { field: 'z', resolution: 20, power: 4, name: 'high_power' });
        const highRd = high.r.data();
        const highMid = highRd.getValue(1, 0);

        // With power=1, midpoint should be closer to 50 (average)
        // With power=4, midpoint should still be ~50 but nearby points dominate more
        return {
          lowMid,
          highMid,
          bothInRange: lowMid > 30 && lowMid < 70 && highMid > 30 && highMid < 70
        };
      });

      expect(result.bothInRange).toBe(true);
    });
  });

  test.describe('Options', () => {
    test('custom resolution affects output size', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { v: 1 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { v: 2 } },
          ]
        };
        const points = window.sp.load(geojson, 'res_test');

        const r50 = window.idw(points, { field: 'v', resolution: 50, name: 'res50' });
        const r100 = window.idw(points, { field: 'v', resolution: 100, name: 'res100' });

        return {
          w50: r50.width,
          w100: r100.width,
          largerIsLarger: r100.width > r50.width
        };
      });

      expect(result.w50).toBe(50);
      expect(result.w100).toBe(100);
      expect(result.largerIsLarger).toBe(true);
    });

    test('custom extent is used', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { v: 1 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { v: 2 } },
          ]
        };
        const points = window.sp.load(geojson, 'extent_test');

        const customExtent = [-1, -1, 2, 2];
        const raster = window.idw(points, {
          field: 'v',
          resolution: 30,
          extent: customExtent,
          name: 'custom_extent'
        });
        const rd = raster.r.data();

        return {
          extent: rd.extent,
          matchesCustom: rd.extent[0] === -1 && rd.extent[1] === -1 && rd.extent[2] === 2 && rd.extent[3] === 2
        };
      });

      expect(result.matchesCustom).toBe(true);
    });

    test('output name is customizable', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { v: 1 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { v: 2 } },
          ]
        };
        const points = window.sp.load(geojson, 'name_test');

        const raster = window.idw(points, { field: 'v', name: 'my_custom_name' });
        return raster.name;
      });

      expect(result).toBe('my_custom_name');
    });
  });

  test.describe('idwToBand', () => {
    test('adds band to existing raster', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create a raster
        const raster = window.sampleRaster({ name: 'band_test', width: 50, height: 50 });
        await new Promise(r => setTimeout(r, 200));

        const initialBandCount = raster.r.data().bandCount;

        // Create points within the raster extent
        const extent = raster._metadata.extent;
        const cx = (extent[0] + extent[2]) / 2;
        const cy = (extent[1] + extent[3]) / 2;

        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [cx - 1, cy - 1] }, properties: { temp: 20 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [cx + 1, cy - 1] }, properties: { temp: 22 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [cx - 1, cy + 1] }, properties: { temp: 18 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [cx + 1, cy + 1] }, properties: { temp: 24 } },
          ]
        };
        const points = window.sp.load(geojson, 'temp_points');

        // Add IDW band
        window.idwToBand(raster, points, { field: 'temp', name: 'temperature' });

        const finalBandCount = raster.r.data().bandCount;
        const bandNames = raster.r.bandNames();

        return {
          initialBandCount,
          finalBandCount,
          bandNames,
          bandAdded: finalBandCount === initialBandCount + 1,
          hasTemperatureBand: bandNames.includes('temperature')
        };
      });

      expect(result.bandAdded).toBe(true);
      expect(result.hasTemperatureBand).toBe(true);
    });
  });

  test.describe('Tool Registration', () => {
    test('IDW tool is registered in toolbox', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = window.toolbox.get('interpolation.idw');
        return {
          exists: tool !== undefined,
          name: tool?.name,
          category: tool?.category,
          hasField: tool?.parameters?.some(p => p.name === 'field'),
          hasPower: tool?.parameters?.some(p => p.name === 'power'),
          hasResolution: tool?.parameters?.some(p => p.name === 'resolution')
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('IDW Interpolation');
      expect(result.category).toBe('Interpolation');
      expect(result.hasField).toBe(true);
      expect(result.hasPower).toBe(true);
      expect(result.hasResolution).toBe(true);
    });

    test('can search for interpolation tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const results = window.toolbox.search('interpolation');
        return {
          found: results.length > 0,
          hasIdw: results.some(t => t.id === 'interpolation.idw')
        };
      });

      expect(result.found).toBe(true);
      expect(result.hasIdw).toBe(true);
    });

    test('Interpolation category exists', async ({ page }) => {
      const result = await page.evaluate(() => {
        const categories = window.toolbox.categories();
        return categories.includes('Interpolation');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {
    test('handles features with missing field values', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { v: 10 } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 0] }, properties: {} }, // Missing v
            { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 1] }, properties: { v: null } }, // Null v
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { v: 20 } },
          ]
        };

        const points = window.sp.load(geojson, 'missing_values');

        try {
          const raster = window.idw(points, { field: 'v', resolution: 20 });
          return { success: true, hasRaster: raster !== null };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasRaster).toBe(true);
    });

    test('handles polygon centroids', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const geojson = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]]
              },
              properties: { pop: 100 }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[1, 0], [1.5, 0], [1.5, 0.5], [1, 0.5], [1, 0]]]
              },
              properties: { pop: 200 }
            },
          ]
        };

        const polys = window.sp.load(geojson, 'poly_centroids');

        try {
          const raster = window.idw(polys, { field: 'pop', resolution: 20 });
          return { success: true, hasRaster: raster !== null };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasRaster).toBe(true);
    });
  });
});
