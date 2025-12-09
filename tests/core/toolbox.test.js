// Spinifex - Tool Registry (Toolbox) Tests
// TDD tests for src/core/toolbox.js

import { test, expect } from '@playwright/test';

test.describe('Toolbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Basic API', () => {
    test('toolbox object exists on window', async ({ page }) => {
      const result = await page.evaluate(() => window.toolbox !== undefined);
      expect(result).toBe(true);
    });

    test('toolbox has required methods', async ({ page }) => {
      const result = await page.evaluate(() => ({
        hasRegister: typeof window.toolbox?.register === 'function',
        hasGet: typeof window.toolbox?.get === 'function',
        hasList: typeof window.toolbox?.list === 'function',
        hasSearch: typeof window.toolbox?.search === 'function',
        hasRun: typeof window.toolbox?.run === 'function',
      }));

      expect(result.hasRegister).toBe(true);
      expect(result.hasGet).toBe(true);
      expect(result.hasList).toBe(true);
      expect(result.hasSearch).toBe(true);
      expect(result.hasRun).toBe(true);
    });

    test('sp.run is a shorthand for toolbox.run', async ({ page }) => {
      const result = await page.evaluate(() => typeof sp.run === 'function');
      expect(result).toBe(true);
    });
  });

  test.describe('Tool Registration', () => {
    test('register() adds a tool to the registry', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({
          id: 'test.mytool',
          name: 'My Test Tool',
          category: 'Test',
          parameters: [],
          execute: async () => null,
        });
        return toolbox.get('test.mytool') !== undefined;
      });

      expect(result).toBe(true);
    });

    test('register() requires an id', async ({ page }) => {
      const result = await page.evaluate(() => {
        try {
          toolbox.register({ name: 'No ID Tool' });
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('register() requires an execute function', async ({ page }) => {
      const result = await page.evaluate(() => {
        try {
          toolbox.register({ id: 'test.noexec', name: 'No Execute' });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('cannot register duplicate tool IDs', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({
          id: 'test.duplicate',
          name: 'First',
          execute: async () => null,
        });
        try {
          toolbox.register({
            id: 'test.duplicate',
            name: 'Second',
            execute: async () => null,
          });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });
  });

  test.describe('Tool Retrieval', () => {
    test('get() returns tool by ID', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({
          id: 'test.gettool',
          name: 'Get Tool',
          description: 'A tool for testing get()',
          execute: async () => null,
        });
        const tool = toolbox.get('test.gettool');
        return {
          id: tool?.id,
          name: tool?.name,
          description: tool?.description,
        };
      });

      expect(result.id).toBe('test.gettool');
      expect(result.name).toBe('Get Tool');
      expect(result.description).toBe('A tool for testing get()');
    });

    test('get() returns undefined for unknown ID', async ({ page }) => {
      const result = await page.evaluate(() => toolbox.get('nonexistent.tool'));
      expect(result).toBeUndefined();
    });

    test('list() returns all tools', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({ id: 'test.list1', name: 'List 1', execute: async () => null });
        toolbox.register({ id: 'test.list2', name: 'List 2', execute: async () => null });
        const all = toolbox.list();
        return {
          isArray: Array.isArray(all),
          hasList1: all.some(t => t.id === 'test.list1'),
          hasList2: all.some(t => t.id === 'test.list2'),
        };
      });

      expect(result.isArray).toBe(true);
      expect(result.hasList1).toBe(true);
      expect(result.hasList2).toBe(true);
    });

    test('list(category) returns tools in that category', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({ id: 'test.cat1', name: 'Cat 1', category: 'Vector', execute: async () => null });
        toolbox.register({ id: 'test.cat2', name: 'Cat 2', category: 'Raster', execute: async () => null });
        toolbox.register({ id: 'test.cat3', name: 'Cat 3', category: 'Vector', execute: async () => null });
        const vectorTools = toolbox.list('Vector');
        return {
          length: vectorTools.length,
          allVector: vectorTools.every(t => t.category === 'Vector'),
        };
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.allVector).toBe(true);
    });

    test('categories() returns list of categories', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({ id: 'test.catlist1', name: 'CL1', category: 'Analysis', execute: async () => null });
        toolbox.register({ id: 'test.catlist2', name: 'CL2', category: 'Export', execute: async () => null });
        const cats = toolbox.categories();
        return {
          isArray: Array.isArray(cats),
          hasAnalysis: cats.includes('Analysis'),
          hasExport: cats.includes('Export'),
        };
      });

      expect(result.isArray).toBe(true);
      expect(result.hasAnalysis).toBe(true);
      expect(result.hasExport).toBe(true);
    });
  });

  test.describe('Tool Search', () => {
    test('search() finds tools by name', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({ id: 'test.searchbuffer', name: 'Buffer', execute: async () => null });
        const results = toolbox.search('buffer');
        return results.some(t => t.id === 'test.searchbuffer');
      });

      expect(result).toBe(true);
    });

    test('search() finds tools by description', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({
          id: 'test.searchdesc',
          name: 'Proximity Tool',
          description: 'Creates zones around features',
          execute: async () => null,
        });
        const results = toolbox.search('zones');
        return results.some(t => t.id === 'test.searchdesc');
      });

      expect(result).toBe(true);
    });

    test('search() finds tools by tags', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({
          id: 'test.searchtags',
          name: 'My Tool',
          tags: ['geometry', 'analysis'],
          execute: async () => null,
        });
        const results = toolbox.search('geometry');
        return results.some(t => t.id === 'test.searchtags');
      });

      expect(result).toBe(true);
    });

    test('search() is case-insensitive', async ({ page }) => {
      const result = await page.evaluate(() => {
        toolbox.register({ id: 'test.searchcase', name: 'Dissolve', execute: async () => null });
        const results = toolbox.search('DISSOLVE');
        return results.some(t => t.id === 'test.searchcase');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Tool Execution', () => {
    test('run() executes a tool and returns result', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.runexec',
          name: 'Run Test',
          execute: async (params) => ({ success: true, value: params.x * 2 }),
        });
        const result = await toolbox.run('test.runexec', { x: 5 });
        return result;
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    test('run() throws for unknown tool', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          await toolbox.run('nonexistent.tool', {});
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('sp.run() works as shorthand', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.sprun',
          name: 'SP Run Test',
          execute: async () => 'sp.run works',
        });
        return await sp.run('test.sprun', {});
      });

      expect(result).toBe('sp.run works');
    });

    test('run() passes context to execute function', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.context',
          name: 'Context Test',
          execute: async (params, context) => ({
            hasMap: context.map !== undefined,
            hasLayers: context.layers !== undefined,
          }),
        });
        return await toolbox.run('test.context', {});
      });

      expect(result.hasMap).toBe(true);
      expect(result.hasLayers).toBe(true);
    });
  });

  test.describe('Parameter Validation', () => {
    test('validates required parameters', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.required',
          name: 'Required Test',
          parameters: [
            { name: 'input', type: 'string', required: true },
          ],
          execute: async () => 'ok',
        });
        try {
          await toolbox.run('test.required', {});
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      });

      expect(result.threw).toBe(true);
      expect(result.message).toContain('input');
    });

    test('applies default values', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.defaults',
          name: 'Defaults Test',
          parameters: [
            { name: 'value', type: 'number', default: 42 },
          ],
          execute: async (params) => params.value,
        });
        return await toolbox.run('test.defaults', {});
      });

      expect(result).toBe(42);
    });

    test('validates min/max for numbers', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.minmax',
          name: 'MinMax Test',
          parameters: [
            { name: 'value', type: 'number', min: 0, max: 100 },
          ],
          execute: async () => 'ok',
        });
        try {
          await toolbox.run('test.minmax', { value: 150 });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('validates select options', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.selectval',
          name: 'Select Validation',
          parameters: [
            {
              name: 'mode',
              type: 'select',
              options: [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ],
            },
          ],
          execute: async () => 'ok',
        });
        try {
          await toolbox.run('test.selectval', { mode: 'invalid' });
          return { threw: false };
        } catch (e) {
          return { threw: true };
        }
      });

      expect(result.threw).toBe(true);
    });

    test('runs custom validate function', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.customval',
          name: 'Custom Validation',
          parameters: [
            {
              name: 'name',
              type: 'string',
              validate: (value) => value.startsWith('sp_') ? null : 'Must start with sp_',
            },
          ],
          execute: async () => 'ok',
        });
        try {
          await toolbox.run('test.customval', { name: 'invalid' });
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      });

      expect(result.threw).toBe(true);
      expect(result.message).toContain('sp_');
    });
  });

  test.describe('Tool Events', () => {
    test('emits tool:started event', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.eventstart',
          name: 'Event Start',
          execute: async () => 'done',
        });

        let eventData = null;
        events.on('tool:started', (data) => { eventData = data; });

        await toolbox.run('test.eventstart', { x: 1 });
        await new Promise(r => setTimeout(r, 50));

        return {
          fired: eventData !== null,
          toolId: eventData?.toolId,
          hasParams: eventData?.params !== undefined,
        };
      });

      expect(result.fired).toBe(true);
      expect(result.toolId).toBe('test.eventstart');
      expect(result.hasParams).toBe(true);
    });

    test('emits tool:completed event on success', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.eventcomplete',
          name: 'Event Complete',
          execute: async () => ({ result: 'success' }),
        });

        let eventData = null;
        events.on('tool:completed', (data) => { eventData = data; });

        await toolbox.run('test.eventcomplete', {});
        await new Promise(r => setTimeout(r, 50));

        return {
          fired: eventData !== null,
          toolId: eventData?.toolId,
          hasResult: eventData?.result !== undefined,
        };
      });

      expect(result.fired).toBe(true);
      expect(result.toolId).toBe('test.eventcomplete');
      expect(result.hasResult).toBe(true);
    });

    test('emits tool:failed event on error', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.eventfail',
          name: 'Event Fail',
          execute: async () => { throw new Error('Test error'); },
        });

        let eventData = null;
        events.on('tool:failed', (data) => { eventData = data; });

        try {
          await toolbox.run('test.eventfail', {});
        } catch (e) {
          // Expected
        }
        await new Promise(r => setTimeout(r, 50));

        return {
          fired: eventData !== null,
          toolId: eventData?.toolId,
          hasError: eventData?.error !== undefined,
        };
      });

      expect(result.fired).toBe(true);
      expect(result.toolId).toBe('test.eventfail');
      expect(result.hasError).toBe(true);
    });
  });

  test.describe('Tool History', () => {
    test('records tool executions in history', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.history',
          name: 'History Test',
          execute: async () => 'done',
        });

        await toolbox.run('test.history', { x: 1 });
        await toolbox.run('test.history', { x: 2 });

        const history = toolbox.history();
        return {
          isArray: Array.isArray(history),
          hasEntries: history.length >= 2,
          lastToolId: history[history.length - 1]?.toolId,
        };
      });

      expect(result.isArray).toBe(true);
      expect(result.hasEntries).toBe(true);
      expect(result.lastToolId).toBe('test.history');
    });

    test('history entries include timestamp', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.historyts',
          name: 'History Timestamp',
          execute: async () => 'done',
        });

        await toolbox.run('test.historyts', {});
        const history = toolbox.history();
        const entry = history.find(h => h.toolId === 'test.historyts');

        return {
          hasTimestamp: entry?.timestamp !== undefined,
          isNumber: typeof entry?.timestamp === 'number',
        };
      });

      expect(result.hasTimestamp).toBe(true);
      expect(result.isNumber).toBe(true);
    });

    test('history entries include params and result', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.historydata',
          name: 'History Data',
          execute: async (params) => ({ doubled: params.x * 2 }),
        });

        await toolbox.run('test.historydata', { x: 5 });
        const history = toolbox.history();
        const entry = history.find(h => h.toolId === 'test.historydata');

        return {
          params: entry?.params,
          result: entry?.result,
        };
      });

      expect(result.params).toEqual({ x: 5 });
      expect(result.result).toEqual({ doubled: 10 });
    });

    test('clearHistory() clears execution history', async ({ page }) => {
      const result = await page.evaluate(async () => {
        toolbox.register({
          id: 'test.clearhistory',
          name: 'Clear History',
          execute: async () => 'done',
        });

        await toolbox.run('test.clearhistory', {});
        const before = toolbox.history().length;
        toolbox.clearHistory();
        const after = toolbox.history().length;

        return { before, after };
      });

      expect(result.before).toBeGreaterThan(0);
      expect(result.after).toBe(0);
    });
  });

  test.describe('Built-in Tools', () => {
    test('buffer tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('vector.buffer');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });

    test('dissolve tool is registered', async ({ page }) => {
      const result = await page.evaluate(() => {
        const tool = toolbox.get('vector.dissolve');
        return tool !== undefined;
      });

      expect(result).toBe(true);
    });
  });
});
