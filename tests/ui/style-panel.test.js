// Spinifex - Style Panel Tests
// Tests for schema-driven layer styling UI

import { test, expect } from '@playwright/test';

test.describe('Vector Style Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample data for testing
    await page.evaluate(() => load(sample));
    await page.waitForTimeout(500);
  });

  test.describe('Panel Opening', () => {
    test('openStylePanel() opens style panel for vector layer', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        const layer = ly.geology;
        const panel = openStylePanel(layer);
        await new Promise(r => setTimeout(r, 300));
        // Check for panel content container
        const panelContent = document.querySelector('.sp-style-panel');
        return {
          panelExists: panel !== null,
          hasContent: panelContent !== null,
        };
      });

      expect(result.panelExists).toBe(true);
      expect(result.hasContent).toBe(true);
    });

    test('panel shows layer name in title', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        const panel = openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 300));
        // WinBox title is set via the title property
        return panel?.title?.toLowerCase().includes('geology') ?? false;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Style Type Selection', () => {
    test('panel has style type selector', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));
        const typeSelect = document.querySelector('.sp-style-panel select[data-param="styleType"]');
        return {
          exists: typeSelect !== null,
          options: Array.from(typeSelect?.options || []).map(o => o.value),
        };
      });

      expect(result.exists).toBe(true);
      expect(result.options).toContain('single');
      expect(result.options).toContain('categorical');
      expect(result.options).toContain('graduated');
    });

    test('changing style type updates visible fields', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const typeSelect = document.querySelector('.sp-style-panel select[data-param="styleType"]');

        // Check single mode
        typeSelect.value = 'single';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));
        const hasFillInSingle = document.querySelector('.sp-style-panel [data-param="fill"]') !== null;

        // Check categorical mode
        typeSelect.value = 'categorical';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));
        const hasFieldInCategorical = document.querySelector('.sp-style-panel [data-param="field"]') !== null;

        return { hasFillInSingle, hasFieldInCategorical };
      });

      expect(result.hasFillInSingle).toBe(true);
      expect(result.hasFieldInCategorical).toBe(true);
    });
  });

  test.describe('Single Style', () => {
    test('single style shows fill color picker', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 300));

        // Color input is in a color row, might not have data-param on input itself
        const fillRow = document.querySelector('.sp-style-panel .sp-color-row');
        const colorInput = fillRow?.querySelector('input[type="color"]');
        return colorInput !== null;
      });

      expect(result).toBe(true);
    });

    test('single style shows stroke settings', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const strokeInput = document.querySelector('.sp-style-panel [data-param="stroke"]');
        const widthInput = document.querySelector('.sp-style-panel [data-param="width"]');
        return {
          hasStroke: strokeInput !== null,
          hasWidth: widthInput !== null,
        };
      });

      expect(result.hasStroke).toBe(true);
      expect(result.hasWidth).toBe(true);
    });

    test('single style shows opacity slider', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const opacityInput = document.querySelector('.sp-style-panel [data-param="opacity"]');
        return opacityInput !== null;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Categorical Style', () => {
    test('categorical style shows field selector', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const typeSelect = document.querySelector('.sp-style-panel select[data-param="styleType"]');
        typeSelect.value = 'categorical';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));

        const fieldSelect = document.querySelector('.sp-style-panel select[data-param="field"]');
        return {
          exists: fieldSelect !== null,
          hasOptions: fieldSelect?.options?.length > 1,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.hasOptions).toBe(true);
    });

    test('categorical style shows palette selector', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const typeSelect = document.querySelector('.sp-style-panel select[data-param="styleType"]');
        typeSelect.value = 'categorical';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));

        const paletteSelect = document.querySelector('.sp-style-panel select[data-param="palette"]');
        return paletteSelect !== null;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Graduated Style', () => {
    test('graduated style shows field and color ramp', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.drillholes);  // Use layer with numeric fields
        await new Promise(r => setTimeout(r, 200));

        const typeSelect = document.querySelector('.sp-style-panel select[data-param="styleType"]');
        typeSelect.value = 'graduated';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));

        const fieldSelect = document.querySelector('.sp-style-panel select[data-param="field"]');
        const scaleSelect = document.querySelector('.sp-style-panel select[data-param="scale"]');
        return {
          hasField: fieldSelect !== null,
          hasScale: scaleSelect !== null,
        };
      });

      expect(result.hasField).toBe(true);
      expect(result.hasScale).toBe(true);
    });
  });

  test.describe('Labels Section', () => {
    test('panel has labels section', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const labelFieldSelect = document.querySelector('.sp-style-panel select[data-param="labelField"]');
        return labelFieldSelect !== null;
      });

      expect(result).toBe(true);
    });

    test('labels section has color and size options', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const labelColor = document.querySelector('.sp-style-panel [data-param="labelColor"]');
        const labelSize = document.querySelector('.sp-style-panel [data-param="labelSize"]');
        return {
          hasColor: labelColor !== null,
          hasSize: labelSize !== null,
        };
      });

      expect(result.hasColor).toBe(true);
      expect(result.hasSize).toBe(true);
    });
  });

  test.describe('Apply Style', () => {
    test('apply button exists', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 200));

        const applyBtn = document.querySelector('.sp-style-panel .sp-apply-btn');
        return applyBtn !== null;
      });

      expect(result).toBe(true);
    });

    test('clicking apply updates layer style', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.geology);
        await new Promise(r => setTimeout(r, 300));

        // Click apply
        const applyBtn = document.querySelector('.sp-style-panel .sp-apply-btn');
        if (!applyBtn) return { hasButton: false };

        applyBtn.click();
        await new Promise(r => setTimeout(r, 300));

        // Check that layer has style options stored
        return {
          hasButton: true,
          hasStyleOpts: ly.geology._styleOpts !== undefined,
          styleType: ly.geology._styleOpts?.type,
        };
      });

      expect(result.hasButton).toBe(true);
      expect(result.hasStyleOpts).toBe(true);
    });
  });

  test.describe('Point Layers', () => {
    test('point layers show radius option', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { openStylePanel } = await import('/src/ui/style-panel.js');
        openStylePanel(ly.drillholes);  // Point layer
        await new Promise(r => setTimeout(r, 200));

        const radiusInput = document.querySelector('.sp-style-panel [data-param="radius"]');
        return radiusInput !== null;
      });

      expect(result).toBe(true);
    });
  });
});
