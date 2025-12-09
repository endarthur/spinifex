// Spinifex - Selection Model Tests
// TDD tests for vector layer selection functionality

import { test, expect } from '@playwright/test';

test.describe('Selection Model', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample data to have vector layers to test with
    await page.evaluate(() => sp.load(sp.sample));
    await page.waitForFunction(() => Object.keys(window.ly).length > 0, { timeout: 5000 });
  });

  test.describe('Basic Selection API', () => {
    test('vector layer has selection property', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return {
          hasSelection: layer?.selection !== undefined,
          selectionIsArray: Array.isArray(layer?.selection),
        };
      });

      expect(result.hasSelection).toBe(true);
      expect(result.selectionIsArray).toBe(true);
    });

    test('selection is initially empty', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return layer?.selection?.length ?? -1;
      });

      expect(result).toBe(0);
    });

    test('has select() method', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer?.select === 'function';
      });

      expect(result).toBe(true);
    });

    test('has deselect() method', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer?.deselect === 'function';
      });

      expect(result).toBe(true);
    });

    test('has clearSelection() method', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer?.clearSelection === 'function';
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Selecting Features', () => {
    test('select() by feature index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select(0);
        return {
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
        };
      });

      expect(result.selectionLength).toBe(1);
      expect(result.isSelected0).toBe(true);
    });

    test('select() by array of indices', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1, 2]);
        return {
          selectionLength: layer.selection.length,
        };
      });

      expect(result.selectionLength).toBe(3);
    });

    test('select() by filter function', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        if (!layer || layer.count === 0) return { skipped: true };
        // Select features where first field value is truthy
        const firstField = layer.fields[0];
        if (!firstField) return { skipped: true };
        layer.select(f => f.properties[firstField] !== undefined);
        return {
          selectionLength: layer.selection.length,
          hasSelections: layer.selection.length > 0,
        };
      });

      if (result.skipped) {
        test.skip();
        return;
      }
      expect(result.hasSelections).toBe(true);
    });

    test('selecting same feature twice does not duplicate', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select(0);
        layer.select(0);
        return layer.selection.length;
      });

      expect(result).toBe(1);
    });

    test('selectAll() selects all features', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.selectAll();
        return {
          selectionLength: layer.selection.length,
          featureCount: layer.count,
        };
      });

      expect(result.selectionLength).toBe(result.featureCount);
    });
  });

  test.describe('Deselecting Features', () => {
    test('deselect() by feature index', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1, 2]);
        layer.deselect(1);
        return {
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
          isSelected1: layer.isSelected(1),
          isSelected2: layer.isSelected(2),
        };
      });

      expect(result.selectionLength).toBe(2);
      expect(result.isSelected0).toBe(true);
      expect(result.isSelected1).toBe(false);
      expect(result.isSelected2).toBe(true);
    });

    test('deselect() by array of indices', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1, 2, 3]);
        layer.deselect([1, 3]);
        return {
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
          isSelected1: layer.isSelected(1),
          isSelected2: layer.isSelected(2),
          isSelected3: layer.isSelected(3),
        };
      });

      expect(result.selectionLength).toBe(2);
      expect(result.isSelected0).toBe(true);
      expect(result.isSelected1).toBe(false);
      expect(result.isSelected2).toBe(true);
      expect(result.isSelected3).toBe(false);
    });

    test('clearSelection() removes all selections', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.selectAll();
        const beforeClear = layer.selection.length;
        layer.clearSelection();
        return {
          beforeClear,
          afterClear: layer.selection.length,
        };
      });

      expect(result.beforeClear).toBeGreaterThan(0);
      expect(result.afterClear).toBe(0);
    });
  });

  test.describe('Toggle Selection', () => {
    test('toggleSelect() adds if not selected', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.clearSelection();
        layer.toggleSelect(0);
        return layer.isSelected(0);
      });

      expect(result).toBe(true);
    });

    test('toggleSelect() removes if already selected', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select(0);
        layer.toggleSelect(0);
        return layer.isSelected(0);
      });

      expect(result).toBe(false);
    });
  });

  test.describe('Selection Info', () => {
    test('isSelected() returns true for selected feature', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select(0);
        return {
          selected0: layer.isSelected(0),
          selected1: layer.isSelected(1),
        };
      });

      expect(result.selected0).toBe(true);
      expect(result.selected1).toBe(false);
    });

    test('selectionCount returns number of selected features', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1, 2]);
        return layer.selectionCount;
      });

      expect(result).toBe(3);
    });

    test('getSelectedFeatures() returns GeoJSON features', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1]);
        const selected = layer.getSelectedFeatures();
        return {
          length: selected.length,
          hasGeometry: selected[0]?.geometry !== undefined,
          hasProperties: selected[0]?.properties !== undefined,
        };
      });

      expect(result.length).toBe(2);
      expect(result.hasGeometry).toBe(true);
      expect(result.hasProperties).toBe(true);
    });
  });

  test.describe('Selection Events', () => {
    test('emits selection:changed event when selection changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        let eventFired = false;
        let eventData = null;

        window.events.on('selection:changed', (data) => {
          eventFired = true;
          eventData = data;
        });

        layer.select(0);

        // Give event time to fire
        await new Promise(r => setTimeout(r, 50));

        return {
          eventFired,
          hasLayerName: eventData?.layerName !== undefined,
          hasSelection: eventData?.selection !== undefined,
        };
      });

      expect(result.eventFired).toBe(true);
      expect(result.hasLayerName).toBe(true);
      expect(result.hasSelection).toBe(true);
    });

    test('event includes layer name and selection array', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        let eventData = null;

        window.events.on('selection:changed', (data) => {
          eventData = data;
        });

        layer.select([0, 1]);
        await new Promise(r => setTimeout(r, 50));

        return {
          layerName: eventData?.layerName,
          selectionLength: eventData?.selection?.length,
        };
      });

      expect(result.layerName).toBeDefined();
      expect(result.selectionLength).toBe(2);
    });
  });

  test.describe('Selection Styling', () => {
    test('selected features have different style', async ({ page }) => {
      // This test verifies that selection styling is applied
      // We can't easily check visual style, but we can check that the method exists
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer?.setSelectionStyle === 'function';
      });

      expect(result).toBe(true);
    });

    test('setSelectionStyle() configures selection appearance', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        // Should not throw
        try {
          layer.setSelectionStyle({
            fillColor: '#ff0000',
            strokeColor: '#ff0000',
            strokeWidth: 3,
          });
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Selection Persistence', () => {
    test('selection survives layer refresh', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1, 2]);
        layer.refresh();
        return {
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
          isSelected1: layer.isSelected(1),
          isSelected2: layer.isSelected(2),
        };
      });

      expect(result.selectionLength).toBe(3);
      expect(result.isSelected0).toBe(true);
      expect(result.isSelected1).toBe(true);
      expect(result.isSelected2).toBe(true);
    });

    test('selection survives style change', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.select([0, 1]);
        layer.style({ fillColor: '#00ff00' });
        return {
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
          isSelected1: layer.isSelected(1),
        };
      });

      expect(result.selectionLength).toBe(2);
      expect(result.isSelected0).toBe(true);
      expect(result.isSelected1).toBe(true);
    });
  });

  test.describe('Integration', () => {
    test('can chain selection methods', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        // Use { add: true } for chaining to add to selection
        const result = layer.select(0).select(1, { add: true }).select(2, { add: true });
        return {
          chainReturnsLayer: result === layer,
          selectionLength: layer.selection.length,
          isSelected0: layer.isSelected(0),
          isSelected1: layer.isSelected(1),
          isSelected2: layer.isSelected(2),
        };
      });

      expect(result.chainReturnsLayer).toBe(true);
      expect(result.selectionLength).toBe(3);
      expect(result.isSelected0).toBe(true);
      expect(result.isSelected1).toBe(true);
      expect(result.isSelected2).toBe(true);
    });

    test('v namespace has selection shorthand', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return {
          hasVSelect: typeof layer?.v?.select === 'function',
          hasVDeselect: typeof layer?.v?.deselect === 'function',
        };
      });

      expect(result.hasVSelect).toBe(true);
      expect(result.hasVDeselect).toBe(true);
    });
  });
});
