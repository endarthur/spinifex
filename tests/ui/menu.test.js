// Spinifex - Menu Tests
// Tests for auto-populated menus from toolbox registry

import { test, expect } from '@playwright/test';

test.describe('Dynamic Menus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Vector Menu', () => {
    test('vector menu is populated from toolbox', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="vector"]');
        return {
          exists: dropdown !== null,
          hasItems: dropdown?.querySelectorAll('.menu-option').length > 0,
          text: dropdown?.innerHTML || '',
        };
      });

      expect(result.exists).toBe(true);
      expect(result.hasItems).toBe(true);
      expect(result.text).toContain('Buffer');
    });

    test('vector menu has all vector tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="vector"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasBuffer: text.includes('Buffer'),
          hasClip: text.includes('Clip'),
          hasIntersect: text.includes('Intersect'),
          hasUnion: text.includes('Union'),
          hasCentroid: text.includes('Centroid'),
        };
      });

      expect(result.hasBuffer).toBe(true);
      expect(result.hasClip).toBe(true);
      expect(result.hasIntersect).toBe(true);
      expect(result.hasUnion).toBe(true);
      expect(result.hasCentroid).toBe(true);
    });
  });

  test.describe('Raster Menu', () => {
    test('raster menu is populated from toolbox', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="raster"]');
        return {
          exists: dropdown !== null,
          hasItems: dropdown?.querySelectorAll('.menu-option').length > 0,
          text: dropdown?.innerHTML || '',
        };
      });

      expect(result.exists).toBe(true);
      expect(result.hasItems).toBe(true);
      expect(result.text).toContain('Hillshade');
    });

    test('raster menu has terrain analysis tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="raster"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasHillshade: text.includes('Hillshade'),
          hasSlope: text.includes('Slope'),
          hasAspect: text.includes('Aspect'),
          hasContours: text.includes('Contours'),
        };
      });

      expect(result.hasHillshade).toBe(true);
      expect(result.hasSlope).toBe(true);
      expect(result.hasAspect).toBe(true);
      expect(result.hasContours).toBe(true);
    });

    test('raster menu has processing tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="raster"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasReproject: text.includes('Reproject'),
          hasResample: text.includes('Resample'),
          hasClip: text.includes('Clip'),
        };
      });

      expect(result.hasReproject).toBe(true);
      expect(result.hasResample).toBe(true);
      expect(result.hasClip).toBe(true);
    });

    test('raster menu has algebra tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="raster"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasCalc: text.includes('Calculator'),
          hasNDVI: text.includes('NDVI'),
          hasNDWI: text.includes('NDWI'),
        };
      });

      expect(result.hasCalc).toBe(true);
      expect(result.hasNDVI).toBe(true);
      expect(result.hasNDWI).toBe(true);
    });

    test('raster menu has group labels', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="raster"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasTerrain: text.includes('Terrain Analysis'),
          hasProcessing: text.includes('Processing'),
          hasAlgebra: text.includes('Raster Algebra'),
        };
      });

      expect(result.hasTerrain).toBe(true);
      expect(result.hasProcessing).toBe(true);
      expect(result.hasAlgebra).toBe(true);
    });
  });

  test.describe('Tools Menu', () => {
    test('tools menu is populated from toolbox', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="tools"]');
        return {
          exists: dropdown !== null,
          hasItems: dropdown?.querySelectorAll('.menu-option').length > 0,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.hasItems).toBe(true);
    });

    test('tools menu has measurement tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="tools"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasDistance: text.includes('Distance'),
          hasArea: text.includes('Area'),
        };
      });

      expect(result.hasDistance).toBe(true);
      expect(result.hasArea).toBe(true);
    });

    test('tools menu has export tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="tools"]');
        const text = dropdown?.innerHTML || '';
        return {
          hasGeoTIFF: text.includes('GeoTIFF'),
          hasGeoJSON: text.includes('GeoJSON'),
          hasShapefile: text.includes('Shapefile'),
        };
      });

      expect(result.hasGeoTIFF).toBe(true);
      expect(result.hasGeoJSON).toBe(true);
      expect(result.hasShapefile).toBe(true);
    });

    test('tools menu has "All Tools..." option', async ({ page }) => {
      const result = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-menu="tools"]');
        const text = dropdown?.innerHTML || '';
        return text.includes('All Tools...');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Menu Actions', () => {
    test('clicking tool menu item opens tool panel with tool', async ({ page }) => {
      // Click the Raster menu
      await page.click('text=Raster');
      await page.waitForTimeout(100);

      // Click Hillshade
      await page.click('[data-action="tool:raster.hillshade"]');
      await page.waitForTimeout(300);

      // Check that tool panel opened with Hillshade
      const result = await page.evaluate(() => {
        const panel = document.querySelector('.sp-tool-panel');
        const title = panel?.querySelector('.sp-tool-title');
        return {
          panelExists: panel !== null,
          title: title?.textContent || '',
        };
      });

      expect(result.panelExists).toBe(true);
      expect(result.title).toBe('Hillshade');
    });

    test('clicking All Tools opens tool panel', async ({ page }) => {
      // Click the Tools menu
      await page.click('text=Tools');
      await page.waitForTimeout(100);

      // Click All Tools...
      await page.click('[data-action="open-tool-panel"]');
      await page.waitForTimeout(300);

      // Check that tool panel opened in list mode
      const result = await page.evaluate(() => {
        const panel = document.querySelector('.sp-tool-panel');
        const search = panel?.querySelector('.sp-tool-panel-search');
        return {
          panelExists: panel !== null,
          hasSearch: search !== null,
        };
      });

      expect(result.panelExists).toBe(true);
      expect(result.hasSearch).toBe(true);
    });
  });
});
