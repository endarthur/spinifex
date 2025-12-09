// Spinifex - Raster Style Panel Tests
// Tests for raster layer styling UI (widget-based implementation)

import { test, expect } from '@playwright/test';

test.describe('Raster Style Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Panel Access', () => {
    test('can open raster properties via layer.style()', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'style_test' });
        await new Promise(r => setTimeout(r, 100));

        // Opening style() should open the properties window
        raster.style();
        await new Promise(r => setTimeout(r, 500));

        // Check if WinBox window opened
        const winbox = document.querySelector('.winbox');
        // Check for raster style panel by looking for sp-panel class or raster content
        const rasterPanel = document.querySelector('.raster-style-panel') ||
                           document.querySelector('.sp-panel') ||
                           winbox?.querySelector('.wb-body > div');
        // Check for mode selector in panel (look in both winbox and panel)
        const modeSelect = rasterPanel?.querySelector('select') ||
                          winbox?.querySelector('select');

        return {
          hasWinbox: winbox !== null,
          hasRasterPanel: rasterPanel !== null,
          hasModeSelect: modeSelect !== null
        };
      });

      expect(result.hasWinbox).toBe(true);
      expect(result.hasRasterPanel).toBe(true);
      expect(result.hasModeSelect).toBe(true);
    });

    test('raster style panel has display mode selector', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'mode_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        // Find mode select by looking for the select in the first form row
        const panel = document.querySelector('.raster-style-panel');
        const modeSelect = panel?.querySelector('.sp-form-row select');

        // Check options
        const options = modeSelect ? Array.from(modeSelect.options).map(o => o.value) : [];

        return {
          hasSelect: modeSelect !== null,
          hasRgbOption: options.includes('rgb'),
          hasSinglebandOption: options.includes('singleband')
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasRgbOption).toBe(true);
      expect(result.hasSinglebandOption).toBe(true);
    });
  });

  test.describe('RGB Mode', () => {
    test('band selectors exist for RGB channels', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'rgb_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        // Find RGB channel widgets
        const channels = document.querySelectorAll('.sp-rgb-channel');
        const rChannel = channels[0];
        const gChannel = channels[1];
        const bChannel = channels[2];

        return {
          hasR: rChannel !== null,
          hasG: gChannel !== null,
          hasB: bChannel !== null,
          channelCount: channels.length,
          rOptions: rChannel?.querySelector('select')?.options?.length || 0
        };
      });

      expect(result.hasR).toBe(true);
      expect(result.hasG).toBe(true);
      expect(result.hasB).toBe(true);
      expect(result.channelCount).toBe(3);
      expect(result.rOptions).toBe(4); // 4-band sample raster
    });

    test('band presets buttons exist', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'preset_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 400));

        // Find preset buttons in sp-preset-buttons container
        const presetContainer = document.querySelector('.sp-conditional .sp-preset-buttons');
        const buttons = presetContainer?.querySelectorAll('button') || [];
        const buttonTexts = Array.from(buttons).map(b => b.textContent);

        return {
          hasPresets: presetContainer !== null,
          hasNatural: buttonTexts.includes('Natural'),
          hasFalseColor: buttonTexts.includes('False Color'),
          buttonCount: buttons.length
        };
      });

      expect(result.hasPresets).toBe(true);
      expect(result.hasNatural).toBe(true);
      expect(result.hasFalseColor).toBe(true);
    });

    test('per-channel stretch inputs exist', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'stretch_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 200));

        // Find first RGB channel
        const rChannel = document.querySelector('.sp-rgb-channel');
        const inputs = rChannel?.querySelectorAll('input[type="number"]') || [];
        const autoBtn = rChannel?.querySelector('button');

        return {
          hasMin: inputs.length >= 1,
          hasMax: inputs.length >= 2,
          hasAuto: autoBtn !== null && autoBtn?.textContent === 'Auto'
        };
      });

      expect(result.hasMin).toBe(true);
      expect(result.hasMax).toBe(true);
      expect(result.hasAuto).toBe(true);
    });
  });

  test.describe('Single Band Mode', () => {
    test('expression input exists', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'expr_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 200));

        // Switch to singleband mode
        const panel = document.querySelector('.raster-style-panel');
        const modeSelect = panel?.querySelector('.sp-form-row .sp-select');
        if (modeSelect) {
          modeSelect.value = 'singleband';
          modeSelect.dispatchEvent(new Event('change'));
        }
        await new Promise(r => setTimeout(r, 100));

        // Select expression radio
        const exprRadio = panel?.querySelector('.sp-radio-group input[value="expression"]');
        if (exprRadio) {
          exprRadio.checked = true;
          exprRadio.dispatchEvent(new Event('change'));
        }
        await new Promise(r => setTimeout(r, 100));

        const exprInput = panel?.querySelector('.sp-expression-input');
        return exprInput !== null;
      });

      expect(result).toBe(true);
    });

    test('expression presets exist', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'preset_expr_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        const panel = document.querySelector('.raster-style-panel');

        // Switch to singleband mode using native select methods
        const modeSelect = panel?.querySelector('.sp-form-row select');
        if (modeSelect) {
          modeSelect.value = 'singleband';
          modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 200));

        // Select expression radio
        const exprRadio = panel?.querySelector('.sp-radio-group input[value="expression"]');
        if (exprRadio) {
          exprRadio.checked = true;
          exprRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 200));

        // Find expression preset buttons - look for all preset buttons with expression-related labels
        const allPresetBtns = panel?.querySelectorAll('.sp-preset-buttons button') || [];
        const btnTexts = Array.from(allPresetBtns).map(b => b.textContent);

        return {
          hasNDVI: btnTexts.includes('NDVI'),
          hasNDWI: btnTexts.includes('NDWI'),
          hasThresh: btnTexts.includes('Thresh'),
          allBtnTexts: btnTexts,
          modeValue: modeSelect?.value,
          singlebandVisible: panel?.querySelector('.sp-conditional[data-show-when="singleband"]')?.style?.display !== 'none'
        };
      });

      expect(result.hasNDVI).toBe(true);
      expect(result.hasNDWI).toBe(true);
      expect(result.hasThresh).toBe(true);
    });

    test('expression preset fills input', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'preset_fill_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        const panel = document.querySelector('.raster-style-panel');

        // Switch to singleband mode
        const modeSelect = panel?.querySelector('.sp-form-row select');
        if (modeSelect) {
          modeSelect.value = 'singleband';
          modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 200));

        // Select expression radio
        const exprRadio = panel?.querySelector('.sp-radio-group input[value="expression"]');
        if (exprRadio) {
          exprRadio.checked = true;
          exprRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 200));

        // Click NDVI preset button
        const allPresetBtns = panel?.querySelectorAll('.sp-preset-buttons button');
        const ndviBtn = Array.from(allPresetBtns || []).find(b => b.textContent === 'NDVI');
        ndviBtn?.click();
        await new Promise(r => setTimeout(r, 300));

        const exprInput = panel?.querySelector('.sp-expression-input');
        const rampSelect = panel?.querySelector('.sp-colorramp-select');
        const stretchWrapper = panel?.querySelector('.sp-stretch-wrapper');
        const stretchInputs = stretchWrapper?.querySelectorAll('input[type="number"]') || [];

        return {
          expr: exprInput?.value || '',
          ramp: rampSelect?.value || '',
          min: stretchInputs[0]?.value || '',
          max: stretchInputs[1]?.value || '',
          debug: {
            modeValue: modeSelect?.value,
            ndviBtnFound: !!ndviBtn,
            exprInputFound: !!exprInput,
            rampSelectFound: !!rampSelect
          }
        };
      });

      expect(result.expr).toContain('b4 - b3');
      expect(result.ramp).toBe('ndvi');
      expect(result.min).toBe('-1');
      expect(result.max).toBe('1');
    });

    test('color ramp selector exists with options', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'ramp_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        const panel = document.querySelector('.raster-style-panel');

        // Switch to singleband mode to see color ramp
        const modeSelect = panel?.querySelector('.sp-form-row select');
        if (modeSelect) {
          modeSelect.value = 'singleband';
          modeSelect.dispatchEvent(new Event('change'));
        }
        await new Promise(r => setTimeout(r, 100));

        const rampSelect = panel?.querySelector('.sp-colorramp-select');
        const options = Array.from(rampSelect?.options || []).map(o => o.value);

        return {
          hasSelect: rampSelect !== null,
          options,
          hasViridis: options.includes('viridis'),
          hasTerrain: options.includes('terrain'),
          hasNdvi: options.includes('ndvi')
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasViridis).toBe(true);
      expect(result.hasTerrain).toBe(true);
      expect(result.hasNdvi).toBe(true);
    });
  });

  test.describe('Common Controls', () => {
    test('opacity slider exists and works', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'opacity_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 300));

        const panel = document.querySelector('.raster-style-panel');
        const opacitySlider = panel?.querySelector('.sp-range-wrapper input[type="range"]');
        const initialValue = opacitySlider?.value;

        // Change opacity
        if (opacitySlider) {
          opacitySlider.value = '50';
          opacitySlider.dispatchEvent(new Event('input'));
        }
        await new Promise(r => setTimeout(r, 100));

        return {
          hasSlider: opacitySlider !== null,
          initialValue,
          newOpacity: raster.opacity()
        };
      });

      expect(result.hasSlider).toBe(true);
      expect(result.newOpacity).toBe(0.5);
    });

    test('blend mode selector exists', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'blend_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 200));

        const panel = document.querySelector('.raster-style-panel');
        // Blend select is in a form-row labeled "Blend"
        const formRows = panel?.querySelectorAll('.sp-form-row');
        let blendSelect = null;
        formRows?.forEach(row => {
          const label = row.querySelector('.sp-form-row-label');
          if (label?.textContent?.includes('Blend')) {
            blendSelect = row.querySelector('select');
          }
        });

        const options = Array.from(blendSelect?.options || []).map(o => o.value);

        return {
          hasSelect: blendSelect !== null,
          hasMultiply: options.includes('multiply'),
          hasScreen: options.includes('screen'),
          hasOverlay: options.includes('overlay')
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasMultiply).toBe(true);
      expect(result.hasScreen).toBe(true);
      expect(result.hasOverlay).toBe(true);
    });

    test('apply and cancel buttons exist', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'buttons_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 200));

        const panel = document.querySelector('.raster-style-panel');
        const actionBtns = panel?.querySelectorAll('.sp-actions button') || [];
        const btnTexts = Array.from(actionBtns).map(b => b.textContent);

        return {
          hasApply: btnTexts.includes('Apply'),
          hasCancel: btnTexts.includes('Cancel')
        };
      });

      expect(result.hasApply).toBe(true);
      expect(result.hasCancel).toBe(true);
    });
  });

  test.describe('Band Stretch Integration', () => {
    test('band stretch is stored by channel (r, g, b) not band number', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const raster = window.sampleRaster({ name: 'bandstretch_test' });
        await new Promise(r => setTimeout(r, 100));
        raster.style();
        await new Promise(r => setTimeout(r, 200));

        const panel = document.querySelector('.raster-style-panel');

        // Set band R to band 4
        const rChannel = panel?.querySelector('.sp-rgb-channel');
        const rSelect = rChannel?.querySelector('select');
        if (rSelect) rSelect.value = '4';

        // Set R stretch values
        const rInputs = rChannel?.querySelectorAll('input[type="number"]');
        if (rInputs?.[0]) rInputs[0].value = '100';
        if (rInputs?.[1]) rInputs[1].value = '5000';
        // Trigger change events
        rInputs?.[0]?.dispatchEvent(new Event('change'));
        rInputs?.[1]?.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 100));

        // Click apply
        const applyBtn = Array.from(panel?.querySelectorAll('.sp-actions button') || [])
          .find(b => b.textContent === 'Apply');
        applyBtn?.click();
        await new Promise(r => setTimeout(r, 100));

        // Check stored values - keyed by channel (r), not band number (band4)
        return {
          hasBandStretch: raster._bandStretch !== undefined,
          rStretch: raster._bandStretch?.r,
          rMin: raster._bandStretch?.r?.min,
          rMax: raster._bandStretch?.r?.max,
          // Should NOT be keyed by band number anymore
          band4Stretch: raster._bandStretch?.band4
        };
      });

      expect(result.hasBandStretch).toBe(true);
      expect(result.rStretch).toBeDefined();
      expect(result.rMin).toBe(100);
      expect(result.rMax).toBe(5000);
      // Old band-keyed format should NOT exist
      expect(result.band4Stretch).toBeUndefined();
    });
  });
});
