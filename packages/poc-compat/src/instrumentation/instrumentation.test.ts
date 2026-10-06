import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createIframeGuard, type IframeGuardDocument } from './iframeGuard';
import {
  createNetworkRecorder,
  installFetchInstrumentation,
  sanitizeBody,
  sanitizeHeaders,
  sanitizeUrl,
} from './networkRecorder';
import { createPluginTrace } from './pluginTrace';
import { createResourceTracker } from './resourceTracker';
import {
  createRuntimeFingerprint,
  createRuntimeIdentityRegistry,
} from './runtimeIdentity';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const forbiddenPluginPath = resolve(
  repositoryRoot,
  'apps/poc-host/build/forbiddenGrafanaImportPlugin.ts'
);

async function loadForbiddenImportClassifier() {
  const moduleUrl = pathToFileURL(forbiddenPluginPath).href;
  return (await import(moduleUrl)) as {
    classifyForbiddenGrafanaImport(
      source: string,
      importer?: string,
      options?: { sourceBridgeRoots?: string[] }
    ): { category: string; id: string; reason: string } | undefined;
    isReviewedDormantRuntimeSystemImport(code: string, id: string): boolean;
  };
}

describe('POC evidence instrumentation', () => {
  it('redacts credential-bearing headers without discarding safe request metadata', () => {
    expect(
      sanitizeHeaders({
        Authorization: 'Bearer secret-token',
        Cookie: 'grafana_session=secret-cookie',
        'Content-Type': 'application/json',
        'Set-Cookie': 'grafana_session=secret-response-cookie',
        'X-Api-Key': 'secret-api-key',
        'X-Request-Id': 'request-42',
      })
    ).toEqual({
      authorization: '<redacted>',
      cookie: '<redacted>',
      'content-type': 'application/json',
      'set-cookie': '<redacted>',
      'x-api-key': '<redacted>',
      'x-request-id': 'request-42',
    });
  });

  it('sanitizes URL credentials and nested request bodies before recording evidence', () => {
    const url = sanitizeUrl(
      'http://localhost:5173/grafana/api/ds/query?uid=grsdk-phase0-poc&token=url-secret&password=url-password'
    );
    const body = sanitizeBody(
      JSON.stringify({
        dashboardUid: 'grsdk-phase0-poc',
        nested: { authorization: 'body-secret', refId: 'A' },
        password: 'body-password',
      })
    );

    expect(url).toBe(
      'http://localhost:5173/grafana/api/ds/query?uid=grsdk-phase0-poc&token=%3Credacted%3E&password=%3Credacted%3E'
    );
    expect(body).toEqual({
      dashboardUid: 'grsdk-phase0-poc',
      nested: { authorization: '<redacted>', refId: 'A' },
      password: '<redacted>',
    });
    expect(JSON.stringify({ body, url })).not.toMatch(
      /url-secret|url-password|body-secret|body-password/
    );
  });

  it('records only sanitized network evidence and never response bodies', () => {
    const recorder = createNetworkRecorder();
    const requestId = recorder.requestStarted({
      body: JSON.stringify({ dashboardUid: 'grsdk-phase0-poc', token: 'secret' }),
      headers: { authorization: 'Bearer secret', 'x-request-id': 'request-42' },
      method: 'POST',
      url: 'http://localhost:5173/grafana/api/ds/query?apiKey=secret',
    });
    recorder.requestFinished(requestId, {
      headers: { 'content-type': 'application/json', 'set-cookie': 'secret-cookie' },
      status: 200,
    });

    const serialized = JSON.stringify(recorder.snapshot());
    expect(serialized).toContain('grsdk-phase0-poc');
    expect(serialized).toContain('request-42');
    expect(serialized).not.toMatch(/Bearer secret|secret-cookie|apiKey=secret|"token":"secret"/);
    expect(serialized).not.toContain('responseBody');
  });

  it('records an already-aborted fetch as cancellation rather than failure', async () => {
    const recorder = createNetworkRecorder();
    const controller = new AbortController();
    controller.abort();
    const target = {
      fetch: async () => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      },
    } as { fetch: typeof fetch };
    const restore = installFetchInstrumentation(target, recorder);

    await expect(
      target.fetch('http://localhost:5173/grafana/api/ds/query', {
        signal: controller.signal,
      })
    ).rejects.toThrow(/aborted/i);

    expect(recorder.snapshot().map(({ type }) => type)).toEqual(['request', 'abort']);
    restore();
  });

  it('balances counters independently for page and dashboard-instance lifetimes', () => {
    const tracker = createResourceTracker();
    const releasePageTimer = tracker.acquire('timeout', 'page');
    const releaseInstanceTimer = tracker.acquire('timeout', 'instance');
    const releaseInstanceSubscription = tracker.acquire('subscription', 'instance');

    expect(tracker.snapshot()).toMatchObject({
      instance: { subscription: 1, timeout: 1 },
      page: { timeout: 1 },
    });

    releaseInstanceTimer();
    releaseInstanceSubscription();
    releaseInstanceSubscription();

    expect(tracker.snapshot()).toMatchObject({
      instance: { subscription: 0, timeout: 0 },
      page: { timeout: 1 },
    });
    expect(tracker.assertBalanced('instance')).toEqual([]);
    expect(tracker.assertBalanced('page')).toEqual(['timeout=1']);

    releasePageTimer();
    expect(tracker.assertBalanced()).toEqual([]);
  });

  it('records transient iframe mutations even when the iframe is later removed', () => {
    let mutationCallback: ((records: Array<{ addedNodes: ArrayLike<unknown> }>) => void) | undefined;
    let disconnected = false;
    const document = {
      documentElement: {},
      querySelectorAll: () => [],
    } satisfies IframeGuardDocument;
    const guard = createIframeGuard(document, {
      createObserver(callback) {
        mutationCallback = callback;
        return {
          disconnect() {
            disconnected = true;
          },
          observe() {},
        };
      },
    });

    mutationCallback?.([
      {
        addedNodes: [
          {
            nodeName: 'SECTION',
            querySelectorAll: (selector: string) =>
              selector === 'iframe' ? [{ nodeName: 'IFRAME' }] : [],
          },
        ],
      },
    ]);

    expect(guard.snapshot()).toMatchObject({ observationCount: 1, violated: true });
    expect(() => guard.assertNoIframes()).toThrow(/observed 1 iframe/i);
    guard.stop();
    expect(disconnected).toBe(true);
  });

  it('creates order-independent runtime fingerprints and rejects duplicate module identities', () => {
    const first = createRuntimeFingerprint({
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      packages: { '@grafana/scenes': '8.13.5', react: '19.2.8' },
      stylePolicy: 'host-only',
    });
    const reordered = createRuntimeFingerprint({
      stylePolicy: 'host-only',
      packages: { react: '19.2.8', '@grafana/scenes': '8.13.5' },
      namespace: 'default',
      locale: 'en-US',
      grafanaBasePath: '/grafana',
    });
    const incompatible = createRuntimeFingerprint({
      ...first.identity,
      grafanaBasePath: '/other-grafana',
    });

    expect(first.fingerprint).toBe(reordered.fingerprint);
    expect(first.fingerprint).not.toBe(incompatible.fingerprint);

    const identities = createRuntimeIdentityRegistry();
    const sharedReact = {};
    identities.record('host:react', sharedReact, '19.2.8');
    identities.record('scenes:react', sharedReact, '19.2.8');
    expect(identities.snapshot().react).toMatchObject({ copies: 1, version: '19.2.8' });
    expect(() => identities.record('panel:react', {}, '19.2.8')).toThrow(/duplicate react runtime/i);
  });

  it('classifies forbidden shell, routing, SystemJS, and boundary-breaking imports', async () => {
    const { classifyForbiddenGrafanaImport, isReviewedDormantRuntimeSystemImport } =
      await loadForbiddenImportClassifier();
    const hostImporter = '/workspace/apps/poc-host/src/main.tsx';
    const bridgeImporter = '/workspace/packages/poc-grafana-bridge/src/panels/text.ts';

    expect(classifyForbiddenGrafanaImport('/grafana/public/app/app.ts', bridgeImporter)?.category).toBe(
      'application-entrypoint'
    );
    expect(
      classifyForbiddenGrafanaImport('/grafana/public/app/routes/routes.tsx', bridgeImporter)?.category
    ).toBe('application-routing');
    expect(
      classifyForbiddenGrafanaImport(
        '/grafana/public/app/core/components/AppChrome/AppChrome.tsx',
        bridgeImporter
      )?.category
    ).toBe('application-navigation-chrome');
    expect(
      classifyForbiddenGrafanaImport(
        '/grafana/public/app/features/dashboard/components/PanelEditor/PanelEditor.tsx',
        bridgeImporter
      )?.category
    ).toBe('dashboard-edit-shell');
    expect(classifyForbiddenGrafanaImport('systemjs', bridgeImporter)?.category).toBe(
      'arbitrary-systemjs'
    );
    expect(classifyForbiddenGrafanaImport('@grafana/runtime/internal', hostImporter)?.category).toBe(
      'grafana-internal-outside-bridge'
    );
    expect(
      classifyForbiddenGrafanaImport(
        '@grafana/faro-core/internal',
        '/workspace/node_modules/@grafana/faro-web-sdk/dist/esm/instrumentations/session.js'
      )
    ).toBeUndefined();
    expect(
      classifyForbiddenGrafanaImport('@grafana/faro-core/internal', hostImporter)?.category
    ).toBe('grafana-internal-outside-bridge');
    expect(
      classifyForbiddenGrafanaImport('/grafana/public/app/plugins/panel/text/module.tsx', hostImporter)
        ?.category
    ).toBe('grafana-application-source-outside-bridge');
    expect(
      classifyForbiddenGrafanaImport('/grafana/public/app/plugins/panel/text/module.tsx', bridgeImporter)
    ).toBeUndefined();
    expect(classifyForbiddenGrafanaImport('@grafana/data', hostImporter)).toBeUndefined();
    expect(
      isReviewedDormantRuntimeSystemImport(
        'return window.System.import(cssPath);',
        '/workspace/node_modules/@grafana/runtime/dist/esm/utils/plugin.mjs?v=13.2.3'
      )
    ).toBe(true);
    expect(
      isReviewedDormantRuntimeSystemImport(
        'const message = "pluginImportUtils should only be set once, when Grafana is starting."; return window.System.import(cssPath);',
        '/workspace/apps/poc-host/node_modules/.vite/deps/esm-reviewedHash.js?v=13.2.3'
      )
    ).toBe(true);
    expect(
      isReviewedDormantRuntimeSystemImport(
        'return window.System.import(userControlledPath);',
        '/workspace/node_modules/@grafana/runtime/dist/esm/utils/plugin.mjs'
      )
    ).toBe(false);
    expect(
      isReviewedDormantRuntimeSystemImport(
        'return window.System.import(cssPath);',
        '/workspace/packages/poc-compat/src/runtime/unsafe.ts'
      )
    ).toBe(false);
  });

  it('records plugin loading with source identity and sanitized failures', () => {
    const trace = createPluginTrace();
    trace.started({
      cacheKey: 'text@13.2.3',
      pluginId: 'text',
      sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
      sourceEntrypoint: 'public/app/plugins/panel/text/module.tsx',
    });
    trace.failed('text', new Error('Authorization: Bearer plugin-secret'));

    const serialized = JSON.stringify(trace.snapshot());
    expect(serialized).toContain('public/app/plugins/panel/text/module.tsx');
    expect(serialized).not.toContain('plugin-secret');
  });
});
