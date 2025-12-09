// Spinifex - Configuration Tests
// TDD tests for src/core/config.js

import { test, expect } from '@playwright/test';

test.describe('Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Basic API', () => {
    test('config object exists', async ({ page }) => {
      const exists = await page.evaluate(() => window.config !== undefined);
      expect(exists).toBe(true);
    });

    test('config is accessible and has expected structure', async ({ page }) => {
      const structure = await page.evaluate(() => {
        const c = window.config;
        return {
          hasColorRamps: 'colorRamps' in c,
          hasBlendModes: 'blendModes' in c,
          hasDefaults: 'defaults' in c,
          hasUnits: 'units' in c,
        };
      });

      expect(structure.hasColorRamps).toBe(true);
      expect(structure.hasBlendModes).toBe(true);
      expect(structure.hasDefaults).toBe(true);
      expect(structure.hasUnits).toBe(true);
    });
  });

  test.describe('Color Ramps', () => {
    test('has standard color ramps', async ({ page }) => {
      const ramps = await page.evaluate(() => Object.keys(window.config.colorRamps));

      expect(ramps).toContain('terrain');
      expect(ramps).toContain('grayscale');
      expect(ramps).toContain('viridis');
      expect(ramps).toContain('plasma');
      expect(ramps).toContain('ndvi');
    });

    test('color ramps have stops and colors arrays', async ({ page }) => {
      const terrain = await page.evaluate(() => window.config.colorRamps.terrain);

      expect(terrain).toHaveProperty('stops');
      expect(terrain).toHaveProperty('colors');
      expect(Array.isArray(terrain.stops)).toBe(true);
      expect(Array.isArray(terrain.colors)).toBe(true);
      expect(terrain.stops.length).toBe(terrain.colors.length);
    });

    test('color ramp colors are RGB arrays', async ({ page }) => {
      const viridis = await page.evaluate(() => window.config.colorRamps.viridis);

      for (const color of viridis.colors) {
        expect(Array.isArray(color)).toBe(true);
        expect(color.length).toBe(3);
        expect(color.every(c => typeof c === 'number' && c >= 0 && c <= 255)).toBe(true);
      }
    });

    test('color ramp stops are normalized 0-1', async ({ page }) => {
      const terrain = await page.evaluate(() => window.config.colorRamps.terrain);

      expect(terrain.stops[0]).toBe(0);
      expect(terrain.stops[terrain.stops.length - 1]).toBe(1);
      for (const stop of terrain.stops) {
        expect(stop).toBeGreaterThanOrEqual(0);
        expect(stop).toBeLessThanOrEqual(1);
      }
    });
  });

  test.describe('Blend Modes', () => {
    test('has standard blend modes', async ({ page }) => {
      const modes = await page.evaluate(() => window.config.blendModes);

      expect(modes).toContain('source-over');
      expect(modes).toContain('multiply');
      expect(modes).toContain('screen');
      expect(modes).toContain('overlay');
    });

    test('blend modes is an array', async ({ page }) => {
      const isArray = await page.evaluate(() => Array.isArray(window.config.blendModes));
      expect(isArray).toBe(true);
    });
  });

  test.describe('Defaults', () => {
    test('has raster defaults', async ({ page }) => {
      const raster = await page.evaluate(() => window.config.defaults.raster);

      expect(raster).toHaveProperty('colorRamp');
      expect(raster).toHaveProperty('nodata');
    });

    test('has vector defaults', async ({ page }) => {
      const vector = await page.evaluate(() => window.config.defaults.vector);

      expect(vector).toHaveProperty('fillColor');
      expect(vector).toHaveProperty('strokeColor');
      expect(vector).toHaveProperty('strokeWidth');
    });

    test('has buffer tool defaults', async ({ page }) => {
      const buffer = await page.evaluate(() => window.config.defaults.buffer);

      expect(buffer).toHaveProperty('segments');
      expect(buffer).toHaveProperty('units');
    });

    test('default values are valid', async ({ page }) => {
      const defaults = await page.evaluate(() => ({
        rasterColorRamp: window.config.defaults.raster.colorRamp,
        vectorFillColor: window.config.defaults.vector.fillColor,
        bufferSegments: window.config.defaults.buffer.segments,
      }));

      // Raster color ramp should be a valid ramp name
      const rampNames = await page.evaluate(() => Object.keys(window.config.colorRamps));
      expect(rampNames).toContain(defaults.rasterColorRamp);

      // Fill color should be a valid color string
      expect(defaults.vectorFillColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Buffer segments should be a positive integer
      expect(Number.isInteger(defaults.bufferSegments)).toBe(true);
      expect(defaults.bufferSegments).toBeGreaterThan(0);
    });
  });

  test.describe('Units', () => {
    test('has distance units with conversion factors', async ({ page }) => {
      const distance = await page.evaluate(() => window.config.units.distance);

      expect(distance).toHaveProperty('m');
      expect(distance).toHaveProperty('km');
      expect(distance).toHaveProperty('ft');
      expect(distance).toHaveProperty('mi');
    });

    test('meter is base unit (factor = 1)', async ({ page }) => {
      const mFactor = await page.evaluate(() => window.config.units.distance.m);
      expect(mFactor).toBe(1);
    });

    test('conversion factors are correct', async ({ page }) => {
      const units = await page.evaluate(() => window.config.units.distance);

      // 1 km = 1000 m
      expect(units.km).toBe(1000);

      // 1 ft ≈ 0.3048 m
      expect(units.ft).toBeCloseTo(0.3048, 4);

      // 1 mi ≈ 1609.34 m
      expect(units.mi).toBeCloseTo(1609.34, 1);
    });

    test('can convert between units', async ({ page }) => {
      const result = await page.evaluate(() => {
        const units = window.config.units.distance;

        // Convert 1 mile to meters
        const mileInMeters = 1 * units.mi;

        // Convert 1000 meters to km
        const metersInKm = 1000 / units.km;

        return { mileInMeters, metersInKm };
      });

      expect(result.mileInMeters).toBeCloseTo(1609.34, 1);
      expect(result.metersInKm).toBe(1);
    });
  });

  test.describe('Immutability', () => {
    test('config values cannot be modified', async ({ page }) => {
      // Config should be frozen or use getters to prevent modification
      const result = await page.evaluate(() => {
        const originalRamp = window.config.defaults.raster.colorRamp;

        try {
          window.config.defaults.raster.colorRamp = 'hacked';
        } catch (e) {
          // Frozen objects throw TypeError
        }

        return {
          before: originalRamp,
          after: window.config.defaults.raster.colorRamp,
        };
      });

      // Value should be unchanged (either frozen or use getter)
      expect(result.after).toBe(result.before);
    });
  });

  test.describe('Helper Functions', () => {
    test('getColorRamp returns ramp by name', async ({ page }) => {
      const hasHelper = await page.evaluate(() => typeof window.config.getColorRamp === 'function');

      if (!hasHelper) {
        test.skip();
        return;
      }

      const ramp = await page.evaluate(() => window.config.getColorRamp('viridis'));
      expect(ramp).toHaveProperty('stops');
      expect(ramp).toHaveProperty('colors');
    });

    test('getColorRamp returns undefined for invalid name', async ({ page }) => {
      const hasHelper = await page.evaluate(() => typeof window.config.getColorRamp === 'function');

      if (!hasHelper) {
        test.skip();
        return;
      }

      const ramp = await page.evaluate(() => window.config.getColorRamp('nonexistent'));
      expect(ramp).toBeUndefined();
    });

    test('convertDistance converts between units', async ({ page }) => {
      const hasHelper = await page.evaluate(() => typeof window.config.convertDistance === 'function');

      if (!hasHelper) {
        test.skip();
        return;
      }

      const result = await page.evaluate(() => ({
        kmToM: window.config.convertDistance(1, 'km', 'm'),
        mToFt: window.config.convertDistance(1, 'm', 'ft'),
        miToKm: window.config.convertDistance(1, 'mi', 'km'),
      }));

      expect(result.kmToM).toBe(1000);
      expect(result.mToFt).toBeCloseTo(3.28084, 2);
      expect(result.miToKm).toBeCloseTo(1.60934, 2);
    });
  });
});
