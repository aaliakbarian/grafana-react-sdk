import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import { installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off', viewport: { height: 1000, width: 1440 } });

for (const mode of ['none', 'full-reference', 'minimum-scoped'] as const) {
  test(`renders Time series in the ${mode} style experiment`, async ({ page }) => {
    test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
    const session = await authenticateGrafanaFixture(page);
    try {
      const consoleGuard = await installConsoleGuard(page);
      const network = installNetworkEvidence(page);
      await installResourceEvidence(page);
      await page.goto(`/?gate=c&style=${mode}`);
      const panel = page.getByRole('region', { name: 'Time series — predictable pulse' });
      await expect(panel).toBeVisible({ timeout: 15_000 });
      await expect(panel.locator('.uplot')).toBeVisible();
      await expect(panel.getByText('Phase 0 Pulse Signal')).toBeVisible();
      expect(await page.locator('html').getAttribute('data-poc-grafana-style-mode')).toBe(mode);
      const sentinel = await page.getByTestId('host-style-sentinel').evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize };
      });
      expect(sentinel.color).toBe('rgb(23, 36, 62)');
      if (mode === 'full-reference') {
        expect(sentinel.fontSize).toBe('14px');
      } else {
        expect(sentinel.fontSize).toBe('16px');
      }
      const assetRequests = (await network.snapshot()).filter(
        (event) =>
          event.type === 'request' && /\.(?:woff2?|ttf|otf|svg)(?:\?|$)/i.test(event.url)
      );
      const hostOrigin = new URL(page.url()).origin;
      expect(
        assetRequests.every((event) => {
          const url = new URL(event.url);
          return url.origin === hostOrigin && url.pathname.startsWith('/grafana/public/fonts/');
        })
      ).toBe(true);
      expect(await page.locator('iframe').count()).toBe(0);
      await consoleGuard.assertClean();
    } finally {
      await session.cleanup();
    }
  });
}
