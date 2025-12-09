// Spinifex - Custom Color Ramps Tests
// Tests for color ramp creation, manipulation, and interpolation

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Color Ramp API Availability
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Color Ramp API Availability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('addColorRamp is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.addColorRamp === 'function');
    expect(hasFunction).toBe(true);
  });

  test('createRamp is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.createRamp === 'function');
    expect(hasFunction).toBe(true);
  });

  test('listColorRamps is available as window global', async ({ page }) => {
    const hasFunction = await page.evaluate(() => typeof window.listColorRamps === 'function');
    expect(hasFunction).toBe(true);
  });

  test('sp.ramps namespace exists with all methods', async ({ page }) => {
    const available = await page.evaluate(() => ({
      add: typeof window.sp.ramps.add === 'function',
      remove: typeof window.sp.ramps.remove === 'function',
      get: typeof window.sp.ramps.get === 'function',
      list: typeof window.sp.ramps.list === 'function',
      create: typeof window.sp.ramps.create === 'function',
      reverse: typeof window.sp.ramps.reverse === 'function',
      interpolate: typeof window.sp.ramps.interpolate === 'function',
      palette: typeof window.sp.ramps.palette === 'function',
      paletteHex: typeof window.sp.ramps.paletteHex === 'function'
    }));
    expect(available.add).toBe(true);
    expect(available.remove).toBe(true);
    expect(available.get).toBe(true);
    expect(available.list).toBe(true);
    expect(available.create).toBe(true);
    expect(available.reverse).toBe(true);
    expect(available.interpolate).toBe(true);
    expect(available.palette).toBe(true);
    expect(available.paletteHex).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create Ramp Function
// ─────────────────────────────────────────────────────────────────────────────

test.describe('createRamp Function', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('creates ramp from hex colors with auto stops', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.createRamp(['#ff0000', '#00ff00', '#0000ff']);
      return {
        hasStops: Array.isArray(ramp.stops),
        hasColors: Array.isArray(ramp.colors),
        stopsCount: ramp.stops.length,
        colorsCount: ramp.colors.length,
        stops: ramp.stops,
        firstColor: ramp.colors[0],
        lastColor: ramp.colors[2]
      };
    });
    expect(result.hasStops).toBe(true);
    expect(result.hasColors).toBe(true);
    expect(result.stopsCount).toBe(3);
    expect(result.colorsCount).toBe(3);
    expect(result.stops).toEqual([0, 0.5, 1]);
    expect(result.firstColor).toEqual([255, 0, 0]);
    expect(result.lastColor).toEqual([0, 0, 255]);
  });

  test('creates ramp with custom stops', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.createRamp(
        ['#000000', '#ffffff', '#ff0000'],
        [0, 0.3, 1]
      );
      return {
        stops: ramp.stops,
        colors: ramp.colors
      };
    });
    expect(result.stops).toEqual([0, 0.3, 1]);
    expect(result.colors[0]).toEqual([0, 0, 0]);
    expect(result.colors[1]).toEqual([255, 255, 255]);
  });

  test('creates ramp from RGB arrays', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.createRamp([[255, 0, 0], [0, 255, 0]]);
      return {
        firstColor: ramp.colors[0],
        lastColor: ramp.colors[1]
      };
    });
    expect(result.firstColor).toEqual([255, 0, 0]);
    expect(result.lastColor).toEqual([0, 255, 0]);
  });

  test('throws error for fewer than 2 colors', async ({ page }) => {
    const result = await page.evaluate(() => {
      try {
        window.createRamp(['#ff0000']);
        return { threw: false };
      } catch (e) {
        return { threw: true, message: e.message };
      }
    });
    expect(result.threw).toBe(true);
    expect(result.message).toContain('at least 2 colors');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Add and Remove Color Ramps
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Add and Remove Color Ramps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('adds a new custom color ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.addColorRamp('my_custom', ['#ff0000', '#00ff00', '#0000ff']);
      const exists = window.sp.ramps.get('my_custom');
      return {
        added: ramp !== null,
        exists: exists !== null,
        hasStops: exists?.stops?.length > 0,
        hasColors: exists?.colors?.length > 0
      };
    });
    expect(result.added).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.hasStops).toBe(true);
    expect(result.hasColors).toBe(true);
  });

  test('added ramp appears in list', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.addColorRamp('test_ramp', ['#000', '#fff']);
      const allRamps = window.listColorRamps();
      return {
        inList: allRamps.includes('test_ramp')
      };
    });
    expect(result.inList).toBe(true);
  });

  test('removes custom ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.addColorRamp('to_remove', ['#000', '#fff']);
      const existsBefore = window.sp.ramps.get('to_remove') !== null;
      const removed = window.sp.ramps.remove('to_remove');
      const existsAfter = window.sp.ramps.get('to_remove') !== null;
      return { existsBefore, removed, existsAfter };
    });
    expect(result.existsBefore).toBe(true);
    expect(result.removed).toBe(true);
    expect(result.existsAfter).toBe(false);
  });

  test('cannot remove built-in ramps', async ({ page }) => {
    const result = await page.evaluate(() => {
      const removed = window.sp.ramps.remove('viridis');
      const stillExists = window.sp.ramps.get('viridis') !== null;
      return { removed, stillExists };
    });
    expect(result.removed).toBe(false);
    expect(result.stillExists).toBe(true);
  });

  test('sanitizes ramp names', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.addColorRamp('My Custom-Ramp!', ['#ff0000', '#0000ff']);
      const exists = window.sp.ramps.get('my_custom_ramp_');
      return { exists: exists !== null };
    });
    expect(result.exists).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Color Interpolation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Color Interpolation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('interpolates at 0 returns first color', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.sp.ramps.interpolate('grayscale', 0);
    });
    expect(result).toEqual([0, 0, 0]);
  });

  test('interpolates at 1 returns last color', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.sp.ramps.interpolate('grayscale', 1);
    });
    expect(result).toEqual([255, 255, 255]);
  });

  test('interpolates at 0.5 returns middle value', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.sp.ramps.interpolate('grayscale', 0.5);
    });
    expect(result[0]).toBeGreaterThan(100);
    expect(result[0]).toBeLessThan(150);
    expect(result[0]).toBe(result[1]); // grayscale: all channels equal
    expect(result[0]).toBe(result[2]);
  });

  test('clamps values outside 0-1 range', async ({ page }) => {
    const result = await page.evaluate(() => {
      const low = window.sp.ramps.interpolate('grayscale', -0.5);
      const high = window.sp.ramps.interpolate('grayscale', 1.5);
      return { low, high };
    });
    expect(result.low).toEqual([0, 0, 0]);
    expect(result.high).toEqual([255, 255, 255]);
  });

  test('works with custom ramp object', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = { stops: [0, 1], colors: [[255, 0, 0], [0, 0, 255]] };
      return window.sp.ramps.interpolate(ramp, 0.5);
    });
    expect(result[0]).toBe(128); // midpoint red
    expect(result[1]).toBe(0);   // no green
    expect(result[2]).toBe(128); // midpoint blue
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Palette Generation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Palette Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('generates palette with specified number of colors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const palette = window.sp.ramps.palette('viridis', 5);
      return {
        count: palette.length,
        firstIsArray: Array.isArray(palette[0]),
        firstHasThreeValues: palette[0]?.length === 3
      };
    });
    expect(result.count).toBe(5);
    expect(result.firstIsArray).toBe(true);
    expect(result.firstHasThreeValues).toBe(true);
  });

  test('generates hex palette', async ({ page }) => {
    const result = await page.evaluate(() => {
      const palette = window.sp.ramps.paletteHex('grayscale', 3);
      return {
        count: palette.length,
        firstIsHex: palette[0].startsWith('#'),
        first: palette[0],
        last: palette[2]
      };
    });
    expect(result.count).toBe(3);
    expect(result.firstIsHex).toBe(true);
    expect(result.first).toBe('#000000');
    expect(result.last).toBe('#ffffff');
  });

  test('defaults to 10 colors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const palette = window.sp.ramps.palette('viridis');
      return palette.length;
    });
    expect(result).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reverse Ramp
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Reverse Ramp', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('creates reversed copy of existing ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      const reversed = window.sp.ramps.reverse('grayscale');
      const original = window.sp.ramps.get('grayscale');
      return {
        createdReversed: reversed !== null,
        exists: window.sp.ramps.get('grayscale_r') !== null,
        originalFirst: original.colors[0],
        reversedFirst: reversed.colors[0]
      };
    });
    expect(result.createdReversed).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.originalFirst).toEqual([0, 0, 0]);
    expect(result.reversedFirst).toEqual([255, 255, 255]);
  });

  test('uses custom name for reversed ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.sp.ramps.reverse('viridis', 'viridis_reversed');
      return window.sp.ramps.get('viridis_reversed') !== null;
    });
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Color Parsing
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Color Parsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('parses 6-digit hex', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor('#ff8800'));
    expect(result).toEqual([255, 136, 0]);
  });

  test('parses 3-digit hex', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor('#f80'));
    expect(result).toEqual([255, 136, 0]);
  });

  test('parses RGB string', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor('rgb(100, 150, 200)'));
    expect(result).toEqual([100, 150, 200]);
  });

  test('parses RGBA string', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor('rgba(50, 100, 150, 0.5)'));
    expect(result).toEqual([50, 100, 150]);
  });

  test('parses named colors', async ({ page }) => {
    const result = await page.evaluate(() => ({
      red: window.sp.ramps.parseColor('red'),
      blue: window.sp.ramps.parseColor('blue'),
      white: window.sp.ramps.parseColor('white')
    }));
    expect(result.red).toEqual([255, 0, 0]);
    expect(result.blue).toEqual([0, 0, 255]);
    expect(result.white).toEqual([255, 255, 255]);
  });

  test('passes through RGB arrays', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor([128, 64, 32]));
    expect(result).toEqual([128, 64, 32]);
  });

  test('clamps out-of-range values', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.parseColor([300, -50, 128]));
    expect(result).toEqual([255, 0, 128]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RGB to Hex Conversion
// ─────────────────────────────────────────────────────────────────────────────

test.describe('RGB to Hex Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('converts RGB to hex', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.rgbToHex([255, 128, 0]));
    expect(result).toBe('#ff8000');
  });

  test('pads single digit values', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.rgbToHex([0, 5, 15]));
    expect(result).toBe('#00050f');
  });

  test('clamps out-of-range values', async ({ page }) => {
    const result = await page.evaluate(() => window.sp.ramps.rgbToHex([300, -50, 128]));
    expect(result).toBe('#ff0080');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Color Scales
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Color Scales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('creates sequential scale from hue', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.sp.ramps.scales.sequential('#0000ff');
      return {
        hasStops: Array.isArray(ramp.stops),
        hasColors: Array.isArray(ramp.colors),
        colorCount: ramp.colors.length
      };
    });
    expect(result.hasStops).toBe(true);
    expect(result.hasColors).toBe(true);
    expect(result.colorCount).toBe(5);
  });

  test('creates diverging scale', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.sp.ramps.scales.diverging('#ff0000', '#0000ff');
      return {
        stops: ramp.stops,
        colorCount: ramp.colors.length,
        middleColor: ramp.colors[1]
      };
    });
    expect(result.stops).toEqual([0, 0.5, 1]);
    expect(result.colorCount).toBe(3);
    expect(result.middleColor).toEqual([255, 255, 255]); // White midpoint
  });

  test('creates categorical scale', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramp = window.sp.ramps.scales.categorical(6);
      return {
        colorCount: ramp.colors.length,
        allDifferent: new Set(ramp.colors.map(c => c.join(','))).size === 6
      };
    });
    expect(result.colorCount).toBe(6);
    expect(result.allDifferent).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Ramps
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Built-in Ramps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('lists built-in ramps', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ramps = window.listColorRamps();
      return {
        hasViridis: ramps.includes('viridis'),
        hasPlasma: ramps.includes('plasma'),
        hasTerrain: ramps.includes('terrain'),
        hasGrayscale: ramps.includes('grayscale'),
        count: ramps.length
      };
    });
    expect(result.hasViridis).toBe(true);
    expect(result.hasPlasma).toBe(true);
    expect(result.hasTerrain).toBe(true);
    expect(result.hasGrayscale).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(9);
  });

  test('can get each built-in ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      const rampNames = ['viridis', 'plasma', 'terrain', 'grayscale', 'bluered', 'ndvi', 'inferno', 'hot'];
      const allValid = rampNames.every(name => {
        const ramp = window.sp.ramps.get(name);
        return ramp && ramp.stops && ramp.colors;
      });
      return { allValid, count: rampNames.length };
    });
    expect(result.allValid).toBe(true);
  });

  test('built-in ramps are not marked as custom', async ({ page }) => {
    const result = await page.evaluate(() => {
      return {
        viridis: window.sp.ramps.isCustom('viridis'),
        terrain: window.sp.ramps.isCustom('terrain')
      };
    });
    expect(result.viridis).toBe(false);
    expect(result.terrain).toBe(false);
  });

  test('added ramps are marked as custom', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.addColorRamp('my_custom_test', ['#ff0000', '#0000ff']);
      return window.sp.ramps.isCustom('my_custom_test');
    });
    expect(result).toBe(true);
  });
});
