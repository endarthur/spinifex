// Spinifex - Settings API Tests
// TDD tests for src/core/settings.js

import { test, expect } from '@playwright/test';

test.describe('Settings API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });

    // Clear any existing settings before each test
    await page.evaluate(() => {
      localStorage.removeItem('sp_settings');
    });
  });

  test.describe('Basic API', () => {
    test('settings object exists and has required methods', async ({ page }) => {
      const api = await page.evaluate(() => {
        return {
          exists: window.settings !== undefined,
          hasGet: typeof window.settings?.get === 'function',
          hasSet: typeof window.settings?.set === 'function',
          hasRemove: typeof window.settings?.remove === 'function',
          hasGetNamespace: typeof window.settings?.getNamespace === 'function',
          hasClearNamespace: typeof window.settings?.clearNamespace === 'function',
          hasOnChange: typeof window.settings?.onChange === 'function',
        };
      });

      expect(api.exists).toBe(true);
      expect(api.hasGet).toBe(true);
      expect(api.hasSet).toBe(true);
      expect(api.hasRemove).toBe(true);
      expect(api.hasGetNamespace).toBe(true);
      expect(api.hasClearNamespace).toBe(true);
      expect(api.hasOnChange).toBe(true);
    });
  });

  test.describe('get() and set()', () => {
    test('set() stores a value that get() retrieves', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.key', 'hello');
        return window.settings.get('test.key');
      });

      expect(result).toBe('hello');
    });

    test('get() returns default value when key does not exist', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.settings.get('nonexistent.key', 'default');
      });

      expect(result).toBe('default');
    });

    test('get() returns null when key does not exist and no default', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.settings.get('nonexistent.key');
      });

      expect(result).toBeNull();
    });

    test('set() overwrites existing value', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.overwrite', 'first');
        window.settings.set('test.overwrite', 'second');
        return window.settings.get('test.overwrite');
      });

      expect(result).toBe('second');
    });

    test('stores and retrieves complex objects', async ({ page }) => {
      const result = await page.evaluate(() => {
        const obj = { name: 'test', values: [1, 2, 3], nested: { a: 1 } };
        window.settings.set('test.object', obj);
        return window.settings.get('test.object');
      });

      expect(result).toEqual({ name: 'test', values: [1, 2, 3], nested: { a: 1 } });
    });

    test('stores and retrieves arrays', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.array', [1, 'two', { three: 3 }]);
        return window.settings.get('test.array');
      });

      expect(result).toEqual([1, 'two', { three: 3 }]);
    });

    test('stores and retrieves numbers', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.number', 42.5);
        return window.settings.get('test.number');
      });

      expect(result).toBe(42.5);
    });

    test('stores and retrieves booleans', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.bool.true', true);
        window.settings.set('test.bool.false', false);
        return {
          t: window.settings.get('test.bool.true'),
          f: window.settings.get('test.bool.false'),
        };
      });

      expect(result.t).toBe(true);
      expect(result.f).toBe(false);
    });

    test('stores and retrieves null', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.null', null);
        // Need to distinguish between "key exists with null" vs "key doesn't exist"
        const hasKey = window.settings.get('test.null', 'NOTFOUND') === null;
        return hasKey;
      });

      // This tests that null is stored, not treated as "not found"
      expect(result).toBe(true);
    });
  });

  test.describe('Dot-notation keys', () => {
    test('supports deeply nested keys', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('a.b.c.d.e', 'deep');
        return window.settings.get('a.b.c.d.e');
      });

      expect(result).toBe('deep');
    });

    test('sibling keys are independent', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('parent.child1', 'one');
        window.settings.set('parent.child2', 'two');
        return {
          child1: window.settings.get('parent.child1'),
          child2: window.settings.get('parent.child2'),
        };
      });

      expect(result.child1).toBe('one');
      expect(result.child2).toBe('two');
    });

    test('can overwrite nested structure with scalar', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.nested.deep', 'value');
        window.settings.set('test.nested', 'scalar');
        return window.settings.get('test.nested');
      });

      expect(result).toBe('scalar');
    });
  });

  test.describe('remove()', () => {
    test('remove() deletes a key', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.remove', 'value');
        window.settings.remove('test.remove');
        return window.settings.get('test.remove', 'gone');
      });

      expect(result).toBe('gone');
    });

    test('remove() does nothing for nonexistent key', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Should not throw
        window.settings.remove('nonexistent.key');
        return true;
      });

      expect(result).toBe(true);
    });

    test('remove() only removes specified key, not siblings', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.a', 1);
        window.settings.set('test.b', 2);
        window.settings.remove('test.a');
        return {
          a: window.settings.get('test.a'),
          b: window.settings.get('test.b'),
        };
      });

      expect(result.a).toBeNull();
      expect(result.b).toBe(2);
    });
  });

  test.describe('Namespaces', () => {
    test('getNamespace() returns all keys under namespace', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('tools.buffer.distance', 100);
        window.settings.set('tools.buffer.units', 'm');
        window.settings.set('tools.dissolve.field', 'name');
        return window.settings.getNamespace('tools');
      });

      expect(result).toEqual({
        buffer: { distance: 100, units: 'm' },
        dissolve: { field: 'name' },
      });
    });

    test('getNamespace() returns empty object for nonexistent namespace', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.settings.getNamespace('nonexistent');
      });

      expect(result).toEqual({});
    });

    test('clearNamespace() removes all keys under namespace', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('test.a', 1);
        window.settings.set('test.b', 2);
        window.settings.set('other.c', 3);

        window.settings.clearNamespace('test');

        return {
          testA: window.settings.get('test.a'),
          testB: window.settings.get('test.b'),
          otherC: window.settings.get('other.c'),
        };
      });

      expect(result.testA).toBeNull();
      expect(result.testB).toBeNull();
      expect(result.otherC).toBe(3);
    });
  });

  test.describe('Persistence', () => {
    test('settings persist across page reloads', async ({ page }) => {
      // Set a value
      await page.evaluate(() => {
        window.settings.set('persist.test', 'survived');
      });

      // Reload the page
      await page.reload();
      await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });

      // Check value is still there
      const result = await page.evaluate(() => {
        return window.settings.get('persist.test');
      });

      expect(result).toBe('survived');
    });

    test('settings are stored in localStorage', async ({ page }) => {
      await page.evaluate(() => {
        window.settings.set('storage.check', 'inLocalStorage');
      });

      const stored = await page.evaluate(() => {
        return localStorage.getItem('sp_settings');
      });

      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.storage.check).toBe('inLocalStorage');
    });
  });

  test.describe('onChange()', () => {
    test('onChange() fires when value changes', async ({ page }) => {
      const result = await page.evaluate(() => {
        let received = null;
        window.settings.onChange('test.watch', (value, key) => {
          received = { value, key };
        });
        window.settings.set('test.watch', 'changed');
        return received;
      });

      expect(result.value).toBe('changed');
      expect(result.key).toBe('test.watch');
    });

    test('onChange() fires for nested key changes', async ({ page }) => {
      const result = await page.evaluate(() => {
        const calls = [];
        window.settings.onChange('parent', (value, key) => {
          calls.push({ value, key });
        });
        window.settings.set('parent.child', 'value');
        return calls;
      });

      expect(result.length).toBe(1);
      expect(result[0].key).toBe('parent.child');
    });

    test('onChange() returns unsubscribe function', async ({ page }) => {
      const result = await page.evaluate(() => {
        let count = 0;
        const unsub = window.settings.onChange('test.unsub', () => {
          count++;
        });

        window.settings.set('test.unsub', 'first');
        unsub();
        window.settings.set('test.unsub', 'second');

        return count;
      });

      expect(result).toBe(1);
    });
  });

  test.describe('Common Use Cases', () => {
    test('tool settings with defaults', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Simulate getting tool settings with defaults
        const distance = window.settings.get('tools.buffer.defaultDistance', { value: 100, unit: 'm' });
        const segments = window.settings.get('tools.buffer.defaultSegments', 8);

        return { distance, segments };
      });

      expect(result.distance).toEqual({ value: 100, unit: 'm' });
      expect(result.segments).toBe(8);
    });

    test('UI preferences', async ({ page }) => {
      const result = await page.evaluate(() => {
        window.settings.set('ui.terminal.height', 250);
        window.settings.set('ui.theme', 'dark');

        return {
          height: window.settings.get('ui.terminal.height'),
          theme: window.settings.get('ui.theme'),
        };
      });

      expect(result.height).toBe(250);
      expect(result.theme).toBe('dark');
    });

    test('history array', async ({ page }) => {
      const result = await page.evaluate(() => {
        const history = window.settings.get('history.tools', []);
        history.push({ tool: 'buffer', time: Date.now() });
        history.push({ tool: 'dissolve', time: Date.now() });
        window.settings.set('history.tools', history);

        return window.settings.get('history.tools');
      });

      expect(result.length).toBe(2);
      expect(result[0].tool).toBe('buffer');
      expect(result[1].tool).toBe('dissolve');
    });
  });
});
