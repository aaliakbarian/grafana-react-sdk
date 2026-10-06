import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

const user = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;

test.use({ locale: 'en-US', trace: 'off' });

test('retrieves both V1 dashboards by Grafana UID through the host proxy', async ({ page }) => {
  test.skip(!user || !password, 'local disposable Grafana fixture credentials are required');

  const login = await page.request.post('/grafana/login', {
    data: { user, password },
  });
  expect(login.status()).toBe(200);

  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const evidencePath = '/@fs/workspace/packages/poc-compat/src/runtime/runtimeIdentity.ts';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const evidenceModule = await import(/* @vite-ignore */ evidencePath);
    const runtimeEvidence = evidenceModule.createRuntimeEvidenceRecorder();
    const request = window.fetch.bind(window);
    const config = {
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task6-empty-catalog', panelIds: [] },
      request,
      theme: 'light',
      timezone: 'browser',
    };

    const first = await runtime.acquirePocRuntime(config, runtimeEvidence);
    const second = await runtime.acquirePocRuntime(config, runtimeEvidence);
    const primary = await first.dashboardClient.loadByUid('grsdk-phase0-poc');
    const alternate = await second.dashboardClient.loadByUid('grsdk-phase0-poc-alt');
    const transportEvidence = first.transportEvidence.snapshot();
    const during = runtime.inspectPocRuntime();
    first.release();
    second.release();

    return {
      after: runtime.inspectPocRuntime(),
      alternate: {
        apiVersion: alternate.dto.apiVersion,
        metadataName: alternate.dto.metadata.name,
        panelCount: alternate.dto.spec.panels.length,
        schemaVersion: alternate.dto.spec.schemaVersion,
      },
      during,
      iframeCount: document.querySelectorAll('iframe').length,
      location: `${location.pathname}${location.search}${location.hash}`,
      primary: {
        apiVersion: primary.dto.apiVersion,
        family: primary.family,
        metadataName: primary.dto.metadata.name,
        panelCount: primary.dto.spec.panels.length,
        schemaVersion: primary.dto.spec.schemaVersion,
        v2Available: primary.v2Available,
      },
      runtimeEvidence: runtimeEvidence.snapshot(),
      sameDashboardClient: first.dashboardClient === second.dashboardClient,
      transportEvidence,
    };
  });

  expect(result.primary).toEqual({
    apiVersion: 'dashboard.grafana.app/v1',
    family: 'v1',
    metadataName: 'grsdk-phase0-poc',
    panelCount: 4,
    schemaVersion: 42,
    v2Available: true,
  });
  expect(result.alternate).toEqual({
    apiVersion: 'dashboard.grafana.app/v1',
    metadataName: 'grsdk-phase0-poc-alt',
    panelCount: 1,
    schemaVersion: 42,
  });
  expect(result).toMatchObject({
    after: { activeLeases: 0, status: 'ready' },
    during: { activeLeases: 2, status: 'ready' },
    iframeCount: 0,
    location: '/',
    sameDashboardClient: true,
  });
  expect(result.during.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(result.transportEvidence).toEqual([
    expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /Bearer |authorization|cookie|password|service.?account|responseBody/i
  );

  const browserNetwork = await networkEvidence.snapshot();
  const dashboardRequests = browserNetwork.filter(
    (entry) => entry.type === 'request' && entry.url.includes('/grafana/apis/dashboard.grafana.app/')
  );
  expect(dashboardRequests.map((entry) => entry.url)).toEqual([
    'http://localhost:5173/grafana/apis/dashboard.grafana.app/',
    'http://localhost:5173/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto',
    'http://localhost:5173/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto',
  ]);
  expect(JSON.stringify(browserNetwork)).not.toContain('/api/dashboards/uid/');

  const resources = await captureResourceEvidence(page, 'task6-dashboard-api-released');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
  expect(resources.dom.portalRoots).toBe(0);
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);

  await networkEvidence.write('artifacts/playwright/task-6-dashboard-network.json');
  await mkdir('artifacts/playwright', { recursive: true });
  await writeFile(
    'artifacts/playwright/task-6-dashboard-transport.json',
    `${JSON.stringify(result.transportEvidence, null, 2)}\n`,
    'utf8'
  );
  await writeResourceEvidence('artifacts/playwright/task-6-dashboard-resources.json', [resources]);
  await consoleGuard.assertClean();
});

test('classifies a real unauthenticated discovery response without retaining credentials', async ({ page }) => {
  const consoleGuard = await installConsoleGuard(page, [
    {
      justification: 'Chromium reports the deliberately exercised Grafana 401 as a resource error.',
      pattern: /console-error: Failed to load resource:.*401 \(Unauthorized\)/,
    },
  ]);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const lease = await runtime.acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task6-empty-catalog', panelIds: [] },
      request: window.fetch.bind(window),
      theme: 'light',
      timezone: 'browser',
    });
    let failure: Record<string, unknown> = {};
    try {
      await lease.dashboardClient.loadByUid('grsdk-phase0-poc');
    } catch (error) {
      const candidate = error as { code?: string; stage?: string; status?: number };
      failure = { code: candidate.code, stage: candidate.stage, status: candidate.status };
    }
    const transportEvidence = lease.transportEvidence.snapshot();
    lease.release();
    return { failure, iframeCount: document.querySelectorAll('iframe').length, transportEvidence };
  });

  expect(result).toMatchObject({
    failure: { code: 'dashboard-unauthorized', stage: 'discovery', status: 401 },
    iframeCount: 0,
    transportEvidence: [
      expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'http-error', status: 401 }),
    ],
  });
  expect(JSON.stringify(result)).not.toMatch(/authorization|cookie|password|responseBody/i);
  await consoleGuard.assertClean();
});

test('cancels stale browser work through AbortSignal without an iframe or navigation', async ({ page }) => {
  const consoleGuard = await installConsoleGuard(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const adapterPath = '/@fs/workspace/packages/poc-compat/src/network/backendSrvAdapter.ts';
    const dashboardPath = '/@fs/workspace/packages/poc-compat/src/dashboard/loadDashboardV1.ts';
    const adapter = await import(/* @vite-ignore */ adapterPath);
    const dashboard = await import(/* @vite-ignore */ dashboardPath);
    const evidence = adapter.createTransportEvidenceRecorder();
    const request: typeof fetch = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      });
    const backendSrv = adapter.createPocBackendSrv({
      evidence,
      grafanaBasePath: '/grafana',
      request,
    });
    const client = dashboard.createPocDashboardClient({
      backendSrv,
      namespace: 'default',
      runtimeFingerprint: 'task6-browser-cancellation',
    });
    const controller = new AbortController();
    const pending = client.loadByUid('grsdk-phase0-poc', { signal: controller.signal });
    controller.abort();
    let failure: Record<string, unknown> = {};
    try {
      await pending;
    } catch (error) {
      const candidate = error as { code?: string; stage?: string };
      failure = { code: candidate.code, stage: candidate.stage };
    }
    return {
      evidence: evidence.snapshot(),
      failure,
      iframeCount: document.querySelectorAll('iframe').length,
      location: `${location.pathname}${location.search}${location.hash}`,
    };
  });

  expect(result).toMatchObject({
    evidence: [expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'cancelled' })],
    failure: { code: 'cancelled', stage: 'discovery' },
    iframeCount: 0,
    location: '/',
  });
  await consoleGuard.assertClean();
});
