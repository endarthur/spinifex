// Spinifex - Widget Registry Tests
// TDD tests for src/core/widgets.js

import { test, expect } from '@playwright/test';

test.describe('Widget Registry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Basic API', () => {
    test('widgets object exists on window', async ({ page }) => {
      const result = await page.evaluate(() => window.widgets !== undefined);
      expect(result).toBe(true);
    });

    test('widgets has required methods', async ({ page }) => {
      const result = await page.evaluate(() => ({
        hasRegister: typeof window.widgets?.register === 'function',
        hasGet: typeof window.widgets?.get === 'function',
        hasList: typeof window.widgets?.list === 'function',
        hasRender: typeof window.widgets?.render === 'function',
      }));

      expect(result.hasRegister).toBe(true);
      expect(result.hasGet).toBe(true);
      expect(result.hasList).toBe(true);
      expect(result.hasRender).toBe(true);
    });
  });

  test.describe('Widget Registration', () => {
    test('register() adds a widget to the registry', async ({ page }) => {
      const result = await page.evaluate(() => {
        widgets.register({
          type: 'test.custom',
          render: (param, value, onChange) => document.createElement('div'),
        });
        return widgets.get('test.custom') !== undefined;
      });

      expect(result).toBe(true);
    });

    test('register() requires a type', async ({ page }) => {
      const result = await page.evaluate(() => {
        try {
          widgets.register({ render: () => {} });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('register() requires a render function', async ({ page }) => {
      const result = await page.evaluate(() => {
        try {
          widgets.register({ type: 'test.norender' });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('cannot register duplicate widget types', async ({ page }) => {
      const result = await page.evaluate(() => {
        widgets.register({
          type: 'test.dup',
          render: () => document.createElement('div'),
        });
        try {
          widgets.register({
            type: 'test.dup',
            render: () => document.createElement('span'),
          });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });
  });

  test.describe('Widget Retrieval', () => {
    test('get() returns widget by type', async ({ page }) => {
      const result = await page.evaluate(() => {
        widgets.register({
          type: 'test.getwidget',
          label: 'Test Widget',
          render: () => document.createElement('div'),
        });
        const widget = widgets.get('test.getwidget');
        return {
          type: widget?.type,
          label: widget?.label,
        };
      });

      expect(result.type).toBe('test.getwidget');
      expect(result.label).toBe('Test Widget');
    });

    test('get() returns undefined for unknown type', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('nonexistent.widget'));
      expect(result).toBeUndefined();
    });

    test('list() returns all registered widgets', async ({ page }) => {
      const result = await page.evaluate(() => {
        widgets.register({ type: 'test.list1', render: () => document.createElement('div') });
        widgets.register({ type: 'test.list2', render: () => document.createElement('div') });
        const all = widgets.list();
        return {
          isArray: Array.isArray(all),
          hasList1: all.some(w => w.type === 'test.list1'),
          hasList2: all.some(w => w.type === 'test.list2'),
        };
      });

      expect(result.isArray).toBe(true);
      expect(result.hasList1).toBe(true);
      expect(result.hasList2).toBe(true);
    });
  });

  test.describe('Built-in Widgets', () => {
    test('string widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('string') !== undefined);
      expect(result).toBe(true);
    });

    test('number widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('number') !== undefined);
      expect(result).toBe(true);
    });

    test('integer widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('integer') !== undefined);
      expect(result).toBe(true);
    });

    test('select widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('select') !== undefined);
      expect(result).toBe(true);
    });

    test('boolean widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('boolean') !== undefined);
      expect(result).toBe(true);
    });

    test('layer widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('layer') !== undefined);
      expect(result).toBe(true);
    });

    test('field widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('field') !== undefined);
      expect(result).toBe(true);
    });
  });

  test.describe('Widget Rendering', () => {
    test('render() creates DOM element for widget', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'testParam',
          type: 'string',
          label: 'Test Parameter',
        }, '', () => {});
        return {
          isElement: el instanceof HTMLElement,
          tagName: el?.tagName,
        };
      });

      expect(result.isElement).toBe(true);
      expect(result.tagName).toBeDefined();
    });

    test('render() falls back to string widget for unknown type', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'unknownType',
          type: 'nonexistent_type',
        }, '', () => {});
        return el instanceof HTMLElement;
      });

      expect(result).toBe(true);
    });

    test('string widget renders input element', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'stringParam',
          type: 'string',
        }, 'test value', () => {});
        const input = el.querySelector('input');
        return {
          hasInput: input !== null,
          inputType: input?.type,
          inputValue: input?.value,
        };
      });

      expect(result.hasInput).toBe(true);
      expect(result.inputType).toBe('text');
      expect(result.inputValue).toBe('test value');
    });

    test('number widget renders number input', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'numParam',
          type: 'number',
          min: 0,
          max: 100,
        }, 50, () => {});
        const input = el.querySelector('input');
        return {
          hasInput: input !== null,
          inputType: input?.type,
          inputMin: input?.min,
          inputMax: input?.max,
        };
      });

      expect(result.hasInput).toBe(true);
      expect(result.inputType).toBe('number');
      expect(result.inputMin).toBe('0');
      expect(result.inputMax).toBe('100');
    });

    test('select widget renders select element with options', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'selectParam',
          type: 'select',
          options: [
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
          ],
        }, 'a', () => {});
        const select = el.querySelector('select');
        return {
          hasSelect: select !== null,
          optionCount: select?.options?.length,
          selectedValue: select?.value,
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.optionCount).toBe(2);
      expect(result.selectedValue).toBe('a');
    });

    test('boolean widget renders checkbox', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'boolParam',
          type: 'boolean',
        }, true, () => {});
        const input = el.querySelector('input[type="checkbox"]');
        return {
          hasCheckbox: input !== null,
          isChecked: input?.checked,
        };
      });

      expect(result.hasCheckbox).toBe(true);
      expect(result.isChecked).toBe(true);
    });

    test('layer widget renders dropdown with layers', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Load sample data to have layers
        sp.load(sp.sample);
        // Wait for layers to register
        return new Promise(resolve => {
          setTimeout(() => {
            const el = widgets.render({
              name: 'layerParam',
              type: 'layer',
            }, null, () => {});
            const select = el.querySelector('select');
            resolve({
              hasSelect: select !== null,
              hasOptions: select?.options?.length > 0,
            });
          }, 300);
        });
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasOptions).toBe(true);
    });
  });

  test.describe('Widget Events', () => {
    test('onChange callback fires when value changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'eventTest',
          type: 'string',
        }, '', (newValue) => {
          callbackValue = newValue;
        });

        const input = el.querySelector('input');
        input.value = 'new value';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise(r => setTimeout(r, 50));
        return callbackValue;
      });

      expect(result).toBe('new value');
    });

    test('number widget converts value to number', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'numEvent',
          type: 'number',
        }, 0, (newValue) => {
          callbackValue = newValue;
        });

        const input = el.querySelector('input');
        input.value = '42';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise(r => setTimeout(r, 50));
        return {
          value: callbackValue,
          type: typeof callbackValue,
        };
      });

      expect(result.value).toBe(42);
      expect(result.type).toBe('number');
    });

    test('boolean widget returns boolean value', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'boolEvent',
          type: 'boolean',
        }, false, (newValue) => {
          callbackValue = newValue;
        });

        const input = el.querySelector('input[type="checkbox"]');
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        await new Promise(r => setTimeout(r, 50));
        return {
          value: callbackValue,
          type: typeof callbackValue,
        };
      });

      expect(result.value).toBe(true);
      expect(result.type).toBe('boolean');
    });
  });

  test.describe('Widget Labels', () => {
    test('widget includes label element', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'labelTest',
          type: 'string',
          label: 'My Label',
        }, '', () => {});
        const label = el.querySelector('label');
        return {
          hasLabel: label !== null,
          labelText: label?.textContent,
        };
      });

      expect(result.hasLabel).toBe(true);
      expect(result.labelText).toContain('My Label');
    });

    test('widget uses name as fallback label', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'noLabel',
          type: 'string',
        }, '', () => {});
        const label = el.querySelector('label');
        return label?.textContent;
      });

      expect(result).toContain('noLabel');
    });

    test('required fields show indicator', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'reqField',
          type: 'string',
          required: true,
        }, '', () => {});
        return el.innerHTML.includes('*') || el.classList.contains('required');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Field Widget', () => {
    test('field widget shows fields from associated layer', async ({ page }) => {
      const result = await page.evaluate(async () => {
        sp.load(sp.sample);
        await new Promise(r => setTimeout(r, 300));

        const layerName = Object.keys(ly)[0];
        const layer = ly[layerName];
        if (!layer || layer.type !== 'vector') return { skipped: true };

        const el = widgets.render({
          name: 'fieldSelect',
          type: 'field',
          layer: layerName,
        }, null, () => {});

        const select = el.querySelector('select');
        return {
          hasSelect: select !== null,
          hasOptions: select?.options?.length > 0,
          fieldNames: Array.from(select?.options || []).map(o => o.value),
        };
      });

      if (result.skipped) {
        test.skip();
        return;
      }
      expect(result.hasSelect).toBe(true);
      expect(result.hasOptions).toBe(true);
    });
  });

  test.describe('Widget Descriptions', () => {
    test('widget shows description text', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'descTest',
          type: 'string',
          description: 'Enter your name here',
        }, '', () => {});
        return el.innerHTML.includes('Enter your name here');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Layout Widgets', () => {
    test('row widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('row') !== undefined);
      expect(result).toBe(true);
    });

    test('column widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('column') !== undefined);
      expect(result).toBe(true);
    });

    test('row widget renders children horizontally', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'rowTest',
          type: 'row',
          children: [
            { name: 'a', type: 'string', label: 'A' },
            { name: 'b', type: 'string', label: 'B' },
          ],
        }, { a: '', b: '' }, () => {});
        return {
          hasRow: el.classList.contains('sp-row'),
          childCount: el.children.length,
          isFlexRow: getComputedStyle(el).flexDirection === 'row',
        };
      });

      expect(result.hasRow).toBe(true);
      expect(result.childCount).toBe(2);
    });

    test('row widget is not wrapped with label', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'rowNoWrap',
          type: 'row',
          children: [],
        }, {}, () => {});
        // Layout widgets should not have wrapper div with label
        return el.classList.contains('sp-row');
      });

      expect(result).toBe(true);
    });

    test('formRow widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('formRow') !== undefined);
      expect(result).toBe(true);
    });

    test('formRow renders label and controls', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'formRowTest',
          type: 'formRow',
          label: 'Opacity',
          children: [
            { name: 'value', type: 'range', min: 0, max: 100 },
          ],
        }, { value: 50 }, () => {});
        const label = el.querySelector('.sp-form-row-label');
        const controls = el.querySelector('.sp-form-row-controls');
        return {
          hasFormRow: el.classList.contains('sp-form-row'),
          hasLabel: label !== null,
          labelText: label?.textContent,
          hasControls: controls !== null,
          hasSlider: controls?.querySelector('input[type="range"]') !== null,
        };
      });

      expect(result.hasFormRow).toBe(true);
      expect(result.hasLabel).toBe(true);
      expect(result.labelText).toBe('Opacity');
      expect(result.hasControls).toBe(true);
      expect(result.hasSlider).toBe(true);
    });

    test('formRow supports custom labelWidth', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'formRowWidth',
          type: 'formRow',
          label: 'Test',
          labelWidth: '120px',
          children: [],
        }, {}, () => {});
        const label = el.querySelector('.sp-form-row-label');
        return label?.style.width;
      });

      expect(result).toBe('120px');
    });

    test('spacer widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('spacer') !== undefined);
      expect(result).toBe(true);
    });

    test('spacer renders with default flex', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'spacerDefault',
          type: 'spacer',
        }, null, () => {});
        // Check the style property directly (not computed)
        return {
          hasSpacer: el.classList.contains('sp-spacer'),
          hasFlex: el.style.flex.includes('1'),
        };
      });

      expect(result.hasSpacer).toBe(true);
      expect(result.hasFlex).toBe(true);
    });

    test('spacer renders with custom flex', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'spacerFlex',
          type: 'spacer',
          flex: 2,
        }, null, () => {});
        return el.style.flex.includes('2');
      });

      expect(result).toBe(true);
    });

    test('spacer renders with fixed size', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'spacerFixed',
          type: 'spacer',
          size: '20px',
        }, null, () => {});
        return {
          width: el.style.width,
          height: el.style.height,
          flexShrink: el.style.flexShrink,
        };
      });

      expect(result.width).toBe('20px');
      expect(result.height).toBe('20px');
      expect(result.flexShrink).toBe('0');
    });

    test('spacer works as spring in row', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'rowWithSpacer',
          type: 'row',
          children: [
            { name: 'left', type: 'string', label: 'Left', width: '100px' },
            { type: 'spacer' },  // Spring pushes right to edge
            { name: 'right', type: 'string', label: 'Right', width: '100px' },
          ],
        }, {}, () => {});
        const children = el.children;
        const spacer = el.querySelector('.sp-spacer');
        return {
          childCount: children.length,
          hasSpacer: spacer !== null,
          spacerHasFlex: spacer ? spacer.style.flex.includes('1') : false,
        };
      });

      expect(result.childCount).toBe(3);
      expect(result.hasSpacer).toBe(true);
      expect(result.spacerHasFlex).toBe(true);
    });
  });

  test.describe('Radio Group Widget', () => {
    test('radioGroup widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('radioGroup') !== undefined);
      expect(result).toBe(true);
    });

    test('radioGroup renders radio buttons for options', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'radioTest',
          type: 'radioGroup',
          options: [
            { value: 'opt1', label: 'Option 1' },
            { value: 'opt2', label: 'Option 2' },
            { value: 'opt3', label: 'Option 3' },
          ],
        }, 'opt2', () => {});
        const radios = el.querySelectorAll('input[type="radio"]');
        const checked = el.querySelector('input[type="radio"]:checked');
        return {
          radioCount: radios.length,
          checkedValue: checked?.value,
        };
      });

      expect(result.radioCount).toBe(3);
      expect(result.checkedValue).toBe('opt2');
    });

    test('radioGroup fires onChange when selection changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'radioEvent',
          type: 'radioGroup',
          options: ['a', 'b', 'c'],
        }, 'a', (newValue) => {
          callbackValue = newValue;
        });
        const radios = el.querySelectorAll('input[type="radio"]');
        radios[1].checked = true;
        radios[1].dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        return callbackValue;
      });

      expect(result).toBe('b');
    });
  });

  test.describe('Range Slider Widget', () => {
    test('range widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('range') !== undefined);
      expect(result).toBe(true);
    });

    test('range widget renders slider with value display', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'rangeTest',
          type: 'range',
          min: 0,
          max: 100,
        }, 75, () => {});
        const slider = el.querySelector('input[type="range"]');
        const display = el.querySelector('.sp-range-value');
        return {
          hasSlider: slider !== null,
          hasDisplay: display !== null,
          sliderValue: slider?.value,
          displayText: display?.textContent,
        };
      });

      expect(result.hasSlider).toBe(true);
      expect(result.hasDisplay).toBe(true);
      expect(result.sliderValue).toBe('75');
      expect(result.displayText).toContain('75');
    });

    test('range widget updates display when value changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'rangeUpdate',
          type: 'range',
          min: 0,
          max: 100,
          suffix: '%',
        }, 50, (newValue) => {
          callbackValue = newValue;
        });
        const slider = el.querySelector('input[type="range"]');
        const display = el.querySelector('.sp-range-value');
        slider.value = '80';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        return {
          callbackValue,
          displayText: display?.textContent,
        };
      });

      expect(result.callbackValue).toBe(80);
      expect(result.displayText).toBe('80%');
    });
  });

  test.describe('Button Group Widget', () => {
    test('buttonGroup widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('buttonGroup') !== undefined);
      expect(result).toBe(true);
    });

    test('buttonGroup renders buttons for each option', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'btnGroupTest',
          type: 'buttonGroup',
          buttons: [
            { value: 'a', label: 'Button A' },
            { value: 'b', label: 'Button B' },
            { value: 'c', label: 'Button C' },
          ],
        }, 'b', () => {});
        const buttons = el.querySelectorAll('button');
        const activeBtn = el.querySelector('button.active');
        return {
          buttonCount: buttons.length,
          activeText: activeBtn?.textContent,
        };
      });

      expect(result.buttonCount).toBe(3);
      expect(result.activeText).toBe('Button B');
    });

    test('buttonGroup fires onChange and updates active state', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'btnGroupEvent',
          type: 'buttonGroup',
          buttons: [
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ],
        }, 'x', (newValue) => {
          callbackValue = newValue;
        });
        const buttons = el.querySelectorAll('button');
        buttons[1].click();
        await new Promise(r => setTimeout(r, 50));
        const activeBtn = el.querySelector('button.active');
        return {
          callbackValue,
          activeText: activeBtn?.textContent,
        };
      });

      expect(result.callbackValue).toBe('y');
      expect(result.activeText).toBe('Y');
    });
  });

  test.describe('Color Ramp Widget', () => {
    test('colorRamp widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('colorRamp') !== undefined);
      expect(result).toBe(true);
    });

    test('colorRamp renders select with preview', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'rampTest',
          type: 'colorRamp',
        }, 'viridis', () => {});
        const select = el.querySelector('select');
        const preview = el.querySelector('.sp-colorramp-preview');
        return {
          hasSelect: select !== null,
          hasPreview: preview !== null,
          hasViridis: Array.from(select?.options || []).some(o => o.value === 'viridis'),
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasPreview).toBe(true);
      expect(result.hasViridis).toBe(true);
    });

    test('colorRamp updates preview when selection changes', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'rampChange',
          type: 'colorRamp',
        }, 'viridis', (newValue) => {
          callbackValue = newValue;
        });
        const select = el.querySelector('select');
        select.value = 'terrain';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        return callbackValue;
      });

      expect(result).toBe('terrain');
    });
  });

  test.describe('Color Picker Widget', () => {
    test('color widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('color') !== undefined);
      expect(result).toBe(true);
    });

    test('color widget renders color input with preview', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'colorTest',
          type: 'color',
        }, '#ff5500', () => {});
        const input = el.querySelector('input[type="color"]');
        const preview = el.querySelector('.sp-color-preview');
        return {
          hasInput: input !== null,
          hasPreview: preview !== null,
          inputValue: input?.value,
        };
      });

      expect(result.hasInput).toBe(true);
      expect(result.hasPreview).toBe(true);
      expect(result.inputValue).toBe('#ff5500');
    });
  });

  test.describe('Band Selector Widget', () => {
    test('bandSelector widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('bandSelector') !== undefined);
      expect(result).toBe(true);
    });

    test('bandSelector renders band dropdown and stretch inputs', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'bandTest',
          type: 'bandSelector',
          channel: 'R',
          channelColor: '#ff6b6b',
          bandCount: 4,
        }, { band: 3, min: 100, max: 5000 }, () => {});
        const select = el.querySelector('select');
        const minInput = el.querySelector('input[placeholder="min"]');
        const maxInput = el.querySelector('input[placeholder="max"]');
        const autoBtn = el.querySelector('button');
        return {
          hasSelect: select !== null,
          hasMin: minInput !== null,
          hasMax: maxInput !== null,
          hasAuto: autoBtn !== null,
          bandCount: select?.options?.length,
          selectedBand: select?.value,
          minValue: minInput?.value,
          maxValue: maxInput?.value,
        };
      });

      expect(result.hasSelect).toBe(true);
      expect(result.hasMin).toBe(true);
      expect(result.hasMax).toBe(true);
      expect(result.hasAuto).toBe(true);
      expect(result.bandCount).toBe(4);
      expect(result.selectedBand).toBe('3');
      expect(result.minValue).toBe('100');
      expect(result.maxValue).toBe('5000');
    });

    test('bandSelector returns structured value on change', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let callbackValue = null;
        const el = widgets.render({
          name: 'bandChange',
          type: 'bandSelector',
          bandCount: 4,
        }, { band: 1 }, (newValue) => {
          callbackValue = newValue;
        });
        const select = el.querySelector('select');
        select.value = '4';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        return callbackValue;
      });

      expect(result.band).toBe(4);
    });
  });

  test.describe('Tool Form Generation', () => {
    test('renderToolForm() creates form for tool parameters', async ({ page }) => {
      const result = await page.evaluate(() => {
        const form = widgets.renderToolForm({
          id: 'test.tool',
          name: 'Test Tool',
          parameters: [
            { name: 'input', type: 'string', label: 'Input' },
            { name: 'count', type: 'number', label: 'Count' },
          ],
        }, {}, () => {});

        return {
          isElement: form instanceof HTMLElement,
          hasInputs: form.querySelectorAll('input').length >= 2,
        };
      });

      expect(result.isElement).toBe(true);
      expect(result.hasInputs).toBe(true);
    });

    test('renderToolForm() updates values object on change', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let values = { input: '' };
        const form = widgets.renderToolForm({
          id: 'test.formvalues',
          name: 'Form Values Test',
          parameters: [
            { name: 'input', type: 'string', label: 'Input' },
          ],
        }, values, (newValues) => {
          values = newValues;
        });

        const input = form.querySelector('input');
        input.value = 'updated';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise(r => setTimeout(r, 50));
        return values.input;
      });

      expect(result).toBe('updated');
    });
  });

  test.describe('Structural Widgets', () => {
    test('header widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('header') !== undefined);
      expect(result).toBe(true);
    });

    test('header renders with text', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'headerTest',
          type: 'header',
          label: 'Section Title',
        }, null, () => {});
        return {
          hasClass: el.classList.contains('sp-header'),
          text: el.textContent,
        };
      });

      expect(result.hasClass).toBe(true);
      expect(result.text).toBe('Section Title');
    });

    test('header supports small size', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'headerSmall',
          type: 'header',
          label: 'Small Header',
          size: 'small',
        }, null, () => {});
        return el.classList.contains('sp-header-sm');
      });

      expect(result).toBe(true);
    });

    test('hint widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('hint') !== undefined);
      expect(result).toBe(true);
    });

    test('hint renders with text', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'hintTest',
          type: 'hint',
          text: 'Help text here',
        }, null, () => {});
        return {
          hasClass: el.classList.contains('sp-hint'),
          text: el.textContent,
        };
      });

      expect(result.hasClass).toBe(true);
      expect(result.text).toBe('Help text here');
    });

    test('actions widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('actions') !== undefined);
      expect(result).toBe(true);
    });

    test('actions renders buttons', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'actionsTest',
          type: 'actions',
          buttons: [
            { label: 'Cancel', action: 'cancel' },
            { label: 'Apply', action: 'apply', primary: true },
          ],
        }, null, () => {});
        const buttons = el.querySelectorAll('button');
        return {
          hasClass: el.classList.contains('sp-actions'),
          buttonCount: buttons.length,
          firstLabel: buttons[0]?.textContent,
          secondLabel: buttons[1]?.textContent,
          secondIsPrimary: buttons[1]?.classList.contains('sp-btn-primary'),
        };
      });

      expect(result.hasClass).toBe(true);
      expect(result.buttonCount).toBe(2);
      expect(result.firstLabel).toBe('Cancel');
      expect(result.secondLabel).toBe('Apply');
      expect(result.secondIsPrimary).toBe(true);
    });

    test('actions button click triggers onChange', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let clickedAction = null;
        const el = widgets.render({
          name: 'actionsClick',
          type: 'actions',
          buttons: [
            { label: 'Test', action: 'test-action' },
          ],
        }, null, (action) => {
          clickedAction = action;
        });

        const button = el.querySelector('button');
        button.click();
        await new Promise(r => setTimeout(r, 50));
        return clickedAction;
      });

      expect(result).toBe('test-action');
    });

    test('conditional widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('conditional') !== undefined);
      expect(result).toBe(true);
    });

    test('conditional shows when field matches showWhen', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'conditionalTest',
          type: 'conditional',
          field: 'mode',
          showWhen: 'advanced',
          children: [
            { name: 'advancedOption', type: 'string', label: 'Advanced Option' },
          ],
        }, { mode: 'advanced' }, () => {});
        return el.style.display;
      });

      expect(result).toBe('');
    });

    test('conditional hides when field does not match showWhen', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'conditionalHide',
          type: 'conditional',
          field: 'mode',
          showWhen: 'advanced',
          children: [],
        }, { mode: 'basic' }, () => {});
        return el.style.display;
      });

      expect(result).toBe('none');
    });

    test('conditional supports array of showWhen values', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'conditionalArray',
          type: 'conditional',
          field: 'mode',
          showWhen: ['a', 'b', 'c'],
          children: [],
        }, { mode: 'b' }, () => {});
        return el.style.display;
      });

      expect(result).toBe('');
    });
  });

  test.describe('Expression Widget', () => {
    test('expression widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('expression') !== undefined);
      expect(result).toBe(true);
    });

    test('expression renders input', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'exprTest',
          type: 'expression',
          label: 'Expression',
        }, '', () => {});
        // Widget gets wrapped with sp-widget, inner element is sp-expression-wrapper
        const wrapper = el.querySelector('.sp-expression-wrapper');
        const input = el.querySelector('input');
        return {
          hasWrapper: wrapper !== null,
          hasInput: input !== null,
          inputClass: input?.classList.contains('sp-expression-input'),
        };
      });

      expect(result.hasWrapper).toBe(true);
      expect(result.hasInput).toBe(true);
      expect(result.inputClass).toBe(true);
    });

    test('expression renders presets when provided', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'exprPresets',
          type: 'expression',
          presets: [
            { label: 'NDVI', expr: '(b4-b3)/(b4+b3)' },
            { label: 'NDWI', expr: '(b2-b4)/(b2+b4)' },
          ],
        }, '', () => {});
        const presets = el.querySelector('.sp-expression-presets');
        const buttons = presets?.querySelectorAll('button');
        return {
          hasPresets: presets !== null,
          buttonCount: buttons?.length || 0,
        };
      });

      expect(result.hasPresets).toBe(true);
      expect(result.buttonCount).toBe(2);
    });
  });

  test.describe('Stretch Widget', () => {
    test('stretch widget is registered', async ({ page }) => {
      const result = await page.evaluate(() => widgets.get('stretch') !== undefined);
      expect(result).toBe(true);
    });

    test('stretch renders min/max inputs and auto button', async ({ page }) => {
      const result = await page.evaluate(() => {
        const el = widgets.render({
          name: 'stretchTest',
          type: 'stretch',
          label: 'Stretch',
        }, { min: 0, max: 255 }, () => {});
        // Widget gets wrapped with sp-widget, inner element is sp-stretch-wrapper
        const wrapper = el.querySelector('.sp-stretch-wrapper');
        const inputs = el.querySelectorAll('input[type="number"]');
        const button = el.querySelector('button');
        return {
          hasWrapper: wrapper !== null,
          inputCount: inputs.length,
          hasButton: button !== null,
          buttonText: button?.textContent,
        };
      });

      expect(result.hasWrapper).toBe(true);
      expect(result.inputCount).toBe(2);
      expect(result.hasButton).toBe(true);
      expect(result.buttonText).toBe('Auto');
    });
  });
});
