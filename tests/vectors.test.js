// Spinifex - Vector Layer Tests
// Tests vector data loading, styling, and spatial operations

import { test, expect } from '@playwright/test';

test.describe('Sample Vector Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('can load sample data', async ({ page }) => {
    // Load sample data
    await page.evaluate(() => window.load(window.sample));

    // Wait for layers to be created
    await page.waitForFunction(() => Object.keys(window.ly).length >= 2, { timeout: 5000 });

    // Check that sample layers exist
    const layers = await page.evaluate(() => Object.keys(window.ly));
    expect(layers).toContain('geology');
    expect(layers).toContain('drillholes');
  });

  test('geology layer has correct properties', async ({ page }) => {
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });

    const layerInfo = await page.evaluate(() => {
      const g = window.ly.geology;
      return {
        count: g.count,
        geomType: g.geomType,
        fields: g.fields,
        hasExtent: g.extent !== null,
      };
    });

    expect(layerInfo.count).toBeGreaterThan(0);
    expect(layerInfo.geomType).toBe('Polygon');
    expect(layerInfo.fields).toContain('unit');
    expect(layerInfo.hasExtent).toBe(true);
  });

  test('can filter features with where()', async ({ page }) => {
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });

    // Use actual unit name from sample data
    const result = await page.evaluate(() => {
      const filtered = window.ly.geology.v.where(f => f.properties.unit === 'Granite');
      return {
        count: filtered.count,
        hasFeatures: filtered.features.length > 0,
      };
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.hasFeatures).toBe(true);
  });

  test('can save filtered results', async ({ page }) => {
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });

    // Filter and save using actual unit name (save() returns a Promise)
    await page.evaluate(async () => {
      await window.ly.geology.v.where(f => f.properties.unit === 'Granite').save('granite_only');
    });

    // Wait for new layer
    await page.waitForFunction(() => window.ly.granite_only !== undefined, { timeout: 5000 });

    const newLayer = await page.evaluate(() => ({
      exists: window.ly.granite_only !== undefined,
      count: window.ly.granite_only?.count,
    }));

    expect(newLayer.exists).toBe(true);
    expect(newLayer.count).toBeGreaterThan(0);
  });
});

test.describe('Spatial Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });
  });

  test('buffer operation works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const buffered = await window.buffer(window.ly.drillholes, '500m');
      return {
        exists: buffered !== null,
        name: buffered?.name,
        geomType: buffered?.geomType,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.geomType).toBe('Polygon');
  });

  test('centroid operation works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const centroids = await window.centroid(window.ly.geology);
      return {
        exists: centroids !== null,
        geomType: centroids?.geomType,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.geomType).toBe('Point');
  });

  test('dissolve operation works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const dissolved = await window.dissolve(window.ly.geology, 'lithology');
      return {
        exists: dissolved !== null,
        count: dissolved?.count,
        originalCount: window.ly.geology.count,
      };
    });

    expect(result.exists).toBe(true);
    // Dissolved should have same or fewer features than original
    expect(result.count).toBeLessThanOrEqual(result.originalCount);
  });
});

test.describe('Layer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => window.ly.geology !== undefined, { timeout: 5000 });
  });

  test('can show/hide layers', async ({ page }) => {
    const visibility = await page.evaluate(() => {
      const layer = window.ly.geology;
      const initialVisible = layer.visible;
      layer.hide();
      const afterHide = layer.visible;
      layer.show();
      const afterShow = layer.visible;
      return { initialVisible, afterHide, afterShow };
    });

    expect(visibility.initialVisible).toBe(true);
    expect(visibility.afterHide).toBe(false);
    expect(visibility.afterShow).toBe(true);
  });

  test('can rename layers', async ({ page }) => {
    await page.evaluate(() => {
      window.ly.geology.rename('rocks');
    });

    await page.waitForFunction(() => window.ly.rocks !== undefined, { timeout: 5000 });

    const result = await page.evaluate(() => ({
      hasRocks: window.ly.rocks !== undefined,
      hasGeology: window.ly.geology !== undefined,
    }));

    expect(result.hasRocks).toBe(true);
    expect(result.hasGeology).toBe(false);
  });

  test('can remove layers', async ({ page }) => {
    await page.evaluate(() => {
      window.ly.geology.remove();
    });

    await page.waitForFunction(() => window.ly.geology === undefined, { timeout: 5000 });

    const hasGeology = await page.evaluate(() => window.ly.geology !== undefined);
    expect(hasGeology).toBe(false);
  });

  test('can adjust z-index', async ({ page }) => {
    const zIndexResult = await page.evaluate(() => {
      const initial = window.ly.geology.zIndex();
      window.ly.geology.zIndex(100);
      const after = window.ly.geology.zIndex();
      return { initial, after };
    });

    expect(zIndexResult.after).toBe(100);
  });
});
