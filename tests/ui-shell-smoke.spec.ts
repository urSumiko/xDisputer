// @ts-nocheck
import { test, expect } from '@playwright/test';

const authStatePath = process.env.E2E_AUTH_STATE || '';
const managerRoutes = [
  '/admin?xdisputerDebug=panel',
  '/manager-workspace?xdisputerDebug=panel',
  '/admin/access?xdisputerDebug=panel',
  '/admin/reports?xdisputerDebug=panel',
  '/admin/audit?xdisputerDebug=panel'
];
const masterRoutes = [
  '/master?xdisputerDebug=panel',
  '/master/accounts?xdisputerDebug=panel',
  '/master/workspaces?xdisputerDebug=panel',
  '/master/reports?xdisputerDebug=panel',
  '/master/audit?xdisputerDebug=panel',
  '/master/system?xdisputerDebug=panel',
  '/master/recovery?xdisputerDebug=panel'
];

test.use(authStatePath ? { storageState: authStatePath } : {});

async function seedExecutionSnapshot(page) {
  await page.evaluate(() => {
    const detail = {
      status: 'rendered',
      round: '1st Round',
      outputs: 3,
      warnings: 1,
      engines: ['dynamic-template-v2', 'legacy-renderer-adapter'],
      missingSlots: [],
      generatedAt: new Date().toISOString(),
      summary: 'Smoke-seeded TemplateExecutionOrchestrator snapshot.'
    };
    window.__xdisputerTemplateExecution = detail;
    window.dispatchEvent(new CustomEvent('xdisputer:template-execution', { detail }));
  });
}

async function assertShell(page, route) {
  test.skip(!authStatePath, 'Set E2E_AUTH_STATE to a Playwright storage-state JSON file for authenticated shell smoke audit.');
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-console-shell="true"]')).toHaveCount(1);
  await expect(page.locator('[data-console-sidebar="true"]')).toHaveCount(1);
  await expect(page.locator('[data-console-account-menu="true"]')).toHaveCount(1);
  await expect(page.locator('[data-xdisputer-debugger]')).toHaveCount(1);
  await expect(page.locator('[data-xdisputer-debugger="open"]')).toHaveCount(1);

  const debug = await page.evaluate(() => window.__xdisputerDebug ?? null);
  expect(debug, 'Render debugger snapshot must be populated').toBeTruthy();
  expect(debug.renderedShell).toBe('ConsoleShell');
  expect(debug.renderedSidebar).toBe('ConsoleSidebar');
  expect(debug.renderedAccountMenu).toBe('AccountMenu');

  await seedExecutionSnapshot(page);
  await expect(page.locator('.xdisputer-render-debugger-execution')).toContainText('dynamic-template-v2');
  await expect(page.locator('.xdisputer-render-debugger-execution')).toContainText('legacy-renderer-adapter');

  const screenshotName = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  await expect(page).toHaveScreenshot(`${screenshotName}.png`, { fullPage: true });
}

test.describe('UI shell smoke audit', () => {
  for (const route of managerRoutes) test(`manager ${route}`, async ({ page }) => assertShell(page, route));
  for (const route of masterRoutes) test(`master ${route}`, async ({ page }) => assertShell(page, route));
});
