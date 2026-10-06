import { expect, test } from '@playwright/test';

import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

test.use({ locale: 'en-US' });

test('initializes and releases the standalone page runtime without shell behavior', async ({ page }) => {
  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const evidencePath = '/@fs/workspace/packages/poc-compat/src/runtime/runtimeIdentity.ts';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const evidenceModule = await import(/* @vite-ignore */ evidencePath);
    const evidence = evidenceModule.createRuntimeEvidenceRecorder();
    const request = window.fetch.bind(window);
    const config = {
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task5-empty-catalog', panelIds: [] },
      request,
      theme: 'light',
      timezone: 'browser',
    };

    const first = await runtime.acquirePocRuntime(config, evidence);
    const second = await runtime.acquirePocRuntime(config, evidence);
    let conflictCode: string | undefined;
    try {
      await runtime.acquirePocRuntime({ ...config, grafanaBasePath: '/other-grafana' }, evidence);
    } catch (error) {
      conflictCode = (error as { code?: string }).code;
    }

    first.appEvents.publish({ type: 'task5-browser-check' });
    const scope = first.acquireDashboardScope('task5-browser');
    const bootWindow = window as Window & {
      grafanaBootData?: { settings?: { appSubUrl?: string } };
    };
    const during = {
      bootAppSubUrl: bootWindow.grafanaBootData?.settings?.appSubUrl,
      conflictCode,
      iframeCount: document.querySelectorAll('iframe').length,
      language: navigator.language,
      portalCount: document.querySelectorAll('#grafana-portal-container').length,
      state: runtime.inspectPocRuntime(),
    };

    scope.release();
    first.release();
    second.release();
    return {
      during,
      after: {
        iframeCount: document.querySelectorAll('iframe').length,
        portalCount: document.querySelectorAll('#grafana-portal-container').length,
        state: runtime.inspectPocRuntime(),
      },
      evidence: evidence.snapshot(),
    };
  });

  expect(result.during).toMatchObject({
    bootAppSubUrl: '',
    conflictCode: 'runtime-conflict',
    iframeCount: 0,
    language: 'en-US',
    portalCount: 1,
    state: {
      activeDashboardScopes: 1,
      activeLeases: 2,
      observedEventTypes: ['task5-browser-check'],
      status: 'ready',
    },
  });
  expect(result.during.state.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(result.after).toMatchObject({
    iframeCount: 0,
    portalCount: 0,
    state: {
      activeDashboardScopes: 0,
      activeLeases: 0,
      portal: { activeReferences: 0, ownsRoot: false },
      status: 'ready',
    },
  });
  expect(result.during.state.initializationSteps).toEqual([
    'host-config-validated',
    'boot-data-installed',
    'asset-policy-installed',
    'grafana-cohort-loaded',
    'theme-selected',
    'i18n-initialized',
    'app-events-installed',
    'location-policy-installed',
    'runtime-ready',
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /Bearer |authorization|cookie|password|service.?account|must-not-persist/i
  );

  const resources = await captureResourceEvidence(page, 'task5-runtime-released');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
  expect(resources.dom.portalRoots).toBe(0);
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);

  await networkEvidence.write('artifacts/playwright/task-5-runtime-network.json');
  await writeResourceEvidence('artifacts/playwright/task-5-runtime-resources.json', [resources]);
  await consoleGuard.assertClean();
});
