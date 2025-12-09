// Spinifex - Versioning UI Tests
// Tests for version history window

import { test, expect } from '@playwright/test';

test.describe('Versioning UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
  });

  test.describe('Window Access', () => {
    test('can open versioning window via windows.openVersioningWindow', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Use the exposed windows object
        await window.sp.windows.openVersioningWindow();
        await new Promise(r => setTimeout(r, 300));

        // Query specifically for the versioning window
        const winbox = document.querySelector('.versioning-window');
        const content = document.querySelector('.versioning-content');
        return {
          hasWinbox: winbox !== null,
          hasContent: content !== null,
          title: winbox?.querySelector('.wb-title')?.textContent || ''
        };
      });

      expect(result.hasWinbox).toBe(true);
      expect(result.hasContent).toBe(true);
      expect(result.title).toContain('Version');
    });

    test('shows "no workspace" message when not connected', async ({ page }) => {
      const result = await page.evaluate(async () => {
        await window.sp.windows.openVersioningWindow();
        await new Promise(r => setTimeout(r, 300));

        const content = document.querySelector('.versioning-content');
        return content?.innerHTML.includes('No workspace connected') || false;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Menu Integration', () => {
    test('Version History menu item exists', async ({ page }) => {
      const result = await page.evaluate(() => {
        const menuOption = document.querySelector('[data-action="ws-versions"]');
        return {
          exists: menuOption !== null,
          text: menuOption?.textContent || ''
        };
      });

      expect(result.exists).toBe(true);
      expect(result.text).toContain('Version History');
    });

    test('clicking menu item opens versioning window', async ({ page }) => {
      const result = await page.evaluate(async () => {
        // Click the menu item
        const menuOption = document.querySelector('[data-action="ws-versions"]');
        menuOption?.click();
        await new Promise(r => setTimeout(r, 500));

        const winbox = document.querySelector('.versioning-window');
        return winbox !== null;
      });

      expect(result).toBe(true);
    });
  });

  test.describe('UI Elements', () => {
    test('versioning window has correct CSS structure', async ({ page }) => {
      const result = await page.evaluate(async () => {
        await window.sp.windows.openVersioningWindow();
        await new Promise(r => setTimeout(r, 300));

        const content = document.querySelector('.versioning-content');
        const emptyState = document.querySelector('.versioning-empty');
        const createSection = document.querySelector('.versioning-create');
        const list = document.querySelector('.versioning-list');

        return {
          hasContent: content !== null,
          hasEmptyState: emptyState !== null,
          hasCreateSection: createSection !== null,
          hasList: list !== null
        };
      });

      expect(result.hasContent).toBe(true);
      // Without a workspace, we expect either empty state, or with workspace we expect create/list
      expect(result.hasEmptyState || result.hasCreateSection || result.hasList).toBe(true);
    });

    test('window can be closed', async ({ page }) => {
      const result = await page.evaluate(async () => {
        await window.sp.windows.openVersioningWindow();
        await new Promise(r => setTimeout(r, 300));

        // Find and click close button
        const closeBtn = document.querySelector('.versioning-window .wb-close');
        closeBtn?.click();
        await new Promise(r => setTimeout(r, 200));

        const winbox = document.querySelector('.versioning-window');
        return winbox === null;
      });

      expect(result).toBe(true);
    });
  });
});
