import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off', viewport: { height: 1000, width: 1440 } });

test('renders the real transformed query-backed Time series panel', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    const query = page.waitForRequest(
      (request) =>
        request.url().includes('/grafana/api/ds/query') &&
        request.headers()['x-panel-id'] === '3'
    );

    await page.goto('/?gate=c');
    const request = await query;
    const panel = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('canvas')).not.toHaveCount(0);

    const body = request.postDataJSON() as {
      from?: string;
      queries?: Array<{ refId?: string; scenarioId?: string }>;
      to?: string;
    };
    expect(body.from).toMatch(/^\d+$/);
    expect(body.to).toMatch(/^\d+$/);
    expect(Number(body.to) - Number(body.from)).toBeGreaterThanOrEqual(3_500_000);
    expect(body.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ refId: 'A', scenarioId: 'predictable_pulse' }),
      ])
    );
    expect(request.headers()['x-panel-plugin-id']).toBe('timeseries');

    const inspection = await page.evaluate(async () => {
      const path = '/src/App.tsx';
      const module = await import(/* @vite-ignore */ path);
      return module.inspectGateCHost();
    });
    if (!inspection.timeseriesScene) {
      throw new Error(`Time series scene was not inspectable: ${JSON.stringify(inspection)}`);
    }
    if (inspection.timeseriesScene.fieldDisplayName !== 'Phase 0 Pulse Signal') {
      throw new Error(
        `Time series transform state: ${JSON.stringify({ executions: inspection.transformerExecutions, registry: inspection.transformerRegistry, scene: inspection.timeseriesScene })}`
      );
    }
    await expect(panel.getByText('Phase 0 Pulse Signal')).toBeVisible();
    expect(inspection.timeseriesPlugin).toMatchObject({
      id: 'timeseries',
      module: 'poc-p2:public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
      version: '13.2.3',
    });
    expect(inspection.timeseriesScene).toMatchObject({
      fieldDisplayName: 'Phase 0 Pulse Signal',
      fieldConfig: {
        defaults: {
          color: { mode: 'palette-classic' },
          custom: {
            axisPlacement: 'auto',
            drawStyle: 'line',
            fillOpacity: 15,
            lineInterpolation: 'linear',
            lineWidth: 2,
            pointSize: 5,
            showPoints: 'auto',
            thresholdsStyle: { mode: 'line' },
          },
          max: 100,
          min: 0,
          thresholds: {
            mode: 'absolute',
            steps: [
              // Grafana normalizes the JSON sentinel null to the runtime lower bound.
              { color: 'green', value: Number.NEGATIVE_INFINITY },
              { color: 'red', value: 80 },
            ],
          },
          unit: 'percent',
        },
      },
      fillOpacity: 15,
      lineWidth: 2,
      options: {
        legend: { displayMode: 'list', placement: 'bottom', showLegend: true },
        tooltip: { hideZeros: false, mode: 'single', sort: 'none' },
      },
      unit: 'percent',
    });
    expect(inspection.runtime.initializationSteps).toEqual(
      expect.arrayContaining(['timeseries-transformers-installed'])
    );
    expect(inspection.transformerExecutions).toBeGreaterThan(0);

    const refreshed = page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/grafana/api/ds/query') &&
        candidate.request().headers()['x-panel-plugin-id'] === 'timeseries' &&
        candidate.ok()
    );
    await page.getByTestId('gate-c-refresh').click();
    await refreshed;

    const ranged = page.waitForResponse(
      (candidate) => {
        if (
          !candidate.url().includes('/grafana/api/ds/query') ||
          candidate.request().headers()['x-panel-plugin-id'] !== 'timeseries' ||
          !candidate.ok()
        ) {
          return false;
        }
        const payload = candidate.request().postDataJSON() as { from?: string; to?: string };
        return Number(payload.to) - Number(payload.from) <= 910_000;
      }
    );
    await page.getByTestId('gate-c-time-range').click();
    const rangeRequest = (await ranged).request();
    const rangeBody = rangeRequest.postDataJSON() as { from: string; to: string };
    expect(Number(rangeBody.to) - Number(rangeBody.from)).toBeLessThanOrEqual(910_000);
    expect(Number(rangeBody.to) - Number(rangeBody.from)).toBeGreaterThanOrEqual(890_000);

    const plot = panel.locator('.uplot');
    const beforeResize = await plot.boundingBox();
    expect(beforeResize?.width).toBeGreaterThan(700);
    await page.getByTestId('gate-c-resize').click();
    await expect(page.getByTestId('grafana-dashboard-root')).toHaveCSS('width', '600px');
    await expect
      .poll(async () => (await plot.boundingBox())?.width ?? 0)
      .toBeLessThan(600);
    const afterResize = await plot.boundingBox();
    expect(afterResize?.width).toBeLessThan(beforeResize?.width ?? 0);
    const resizeEvents = await page.evaluate(() =>
      (
        globalThis as typeof globalThis & {
          __POC_RESOURCE_EVIDENCE__?: {
            resizeObserverEvents(): Array<{ entries?: number; event: string }>;
          };
        }
      ).__POC_RESOURCE_EVIDENCE__?.resizeObserverEvents() ?? []
    );
    expect(resizeEvents.some((event) => event.event === 'delivery' && (event.entries ?? 0) > 0)).toBe(
      true
    );

    const canvas = panel.locator('canvas').first();
    const legendSelector = panel.getByRole('button', { name: 'All series selected' });
    await expect(legendSelector).toBeVisible();
    await legendSelector.focus();
    await expect(legendSelector).toBeFocused();
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    }
    await expect(panel.getByText('Phase 0 Pulse Signal')).toBeVisible();
    expect(
      (await networkEvidence.snapshot()).filter(
        (event) => event.type === 'request' && event.url.includes('/grafana/api/ds/query')
      ).length
    ).toBeGreaterThanOrEqual(2);
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.getByRole('navigation').count()).toBe(0);
    expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe('/?gate=c');
    await consoleGuard.assertClean();

    await page.evaluate(async () => {
      const path = '/src/main.tsx';
      const module = await import(/* @vite-ignore */ path);
      module.unmountPocHost();
      await Promise.resolve();
    });
    const released = await captureResourceEvidence(page, 'gate-c-primary-released');
    expect(released.dom).toMatchObject({ iframeElements: 0, portalRoots: 0 });
    expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);
  } finally {
    await session.cleanup();
  }
});
