// Spinifex - RasterData Internal Format Tests
// Tests for the internal raster data structure and band manipulation

import { test, expect } from '@playwright/test';

test.describe('RasterData Internal Format', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('RasterData Class', () => {
    test('RasterData is exported from raster module', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof window.sp.RasterData === 'function';
      });
      expect(result).toBe(true);
    });

    test('RasterData constructor creates valid instance', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 100,
          height: 100,
          extent: [0, 0, 1, 1]
        });
        return {
          width: rd.width,
          height: rd.height,
          extent: rd.extent,
          bandCount: rd.bandCount
        };
      });
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.extent).toEqual([0, 0, 1, 1]);
      expect(result.bandCount).toBe(0);
    });

    test('RasterData has correct default values', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({ width: 10, height: 10 });
        return {
          crs: rd.crs,
          noData: rd.noData,
          extent: rd.extent
        };
      });
      expect(result.crs).toBe('EPSG:4326');
      expect(result.noData).toBe(-9999);
      expect(result.extent).toEqual([0, 0, 1, 1]);
    });
  });

  test.describe('Band Management', () => {
    test('addBand adds a new band', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        data.fill(42);
        const bandIdx = rd.addBand(data, 'elevation');
        return {
          bandIdx,
          bandCount: rd.bandCount,
          bandNames: rd.bandNames
        };
      });
      expect(result.bandIdx).toBe(1);
      expect(result.bandCount).toBe(1);
      expect(result.bandNames).toEqual(['elevation']);
    });

    test('addBand validates data size', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        try {
          const badData = new Float32Array(50); // Wrong size
          rd.addBand(badData, 'test');
          return { error: null };
        } catch (e) {
          return { error: e.message };
        }
      });
      expect(result.error).toContain("doesn't match");
    });

    test('addBand rejects duplicate names', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        rd.addBand(data, 'band1');
        try {
          rd.addBand(data, 'band1');
          return { error: null };
        } catch (e) {
          return { error: e.message };
        }
      });
      expect(result.error).toContain('already exists');
    });

    test('getBand retrieves band by index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        data.fill(42);
        rd.addBand(data, 'test');
        const band = rd.getBand(1);
        return {
          hasData: band?.data instanceof Float32Array,
          name: band?.name,
          value: band?.data?.[0]
        };
      });
      expect(result.hasData).toBe(true);
      expect(result.name).toBe('test');
      expect(result.value).toBe(42);
    });

    test('getBand retrieves band by name', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        data.fill(99);
        rd.addBand(data, 'myband');
        const band = rd.getBand('myband');
        return {
          name: band?.name,
          value: band?.data?.[0]
        };
      });
      expect(result.name).toBe('myband');
      expect(result.value).toBe(99);
    });

    test('removeBand removes band by index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        rd.addBand(new Float32Array(100), 'band1');
        rd.addBand(new Float32Array(100), 'band2');
        const removed = rd.removeBand(1);
        return {
          removed,
          bandCount: rd.bandCount,
          bandNames: rd.bandNames
        };
      });
      expect(result.removed).toBe(true);
      expect(result.bandCount).toBe(1);
      expect(result.bandNames).toEqual(['band2']);
    });

    test('removeBand removes band by name', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        rd.addBand(new Float32Array(100), 'keep');
        rd.addBand(new Float32Array(100), 'remove');
        const removed = rd.removeBand('remove');
        return {
          removed,
          bandCount: rd.bandCount,
          bandNames: rd.bandNames
        };
      });
      expect(result.removed).toBe(true);
      expect(result.bandCount).toBe(1);
      expect(result.bandNames).toEqual(['keep']);
    });

    test('renameBand changes band name', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        rd.addBand(new Float32Array(100), 'old_name');
        const renamed = rd.renameBand('old_name', 'new_name');
        return {
          renamed,
          bandNames: rd.bandNames
        };
      });
      expect(result.renamed).toBe(true);
      expect(result.bandNames).toEqual(['new_name']);
    });
  });

  test.describe('Statistics', () => {
    test('addBand calculates statistics automatically', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        for (let i = 0; i < 100; i++) data[i] = i;
        rd.addBand(data, 'test');
        const band = rd.getBand(1);
        return band?.stats;
      });
      expect(result.min).toBe(0);
      expect(result.max).toBe(99);
      expect(result.validCount).toBe(100);
    });

    test('statistics exclude noData values', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1],
          noData: -9999
        });
        const data = new Float32Array(100);
        for (let i = 0; i < 100; i++) data[i] = i < 10 ? -9999 : i;
        rd.addBand(data, 'test');
        const band = rd.getBand(1);
        return band?.stats;
      });
      expect(result.min).toBe(10);
      expect(result.max).toBe(99);
      expect(result.validCount).toBe(90);
    });

    test('getGlobalStats returns min/max across all bands', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const d1 = new Float32Array(100);
        const d2 = new Float32Array(100);
        d1.fill(50);
        d2.fill(100);
        rd.addBand(d1, 'b1');
        rd.addBand(d2, 'b2');
        return rd.getGlobalStats();
      });
      expect(result.min).toBe(50);
      expect(result.max).toBe(100);
    });
  });

  test.describe('Pixel Access', () => {
    test('pixelIndex converts x,y to index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        return {
          idx00: rd.pixelIndex(0, 0),
          idx50: rd.pixelIndex(5, 0),
          idx05: rd.pixelIndex(0, 5),
          idx55: rd.pixelIndex(5, 5)
        };
      });
      expect(result.idx00).toBe(0);
      expect(result.idx50).toBe(5);
      expect(result.idx05).toBe(50);
      expect(result.idx55).toBe(55);
    });

    test('getValue returns value at geographic coordinates', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 10, 10]
        });
        const data = new Float32Array(100);
        // Set center pixel
        data[55] = 42;
        rd.addBand(data, 'test');
        return rd.getValue(5.5, 4.5);
      });
      expect(result).toBe(42);
    });

    test('getValue returns null for noData', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 10, 10],
          noData: -9999
        });
        const data = new Float32Array(100);
        data.fill(-9999);
        rd.addBand(data, 'test');
        return rd.getValue(5, 5);
      });
      expect(result).toBe(null);
    });

    test('setValue sets value at geographic coordinates', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 10, 10]
        });
        const data = new Float32Array(100);
        rd.addBand(data, 'test');
        rd.setValue(5.5, 4.5, 123);
        return rd.getValue(5.5, 4.5);
      });
      expect(result).toBe(123);
    });
  });

  test.describe('Factory Methods', () => {
    test('createEmpty creates raster with specified dimensions', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = window.sp.RasterData.createEmpty(20, 30, [0, 0, 1, 1], 3);
        return {
          width: rd.width,
          height: rd.height,
          bandCount: rd.bandCount,
          bandNames: rd.bandNames
        };
      });
      expect(result.width).toBe(20);
      expect(result.height).toBe(30);
      expect(result.bandCount).toBe(3);
      expect(result.bandNames).toEqual(['band1', 'band2', 'band3']);
    });

    test('createEmpty with fill value', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = window.sp.RasterData.createEmpty(10, 10, [0, 0, 1, 1], 1, 42);
        return rd.getBand(1)?.data?.[50];
      });
      expect(result).toBe(42);
    });

    test('clone creates deep copy', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rd = new window.sp.RasterData({
          width: 10,
          height: 10,
          extent: [0, 0, 1, 1]
        });
        const data = new Float32Array(100);
        data.fill(42);
        rd.addBand(data, 'test');

        const cloned = rd.clone();
        // Modify original
        rd.getBand(1).data[0] = 999;

        return {
          originalValue: rd.getBand(1).data[0],
          clonedValue: cloned.getBand(1).data[0]
        };
      });
      expect(result.originalValue).toBe(999);
      expect(result.clonedValue).toBe(42);
    });
  });
});

