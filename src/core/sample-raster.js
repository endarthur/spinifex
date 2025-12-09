// Spinifex - Sample Raster Data
// Synthetic multi-band raster for testing and demos
// Simulates 4-band satellite imagery (Blue, Green, Red, NIR)

import { createWebGLRasterLayer, RENDER_MODES } from '../raster/webgl-raster.js';
import { termPrint } from '../ui/terminal.js';

/**
 * Generate synthetic satellite-like imagery
 * Creates a 512x512 pixel, 4-band raster with:
 * - Vegetation areas (high NIR, low Red)
 * - Water bodies (low NIR, moderate Blue/Green)
 * - Bare ground (similar reflectance across bands)
 * - Urban areas (high reflectance, low NIR)
 *
 * @param {Object} options
 * @returns {Object} Raster layer
 */
export function generateSampleRaster(options = {}) {
  const width = options.width || 512;
  const height = options.height || 512;
  const name = options.name || 'sample_satellite';

  // Extent: 5x5 degree area in Western Australia (easy to see at world zoom)
  const extent = options.extent || [115, -25, 120, -20];

  termPrint(`Generating synthetic satellite imagery at ${extent}...`, 'dim');

  // Create 4 bands: Blue, Green, Red, NIR
  const pixelCount = width * height;
  const blue = new Float32Array(pixelCount);
  const green = new Float32Array(pixelCount);
  const red = new Float32Array(pixelCount);
  const nir = new Float32Array(pixelCount);

  // Create terrain features
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Normalize coordinates
      const nx = x / width;
      const ny = y / height;

      // Generate base terrain using simple noise-like patterns
      const noise1 = Math.sin(nx * 12) * Math.cos(ny * 8) * 0.5 + 0.5;
      const noise2 = Math.sin(nx * 25 + 1) * Math.cos(ny * 20 + 2) * 0.3 + 0.5;
      const noise3 = Math.sin((nx + ny) * 15) * 0.2 + 0.5;

      // Classify terrain type based on position and noise
      let terrainType;

      // Water body (river/lake) - diagonal stripe
      if (Math.abs(nx - ny - 0.3) < 0.05 + noise2 * 0.03) {
        terrainType = 'water';
      }
      // Dense vegetation - patches based on noise
      else if (noise1 > 0.6 && noise3 > 0.4) {
        terrainType = 'vegetation_dense';
      }
      // Sparse vegetation
      else if (noise1 > 0.4) {
        terrainType = 'vegetation_sparse';
      }
      // Urban area - small cluster
      else if (nx > 0.6 && nx < 0.8 && ny > 0.2 && ny < 0.4) {
        terrainType = 'urban';
      }
      // Bare ground
      else {
        terrainType = 'bare';
      }

      // Set reflectance values based on terrain type
      // Values scaled 0-10000 (typical satellite DN range)
      let b, g, r, n;

      switch (terrainType) {
        case 'water':
          // Water: high blue, low everything else, very low NIR
          b = 800 + noise2 * 200;
          g = 600 + noise2 * 150;
          r = 400 + noise2 * 100;
          n = 200 + noise2 * 100;  // Water absorbs NIR
          break;

        case 'vegetation_dense':
          // Dense vegetation: low red (absorbed), high NIR (reflected)
          b = 400 + noise2 * 100;
          g = 800 + noise2 * 200;
          r = 300 + noise2 * 100;  // Chlorophyll absorbs red
          n = 4000 + noise1 * 1000; // Leaves reflect NIR strongly
          break;

        case 'vegetation_sparse':
          // Sparse vegetation: mix of vegetation and soil
          b = 600 + noise2 * 150;
          g = 900 + noise2 * 200;
          r = 700 + noise2 * 150;
          n = 2500 + noise1 * 800;
          break;

        case 'urban':
          // Urban: high reflectance, relatively flat spectrum, low NIR
          b = 1500 + noise2 * 300;
          g = 1600 + noise2 * 300;
          r = 1700 + noise2 * 300;
          n = 1400 + noise2 * 200;
          break;

        case 'bare':
        default:
          // Bare ground: brownish, moderate reflectance
          b = 1000 + noise2 * 200;
          g = 1200 + noise2 * 250;
          r = 1500 + noise2 * 300;
          n = 1800 + noise2 * 400;
          break;
      }

      // Add some random noise for realism
      const jitter = (Math.random() - 0.5) * 100;

      blue[idx] = Math.max(0, b + jitter);
      green[idx] = Math.max(0, g + jitter);
      red[idx] = Math.max(0, r + jitter);
      nir[idx] = Math.max(0, n + jitter);
    }
  }

  // Calculate band statistics
  const calcStats = (band) => {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < band.length; i++) {
      if (band[i] < min) min = band[i];
      if (band[i] > max) max = band[i];
    }
    return { min, max };
  };

  const bandStats = {
    band1: calcStats(blue),
    band2: calcStats(green),
    band3: calcStats(red),
    band4: calcStats(nir)
  };

  // Create the raster layer
  const bands = [blue, green, red, nir];

  const metadata = {
    width,
    height,
    extent,
    bandCount: 4,
    bandStats,
    min: 0,
    max: 5000,
    nodata: -9999,
    description: 'Synthetic 4-band satellite imagery (Blue, Green, Red, NIR)'
  };

  const layer = createWebGLRasterLayer(bands, metadata, name, {
    mode: RENDER_MODES.RGB,
    nodata: -9999
  });

  // Set default to natural color (RGB = bands 3, 2, 1)
  layer.r.bands(3, 2, 1);

  termPrint(`Generated: ${name} (${width}x${height}, 4 bands)`, 'green');
  termPrint('  Bands: 1=Blue, 2=Green, 3=Red, 4=NIR', 'dim');
  termPrint('  Try: layer.r.bands(4,3,2) for false-color NIR', 'dim');
  termPrint('  Try: ndvi(layer) for vegetation index', 'dim');

  // Store params for versioning recreation
  layer._sampleParams = { width, height, name, extent };

  layer.zoom();

  return layer;
}

// Shortcut function
export const sampleRaster = generateSampleRaster;
