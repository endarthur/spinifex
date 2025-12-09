// Spinifex - Versioning Tests
// Tests for lightweight git-like version control

import { test, expect } from '@playwright/test';

test.describe('Versioning System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('API Availability', () => {
    test('versioning object exists on sp', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.sp.versioning !== undefined;
      });
      expect(result).toBe(true);
    });

    test('v shorthand exists on sp', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.sp.v !== undefined;
      });
      expect(result).toBe(true);
    });

    test('v is same as versioning', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.sp.v === window.sp.versioning;
      });
      expect(result).toBe(true);
    });

    test('versioning is available globally', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.v !== undefined && window.versioning !== undefined;
      });
      expect(result).toBe(true);
    });

    test('versioning has required methods', async ({ page }) => {
      const result = await page.evaluate(() => {
        const v = window.sp.v;
        return {
          hasSave: typeof v.save === 'function',
          hasList: typeof v.list === 'function',
          hasShow: typeof v.show === 'function',
          hasRestore: typeof v.restore === 'function',
          hasRemove: typeof v.remove === 'function',
          hasDiff: typeof v.diff === 'function',
          hasSnapshot: typeof v.snapshot === 'function'
        };
      });

      expect(result.hasSave).toBe(true);
      expect(result.hasList).toBe(true);
      expect(result.hasShow).toBe(true);
      expect(result.hasRestore).toBe(true);
      expect(result.hasRemove).toBe(true);
      expect(result.hasDiff).toBe(true);
      expect(result.hasSnapshot).toBe(true);
    });
  });

  test.describe('No Workspace Connected', () => {
    test('save returns null when no workspace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        return await window.sp.v.save('test');
      });
      expect(result).toBeNull();
    });

    test('list returns empty array when no workspace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        return await window.sp.v.list();
      });
      expect(result).toEqual([]);
    });

    test('show returns null when no workspace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        return await window.sp.v.show(1);
      });
      expect(result).toBeNull();
    });

    test('restore returns false when no workspace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        return await window.sp.v.restore(1);
      });
      expect(result).toBe(false);
    });
  });

  test.describe('Compression Utilities', () => {
    test('CompressionStream API is available', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof CompressionStream !== 'undefined';
      });
      expect(result).toBe(true);
    });

    test('DecompressionStream API is available', async ({ page }) => {
      const result = await page.evaluate(() => {
        return typeof DecompressionStream !== 'undefined';
      });
      expect(result).toBe(true);
    });

    test('can compress and decompress text', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create a larger JSON to test compression
        const original = JSON.stringify({
          type: 'FeatureCollection',
          features: Array(100).fill(null).map((_, i) => ({
            type: 'Feature',
            properties: { id: i, name: `Feature ${i}` },
            geometry: { type: 'Point', coordinates: [0, 0] }
          }))
        });

        // Compress
        const blob = new Blob([original]);
        const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        const compressedBuffer = await compressedBlob.arrayBuffer();

        // Decompress
        const decompressBlob = new Blob([compressedBuffer]);
        const decompressedStream = decompressBlob.stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressedBlob = await new Response(decompressedStream).blob();
        const decompressed = await decompressedBlob.text();

        return {
          originalLength: original.length,
          compressedLength: compressedBuffer.byteLength,
          matches: decompressed === original
        };
      });

      expect(result.matches).toBe(true);
      // Larger data compresses better
      expect(result.compressedLength).toBeLessThan(result.originalLength);
    });
  });

  test.describe('State Capture', () => {
    test('captures layer state correctly', async ({ page }) => {
      // Load sample data and wait for layers to register
      await page.evaluate(() => sp.load(sp.sample));
      await page.waitForFunction(() => window.ly?.geology !== undefined, { timeout: 5000 });

      const result = await page.evaluate(() => {
        const layerCount = window.sp.state.layers.size;
        // Get layer names from the layer objects
        const layerNames = [...window.sp.state.layers.values()].map(l => l.name);

        return {
          layerCount,
          layerNames,
          hasGeology: layerNames.includes('geology'),
          hasDrillholes: layerNames.includes('drillholes'),
          lyGeologyExists: window.ly.geology !== undefined
        };
      });

      expect(result.layerCount).toBeGreaterThan(0);
      expect(result.lyGeologyExists).toBe(true);
      // Check at least one layer has expected name
      expect(result.hasGeology || result.hasDrillholes).toBe(true);
    });

    test('layer has geojson property for versioning', async ({ page }) => {
      await page.evaluate(() => sp.load(sp.sample));
      await page.waitForFunction(() => window.ly?.geology !== undefined, { timeout: 5000 });

      const result = await page.evaluate(() => {
        const layer = window.ly.geology;
        return {
          hasGeojson: layer.geojson !== undefined,
          isFeatureCollection: layer.geojson?.type === 'FeatureCollection',
          hasFeatures: Array.isArray(layer.geojson?.features)
        };
      });

      expect(result.hasGeojson).toBe(true);
      expect(result.isFeatureCollection).toBe(true);
      expect(result.hasFeatures).toBe(true);
    });

    test('layer has style options for versioning', async ({ page }) => {
      await page.evaluate(() => sp.load(sp.sample));
      await page.waitForFunction(() => window.ly?.geology !== undefined, { timeout: 5000 });

      const result = await page.evaluate(() => {
        const layer = window.ly.geology;
        // Apply a style
        layer.style({ type: 'rules', rules: [{ filter: '', fill: '#ff0000' }] });
        return {
          hasStyleOpts: layer._styleOpts !== undefined,
          styleType: layer._styleOpts?.type
        };
      });

      expect(result.hasStyleOpts).toBe(true);
      expect(result.styleType).toBe('rules');
    });

    test('layer has zIndex for versioning', async ({ page }) => {
      await page.evaluate(() => sp.load(sp.sample));
      await page.waitForFunction(() => window.ly?.geology !== undefined, { timeout: 5000 });

      const result = await page.evaluate(() => {
        const layer = window.ly.geology;
        layer.zIndex(100);
        return {
          hasZIndex: typeof layer.zIndex === 'function',
          zIndexValue: layer.zIndex()
        };
      });

      expect(result.hasZIndex).toBe(true);
      expect(result.zIndexValue).toBe(100);
    });
  });

  test.describe('Version Metadata Structure', () => {
    test('VERSIONS_FOLDER constant is set', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.sp.v.VERSIONS_FOLDER;
      });
      expect(result).toBe('.versions');
    });
  });

  test.describe('Raster Layer Support', () => {
    test('raster layer has properties needed for versioning', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'version_test' });
        return {
          hasWidth: raster.width !== undefined,
          hasHeight: raster.height !== undefined,
          hasMetadata: raster._metadata !== undefined,
          hasZIndex: typeof raster.zIndex === 'function',
          type: raster.type
        };
      });

      expect(result.hasWidth).toBe(true);
      expect(result.hasHeight).toBe(true);
      expect(result.hasZIndex).toBe(true);
      expect(result.type).toBe('raster');
    });

    test('sample raster params are stored for recreation', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'recreate_test', width: 100, height: 100 });
        return {
          hasSampleParams: raster._sampleParams !== undefined,
          paramsName: raster._sampleParams?.name,
          paramsWidth: raster._sampleParams?.width
        };
      });

      // Note: This test documents expected behavior - sampleRaster should store params
      // If this fails, we need to update sample-raster.js to store params
      expect(result.hasSampleParams).toBe(true);
    });
  });

  test.describe('Help Documentation', () => {
    test('help for versioning is available', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Check if help("versioning") doesn't throw
        try {
          window.help('versioning');
          return true;
        } catch (e) {
          return false;
        }
      });
      expect(result).toBe(true);
    });
  });
});