test.describe('RasterLayer Band Manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('r.data() Access', () => {
    test('raster.r.data() returns RasterData', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'data_test' });
        const rd = raster.r.data();
        return {
          hasRasterData: rd !== null,
          hasWidth: typeof rd?.width === 'number',
          hasBandCount: typeof rd?.bandCount === 'number'
        };
      });
      expect(result.hasRasterData).toBe(true);
      expect(result.hasWidth).toBe(true);
      expect(result.hasBandCount).toBe(true);
    });

    test('r.getBand() returns band object', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'getband_test' });
        const band1 = raster.r.getBand(1);
        return {
          hasBand: band1 !== null,
          hasData: band1?.data instanceof Float32Array,
          hasName: typeof band1?.name === 'string',
          hasStats: band1?.stats !== undefined
        };
      });
      expect(result.hasBand).toBe(true);
      expect(result.hasData).toBe(true);
      expect(result.hasName).toBe(true);
      expect(result.hasStats).toBe(true);
    });

    test('r.bandNames() returns array of band names', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'bandnames_test' });
        const names = raster.r.bandNames();
        return {
          isArray: Array.isArray(names),
          hasNames: names?.length > 0
        };
      });
      expect(result.isArray).toBe(true);
      expect(result.hasNames).toBe(true);
    });
  });

  test.describe('r.addBand()', () => {
    test('addBand from array creates new band', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'addband_array_test' });
        const initialCount = raster.r.data().bandCount;
        const pixelCount = raster.width * raster.height;

        const newData = new Float32Array(pixelCount);
        newData.fill(42);

        // addBand returns the layer for chaining
        const returnedLayer = raster.r.addBand(newData, 'new_band');

        return {
          initialCount,
          finalCount: raster.r.data().bandCount,
          returnsLayer: returnedLayer === raster,
          bandNames: raster.r.bandNames()
        };
      });
      expect(result.finalCount).toBe(result.initialCount + 1);
      expect(result.returnsLayer).toBe(true);
      expect(result.bandNames).toContain('new_band');
    });

    test('addBand from another raster', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster1 = window.sampleRaster({ name: 'source_raster' });
        const raster2 = window.sampleRaster({ name: 'target_raster' });
        await new Promise(r => setTimeout(r, 100));

        const initialCount = raster2.r.data().bandCount;
        raster2.r.addBand(raster1, 'from_source', { band: 1 });

        return {
          initialCount,
          finalCount: raster2.r.data().bandCount,
          bandNames: raster2.r.bandNames()
        };
      });
      expect(result.finalCount).toBe(result.initialCount + 1);
      expect(result.bandNames).toContain('from_source');
    });
  });

  test.describe('r.removeBand()', () => {
    test('removeBand by index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'removeband_test' });
        const initialCount = raster.r.data().bandCount;

        // removeBand returns the layer for chaining
        const returnedLayer = raster.r.removeBand(1);

        return {
          initialCount,
          finalCount: raster.r.data().bandCount,
          returnsLayer: returnedLayer === raster
        };
      });
      expect(result.returnsLayer).toBe(true);
      expect(result.finalCount).toBe(result.initialCount - 1);
    });
  });

  test.describe('r.renameBand()', () => {
    test('renameBand changes band name', async ({ page }) => {
      const result = await page.evaluate(() => {
        const raster = window.sampleRaster({ name: 'renameband_test' });
        const originalNames = [...raster.r.bandNames()];

        // renameBand returns the layer for chaining
        const returnedLayer = raster.r.renameBand(1, 'custom_name');

        return {
          originalNames,
          returnsLayer: returnedLayer === raster,
          newNames: raster.r.bandNames()
        };
      });
      expect(result.returnsLayer).toBe(true);
      expect(result.newNames[0]).toBe('custom_name');
    });
  });
});

