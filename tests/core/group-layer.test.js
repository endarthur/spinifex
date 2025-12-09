// Spinifex - GroupLayer Tests
// TDD tests for src/core/group-layer.js

import { test, expect } from '@playwright/test';

test.describe('GroupLayer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Creation', () => {
    test('sp.group() creates an empty GroupLayer', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('my-group');
        return {
          exists: group !== undefined,
          name: group?.name,
          type: group?.type,
          childCount: group?.children?.length ?? 0,
        };
      });

      expect(result.exists).toBe(true);
      expect(result.name).toBe('my-group');
      expect(result.type).toBe('group');
      expect(result.childCount).toBe(0);
    });

    test('sp.group() creates group with initial children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'tile1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'tile2');
        const group = sp.group('with-children', [layer1, layer2]);
        return {
          childCount: group?.children?.length ?? 0,
          childNames: group?.children?.map(c => c.name) ?? [],
        };
      });

      expect(result.childCount).toBe(2);
      expect(result.childNames).toContain('tile1');
      expect(result.childNames).toContain('tile2');
    });

    test('GroupLayer is added to ly namespace', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const group = sp.group('ns-test');
        await new Promise(r => setTimeout(r, 100));
        return { inLy: window.ly['ns-test'] === group };
      });

      expect(result.inLy).toBe(true);
    });
  });

  test.describe('Child Management', () => {
    test('add() adds a layer to the group', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('add-test');
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'child1');
        group.add(layer);
        return {
          childCount: group.children.length,
          hasChild: group.children.includes(layer),
        };
      });

      expect(result.childCount).toBe(1);
      expect(result.hasChild).toBe(true);
    });

    test('removeChild() removes a layer from the group', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'remove-child');
        const group = sp.group('remove-test', [layer]);
        const beforeCount = group.children.length;
        group.removeChild(layer);
        return {
          beforeCount,
          afterCount: group.children.length,
        };
      });

      expect(result.beforeCount).toBe(1);
      expect(result.afterCount).toBe(0);
    });

    test('clear() removes all children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'clear1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'clear2');
        const group = sp.group('clear-test', [layer1, layer2]);
        const beforeCount = group.children.length;
        group.clear();
        return {
          beforeCount,
          afterCount: group.children.length,
        };
      });

      expect(result.beforeCount).toBe(2);
      expect(result.afterCount).toBe(0);
    });

    test('has() checks if layer is in group', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'has1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'has2');
        const group = sp.group('has-test', [layer1]);
        return {
          hasLayer1: group.has(layer1),
          hasLayer2: group.has(layer2),
        };
      });

      expect(result.hasLayer1).toBe(true);
      expect(result.hasLayer2).toBe(false);
    });
  });

  test.describe('Visibility', () => {
    test('show() shows all children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'show1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'show2');
        const group = sp.group('show-test', [layer1, layer2]);
        group.hide();
        group.show();
        return {
          groupVisible: group.visible,
          child1Visible: layer1.visible,
          child2Visible: layer2.visible,
        };
      });

      expect(result.groupVisible).toBe(true);
      expect(result.child1Visible).toBe(true);
      expect(result.child2Visible).toBe(true);
    });

    test('hide() hides all children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'hide1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'hide2');
        const group = sp.group('hide-test', [layer1, layer2]);
        group.hide();
        return {
          groupVisible: group.visible,
          child1Visible: layer1.visible,
          child2Visible: layer2.visible,
        };
      });

      expect(result.groupVisible).toBe(false);
      expect(result.child1Visible).toBe(false);
      expect(result.child2Visible).toBe(false);
    });
  });

  test.describe('Opacity', () => {
    test('opacity() affects all children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'op1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'op2');
        const group = sp.group('opacity-test', [layer1, layer2]);
        group.opacity(0.5);
        return {
          groupOpacity: group.opacity(),
          child1Opacity: layer1.opacity(),
          child2Opacity: layer2.opacity(),
        };
      });

      expect(result.groupOpacity).toBe(0.5);
      expect(result.child1Opacity).toBe(0.5);
      expect(result.child2Opacity).toBe(0.5);
    });
  });

  test.describe('Z-Index', () => {
    test('zIndex() sets z-index for all children relative to group', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'z1');
        const layer2 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'z2');
        layer1.zIndex(5);
        layer2.zIndex(10);
        const group = sp.group('zindex-test', [layer1, layer2]);
        group.zIndex(100);
        return {
          groupZ: group.zIndex(),
          // Children should be offset from group z-index
          child1Z: layer1.zIndex(),
          child2Z: layer2.zIndex(),
        };
      });

      expect(result.groupZ).toBe(100);
      // Children should maintain relative order within group
      expect(result.child1Z).toBeLessThan(result.child2Z);
    });

    test('bringToFront() moves entire group to top', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile('https://example.com/{z}/{x}/{y}.png', 'front1');
        const group = sp.group('front-test', [layer1]);
        const other = sp.tile('https://example.com/{z}/{x}/{y}.png', 'other-layer');
        other.zIndex(50);
        group.bringToFront();
        return {
          groupZ: group.zIndex(),
          otherZ: other.zIndex(),
          groupAboveOther: group.zIndex() > other.zIndex(),
        };
      });

      expect(result.groupAboveOther).toBe(true);
    });
  });

  test.describe('Nested Groups', () => {
    test('groups can contain other groups', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'nested-layer');
        const innerGroup = sp.group('inner', [layer]);
        const outerGroup = sp.group('outer', [innerGroup]);
        return {
          outerChildCount: outerGroup.children.length,
          innerChildCount: innerGroup.children.length,
          innerIsGroup: innerGroup.type === 'group',
        };
      });

      expect(result.outerChildCount).toBe(1);
      expect(result.innerChildCount).toBe(1);
      expect(result.innerIsGroup).toBe(true);
    });

    test('hide on parent hides nested children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'deep-layer');
        const innerGroup = sp.group('inner-vis', [layer]);
        const outerGroup = sp.group('outer-vis', [innerGroup]);
        outerGroup.hide();
        return {
          layerVisible: layer.visible,
          innerVisible: innerGroup.visible,
          outerVisible: outerGroup.visible,
        };
      });

      expect(result.outerVisible).toBe(false);
      expect(result.innerVisible).toBe(false);
      expect(result.layerVisible).toBe(false);
    });
  });

  test.describe('Expand/Collapse', () => {
    test('expanded property defaults to true', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('expand-default');
        return group.expanded;
      });

      expect(result).toBe(true);
    });

    test('collapse() sets expanded to false', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('collapse-test');
        group.collapse();
        return group.expanded;
      });

      expect(result).toBe(false);
    });

    test('expand() sets expanded to true', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('expand-test');
        group.collapse();
        group.expand();
        return group.expanded;
      });

      expect(result).toBe(true);
    });

    test('toggle() toggles expanded state', async ({ page }) => {
      const result = await page.evaluate(() => {
        const group = sp.group('toggle-test');
        const before = group.expanded;
        group.toggle();
        const after1 = group.expanded;
        group.toggle();
        const after2 = group.expanded;
        return { before, after1, after2 };
      });

      expect(result.before).toBe(true);
      expect(result.after1).toBe(false);
      expect(result.after2).toBe(true);
    });
  });

  test.describe('Zoom', () => {
    test('zoom() zooms to combined extent of children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer1 = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'zoom1',
          extent: [0, 0, 100, 100],
        });
        const layer2 = sp.tile({
          url: 'https://example.com/{z}/{x}/{y}.png',
          name: 'zoom2',
          extent: [50, 50, 150, 150],
        });
        const group = sp.group('zoom-test', [layer1, layer2]);
        // Should not throw
        try {
          group.zoom();
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Serialization', () => {
    test('toJSON() includes children', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'json-child');
        const group = sp.group('json-test', [layer]);
        group.opacity(0.8);
        return group.toJSON();
      });

      expect(result.name).toBe('json-test');
      expect(result.type).toBe('group');
      expect(result.opacity).toBe(0.8);
      expect(result.children).toBeDefined();
      expect(result.children.length).toBe(1);
      expect(result.children[0].name).toBe('json-child');
    });
  });

  test.describe('Removal', () => {
    test('remove() removes group and keeps children', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'kept-layer');
        const group = sp.group('remove-group', [layer]);
        // Wait for both layer and group to be registered in ly
        await new Promise(r => setTimeout(r, 300));

        const groupInLyBefore = 'remove-group' in window.ly;
        const layerInLyBefore = 'kept-layer' in window.ly;

        group.remove();
        await new Promise(r => setTimeout(r, 200));

        return {
          groupInLyBefore,
          layerInLyBefore,
          groupInLyAfter: 'remove-group' in window.ly,
          layerInLyAfter: 'kept-layer' in window.ly,
          layerStillVisible: layer.visible,
        };
      });

      expect(result.groupInLyBefore).toBe(true);
      expect(result.layerInLyBefore).toBe(true);
      expect(result.groupInLyAfter).toBe(false);
      // Child layer should still exist after group removal
      expect(result.layerInLyAfter).toBe(true);
    });

    test('remove(true) removes group and all children', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const layer = sp.tile('https://example.com/{z}/{x}/{y}.png', 'removed-with-group');
        const group = sp.group('remove-all', [layer]);
        await new Promise(r => setTimeout(r, 300));

        group.remove(true);  // true = remove children too
        await new Promise(r => setTimeout(r, 200));

        return {
          groupInLy: 'remove-all' in window.ly,
          layerInLy: 'removed-with-group' in window.ly,
        };
      });

      expect(result.groupInLy).toBe(false);
      expect(result.layerInLy).toBe(false);
    });
  });
});
