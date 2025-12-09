// Spinifex - Raster Layer Tests
// Tests raster operations, algebra, expressions, and band compositing

import { test, expect } from '@playwright/test';

test.describe('Sample Raster Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('can generate sample raster', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.sampleRaster();
      return {
        exists: raster !== null,
        name: raster.name,
        width: raster.width,
        height: raster.height,
        bandCount: raster._metadata?.bandCount,
        isRaster: raster.isRaster,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toBe('sample_satellite');
    expect(result.width).toBe(512);  // Default size
    expect(result.height).toBe(512);
    expect(result.bandCount).toBe(4);
    expect(result.isRaster).toBe(true);
  });

  test('sample raster has correct band stats', async ({ page }) => {
    const stats = await page.evaluate(() => {
      const raster = window.sampleRaster({ name: 'test_stats' });
      return {
        minValue: raster.minValue,
        maxValue: raster.maxValue,
        hasBandStats: raster._bandStats !== undefined,
        band1: raster._bandStats?.band1,
        band4: raster._bandStats?.band4,
      };
    });

    expect(stats.hasBandStats).toBe(true);
    // NIR band should have higher max than blue
    expect(stats.band4.max).toBeGreaterThan(stats.band1.max);
  });
});

test.describe('Raster Band Compositing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Generate sample raster
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('can set RGB band mapping', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.sat;

      // Get initial mapping (after generation, r.bands(3,2,1) was called)
      const initial = raster.r.bands();

      // Set NIR false-color (4, 3, 2)
      raster.r.bands(4, 3, 2);
      const falseColor = raster.r.bands();

      // Set natural color
      raster.r.bands(3, 2, 1);
      const natural = raster.r.bands();

      return { initial, falseColor, natural };
    });

    // Initial should be [3, 2, 1] since sampleRaster calls bands(3, 2, 1)
    expect(result.initial).toEqual([3, 2, 1]);
    expect(result.falseColor).toEqual([4, 3, 2]);
    expect(result.natural).toEqual([3, 2, 1]);
  });

  test('rejects invalid band numbers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.sat;
      const before = [...raster.r.bands()];

      // Try to set invalid band (5 doesn't exist)
      raster.r.bands(5, 3, 2);
      const after = raster.r.bands();

      return { before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) };
    });

    // Should not have changed
    expect(result.unchanged).toBe(true);
  });
});

test.describe('Raster Color Ramps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'dem' }));
    await page.waitForFunction(() => window.ly.dem !== undefined, { timeout: 5000 });
  });

  test('can change color ramp', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.dem;

      // Switch to singleband mode with terrain ramp
      raster.r.mode('singleband');
      raster.r.colorRamp('terrain');
      const terrain = raster.r.colorRamp();

      raster.r.colorRamp('viridis');
      const viridis = raster.r.colorRamp();

      return { terrain, viridis };
    });

    expect(result.terrain).toBe('terrain');
    expect(result.viridis).toBe('viridis');
  });

  test('can adjust stretch', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.dem;

      const before = raster.r.stretch();
      raster.r.stretch(0, 1000);
      const after = raster.r.stretch();

      return { before, after };
    });

    expect(result.after.min).toBe(0);
    expect(result.after.max).toBe(1000);
  });
});

test.describe('Raster Expressions (WebGL)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('can apply NDVI expression', async ({ page }) => {
    // Apply expression and wait for it to complete (it's async)
    await page.evaluate(() => {
      window.ly.sat.r.expression('(b4 - b3) / (b4 + b3)', {
        min: -1,
        max: 1,
        colorRamp: 'ndvi'
      });
    });

    // Wait for the async import to complete and expression to be stored
    await page.waitForFunction(() => window.ly.sat._customExpression !== null && window.ly.sat._customExpression !== undefined, { timeout: 5000 });

    const expressionSet = await page.evaluate(() => window.ly.sat._customExpression);
    expect(expressionSet).toBe('(b4 - b3) / (b4 + b3)');
  });

  test('can clear expression', async ({ page }) => {
    // First set an expression
    await page.evaluate(() => {
      window.ly.sat.r.expression('b4 - b3');
    });
    await page.waitForFunction(() => window.ly.sat._customExpression === 'b4 - b3', { timeout: 5000 });

    // Then clear it
    await page.evaluate(() => {
      window.ly.sat.r.expression(null);
    });

    // Wait a bit for the clear to take effect
    await page.waitForTimeout(100);

    const cleared = await page.evaluate(() => window.ly.sat._customExpression);
    expect(cleared).toBeNull();
  });
});

