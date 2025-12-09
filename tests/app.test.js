// Spinifex - App Integration Tests
// Tests basic app loading, UI, and core functionality

import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('loads the application', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Spinifex/);

    // Check main components are present
    await expect(page.locator('#map')).toBeVisible();

    // Wait for app to initialize
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('sp namespace is available', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });

    // Check that core API functions exist
    const apiCheck = await page.evaluate(() => {
      return {
        hasLoad: typeof window.load === 'function',
        hasSample: typeof window.sample === 'object',
        hasSrtm: typeof window.srtm === 'function',
        hasCalc: typeof window.calc === 'function',
        hasNdvi: typeof window.ndvi === 'function',
        hasSampleRaster: typeof window.sampleRaster === 'function',
        hasLy: typeof window.ly === 'object',
      };
    });

    expect(apiCheck.hasLoad).toBe(true);
    expect(apiCheck.hasSample).toBe(true);
    expect(apiCheck.hasSrtm).toBe(true);
    expect(apiCheck.hasCalc).toBe(true);
    expect(apiCheck.hasNdvi).toBe(true);
    expect(apiCheck.hasSampleRaster).toBe(true);
    expect(apiCheck.hasLy).toBe(true);
  });

  test('help function works', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });

    // Call help and check it doesn't throw
    const result = await page.evaluate(() => {
      try {
        window.help();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
  });
});

test.describe('Basemaps', () => {
  test('can add a basemap', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });

    // Add dark basemap
    await page.evaluate(() => window.basemap('dark'));

    // Wait for layer to be added
    await page.waitForFunction(() => window.ly.dark !== undefined, { timeout: 5000 });

    // Check layer exists
    const hasDark = await page.evaluate(() => window.ly.dark !== undefined);
    expect(hasDark).toBe(true);
  });
});
