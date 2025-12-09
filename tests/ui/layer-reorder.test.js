// Spinifex - Layer Reordering Tests
// Tests for drag-drop layer reordering including WebGL raster layers

import { test, expect } from '@playwright/test';

test.describe('Layer Reordering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Z-Index Management', () => {
    test('layers have unique z-indices after loading multiple', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Load sample vector data
        await sp.load(sp.sample);

        // Get all z-indices
        const zIndices = Object.values(window.ly).map(l => l.zIndex());
        const uniqueZIndices = new Set(zIndices);

        return {
          count: zIndices.length,
          uniqueCount: uniqueZIndices.size,
          allUnique: zIndices.length === uniqueZIndices.size
        };
      });

      expect(result.allUnique).toBe(true);
    });

    test('changing z-index updates layer stacking', async ({ page }) => {
      const result = await page.evaluate(async () => {
        await sp.load(sp.sample);
        // Wait for layers to load
        await new Promise(r => setTimeout(r, 100));

        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        if (!layer) return { error: 'No vector layer found' };

        const originalZ = layer.zIndex();
        layer.zIndex(500);
        const newZ = layer.zIndex();

        return {
          originalZ,
          newZ,
          changed: newZ === 500
        };
      });

      expect(result.changed).toBe(true);
    });
  });

  test.describe('Vector Layer Reordering', () => {
    test('can programmatically reorder vector layers', async ({ page }) => {
      const result = await page.evaluate(async () => {
        await sp.load(sp.sample);

        const layers = Object.values(window.ly).filter(l => l.type === 'vector');
        if (layers.length < 2) return { skipped: true };

        const layer1 = layers[0];
        const layer2 = layers[1];

        // Set initial order
        layer1.zIndex(100);
        layer2.zIndex(200);

        const beforeSwap = {
          layer1Z: layer1.zIndex(),
          layer2Z: layer2.zIndex(),
          layer1Above: layer1.zIndex() > layer2.zIndex()
        };

        // Swap order
        layer1.zIndex(200);
        layer2.zIndex(100);

        const afterSwap = {
          layer1Z: layer1.zIndex(),
          layer2Z: layer2.zIndex(),
          layer1Above: layer1.zIndex() > layer2.zIndex()
        };

        return {
          beforeSwap,
          afterSwap,
          orderReversed: beforeSwap.layer1Above !== afterSwap.layer1Above
        };
      });

      if (result.skipped) {
        test.skip();
        return;
      }

      expect(result.orderReversed).toBe(true);
    });
  });

  test.describe('Raster Layer Z-Index', () => {
    test('raster layer has zIndex getter/setter', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create a sample raster (uses WebGL)
        const raster = window.sampleRaster({ name: 'zindex_test' });

        return {
          hasZIndex: typeof raster.zIndex === 'function',
          initialZ: raster.zIndex(),
          canSet: (() => {
            raster.zIndex(150);
            return raster.zIndex() === 150;
          })()
        };
      });

      expect(result.hasZIndex).toBe(true);
      expect(result.canSet).toBe(true);
    });
  });

  test.describe('Mixed Layer Reordering (Vector + Raster)', () => {
    test('can reorder mixed vector and raster layers', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Load both vector and raster
        await sp.load(sp.sample);
        window.sampleRaster({ name: 'mixed_raster' });

        const vectorLayer = Object.values(window.ly).find(l => l.type === 'vector');
        const rasterLayer = Object.values(window.ly).find(l => l.type === 'raster');

        if (!vectorLayer || !rasterLayer) return { skipped: true };

        // Set initial order: raster below vector
        rasterLayer.zIndex(100);
        vectorLayer.zIndex(200);

        const before = {
          rasterZ: rasterLayer.zIndex(),
          vectorZ: vectorLayer.zIndex(),
          vectorAbove: vectorLayer.zIndex() > rasterLayer.zIndex()
        };

        // Swap: put raster above vector
        rasterLayer.zIndex(300);
        vectorLayer.zIndex(150);

        const after = {
          rasterZ: rasterLayer.zIndex(),
          vectorZ: vectorLayer.zIndex(),
          rasterAbove: rasterLayer.zIndex() > vectorLayer.zIndex()
        };

        return {
          before,
          after,
          orderChanged: before.vectorAbove && after.rasterAbove
        };
      });

      if (result.skipped) {
        test.skip();
        return;
      }

      expect(result.orderChanged).toBe(true);
    });

    test('multiple raster z-index changes do not crash WebGL', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create a sample raster (uses WebGL)
        const raster = window.sampleRaster({ name: 'webgl_stress' });

        // Rapidly change z-index multiple times (this used to crash)
        const errors = [];
        try {
          for (let i = 0; i < 10; i++) {
            raster.zIndex(100 + i * 10);
            // Small delay to allow WebGL to process
            await new Promise(r => setTimeout(r, 10));
          }
        } catch (e) {
          errors.push(e.message);
        }

        return {
          finalZ: raster.zIndex(),
          noErrors: errors.length === 0,
          errors
        };
      });

      expect(result.noErrors).toBe(true);
      expect(result.finalZ).toBe(190); // 100 + 9*10
    });

    test('raster remains visible after z-index changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'visible_test' });

        // Change z-index
        raster.zIndex(500);

        // Check visibility
        return {
          visible: raster.visible,
          olLayerVisible: raster._olLayer.getVisible()
        };
      });

      expect(result.visible).toBe(true);
      expect(result.olLayerVisible).toBe(true);
    });
  });

  test.describe('Layer Panel Reorder Simulation', () => {
    test('getLayersSortedByZIndex returns correct order', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Import state functions
        const { getLayersSortedByZIndex } = await import('/src/core/state.js');

        await sp.load(sp.sample);

        const sorted = getLayersSortedByZIndex();
        const zIndices = sorted.map(l => l.zIndex());

        // Check that z-indices are in descending order (highest first)
        let isDescending = true;
        for (let i = 1; i < zIndices.length; i++) {
          if (zIndices[i] > zIndices[i-1]) {
            isDescending = false;
            break;
          }
        }

        return {
          count: sorted.length,
          zIndices,
          isDescending
        };
      });

      expect(result.isDescending).toBe(true);
    });
  });

  test.describe('WebGL Crash Prevention', () => {
    test('rapid show/hide during z-index change does not crash', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'crash_test1' });

        const errors = [];
        try {
          // Simulate the pattern used in layer reordering:
          // hide, change z-index, show
          for (let i = 0; i < 5; i++) {
            raster._olLayer.setVisible(false);
            raster._olLayer.setZIndex(100 + i * 50);
            raster._olLayer.setVisible(true);
            await new Promise(r => requestAnimationFrame(r));
          }
        } catch (e) {
          errors.push(e.message);
        }

        return {
          noErrors: errors.length === 0,
          finalVisible: raster._olLayer.getVisible(),
          errors
        };
      });

      expect(result.noErrors).toBe(true);
      expect(result.finalVisible).toBe(true);
    });

    test('multiple rasters can be reordered without WebGL issues', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Create two rasters (uses WebGL)
        const raster1 = window.sampleRaster({ name: 'raster1' });
        const raster2 = window.sampleRaster({ name: 'raster2' });

        const errors = [];
        try {
          // Swap order multiple times
          for (let i = 0; i < 3; i++) {
            // Temporarily hide both
            raster1._olLayer.setVisible(false);
            raster2._olLayer.setVisible(false);

            // Swap z-indices
            const z1 = raster1.zIndex();
            const z2 = raster2.zIndex();
            raster1._olLayer.setZIndex(z2);
            raster2._olLayer.setZIndex(z1);
            raster1._zIndex = z2;
            raster2._zIndex = z1;

            // Restore visibility
            raster1._olLayer.setVisible(true);
            raster2._olLayer.setVisible(true);

            await new Promise(r => requestAnimationFrame(r));
          }
        } catch (e) {
          errors.push(e.message);
        }

        return {
          noErrors: errors.length === 0,
          raster1Visible: raster1._olLayer.getVisible(),
          raster2Visible: raster2._olLayer.getVisible(),
          errors
        };
      });

      expect(result.noErrors).toBe(true);
      expect(result.raster1Visible).toBe(true);
      expect(result.raster2Visible).toBe(true);
    });
  });
});
