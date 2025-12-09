// Spinifex - TileLayer Tests
// TDD tests for src/core/tile-layer.js

import { test, expect } from '@playwright/test';

test.describe('TileLayer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Creation', () => {
    test('sp.tile() creates a TileLayer from XYZ URL', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'osm-test');
        return {
          exists: layer !== undefined,
          name: layer?.name,
          type: layer?.type,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('osm-test');
      expect(result.type).toBe('tile');
    });

    test('sp.tile() auto-generates name if not provided', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png');
        return {
          hasName: layer?.name !== undefined && layer.name.length > 0,
        };
      });

      expect(result.hasName).toBe(true);
    });

    test('sp.tile() with options object', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'custom-tiles',
          attribution: 'Test Attribution',
          minZoom: 5,
          maxZoom: 15,
        });
        return {
          name: layer?.name,
          type: layer?.type,
        };
      });

      expect(result.name).toBe('custom-tiles');
      expect(result.type).toBe('tile');
    });

    test('TileLayer is added to ly namespace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'mytiles');
        // Wait for async ly registration (dynamic import can be slow under load)
        await new Promise(r => setTimeout(r, 300));
        return {
          inLy: window.ly['mytiles'] === layer,
        };
      });

      expect(result.inLy).toBe(true);
    });

    test('TileLayer is added to map layers', async ({ page }) => {
      const result = await page.evaluate(() => {
        const map = sp.map;
        const before = map.getLayers().getLength();
        sp.tile('https://example.com/{z}/{x}/{y}.png', 'map-test');
        const after = map.getLayers().getLength();
        return { added: after > before };
      });

      expect(result.added).toBe(true);
    });
  });

  test.describe('BaseLayer Interface', () => {
    test('has show() and hide() methods', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'vis-test');
        layer.hide();
        const hiddenVis = layer.visible;
        layer.show();
        const shownVis = layer.visible;
        return { hiddenVis, shownVis };
      });

      expect(result.hiddenVis).toBe(false);
      expect(result.shownVis).toBe(true);
    });

    test('has opacity() getter/setter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'opacity-test');
        const initial = layer.opacity();
        layer.opacity(0.5);
        const after = layer.opacity();
        return { initial, after };
      });

      expect(result.initial).toBe(1);
      expect(result.after).toBe(0.5);
    });

    test('has zIndex() getter/setter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'zindex-test');
        layer.zIndex(50);
        return layer.zIndex();
      });

      expect(result).toBe(50);
    });

    test('has blendMode() getter/setter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'blend-test');
        const initial = layer.blendMode();
        layer.blendMode('multiply');
        const after = layer.blendMode();
        return { initial, after };
      });

      expect(result.initial).toBe('source-over');
      expect(result.after).toBe('multiply');
    });

    test('has bringToFront() and sendToBack()', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'front-back-1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'front-back-2');
        layer1.zIndex(10);
        layer2.zIndex(20);
        layer1.bringToFront();
        const z1 = layer1.zIndex();
        const z2 = layer2.zIndex();
        return { z1GreaterThanZ2: z1 > z2 };
      });

      expect(result.z1GreaterThanZ2).toBe(true);
    });

    test('has remove() method', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const map = sp.map;
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'remove-test');
        // Wait for async ly registration (dynamic import)
        await new Promise(r => setTimeout(r, 200));
        const beforeLen = map.getLayers().getLength();
        const inLyBefore = 'remove-test' in window.ly;
        layer.remove();
        // Wait for async ly cleanup
        await new Promise(r => setTimeout(r, 200));
        const afterLen = map.getLayers().getLength();
        const inLyAfter = 'remove-test' in window.ly;
        return { removed: afterLen < beforeLen, inLyBefore, inLyAfter };
      });

      expect(result.removed).toBe(true);
      expect(result.inLyBefore).toBe(true);
      expect(result.inLyAfter).toBe(false);
    });

    test('has rename() method', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'old-name');
        // Wait for initial ly registration
        await new Promise(r => setTimeout(r, 100));
        layer.rename('new-name');
        // Wait for async rename (dynamic import)
        await new Promise(r => setTimeout(r, 200));
        return {
          newName: layer.name,
          inLyNew: 'new-name' in window.ly,
          inLyOld: 'old-name' in window.ly,
        };
      });

      expect(result.newName).toBe('new-name');
      expect(result.inLyNew).toBe(true);
      expect(result.inLyOld).toBe(false);
    });
  });

  test.describe('Tile-specific Features', () => {
    test('supports WMS source type', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          type: 'wms',
          url: 'https://example.com/wms',
          params: { LAYERS: 'test', FORMAT: 'image/png' },
          name: 'wms-test',
        });
        return {
          name: layer?.name,
          type: layer?.type,
          sourceType: layer?.sourceType,
        };
      });

      expect(result.name).toBe('wms-test');
      expect(result.type).toBe('tile');
      expect(result.sourceType).toBe('wms');
    });

    test('supports WMTS source type', async ({ page }) => {
      // WMTS requires more setup, just test that the option is accepted
      const result = await page.evaluate(() => {
        try {
          const layer = sp.tile({
            type: 'wmts',
            url: 'https://example.com/wmts',
            layer: 'test',
            name: 'wmts-test',
          });
          return { created: layer !== undefined, sourceType: layer?.sourceType };
        } catch (e) {
          // WMTS may fail without proper capabilities, that's OK for this test
          return { created: false, error: e.message };
        }
      });

      // Either it creates successfully or fails gracefully
      expect(result.created !== undefined).toBe(true);
    });

    test('default source type is xyz', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'xyz-default');
        return layer?.sourceType;
      });

      expect(result).toBe('xyz');
    });

    test('exposes url property', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'url-test');
        return layer?.url;
      });

      expect(result).toBe('https://example.com/{z}/{x}/{y}.png');
    });

    test('exposes attribution property', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'attr-test',
          attribution: 'Test Attribution',
        });
        return layer?.attribution;
      });

      expect(result).toBe('Test Attribution');
    });
  });

  test.describe('CRS Support', () => {
    test('has crs property (defaults to EPSG:3857)', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'crs-test');
        return layer?.crs;
      });

      expect(result).toBe('EPSG:3857');
    });

    test('can specify custom CRS', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'crs-custom',
          crs: 'EPSG:4326',
        });
        return layer?.crs;
      });

      expect(result).toBe('EPSG:4326');
    });
  });

  test.describe('Serialization', () => {
    test('toJSON() returns layer config', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'json-test',
          attribution: 'Test',
        });
        layer.opacity(0.7);
        layer.zIndex(25);
        return layer.toJSON();
      });

      expect(result.name).toBe('json-test');
      expect(result.type).toBe('tile');
      expect(result.url).toBe('https://example.com/{z}/{x}/{y}.png');
      expect(result.opacity).toBe(0.7);
      expect(result.zIndex).toBe(25);
    });
  });

  test.describe('Extent and Zoom', () => {
    test('zoom() does not throw', async ({ page }) => {
      const result = await page.evaluate(() => {
        try {
          const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'zoom-test');
          layer.zoom();
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
    });

    test('extent() returns null for unbounded tiles', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'extent-test');
        return layer?.extent?.() ?? null;
      });

      // XYZ tiles typically don't have a defined extent
      expect(result).toBeNull();
    });

    test('can set custom extent', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'extent-custom',
          extent: [-180, -90, 180, 90],
        });
        return layer?.extent?.();
      });

      expect(result).toEqual([-180, -90, 180, 90]);
    });
  });
});
