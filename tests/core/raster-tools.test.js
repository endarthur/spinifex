// Spinifex - Raster Tools Tests
// Tests for raster tools registration in the toolbox

import { test, expect } from '@playwright/test';

test.describe('Raster Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('DEM Analysis Tools Registration', () => {
    test('hillshade tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.hillshade');
        return {
          exists: tool !== undefined,
          name: tool?.name,
          category: tool?.category,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('Hillshade');
      expect(result.category).toBe('Raster');
    });

    test('slope tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.slope');
        return {
          exists: tool !== undefined,
          name: tool?.name,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('Slope');
    });

    test('aspect tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.aspect');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('contours tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.contours');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('tri tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.tri');
        return {
          exists: tool !== undefined,
          name: tool?.name,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('Terrain Ruggedness Index');
    });

    test('tpi tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.tpi');
        return {
          exists: tool !== undefined,
          name: tool?.name,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('Topographic Position Index');
    });

    test('roughness tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.roughness');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Tool Parameters', () => {
    test('hillshade has azimuth parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.hillshade');
        const param = tool?.parameters?.find(p => p.name === 'azimuth');
        return {
          exists: param !== undefined,
          type: param?.type,
          hasDefault: param?.default !== undefined,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('number');
      expect(result.hasDefault).toBe(true);
    });

    test('hillshade has altitude parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.hillshade');
        const param = tool?.parameters?.find(p => p.name === 'altitude');
        return {
          exists: param !== undefined,
          type: param?.type,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('number');
    });

    test('hillshade has zFactor parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.hillshade');
        const param = tool?.parameters?.find(p => p.name === 'zFactor');
        return param !== undefined;
      });

      expect(result).toBe(true);
    });

    test('contours has interval parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.contours');
        const param = tool?.parameters?.find(p => p.name === 'interval');
        return {
          exists: param !== undefined,
          type: param?.type,
          hasDefault: param?.default !== undefined,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('number');
      expect(result.hasDefault).toBe(true);
    });

    test('slope has units parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.slope');
        const param = tool?.parameters?.find(p => p.name === 'units');
        return {
          exists: param !== undefined,
          type: param?.type,
          hasOptions: Array.isArray(param?.options),
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('select');
      expect(result.hasOptions).toBe(true);
    });
  });

  test.describe('Raster Category', () => {
    test('all raster tools are in Raster category', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rasterTools = toolbox.list('Raster');
        const toolIds = rasterTools.map(t => t.id);
        return {
          count: rasterTools.length,
          hasHillshade: toolIds.includes('raster.hillshade'),
          hasSlope: toolIds.includes('raster.slope'),
          hasAspect: toolIds.includes('raster.aspect'),
          hasContours: toolIds.includes('raster.contours'),
        };
      });

      expect(result.count).toBeGreaterThanOrEqual(7);
      expect(result.hasHillshade).toBe(true);
      expect(result.hasSlope).toBe(true);
      expect(result.hasAspect).toBe(true);
      expect(result.hasContours).toBe(true);
    });
  });

  test.describe('Tool Search', () => {
    test('can search for terrain tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const results = toolbox.search('terrain');
        return results.length > 0;
      });

      expect(result).toBe(true);
    });

    test('can search for DEM tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const results = toolbox.search('dem');
        return results.length > 0;
      });

      expect(result).toBe(true);
    });

    test('can search for elevation tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        const results = toolbox.search('elevation');
        return results.length > 0;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('GDAL Processing Tools Registration', () => {
    test('reproject tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.reproject');
        return {
          exists: tool !== undefined,
          name: tool?.name,
          category: tool?.category,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('Reproject');
      expect(result.category).toBe('Raster');
    });

    test('resample tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.resample');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('clip tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.clip');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('mosaic tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.mosaic');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('rasterize tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.rasterize');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('GDAL Tool Parameters', () => {
    test('reproject has targetCRS parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.reproject');
        const param = tool?.parameters?.find(p => p.name === 'targetCRS');
        return {
          exists: param !== undefined,
          required: param?.required,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.required).toBe(true);
    });

    test('resample has method parameter with options', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.resample');
        const param = tool?.parameters?.find(p => p.name === 'method');
        return {
          exists: param !== undefined,
          type: param?.type,
          hasOptions: Array.isArray(param?.options),
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('select');
      expect(result.hasOptions).toBe(true);
    });

    test('rasterize has resolution parameter', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('raster.rasterize');
        const param = tool?.parameters?.find(p => p.name === 'resolution');
        return {
          exists: param !== undefined,
          type: param?.type,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.type).toBe('number');
    });
  });

  test.describe('Tool Panel Integration', () => {
    test('raster tools appear in tool panel', async ({ page }) => {
      await page.evaluate(() => sp.tools());
      await page.waitForTimeout(300);

      const hasRasterCategory = await page.evaluate(() => {
        const panel = document.querySelector('.sp-tool-panel');
        return panel?.innerHTML?.includes('Raster');
      });

      expect(hasRasterCategory).toBe(true);
    });

    test('can open hillshade tool form', async ({ page }) => {
      await page.evaluate(() => sp.tools());
      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const tool = document.querySelector('[data-tool-id="raster.hillshade"]');
        if (tool) tool.click();
      });
      await page.waitForTimeout(200);

      const hasForm = await page.evaluate(() => {
        const form = document.querySelector('.sp-tool-panel .sp-tool-form');
        return form !== null;
      });

      expect(hasForm).toBe(true);
    });

    test('total raster tools count is at least 12', async ({ page }) => {
      const result = await page.evaluate(() => {
        const rasterTools = toolbox.list('Raster');
        return rasterTools.length;
      });

      expect(result).toBeGreaterThanOrEqual(12);
    });
  });
});