test.describe('Raster Calculator (calc)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('calc creates new layer from expression', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ndviLayer = await window.calc(
        '(a.b4 - a.b3) / (a.b4 + a.b3)',
        { a: window.ly.sat },
        { name: 'ndvi_result', colorRamp: 'ndvi', min: -1, max: 1 }
      );

      return {
        exists: ndviLayer !== null,
        name: ndviLayer.name,
        isRaster: ndviLayer.isRaster,
        width: ndviLayer.width,
        height: ndviLayer.height,
        bandCount: ndviLayer._metadata?.bandCount,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toBe('ndvi_result');
    expect(result.isRaster).toBe(true);
    expect(result.width).toBe(512);  // Inherits from source raster
    expect(result.height).toBe(512);
    expect(result.bandCount).toBe(1);  // Result is single-band
  });

  test('calc result has valid NDVI range', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ndviLayer = await window.calc(
        '(a.b4 - a.b3) / (a.b4 + a.b3)',
        { a: window.ly.sat },
        { name: 'ndvi_check' }
      );

      return {
        min: ndviLayer.minValue,
        max: ndviLayer.maxValue,
      };
    });

    // NDVI should be between -1 and 1
    expect(result.min).toBeGreaterThanOrEqual(-1);
    expect(result.max).toBeLessThanOrEqual(1);
  });

  test('can do simple arithmetic', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Just double the first input band
      const doubled = await window.calc('a * 2', { a: window.ly.sat }, { name: 'doubled' });

      return {
        exists: doubled !== null,
        name: doubled.name,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toBe('doubled');
  });

  test('threshold creates binary result', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const thresh = await window.calc(
        'a.b4 > 2000 ? 1 : 0',
        { a: window.ly.sat },
        { name: 'veg_mask' }
      );

      return {
        min: thresh.minValue,
        max: thresh.maxValue,
      };
    });

    // Binary threshold should only have 0 and 1
    expect(result.min).toBeGreaterThanOrEqual(0);
    expect(result.max).toBeLessThanOrEqual(1);
  });
});

test.describe('Raster Algebra Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('ndvi() shortcut works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ndvi = await window.ndvi(window.ly.sat);
      return {
        exists: ndvi !== null,
        name: ndvi.name,
        min: ndvi.minValue,
        max: ndvi.maxValue,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toContain('ndvi');
    expect(result.min).toBeGreaterThanOrEqual(-1);
    expect(result.max).toBeLessThanOrEqual(1);
  });

  test('ndvi() with custom bands works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Use bands 4 and 3 explicitly
      const ndvi = await window.ndvi(window.ly.sat, 4, 3, { name: 'custom_ndvi' });
      return {
        exists: ndvi !== null,
        name: ndvi.name,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toBe('custom_ndvi');
  });

  test('threshold() shortcut works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const thresh = await window.threshold(window.ly.sat, 1000);
      return {
        exists: thresh !== null,
        name: thresh.name,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toContain('threshold');
  });

  test('ratio() shortcut works', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ratio = await window.ratio(window.ly.sat, 4, 3);
      return {
        exists: ratio !== null,
        name: ratio.name,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.name).toContain('ratio');
  });
});

