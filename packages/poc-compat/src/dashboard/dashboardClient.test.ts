import { describe, expect, it, vi } from 'vitest';

import { createPocBackendSrv, createTransportEvidenceRecorder } from '../network/backendSrvAdapter';
import { PocDashboardError } from './errors';
import { createPocDashboardClient } from './loadDashboardV1';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

const discovery = {
  apiVersion: 'v1',
  kind: 'APIGroup',
  name: 'dashboard.grafana.app',
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' },
  versions: [
    { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' },
    { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' },
    { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
  ],
};

function dashboardDto(uid: string, overrides: Record<string, unknown> = {}) {
  const base = {
    access: {
      annotationsPermissions: {
        dashboard: { canAdd: true, canDelete: true, canEdit: true },
      },
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      canStar: true,
      isPublic: false,
      slug: uid,
      url: `/d/${uid}`,
    },
    apiVersion: 'dashboard.grafana.app/v1',
    kind: 'DashboardWithAccessInfo',
    metadata: {
      generation: 3,
      name: uid,
      namespace: 'default',
      resourceVersion: 'resource-version-3',
      uid: 'opaque-kubernetes-resource-uid',
    },
    spec: { panels: [], schemaVersion: 42, title: uid },
    status: { conversion: { failed: false, storedVersion: 'v1' } },
  };
  return { ...base, ...overrides };
}

function responseQueue(...responses: Array<Response | Error | (() => Promise<Response>)>) {
  return vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (typeof next === 'function') return next();
    if (next instanceof Error) throw next;
    if (!next) throw new Error('Unexpected extra request');
    return next;
  });
}

function createClient(request: typeof fetch, fingerprint = 'runtime-a') {
  const evidence = createTransportEvidenceRecorder();
  const backendSrv = createPocBackendSrv({ evidence, grafanaBasePath: '/grafana', request });
  return {
    client: createPocDashboardClient({ backendSrv, namespace: 'default', runtimeFingerprint: fingerprint }),
    evidence,
  };
}

describe('POC dashboard client', () => {
  it('discovers stable versions once and retrieves both real UID identities through V1 DTO paths', async () => {
    const request = responseQueue(
      jsonResponse(discovery),
      jsonResponse(dashboardDto('grsdk-phase0-poc')),
      jsonResponse(dashboardDto('grsdk-phase0-poc-alt'))
    );
    const { client } = createClient(request);

    const primary = await client.loadByUid('grsdk-phase0-poc');
    const alternate = await client.loadByUid('grsdk-phase0-poc-alt');

    expect(primary).toMatchObject({
      apiVersion: 'v1',
      family: 'v1',
      requestedUid: 'grsdk-phase0-poc',
      v2Available: true,
    });
    expect(alternate.dto.metadata.name).toBe('grsdk-phase0-poc-alt');
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/grafana/apis/dashboard.grafana.app/',
      '/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto',
      '/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto',
    ]);
    expect(request.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('/api/dashboards/uid/')
    );
  });

  it('does not cache failed discovery and coalesces a later successful discovery', async () => {
    const request = responseQueue(
      jsonResponse({ message: 'temporary failure' }, 500),
      jsonResponse(discovery),
      jsonResponse(dashboardDto('grsdk-phase0-poc'))
    );
    const { client } = createClient(request);

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'network',
      stage: 'discovery',
      status: 500,
    });
    await expect(client.loadByUid('grsdk-phase0-poc')).resolves.toMatchObject({ family: 'v1' });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each(['', ' ', '../admin', 'title with spaces', 'uid/segment'])('rejects invalid UID %j before network', async (uid) => {
    const request = vi.fn<typeof fetch>();
    const { client } = createClient(request);

    await expect(client.loadByUid(uid)).rejects.toMatchObject({ code: 'dashboard-uid-invalid' });
    expect(request).not.toHaveBeenCalled();
  });

  it('uses metadata.name as canonical UID and ignores opaque metadata.uid', async () => {
    const request = responseQueue(
      jsonResponse(discovery),
      jsonResponse(
        dashboardDto('different-response-name', {
          metadata: {
            generation: 1,
            name: 'different-response-name',
            namespace: 'default',
            resourceVersion: 'rv',
            uid: 'grsdk-phase0-poc',
          },
        })
      )
    );
    const { client } = createClient(request);

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'dashboard-identity-mismatch',
      path: 'metadata.name',
    });
  });

  it('accepts absent spec.uid, validates it when present, and never uses it as path identity', async () => {
    const request = responseQueue(
      jsonResponse(discovery),
      jsonResponse(
        dashboardDto('grsdk-phase0-poc', {
          spec: { panels: [], schemaVersion: 42, uid: 'wrong-spec-uid' },
        })
      )
    );
    const { client } = createClient(request);

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'dashboard-identity-mismatch',
      path: 'spec.uid',
    });
  });

  it.each([
    [401, 'dashboard-unauthorized'],
    [403, 'dashboard-forbidden'],
    [404, 'dashboard-not-found'],
  ] as const)('classifies dashboard HTTP %s as %s', async (status, code) => {
    const request = responseQueue(jsonResponse(discovery), jsonResponse({}, status));
    const { client } = createClient(request);

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code,
      requestId: 'runtime-a:dashboard:grsdk-phase0-poc',
      stage: 'dashboard-v1',
      status,
    });
  });

  it('does not misclassify discovery 404 as a missing dashboard', async () => {
    const { client } = createClient(responseQueue(jsonResponse({}, 404)));

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'dashboard-api-version-unsupported',
      stage: 'discovery',
      status: 404,
    });
  });

  it('rejects discovery without stable V1 while recording advertised versions', async () => {
    const { client } = createClient(
      responseQueue(
        jsonResponse({
          ...discovery,
          versions: [{ groupVersion: 'dashboard.grafana.app/v2', version: 'v2' }],
        })
      )
    );

    await expect(client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      advertisedVersions: ['v2'],
      code: 'dashboard-api-version-unsupported',
    });
  });

  it('returns typed unsupported errors for V2-stored and old V1 dashboards', async () => {
    const v2Request = responseQueue(
      jsonResponse(discovery),
      jsonResponse(
        dashboardDto('grsdk-phase0-poc', {
          status: { conversion: { failed: true, storedVersion: 'v2' } },
        })
      )
    );
    const oldRequest = responseQueue(
      jsonResponse(discovery),
      jsonResponse(
        dashboardDto('grsdk-phase0-poc', {
          spec: { panels: [], schemaVersion: 41 },
        })
      )
    );

    await expect(createClient(v2Request).client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'dashboard-version-unsupported',
      storedVersion: 'v2',
    });
    await expect(createClient(oldRequest, 'runtime-b').client.loadByUid('grsdk-phase0-poc')).rejects.toMatchObject({
      code: 'dashboard-feature-unsupported',
      path: 'spec.schemaVersion',
    });
  });

  it.each([
    ['missing access', { access: undefined }],
    ['incomplete access metadata', { access: { annotationsPermissions: {} } }],
    ['wrong kind', { kind: 'Dashboard' }],
    ['wrong namespace', { metadata: { generation: 1, name: 'grsdk-phase0-poc', namespace: 'other', resourceVersion: 'rv' } }],
    ['missing spec', { spec: undefined }],
  ])('classifies malformed DTO: %s', async (_case, override) => {
    const request = responseQueue(
      jsonResponse(discovery),
      jsonResponse(dashboardDto('grsdk-phase0-poc', override))
    );
    const { client } = createClient(request);

    const failure = await client.loadByUid('grsdk-phase0-poc').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PocDashboardError);
    expect(failure).toMatchObject({
      code: 'dashboard-response-malformed',
    });
  });

  it('classifies host network rejection without retaining its sensitive detail', async () => {
    const { client } = createClient(
      responseQueue(new TypeError('Failed with token=must-not-persist'))
    );

    const failure = await client.loadByUid('grsdk-phase0-poc').catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'network', stage: 'discovery' });
    expect(JSON.stringify(failure)).not.toContain('must-not-persist');
  });

  it('propagates consumer cancellation and records only classified transport metadata', async () => {
    const request = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        })
    );
    const { client, evidence } = createClient(request);
    const controller = new AbortController();
    const pending = client.loadByUid('grsdk-phase0-poc', { signal: controller.signal });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'cancelled', stage: 'discovery' });
    expect(evidence.snapshot()).toContainEqual(
      expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'cancelled' })
    );
    expect(JSON.stringify(evidence.snapshot())).not.toMatch(
      /authorization|cookie|password|responseBody/i
    );
  });
});
