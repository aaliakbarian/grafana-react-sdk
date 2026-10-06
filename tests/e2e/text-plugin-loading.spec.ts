import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

test('loads the exact Text PanelPlugin through the closed Runtime importer without rendering', async ({
  page,
}) => {
  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const probePath = '/@fs/workspace/tests/e2e/support/task8TextPluginProbe.ts';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const lease = await runtime.acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task8-text-only', panelIds: [] },
      request: window.fetch.bind(window),
      theme: 'light',
      timezone: 'browser',
    });
    const probe = await import(/* @vite-ignore */ probePath);
    const plugin = await probe.runTask8TextPluginProbe();
    const during = runtime.inspectPocRuntime();
    lease.release();

    return {
      iframeCount: document.querySelectorAll('iframe').length,
      location: `${location.pathname}${location.search}${location.hash}`,
      plugin,
      runtimeAfter: runtime.inspectPocRuntime(),
      runtimeDuring: during,
      sourceResources: performance
        .getEntriesByType('resource')
        .map(({ name }) => name)
        .filter((name) => /poc-grafana-bridge|plugins\/panel\/text|systemjs/i.test(name))
        .map((name) => new URL(name).pathname),
    };
  });

  expect(result.plugin).toMatchObject({
    cacheIdentity: true,
    metadata: {
      id: 'text',
      module: 'public/app/plugins/panel/text/v1/module.tsx',
      name: 'Text',
      skipDataQuery: true,
      version: '13.2.3',
    },
    panelComponentName: 'TextPanel',
    promiseIdentity: true,
    pluginIdentity: true,
    unknownCategory: 'panel-plugin-unsupported',
  });
  expect(result.plugin.events).toEqual([
    expect.objectContaining({
      cache: 'miss',
      moduleIdentity: 'public/app/plugins/panel/text/v1/module.tsx',
      pluginId: 'text',
      sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
      strategy: 'P1-direct-source',
      type: 'start',
    }),
    { pluginId: 'text', type: 'cache-hit' },
    expect.objectContaining({ pluginId: 'text', type: 'success', version: '13.2.3' }),
    { category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' },
  ]);
  expect(result).toMatchObject({
    iframeCount: 0,
    location: '/',
    runtimeAfter: { activeLeases: 0, status: 'ready' },
    runtimeDuring: { activeLeases: 1, status: 'ready' },
  });
  expect(result.runtimeDuring.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(result.sourceResources).toEqual(
    expect.arrayContaining([
      expect.stringContaining('/packages/poc-grafana-bridge/src/panels/text.ts'),
      expect.stringContaining('/public/app/plugins/panel/text/v1/module.tsx'),
    ])
  );
  expect(result.sourceResources.some((path) => path.includes('/text/v2/'))).toBe(false);
  expect(result.sourceResources.some((path) => /systemjs/i.test(path))).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(
    /Bearer |authorization|cookie|password|service.?account|responseBody|queryText/i
  );

  const browserNetwork = await networkEvidence.snapshot();
  expect(browserNetwork.some((entry) => entry.url.includes('/grafana/'))).toBe(false);
  expect(browserNetwork.some((entry) => /systemjs/i.test(entry.url))).toBe(false);
  const resources = await captureResourceEvidence(page, 'task8-text-plugin-loaded-no-render');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom).toMatchObject({ iframeElements: 0, portalRoots: 0 });
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);

  await mkdir('artifacts/playwright', { recursive: true });
  await writeFile(
    'artifacts/playwright/task-8-text-plugin.json',
    `${JSON.stringify(
      {
        events: result.plugin.events,
        metadata: result.plugin.metadata,
        panelComponentName: result.plugin.panelComponentName,
        sourceResources: result.sourceResources,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  await networkEvidence.write('artifacts/playwright/task-8-text-plugin-network.json');
  await writeResourceEvidence('artifacts/playwright/task-8-text-plugin-resources.json', [resources]);
  await consoleGuard.assertClean();
});
