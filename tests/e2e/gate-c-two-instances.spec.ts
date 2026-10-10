import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off', viewport: { height: 1200, width: 1440 } });

test('isolates two compatible dashboard instances sharing one runtime and plugin cache', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    await page.goto('/?gate=c&instances=2');
    const plots = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect.poll(() => plots.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1_000);
    if ((await plots.count()) !== 2) {
      const path = '/src/App.tsx';
      const diagnostic = await page.evaluate(async (modulePath) => {
        const module = await import(/* @vite-ignore */ modulePath);
        return module.inspectGateCHost();
      }, path);
      throw new Error(`Two-instance diagnostic: ${JSON.stringify(diagnostic)}`);
    }
    await expect(plots.nth(0).getByText('Phase 0 Pulse Signal')).toBeVisible();
    await expect(plots.nth(1).getByText('Phase 0 Pulse Signal')).toBeVisible();

    const before = await captureResourceEvidence(page, 'gate-c-two-active');
    expect(before.page.resizeObserver).toBeGreaterThanOrEqual(2);
    const inspection = await page.evaluate(async () => {
      const path = '/src/App.tsx';
      const module = await import(/* @vite-ignore */ path);
      return module.inspectGateCHost();
    });
    expect(inspection.scenes.filter(({ active }: { active: boolean }) => active)).toHaveLength(2);
    expect(
      inspection.pluginEvents.filter(
        (event: { pluginId?: string; type: string }) =>
          event.pluginId === 'timeseries' && event.type === 'success'
      )
    ).toHaveLength(1);
    expect(
      inspection.pluginEvents.some(
        (event: { pluginId?: string; type: string }) =>
          event.pluginId === 'timeseries' && event.type === 'cache-hit'
      )
    ).toBe(true);

    await page.getByTestId('gate-c-toggle-second').click();
    await expect(page.getByTestId('gate-c-instance-secondary')).toHaveCount(0);
    await expect(plots).toHaveCount(1);
    await expect.poll(async () => (await captureResourceEvidence(page, 'one-active')).page.resizeObserver)
      .toBeLessThan(before.page.resizeObserver);
    await expect(plots.getByText('Phase 0 Pulse Signal')).toBeVisible();
    expect(await page.locator('iframe').count()).toBe(0);
    await consoleGuard.assertClean();

    await page.evaluate(async () => {
      const path = '/src/main.tsx';
      const module = await import(/* @vite-ignore */ path);
      module.unmountPocHost();
      await Promise.resolve();
    });
    const released = await captureResourceEvidence(page, 'gate-c-two-released');
    expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);
  } finally {
    await session.cleanup();
  }
});