test.describe('Raster getValue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('can get value at point', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.sat;
      const extent = raster.extent;

      // Get value at center of raster
      const centerLon = (extent[0] + extent[2]) / 2;
      const centerLat = (extent[1] + extent[3]) / 2;

      const val1 = raster.r.getValue(centerLon, centerLat, 1);
      const val4 = raster.r.getValue(centerLon, centerLat, 4);

      return {
        val1,
        val4,
        hasValues: val1 !== null && val4 !== null,
      };
    });

    expect(result.hasValues).toBe(true);
    expect(typeof result.val1).toBe('number');
    expect(typeof result.val4).toBe('number');
  });

  test('returns null for out of bounds', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raster = window.ly.sat;
      // Way outside the extent
      const val = raster.r.getValue(0, 0, 1);
      return { val };
    });

    expect(result.val).toBeNull();
  });
});

test.describe('Raster Save/Reload Cycle', () => {
  test.setTimeout(120000); // GDAL operations can be slow

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('layerToGeoTiff produces valid georeference before GDAL', async ({ page }) => {
    // This test checks that our raw TIFF has valid geo-referencing
    // before GDAL processes it
    const result = await page.evaluate(async () => {
      try {
        const original = window.sampleRaster({ name: 'geotiff_check' });
        const originalExtent = original.extent;

        // Export to GeoTIFF (which internally creates raw TIFF)
        const { toGeoTiff } = await import('/src/raster/gdal.js');
        const rawTiffBlob = await toGeoTiff(original);

        if (!rawTiffBlob) {
          return { success: false, error: 'toGeoTiff returned null' };
        }
        const rawTiff = await rawTiffBlob.arrayBuffer();

        // Parse with geotiff.js
        const geotiff = await import('https://cdn.jsdelivr.net/npm/geotiff@2.1.0/+esm');
        const tiff = await geotiff.fromArrayBuffer(rawTiff);
        const image = await tiff.getImage();

        const rawBbox = image.getBoundingBox();

        return {
          success: true,
          originalExtent,
          rawBbox,
          bboxValid: rawBbox && rawBbox.every(v => isFinite(v)) &&
                     rawBbox[0] !== rawBbox[2] && rawBbox[1] !== rawBbox[3]
        };
      } catch (e) {
        return { success: false, error: e.message, stack: e.stack };
      }
    });

    if (!result.success) {
      console.log('Test failed:', result.error);
      if (result.stack) console.log('Stack:', result.stack);
    } else {
      console.log('Original extent:', result.originalExtent);
      console.log('Raw TIFF bbox:', result.rawBbox);
    }

    expect(result.success).toBe(true);
    expect(result.bboxValid).toBe(true);
    // Check that bbox roughly matches original extent
    if (result.originalExtent && result.rawBbox) {
      expect(Math.abs(result.rawBbox[0] - result.originalExtent[0])).toBeLessThan(1);
      expect(Math.abs(result.rawBbox[2] - result.originalExtent[2])).toBeLessThan(1);
    }
  });

  test('sample raster survives COG round-trip', async ({ page }) => {
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const result = await page.evaluate(async () => {
      try {
        // Create sample raster
        const original = window.sampleRaster({ name: 'roundtrip_test' });
        if (!original) {
          return { success: false, error: 'Failed to create sample raster' };
        }

        const originalInfo = {
          width: original.width,
          height: original.height,
          bands: original.bands,
          min: original.minValue,
          max: original.maxValue,
          extent: original.extent
        };

        // Export to COG
        const blob = await window.gdal.toCOG(original);
        if (!blob) {
          return { success: false, error: 'toCOG returned null' };
        }

        // Try to reload from COG blob
        const { loadGeoTIFF } = await import('/src/formats/geotiff.js');
        const buffer = await blob.arrayBuffer();

        // Parse with geotiff.js first to debug
        let cogInfo = null;
        try {
          const geotiff = await import('https://cdn.jsdelivr.net/npm/geotiff@2.1.0/+esm');
          const tiff = await geotiff.fromArrayBuffer(buffer);
          const image = await tiff.getImage();
          cogInfo = {
            width: image.getWidth(),
            height: image.getHeight(),
            bbox: image.getBoundingBox(),
            samplesPerPixel: image.getSamplesPerPixel()
          };
        } catch (parseError) {
          cogInfo = { parseError: parseError.message };
        }

        const reloaded = await loadGeoTIFF(buffer, 'reloaded_test');

        if (!reloaded) {
          return { success: false, error: 'loadGeoTIFF returned null', cogInfo };
        }

        return {
          success: true,
          original: originalInfo,
          cogInfo,
          reloaded: {
            width: reloaded.width,
            height: reloaded.height,
            bands: reloaded.bands,
            min: reloaded.minValue,
            max: reloaded.maxValue,
            extent: reloaded.extent
          }
        };
      } catch (e) {
        return { success: false, error: e.message, stack: e.stack };
      }
    });

    if (!result.success) {
      console.log('Round-trip failed:', result.error);
      if (result.cogInfo) console.log('COG info:', JSON.stringify(result.cogInfo));
      if (result.originalInfo) console.log('Original info:', JSON.stringify(result.originalInfo));
      if (result.stack) console.log('Stack:', result.stack);
    }
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }

    expect(result.success).toBe(true);
    expect(result.reloaded.width).toBe(result.original.width);
    expect(result.reloaded.height).toBe(result.original.height);
    expect(result.reloaded.bands).toBe(result.original.bands);
  });

  test('COG round-trip works with workspace-style options', async ({ page }) => {
    // This test simulates how workspace saves and loads raster layers
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const result = await page.evaluate(async () => {
      try {
        // Create sample raster
        const original = window.sampleRaster({ name: 'workspace_test' });

        // Build workspace-style config (like workspace.js does on save)
        const layerConfig = {
          name: original.name,
          type: 'raster',
          format: 'cog',
          visible: original.visible,
          zIndex: original.zIndex ? original.zIndex() : 0
        };

        // Add raster-specific properties (like workspace.js does)
        if (original._metadata) {
          layerConfig.nodata = original._metadata.nodata;
          layerConfig.min = original._metadata.min;
          layerConfig.max = original._metadata.max;
        }
        if (original._colorRamp) {
          layerConfig.colorRamp = original._colorRamp;
        }
        if (original._mode) {
          layerConfig.mode = original._mode;
        }
        if (original._selectedBand) {
          layerConfig.selectedBand = original._selectedBand;
        }

        // Export to COG
        const blob = await window.gdal.toCOG(original);
        const buffer = await blob.arrayBuffer();

        // Remove original layer first to avoid name conflicts
        original.remove();

        // Now try to reload with full workspace config
        const { loadGeoTIFF } = await import('/src/formats/geotiff.js');
        const reloaded = await loadGeoTIFF(buffer, layerConfig.name, layerConfig);

        if (!reloaded) {
          return {
            success: false,
            error: 'loadGeoTIFF returned null',
            layerConfig
          };
        }

        return {
          success: true,
          layerConfig,
          reloaded: {
            width: reloaded.width,
            height: reloaded.height,
            bands: reloaded.bands,
            mode: reloaded._mode
          }
        };
      } catch (e) {
        return { success: false, error: e.message, stack: e.stack };
      }
    });

    if (!result.success) {
      console.log('Workspace-style load failed:', result.error);
      if (result.layerConfig) console.log('Config:', JSON.stringify(result.layerConfig));
      if (result.stack) console.log('Stack:', result.stack);
    }

    const criticalErrors = errors.filter(e =>
      e.includes('Invalid array') || e.includes('RangeError')
    );
    if (criticalErrors.length > 0) {
      console.log('Critical errors:', criticalErrors);
    }

    expect(result.success).toBe(true);
    expect(criticalErrors.length).toBe(0);
  });

  test('reloaded raster can render without errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const result = await page.evaluate(async () => {
      try {
        // Create, export, and reload
        const original = window.sampleRaster({ name: 'render_test' });
        const blob = await window.gdal.toCOG(original);
        original.remove();

        const { loadGeoTIFF } = await import('/src/formats/geotiff.js');
        const buffer = await blob.arrayBuffer();
        const reloaded = await loadGeoTIFF(buffer, 'render_reloaded');

        if (!reloaded) {
          return { success: false, error: 'loadGeoTIFF returned null' };
        }

        // Try to zoom to the layer (triggers tile rendering)
        reloaded.zoom();

        // Wait a moment for tiles to start loading
        await new Promise(r => setTimeout(r, 500));

        // Check if layer is visible and has an OpenLayers layer
        return {
          success: true,
          hasOlLayer: reloaded._olLayer !== undefined,
          isVisible: reloaded.visible
        };
      } catch (e) {
        return { success: false, error: e.message, stack: e.stack };
      }
    });

    if (!result.success) {
      console.log('Render test failed:', result.error);
      if (result.stack) console.log('Stack:', result.stack);
    }

    // Check no "Invalid array length" or similar errors
    const criticalErrors = errors.filter(e =>
      e.includes('Invalid array') ||
      e.includes('RangeError') ||
      e.includes('TypeError')
    );

    expect(result.success).toBe(true);
    expect(result.hasOlLayer).toBe(true);
    expect(criticalErrors.length).toBe(0);
  });

  test('reloaded RGB raster has correct band stats for rendering', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Create sample raster
        const original = window.sampleRaster({ name: 'stats_test' });

        const originalStats = {
          mode: original._mode,
          bandMapping: original._bandMapping,
          bandStats: original._bandStats,
          globalMin: original.minValue,
          globalMax: original.maxValue,
          nodata: original._metadata?.nodata
        };

        // Export to COG
        const blob = await window.gdal.toCOG(original);
        original.remove();

        // Reload
        const { loadGeoTIFF } = await import('/src/formats/geotiff.js');
        const buffer = await blob.arrayBuffer();
        const reloaded = await loadGeoTIFF(buffer, 'stats_reloaded');

        if (!reloaded) {
          return { success: false, error: 'loadGeoTIFF returned null' };
        }

        const reloadedStats = {
          mode: reloaded._mode,
          bandMapping: reloaded._bandMapping,
          bandStats: reloaded._bandStats,
          globalMin: reloaded.minValue,
          globalMax: reloaded.maxValue,
          nodata: reloaded._metadata?.nodata
        };

        // Try setting RGB bands explicitly
        reloaded.r.bands(3, 2, 1);

        // Sample some actual pixel values
        const samplePixel = {
          band1: reloaded.r.getValue(117.5, -22.5, 1),
          band2: reloaded.r.getValue(117.5, -22.5, 2),
          band3: reloaded.r.getValue(117.5, -22.5, 3),
          band4: reloaded.r.getValue(117.5, -22.5, 4)
        };

        return {
          success: true,
          original: originalStats,
          reloaded: reloadedStats,
          samplePixel,
          modeAfterBands: reloaded._mode,
          mappingAfterBands: reloaded._bandMapping
        };
      } catch (e) {
        return { success: false, error: e.message, stack: e.stack };
      }
    });

    console.log('Original stats:', JSON.stringify(result.original, null, 2));
    console.log('Reloaded stats:', JSON.stringify(result.reloaded, null, 2));
    console.log('Sample pixel:', JSON.stringify(result.samplePixel));
    console.log('Mode after bands():', result.modeAfterBands);
    console.log('Mapping after bands():', result.mappingAfterBands);

    expect(result.success).toBe(true);
    expect(result.reloaded.mode).toBe('rgb');
    expect(result.reloaded.bandStats).toBeDefined();
    // Band stats should have reasonable values (not 0-255 default)
    expect(result.reloaded.bandStats.band1.max).toBeGreaterThan(100);
  });
});

