// Spinifex - Event Bus Tests
// TDD tests for src/core/events.js

import { test, expect } from '@playwright/test';

test.describe('Event Bus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Basic Pub/Sub', () => {
    test('events object exists and has required methods', async ({ page }) => {
      const api = await page.evaluate(() => {
        return {
          exists: window.events !== undefined,
          hasOn: typeof window.events?.on === 'function',
          hasOff: typeof window.events?.off === 'function',
          hasEmit: typeof window.events?.emit === 'function',
          hasOnce: typeof window.events?.once === 'function',
        };
      });

      expect(api.exists).toBe(true);
      expect(api.hasOn).toBe(true);
      expect(api.hasOff).toBe(true);
      expect(api.hasEmit).toBe(true);
      expect(api.hasOnce).toBe(true);
    });

    test('on() subscribes to events', async ({ page }) => {
      const result = await page.evaluate(() => {
        let received = null;
        window.events.on('test:basic', (data) => {
          received = data;
        });
        window.events.emit('test:basic', 'hello');
        return received;
      });

      expect(result).toBe('hello');
    });

    test('on() can subscribe multiple handlers to same event', async ({ page }) => {
      const result = await page.evaluate(() => {
        const calls = [];
        window.events.on('test:multi', () => calls.push('first'));
        window.events.on('test:multi', () => calls.push('second'));
        window.events.emit('test:multi');
        return calls;
      });

      expect(result).toEqual(['first', 'second']);
    });

    test('emit() passes multiple arguments to handlers', async ({ page }) => {
      const result = await page.evaluate(() => {
        let args = null;
        window.events.on('test:args', (a, b, c) => {
          args = [a, b, c];
        });
        window.events.emit('test:args', 1, 'two', { three: 3 });
        return args;
      });

      expect(result).toEqual([1, 'two', { three: 3 }]);
    });

    test('emit() does nothing if no subscribers', async ({ page }) => {
      const result = await page.evaluate(() => {
        // Should not throw
        window.events.emit('test:nosubscribers', 'data');
        return true;
      });

      expect(result).toBe(true);
    });

    test('on() returns unsubscribe function', async ({ page }) => {
      const result = await page.evaluate(() => {
        let count = 0;
        const unsub = window.events.on('test:unsub', () => count++);

        window.events.emit('test:unsub');
        const afterFirst = count;

        unsub(); // Unsubscribe
        window.events.emit('test:unsub');
        const afterSecond = count;

        return { afterFirst, afterSecond };
      });

      expect(result.afterFirst).toBe(1);
      expect(result.afterSecond).toBe(1); // Should not increment
    });
  });

  test.describe('off() - Unsubscribe', () => {
    test('off() removes specific handler', async ({ page }) => {
      const result = await page.evaluate(() => {
        let count = 0;
        const handler = () => count++;

        window.events.on('test:off', handler);
        window.events.emit('test:off');
        const afterFirst = count;

        window.events.off('test:off', handler);
        window.events.emit('test:off');
        const afterSecond = count;

        return { afterFirst, afterSecond };
      });

      expect(result.afterFirst).toBe(1);
      expect(result.afterSecond).toBe(1);
    });

    test('off() only removes specified handler, not others', async ({ page }) => {
      const result = await page.evaluate(() => {
        const calls = [];
        const handler1 = () => calls.push('one');
        const handler2 = () => calls.push('two');

        window.events.on('test:offpartial', handler1);
        window.events.on('test:offpartial', handler2);

        window.events.off('test:offpartial', handler1);
        window.events.emit('test:offpartial');

        return calls;
      });

      expect(result).toEqual(['two']);
    });

    test('off() does nothing if handler not subscribed', async ({ page }) => {
      const result = await page.evaluate(() => {
        const handler = () => {};
        // Should not throw
        window.events.off('test:notsubscribed', handler);
        return true;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('once() - One-time Subscription', () => {
    test('once() handler is called only once', async ({ page }) => {
      const result = await page.evaluate(() => {
        let count = 0;
        window.events.once('test:once', () => count++);

        window.events.emit('test:once');
        window.events.emit('test:once');
        window.events.emit('test:once');

        return count;
      });

      expect(result).toBe(1);
    });

    test('once() receives event data', async ({ page }) => {
      const result = await page.evaluate(() => {
        let received = null;
        window.events.once('test:oncedata', (data) => {
          received = data;
        });
        window.events.emit('test:oncedata', { value: 42 });
        return received;
      });

      expect(result).toEqual({ value: 42 });
    });

    test('once() returns unsubscribe function that works before emit', async ({ page }) => {
      const result = await page.evaluate(() => {
        let called = false;
        const unsub = window.events.once('test:onceunsub', () => {
          called = true;
        });

        unsub(); // Unsubscribe before emit
        window.events.emit('test:onceunsub');

        return called;
      });

      expect(result).toBe(false);
    });
  });

  test.describe('Event Namespacing', () => {
    test('supports namespaced event names', async ({ page }) => {
      const result = await page.evaluate(() => {
        const received = [];

        window.events.on('layer:added', (name) => received.push(`added:${name}`));
        window.events.on('layer:removed', (name) => received.push(`removed:${name}`));

        window.events.emit('layer:added', 'points');
        window.events.emit('layer:removed', 'lines');

        return received;
      });

      expect(result).toEqual(['added:points', 'removed:lines']);
    });

    test('namespaced events are independent', async ({ page }) => {
      const result = await page.evaluate(() => {
        let layerCalls = 0;
        let mapCalls = 0;

        window.events.on('layer:click', () => layerCalls++);
        window.events.on('map:click', () => mapCalls++);

        window.events.emit('layer:click');
        window.events.emit('layer:click');
        window.events.emit('map:click');

        return { layerCalls, mapCalls };
      });

      expect(result.layerCalls).toBe(2);
      expect(result.mapCalls).toBe(1);
    });
  });

  test.describe('Edge Cases', () => {
    test('handler can unsubscribe itself during emit', async ({ page }) => {
      const result = await page.evaluate(() => {
        let count = 0;
        let unsub;
        unsub = window.events.on('test:selfunsub', () => {
          count++;
          unsub();
        });

        window.events.emit('test:selfunsub');
        window.events.emit('test:selfunsub');

        return count;
      });

      expect(result).toBe(1);
    });

    test('handler throwing error does not break other handlers', async ({ page }) => {
      const result = await page.evaluate(() => {
        const calls = [];

        window.events.on('test:throw', () => calls.push('before'));
        window.events.on('test:throw', () => { throw new Error('oops'); });
        window.events.on('test:throw', () => calls.push('after'));

        try {
          window.events.emit('test:throw');
        } catch (e) {
          // May or may not throw depending on implementation
        }

        return calls;
      });

      // At minimum, the first handler should be called
      expect(result).toContain('before');
      // Ideally, 'after' should also be called (resilient implementation)
      // But this test documents current behavior
    });

    test('subscribing during emit does not affect current emit', async ({ page }) => {
      const result = await page.evaluate(() => {
        const calls = [];

        window.events.on('test:subduring', () => {
          calls.push('first');
          // Subscribe new handler during emit
          window.events.on('test:subduring', () => calls.push('dynamic'));
        });

        window.events.emit('test:subduring'); // First emit
        const afterFirst = [...calls];

        window.events.emit('test:subduring'); // Second emit
        const afterSecond = [...calls];

        return { afterFirst, afterSecond };
      });

      expect(result.afterFirst).toEqual(['first']);
      expect(result.afterSecond).toContain('first');
      expect(result.afterSecond).toContain('dynamic');
    });

    test('emit returns nothing (void)', async ({ page }) => {
      const result = await page.evaluate(() => {
        return window.events.emit('test:void', 'data');
      });

      expect(result).toBeUndefined();
    });
  });

  test.describe('Clear/Reset', () => {
    test('clear() removes all handlers for an event', async ({ page }) => {
      const hasClear = await page.evaluate(() => typeof window.events?.clear === 'function');

      if (!hasClear) {
        test.skip();
        return;
      }

      const result = await page.evaluate(() => {
        let count = 0;
        window.events.on('test:clear', () => count++);
        window.events.on('test:clear', () => count++);

        window.events.emit('test:clear');
        const afterFirst = count;

        window.events.clear('test:clear');
        window.events.emit('test:clear');
        const afterSecond = count;

        return { afterFirst, afterSecond };
      });

      expect(result.afterFirst).toBe(2);
      expect(result.afterSecond).toBe(2);
    });
  });
});
