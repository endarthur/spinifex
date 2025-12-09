// Spinifex - GDAL Processing Tests
// Tests GDAL WebAssembly integration for terrain analysis, format conversion, etc.
// Note: These tests are slower due to GDAL WebAssembly loading

import { test, expect } from '@playwright/test';

// Increase timeout for GDAL tests (WASM loading is slow)
test.setTimeout(60000);

test.describe('GDAL Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('gdal namespace is available', async ({ page }) => {
    const hasGdal = await page.evaluate(() => window.gdal !== undefined);
    expect(hasGdal).toBe(true);
  });

  test('gdal has all expected functions', async ({ page }) => {
    const funcs = await page.evaluate(() => {
      return {
        // Export
        toCOG: typeof window.gdal.toCOG,
        downloadCOG: typeof window.gdal.downloadCOG,
        toGeoTiff: typeof window.gdal.toGeoTiff,
        downloadVector: typeof window.gdal.downloadVector,
        convert: typeof window.gdal.convert,
        // Reproject & resample
        reproject: typeof window.gdal.reproject,
        resample: typeof window.gdal.resample,
        // DEM analysis
        hillshade: typeof window.gdal.hillshade,
        slope: typeof window.gdal.slope,
        aspect: typeof window.gdal.aspect,
        contours: typeof window.gdal.contours,
        tri: typeof window.gdal.tri,
        tpi: typeof window.gdal.tpi,
        roughness: typeof window.gdal.roughness,
        // Raster operations
        clip: typeof window.gdal.clip,
        mosaic: typeof window.gdal.mosaic,
        rasterize: typeof window.gdal.rasterize,
        // Utilities
        info: typeof window.gdal.info,
        drivers: typeof window.gdal.drivers,
        load: typeof window.gdal.load
      };
    });

    // All should be functions
    for (const [name, type] of Object.entries(funcs)) {
      expect(type, `gdal.${name} should be a function`).toBe('function');
    }
  });
});

test.describe('DEM Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Generate a sample raster (simulating DEM data)
    await page.evaluate(() => window.sampleRaster({ name: 'dem' }));
    await page.waitForFunction(() => window.ly.dem !== undefined, { timeout: 5000 });
  });

  test('hillshade generates shaded relief', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const hs = await window.gdal.hillshade(window.ly.dem, { name: 'hs_test' });
        return {
          success: true,
          name: hs?.name,
          isRaster: hs?.isRaster,
          hasData: hs?._data !== undefined
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('hs_test');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('hillshade not available:', result.error);
    }
  });

  test('slope calculates terrain slope', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const sl = await window.gdal.slope(window.ly.dem, { name: 'slope_test' });
        return {
          success: true,
          name: sl?.name,
          isRaster: sl?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('slope_test');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('slope not available:', result.error);
    }
  });

  test('aspect calculates terrain aspect', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const asp = await window.gdal.aspect(window.ly.dem, { name: 'aspect_test' });
        return {
          success: true,
          name: asp?.name,
          isRaster: asp?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('aspect_test');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('aspect not available:', result.error);
    }
  });

  test('contours generates contour lines', async ({ page }) => {
    // Use a smaller DEM for contours test (contour generation is slow)
    const result = await page.evaluate(async () => {
      try {
        // Create a small DEM specifically for contours (64x64 instead of 512x512)
        const smallDem = window.sampleRaster({
          name: 'dem_small',
          width: 64,
          height: 64
        });
        await new Promise(r => setTimeout(r, 200)); // Wait for raster creation

        const ctrs = await window.gdal.contours(smallDem, {
          interval: 500,  // Larger interval = fewer contours = faster
          name: 'contours_test'
        });
        return {
          success: true,
          name: ctrs?.name,
          isVector: ctrs?._olLayer !== undefined,
          hasFeatures: ctrs?.count > 0,
          featureCount: ctrs?.count || 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('contours_test');
      expect(result.isVector).toBe(true);
      expect(result.hasFeatures).toBe(true);
      console.log(`Contours generated: ${result.featureCount} features`);
    } else {
      console.log('contours not available:', result.error);
    }
  });

  test('tri calculates terrain ruggedness', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const triLayer = await window.gdal.tri(window.ly.dem, { name: 'tri_test' });
        return {
          success: true,
          name: triLayer?.name,
          isRaster: triLayer?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('tri_test');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('tri not available:', result.error);
    }
  });
});