test.describe('Raster Style Panel UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'sat' }));
    await page.waitForFunction(() => window.ly.sat !== undefined, { timeout: 5000 });
  });

  test('style panel opens for raster layer', async ({ page }) => {
    // Import windows.js and call openLayerProperties directly
    await page.evaluate(async () => {
      const { openLayerProperties } = await import('/src/ui/windows.js');
      openLayerProperties(window.ly.sat, 'style');
    });

    // Wait for the WinBox window to appear
    await page.waitForSelector('.winbox', { timeout: 5000 });

    // Check that raster-specific elements exist (widget-based)
    const hasRasterPanel = await page.locator('.raster-style-panel').count() > 0;
    const hasRgbChannels = await page.locator('.sp-rgb-channel').count() > 0;
    const hasConditional = await page.locator('.sp-conditional').count() > 0;

    expect(hasRasterPanel).toBe(true);
    expect(hasRgbChannels).toBe(true);
    expect(hasConditional).toBe(true);
  });

  test('band selectors show correct band count', async ({ page }) => {
    await page.evaluate(async () => {
      const { openLayerProperties } = await import('/src/ui/windows.js');
      openLayerProperties(window.ly.sat, 'style');
    });

    await page.waitForSelector('.winbox', { timeout: 5000 });

    // Check that band selectors have 4 options (for 4-band sample raster)
    const bandOptions = await page.evaluate(() => {
      const rChannel = document.querySelector('.sp-rgb-channel');
      const select = rChannel?.querySelector('select');
      return select ? select.options.length : 0;
    });

    expect(bandOptions).toBe(4);
  });

  test('color ramp selector has options', async ({ page }) => {
    await page.evaluate(async () => {
      const { openLayerProperties } = await import('/src/ui/windows.js');
      openLayerProperties(window.ly.sat, 'style');
    });

    await page.waitForSelector('.winbox', { timeout: 5000 });

    // Switch to singleband mode first (now via formRow select)
    await page.evaluate(() => {
      const panel = document.querySelector('.raster-style-panel');
      const modeSelect = panel?.querySelector('.sp-form-row select');
      if (modeSelect) {
        modeSelect.value = 'singleband';
        modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);

    // Check color ramp selector
    const rampOptions = await page.evaluate(() => {
      const select = document.querySelector('.sp-colorramp-select');
      return select ? Array.from(select.options).map(o => o.value) : [];
    });

    expect(rampOptions).toContain('terrain');
    expect(rampOptions).toContain('viridis');
    expect(rampOptions).toContain('ndvi');
  });

  test('apply button updates raster display', async ({ page }) => {
    await page.evaluate(async () => {
      const { openLayerProperties } = await import('/src/ui/windows.js');
      openLayerProperties(window.ly.sat, 'style');
    });

    await page.waitForSelector('.winbox', { timeout: 5000 });

    // Get initial band mapping
    const initialBands = await page.evaluate(() => window.ly.sat.r.bands());

    // Change band mapping via UI (using widget selectors)
    await page.evaluate(() => {
      const channels = document.querySelectorAll('.sp-rgb-channel');
      const rSelect = channels[0]?.querySelector('select');
      const gSelect = channels[1]?.querySelector('select');
      const bSelect = channels[2]?.querySelector('select');
      if (rSelect) { rSelect.value = '4'; rSelect.dispatchEvent(new Event('change')); }
      if (gSelect) { gSelect.value = '3'; gSelect.dispatchEvent(new Event('change')); }
      if (bSelect) { bSelect.value = '2'; bSelect.dispatchEvent(new Event('change')); }
    });

    // Click apply
    await page.evaluate(() => {
      const panel = document.querySelector('.raster-style-panel');
      const applyBtn = Array.from(panel?.querySelectorAll('.sp-actions button') || [])
        .find(b => b.textContent === 'Apply');
      applyBtn?.click();
    });

    // Wait a bit for the change to apply
    await page.waitForTimeout(100);

    // Check that band mapping changed
    const newBands = await page.evaluate(() => window.ly.sat.r.bands());

    expect(newBands).toEqual([4, 3, 2]);
  });
});
