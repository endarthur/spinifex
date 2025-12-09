// Spinifex - Map Tools Tests
// Tests for interactive map tools manager

import { test, expect } from '@playwright/test';

test.describe('Map Tools Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample data to have layers to work with
    await page.evaluate(() => sp.load(sp.sample));
    await page.waitForFunction(() => Object.keys(window.ly).length > 0, { timeout: 5000 });
  });

  test.describe('Manager State', () => {
    test('mapTools object exists on sp', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.sp.mapTools !== undefined;
      });
      expect(result).toBe(true);
    });

    test('current is null when no tool active', async ({ page }) => {
      const result = await page.evaluate(() => {
        sp.mapTools.deactivate(); // Ensure clean state
        return sp.mapTools.current;
      });
      expect(result).toBeNull();
    });

    test('currentTool is null when no tool active', async ({ page }) => {
      const result = await page.evaluate(() => {
        sp.mapTools.deactivate();
        return sp.mapTools.currentTool;
      });
      expect(result).toBeNull();
    });
  });

  test.describe('Tool Activation', () => {
    test('activate() with valid tool returns true', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'test.tool',
          name: 'Test Tool',
          type: 'interactive',
          cursor: 'pointer'
        };
        return sp.mapTools.activate(tool);
      });
      expect(result).toBe(true);
    });

    test('activate() sets current to tool id', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'test.tool2',
          name: 'Test Tool 2',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        return sp.mapTools.current;
      });
      expect(result).toBe('test.tool2');
    });

    test('activate() sets currentTool', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'test.tool3',
          name: 'Test Tool 3',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        return sp.mapTools.currentTool?.name;
      });
      expect(result).toBe('Test Tool 3');
    });

    test('activate() with null returns false', async ({ page }) => {
      const result = await page.evaluate(() => {
        return sp.mapTools.activate(null);
      });
      expect(result).toBe(false);
    });

    test('activate() sets cursor style', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'cursor.test',
          name: 'Cursor Test',
          type: 'interactive',
          cursor: 'crosshair'
        };
        sp.mapTools.activate(tool);
        const mapEl = document.getElementById('map');
        return mapEl?.style.cursor;
      });
      expect(result).toBe('crosshair');
    });
  });

  test.describe('Tool Deactivation', () => {
    test('deactivate() clears current', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'deactivate.test',
          name: 'Deactivate Test',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        sp.mapTools.deactivate();
        return sp.mapTools.current;
      });
      expect(result).toBeNull();
    });

    test('deactivate() clears currentTool', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'deactivate.test2',
          name: 'Deactivate Test 2',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        sp.mapTools.deactivate();
        return sp.mapTools.currentTool;
      });
      expect(result).toBeNull();
    });

    test('deactivate() resets cursor', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'cursor.reset',
          name: 'Cursor Reset Test',
          type: 'interactive',
          cursor: 'crosshair'
        };
        sp.mapTools.activate(tool);
        sp.mapTools.deactivate();
        const mapEl = document.getElementById('map');
        return mapEl?.style.cursor;
      });
      expect(result).toBe('');
    });

    test('deactivate() calls tool deactivate hook', async ({ page }) => {
      const result = await page.evaluate(() => {
        let hookCalled = false;
        const tool = {
          id: 'hook.test',
          name: 'Hook Test',
          type: 'interactive',
          deactivate: () => { hookCalled = true; }
        };
        sp.mapTools.activate(tool);
        sp.mapTools.deactivate();
        return hookCalled;
      });
      expect(result).toBe(true);
    });

    test('activating new tool deactivates previous', async ({ page }) => {
      const result = await page.evaluate(() => {
        let firstDeactivated = false;
        const tool1 = {
          id: 'first.tool',
          name: 'First Tool',
          type: 'interactive',
          deactivate: () => { firstDeactivated = true; }
        };
        const tool2 = {
          id: 'second.tool',
          name: 'Second Tool',
          type: 'interactive'
        };
        sp.mapTools.activate(tool1);
        sp.mapTools.activate(tool2);
        return {
          firstDeactivated,
          currentId: sp.mapTools.current
        };
      });
      expect(result.firstDeactivated).toBe(true);
      expect(result.currentId).toBe('second.tool');
    });
  });

  test.describe('isActive Check', () => {
    test('isActive() returns false when no tool active', async ({ page }) => {
      const result = await page.evaluate(() => {
        sp.mapTools.deactivate();
        return sp.mapTools.isActive('some.tool');
      });
      expect(result).toBe(false);
    });

    test('isActive() returns true for active tool', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'active.check',
          name: 'Active Check',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        return sp.mapTools.isActive('active.check');
      });
      expect(result).toBe(true);
    });

    test('isActive() returns false for different tool', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'this.tool',
          name: 'This Tool',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        return sp.mapTools.isActive('other.tool');
      });
      expect(result).toBe(false);
    });
  });

  test.describe('Cancel Functionality', () => {
    test('cancel() deactivates current tool', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = {
          id: 'cancel.test',
          name: 'Cancel Test',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
        sp.mapTools.cancel();
        return sp.mapTools.current;
      });
      expect(result).toBeNull();
    });

    test('cancel() calls onCancel hook', async ({ page }) => {
      const result = await page.evaluate(() => {
        let cancelHookCalled = false;
        const tool = {
          id: 'cancel.hook',
          name: 'Cancel Hook Test',
          type: 'interactive',
          onCancel: () => { cancelHookCalled = true; }
        };
        sp.mapTools.activate(tool);
        sp.mapTools.cancel();
        return cancelHookCalled;
      });
      expect(result).toBe(true);
    });
  });

  test.describe('Activate By ID', () => {
    test('activateById() returns false for non-existent tool', async ({ page }) => {
      const result = await page.evaluate(async () => {
        return await sp.mapTools.activateById('non.existent.tool');
      });
      expect(result).toBe(false);
    });

    test('activateById() is async function', async ({ page }) => {
      const result = await page.evaluate(() => {
        const ret = sp.mapTools.activateById('test');
        // Should return a Promise
        return ret instanceof Promise;
      });
      expect(result).toBe(true);
    });
  });

  test.describe('Built-in Tools via Shortcuts', () => {
    test('sp.sketching exists with tool functions', async ({ page }) => {
      const result = await page.evaluate(() => {
        return sp.sketching !== undefined &&
          typeof sp.sketching.point === 'function' &&
          typeof sp.sketching.line === 'function' &&
          typeof sp.sketching.polygon === 'function' &&
          typeof sp.sketching.modify === 'function' &&
          typeof sp.sketching.cancel === 'function';
      });
      expect(result).toBe(true);
    });

    test('sp.selection exists with tool functions', async ({ page }) => {
      const result = await page.evaluate(() => {
        return sp.selection !== undefined &&
          typeof sp.selection.click === 'function' &&
          typeof sp.selection.box === 'function';
      });
      expect(result).toBe(true);
    });
  });

  test.describe('Tool Activation Hooks', () => {
    test('activate hook is called', async ({ page }) => {
      const result = await page.evaluate(() => {
        let activateHookCalled = false;
        let receivedOptions = null;
        const tool = {
          id: 'activate.hook',
          name: 'Activate Hook Test',
          type: 'interactive',
          activate: (opts) => {
            activateHookCalled = true;
            receivedOptions = opts;
          }
        };
        sp.mapTools.activate(tool, { testOption: 'value' });
        return {
          hookCalled: activateHookCalled,
          hasTestOption: receivedOptions?.testOption === 'value',
          hasMap: receivedOptions?.map !== undefined
        };
      });
      expect(result.hookCalled).toBe(true);
      expect(result.hasTestOption).toBe(true);
      expect(result.hasMap).toBe(true);
    });
  });

  test.describe('Keyboard Handler', () => {
    test('Escape key cancels active tool', async ({ page }) => {
      // Activate a tool
      await page.evaluate(() => {
        const tool = {
          id: 'escape.test',
          name: 'Escape Test',
          type: 'interactive'
        };
        sp.mapTools.activate(tool);
      });

      // Press Escape
      await page.keyboard.press('Escape');

      // Check tool was deactivated
      const result = await page.evaluate(() => {
        return sp.mapTools.current;
      });
      expect(result).toBeNull();
    });

    test('onKeyDown hook is called', async ({ page }) => {
      const result = await page.evaluate(async () => {
        let keyPressed = null;
        const tool = {
          id: 'keydown.test',
          name: 'KeyDown Test',
          type: 'interactive',
          onKeyDown: (key) => { keyPressed = key; }
        };
        sp.mapTools.activate(tool);

        // Simulate keydown
        const event = new KeyboardEvent('keydown', { key: 'a' });
        document.dispatchEvent(event);

        return keyPressed;
      });
      expect(result).toBe('a');
    });
  });
});