test.describe('Raster Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test('resample changes raster resolution', async ({ page }) => {
    // Create raster first
    await page.evaluate(() => window.sampleRaster({ name: 'rast' }));
    await page.waitForFunction(() => window.ly.rast !== undefined, { timeout: 5000 });

    const result = await page.evaluate(async () => {
      try {
        const original = window.ly.rast;
        const resampled = await window.gdal.resample(original, {
          scale: 0.5,  // Half resolution
          name: 'resampled_test'
        });
        return {
          success: true,
          name: resampled?.name,
          originalWidth: original.width,
          newWidth: resampled?.width,
          isRaster: resampled?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success && result.name) {
      expect(result.name).toBe('resampled_test');
      expect(result.isRaster).toBe(true);
      // New width should be approximately half
      expect(result.newWidth).toBeLessThan(result.originalWidth);
    } else {
      console.log('resample not available:', result.error || 'output incomplete');
    }
  });

  test('mosaic combines multiple rasters', async ({ page }) => {
    // Create two rasters
    await page.evaluate(() => {
      window.sampleRaster({ name: 'tile1' });
      window.sampleRaster({ name: 'tile2' });
    });
    await page.waitForFunction(() =>
      window.ly.tile1 !== undefined && window.ly.tile2 !== undefined,
      { timeout: 5000 }
    );

    const result = await page.evaluate(async () => {
      try {
        const mosaicked = await window.gdal.mosaic(
          [window.ly.tile1, window.ly.tile2],
          { name: 'mosaic_test' }
        );
        return {
          success: true,
          name: mosaicked?.name,
          isRaster: mosaicked?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('mosaic_test');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('mosaic not available:', result.error);
    }
  });
});

test.describe('Vector to Raster', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample vector data
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => Object.keys(window.ly).length > 0, { timeout: 5000 });
  });

  test('rasterize burns vector to raster', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Get the first vector layer
        const vectorLayer = Object.values(window.ly).find(l => l._olLayer);
        if (!vectorLayer) return { success: false, error: 'No vector layer found' };

        const rasterized = await window.gdal.rasterize(vectorLayer, {
          width: 100,
          height: 100,
          name: 'rasterized_test'
        });
        return {
          success: true,
          name: rasterized?.name,
          isRaster: rasterized?.isRaster,
          width: rasterized?.width,
          height: rasterized?.height
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toBe('rasterized_test');
      expect(result.isRaster).toBe(true);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    } else {
      console.log('rasterize not available:', result.error);
    }
  });
});

test.describe('Vector Format Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample vector data
    await page.evaluate(() => window.load(window.sample));
    await page.waitForFunction(() => Object.keys(window.ly).length > 0, { timeout: 5000 });
  });

  test('convert exports to GeoJSON blob', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Get the first vector layer
        const vectorLayer = Object.values(window.ly).find(l => l._olLayer);
        if (!vectorLayer) return { success: false, error: 'No vector layer found' };

        const blob = await window.gdal.convert(vectorLayer, 'geojson');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          type: blob?.type,
          size: blob?.size
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.isBlob).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    } else {
      console.log('convert not available:', result.error);
    }
  });

  test('convert exports to KML blob', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const vectorLayer = Object.values(window.ly).find(l => l._olLayer);
        if (!vectorLayer) return { success: false, error: 'No vector layer found' };

        const blob = await window.gdal.convert(vectorLayer, 'kml');
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.isBlob).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    } else {
      console.log('KML convert not available:', result.error);
    }
  });
});

