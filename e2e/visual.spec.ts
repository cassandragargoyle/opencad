/**
 * T-VIS: Visual Regression Tests
 *
 * Uses Playwright screenshot comparison to catch unintended UI regressions.
 * Baselines live in e2e/visual.spec.ts-snapshots/ and are rendered inside the
 * official Playwright Docker image, the same environment CI runs in — fonts
 * and rasterisation differ between hosts, so never regenerate them natively.
 *
 * To update baselines after intentional UI changes (from the repo root, after
 * `pnpm build:browser`):
 *   pnpm test:e2e:visual:update
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import { waitForAppReady } from './helpers';

const VIEWPORT = { width: 1440, height: 900 };

test.use({ viewport: VIEWPORT });

// Baselines are Chromium renders from the Playwright container; a native host
// or another browser would never match them.
test.skip(
  !process.env.PW_CONTAINER,
  'Visual tests run in the Playwright container — pnpm test:e2e:visual'
);
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual baselines are Chromium-only');

/** Regions whose content changes between runs (timers, frame rate, GPU canvases). */
function dynamicRegions(page: Page): Locator[] {
  return [page.locator('canvas'), page.locator('.status-fps'), page.locator('.last-synced')];
}

const SCREENSHOT = { maxDiffPixelRatio: 0.005, animations: 'disabled', caret: 'hide' } as const;

test.beforeEach(async ({ page }) => {
  await waitForAppReady(page);
});

test.describe('T-VIS-001: App shell layout', () => {
  test('light theme — default 3D view', async ({ page }) => {
    await expect(page).toHaveScreenshot('app-light-3d.png', {
      ...SCREENSHOT,
      mask: dynamicRegions(page),
    });
  });

  test('dark theme', async ({ page }) => {
    await page.locator('[title="Toggle light/dark theme"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page).toHaveScreenshot('app-dark-3d.png', {
      ...SCREENSHOT,
      mask: dynamicRegions(page),
    });
  });

  test('floor plan view', async ({ page }) => {
    await page.locator('.toolbar-tabs .tab-btn:has-text("Floor Plan")').click();
    await expect(page.locator('.toolbar-tabs .tab-btn.active')).toHaveText('Floor Plan');
    await expect(page).toHaveScreenshot('app-light-floor-plan.png', {
      ...SCREENSHOT,
      mask: dynamicRegions(page),
    });
  });

  test('section view', async ({ page }) => {
    await page.locator('.toolbar-tabs .tab-btn:has-text("Section")').click();
    await expect(page.locator('.toolbar-tabs .tab-btn.active')).toHaveText('Section');
    await expect(page).toHaveScreenshot('app-light-section.png', {
      ...SCREENSHOT,
      mask: dynamicRegions(page),
    });
  });
});

test.describe('T-VIS-002: Panels and overlays', () => {
  test('AI chat panel open', async ({ page }) => {
    await page.locator('[title="AI Assistant"]').click();
    await expect(page.locator('.ai-chat-panel')).toBeVisible();
    await expect(page.locator('.ai-chat-panel')).toHaveScreenshot('ai-chat-panel.png', SCREENSHOT);
  });

  test('import modal', async ({ page }) => {
    await page.locator('[title="Import IFC"]').click();
    // Element shot: a full-page mask over the viewport canvas would hide the modal.
    await expect(page.locator('.modal-content')).toHaveScreenshot('import-modal.png', SCREENSHOT);
  });

  test('export modal', async ({ page }) => {
    await page.locator('[title="Export IFC"]').click();
    await expect(page.locator('.modal-content')).toHaveScreenshot('export-modal.png', SCREENSHOT);
  });
});

test.describe('T-VIS-003: ToolShelf', () => {
  test('toolshelf default state', async ({ page }) => {
    await expect(page.locator('.app-toolshelf-container')).toHaveScreenshot(
      'toolshelf-default.png',
      SCREENSHOT
    );
  });

  test('toolshelf with the wall tool active', async ({ page }) => {
    await page.locator('.app-main').click();
    await page.keyboard.press('w');
    await expect(page.locator('.tool-btn.active[title^="Wall"]')).toBeVisible();
    await expect(page.locator('.app-toolshelf-container')).toHaveScreenshot(
      'toolshelf-wall-active.png',
      SCREENSHOT
    );
  });
});

test.describe('T-VIS-004: Status bar', () => {
  test('status bar online state', async ({ page }) => {
    await expect(page.locator('.app-status-bar')).toHaveScreenshot('status-bar-online.png', {
      ...SCREENSHOT,
      maxDiffPixelRatio: 0.01,
      mask: dynamicRegions(page),
    });
  });
});