test.describe('RasterData Backward Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('existing raster rendering still works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const raster = window.sampleRaster({ name: 'compat_render_test' });
      await new Promise(r => setTimeout(r, 200));

      // Check that the raster layer exists and has data
      return {
        hasLayer: raster !== null,
        hasData: raster._data !== undefined,
        hasMetadata: raster._metadata !== undefined,
        isVisible: raster._visible !== false,
        hasRasterMethods: raster.r !== undefined
      };
    });
    expect(result.hasLayer).toBe(true);
    expect(result.hasData).toBe(true);
    expect(result.hasMetadata).toBe(true);
    expect(result.isVisible).toBe(true);
    expect(result.hasRasterMethods).toBe(true);
  });

  test('legacy _data property still accessible', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.sampleRaster({ name: 'compat_data_test' });
      return {
        hasData: raster._data !== undefined,
        hasMetadata: raster._metadata !== undefined,
        hasWidth: typeof raster.width === 'number'
      };
    });
    expect(result.hasData).toBe(true);
    expect(result.hasMetadata).toBe(true);
    expect(result.hasWidth).toBe(true);
  });

  test('RasterData syncs with legacy format', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.sampleRaster({ name: 'sync_test' });

      // Access through new API
      const rd = raster.r.data();
      const newBandCount = rd.bandCount;

      // Legacy access
      const legacyData = Array.isArray(raster._data) ? raster._data : [raster._data];
      const legacyBandCount = legacyData.length;

      return {
        newBandCount,
        legacyBandCount,
        match: newBandCount === legacyBandCount
      };
    });
    expect(result.match).toBe(true);
  });
});