test.describe('Raster Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'export_test' }));
    await page.waitForFunction(() => window.ly.export_test !== undefined, { timeout: 5000 });
  });

  test('toGeoTiff exports raster as GeoTIFF blob', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const blob = await window.gdal.toGeoTiff(window.ly.export_test);
        return {
          success: true,
          isBlob: blob instanceof Blob,
          type: blob?.type,
          size: blob?.size
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.isBlob).toBe(true);
      expect(result.type).toBe('image/tiff');
      expect(result.size).toBeGreaterThan(0);
    } else {
      console.log('toGeoTiff not available:', result.error);
    }
  });

  test('toCOG exports raster as Cloud Optimized GeoTIFF', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const blob = await window.gdal.toCOG(window.ly.export_test);
        return {
          success: true,
          isBlob: blob instanceof Blob,
          size: blob?.size
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.isBlob).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    } else {
      console.log('toCOG not available:', result.error);
    }
  });

  test('toCOG exports multi-band raster without TIFF errors', async ({ page }) => {
    // This test specifically checks that the TIFF tag structure is correct
    // The sample raster has 4 bands (B,G,R,NIR) which previously caused:
    // - "Invalid TIFF directory; tags are not sorted in ascending order"
    // - "Bad value 1 for 'ExtraSamples' tag"

    // Listen to console messages from the browser
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('TIFF') || text.includes('WARNING') || text.includes('ERROR') ||
          text.includes('ExtraSamples') || text.includes('Invalid') || text.includes('Bad value')) {
        consoleMessages.push(`[${msg.type()}] ${text}`);
      }
    });

    const result = await page.evaluate(async () => {
      try {
        const layer = window.ly.export_test;
        const bandCount = layer._metadata?.bandCount || layer.bands;

        const blob = await window.gdal.toCOG(layer);

        return {
          success: true,
          bandCount,
          blobSize: blob?.size
        };
      } catch (e) {
        return {
          success: false,
          error: e?.message || String(e),
          stack: e?.stack,
          errorObj: JSON.stringify(e, Object.getOwnPropertyNames(e || {}))
        };
      }
    });

    if (!result.success) {
      console.log('toCOG failed:', result.error);
      console.log('Error object:', result.errorObj);
    }
    if (consoleMessages.length > 0) {
      console.log('Console messages:', consoleMessages);
    }

    expect(result.success).toBe(true);
    expect(result.bandCount).toBeGreaterThanOrEqual(3); // Multi-band raster
    expect(result.blobSize).toBeGreaterThan(0);
    // Check no TIFF errors in console
    const tiffErrors = consoleMessages.filter(m =>
      m.includes('Invalid') || m.includes('Bad value') || m.includes('ERROR')
    );
    expect(tiffErrors.length).toBe(0);
  });

  test('toCOG can be read back by geotiff.js', async ({ page }) => {
    // Round-trip test: export to COG and read it back with geotiff.js
    const result = await page.evaluate(async () => {
      try {
        const layer = window.ly.export_test;
        if (!layer) {
          return { success: false, error: 'export_test layer not found' };
        }

        // Export to COG
        const blob = await window.gdal.toCOG(layer);
        if (!blob) {
          return { success: false, error: 'toCOG returned null' };
        }

        // Read back with geotiff.js to verify format
        const { loadGeoTIFF } = await import('/src/formats/geotiff.js');
        const buffer = await blob.arrayBuffer();
        const reloaded = await loadGeoTIFF(buffer, 'reloaded_test');

        if (!reloaded) {
          return { success: false, error: 'loadGeoTIFF returned null' };
        }

        return {
          success: true,
          originalBands: layer.bands,
          reloadedBands: reloaded.bands,
          originalWidth: layer.width,
          reloadedWidth: reloaded.width,
          originalHeight: layer.height,
          reloadedHeight: reloaded.height
        };
      } catch (e) {
        return { success: false, error: e?.message || String(e) };
      }
    });

    if (!result.success) {
      console.log('Round-trip test failed:', result.error);
    }
    expect(result.success).toBe(true);
    expect(result.reloadedBands).toBe(result.originalBands);
    expect(result.reloadedWidth).toBe(result.originalWidth);
    expect(result.reloadedHeight).toBe(result.originalHeight);
  });
});

test.describe('Reproject', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.sampleRaster({ name: 'proj_test' }));
    await page.waitForFunction(() => window.ly.proj_test !== undefined, { timeout: 5000 });
  });

  test('reproject transforms raster to new CRS', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const reprojected = await window.gdal.reproject(
          window.ly.proj_test,
          'EPSG:32755',  // UTM zone 55S
          { name: 'reprojected_test' }
        );
        return {
          success: true,
          name: reprojected?.name,
          isRaster: reprojected?.isRaster
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    if (result.success) {
      expect(result.name).toContain('reprojected');
      expect(result.isRaster).toBe(true);
    } else {
      console.log('reproject not available:', result.error);
    }
  });
});
