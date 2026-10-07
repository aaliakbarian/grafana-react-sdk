import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  createPocBackendSrv,
  createTransportEvidenceRecorder,
  PocTransportError,
  resolveGrafanaRequestUrl,
} from './backendSrvAdapter';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json', 'x-request-id': 'server-request-id' },
    status,
    statusText: status === 200 ? 'OK' : 'Failure',
  });
}

describe('POC BackendSrv adapter', () => {
  it('normalizes root-relative Grafana requests without accepting origins or traversal', () => {
    expect(resolveGrafanaRequestUrl('/grafana/', '/apis/dashboard.grafana.app/')).toBe(
      '/grafana/apis/dashboard.grafana.app/'
    );
    expect(resolveGrafanaRequestUrl('/grafana', '/grafana/api/health')).toBe(
      '/grafana/api/health'
    );
    expect(() => resolveGrafanaRequestUrl('/grafana', 'https://grafana.invalid/api')).toThrow(
      /root-relative/i
    );
    expect(() => resolveGrafanaRequestUrl('/grafana', '/api/../admin')).toThrow(/relative path/i);
    expect(() => resolveGrafanaRequestUrl('/grafana', '/grafana-other/api')).toThrow(
      /outside the configured Grafana base path/i
    );
  });

  it('uses the host request function, browser credentials, request IDs, and JSON decoding', async () => {
    const request = vi.fn<typeof fetch>(async () => jsonResponse({ kind: 'APIGroup' }));
    const evidence = createTransportEvidenceRecorder();
    const backend = createPocBackendSrv({
      evidence,
      grafanaBasePath: '/grafana',
      request,
    });

    await expect(
      backend.get('/apis/dashboard.grafana.app/', { limit: 10 }, 'discovery-1')
    ).resolves.toEqual({ kind: 'APIGroup' });

    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe('/grafana/apis/dashboard.grafana.app/?limit=10');
    expect(init).toMatchObject({ credentials: 'include', method: 'GET' });
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
    expect(evidence.snapshot()).toEqual([
      expect.objectContaining({
        endpoint: 'dashboard-discovery',
        method: 'GET',
        outcome: 'success',
        requestId: 'discovery-1',
        sequence: 1,
        status: 200,
      }),
    ]);
    expect(Object.keys(evidence.snapshot()[0] ?? {}).sort()).toEqual([
      'durationMs',
      'endpoint',
      'method',
      'outcome',
      'requestId',
      'sequence',
      'status',
    ]);
  });

  it('rejects credential-bearing adapter headers while allowing host-owned request behavior', async () => {
    const request = vi.fn<typeof fetch>(async () => jsonResponse({}));
    const backend = createPocBackendSrv({ grafanaBasePath: '/grafana', request });

    await expect(
      backend.get('/api/health', undefined, undefined, {
        headers: { Authorization: 'Bearer must-not-persist' },
      })
    ).rejects.toMatchObject({ code: 'transport-credential-header-forbidden' });
    expect(request).not.toHaveBeenCalled();
  });

  it('encodes non-Latin-1 query-context headers like Grafana BackendSrv', async () => {
    const request = vi.fn<typeof fetch>(async () => jsonResponse({ results: {} }));
    const backend = createPocBackendSrv({ grafanaBasePath: '/grafana', request });

    await backend.post('/api/ds/query', {}, { headers: { 'X-Panel-Title': 'Stat — pulse' } });

    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-panel-title')).toBe('Stat%20%E2%80%94%20pulse');
  });

  it.each([401, 403])(
    'classifies datasource query HTTP %s without retaining its response body',
    async (status) => {
      const evidence = createTransportEvidenceRecorder();
      const backend = createPocBackendSrv({
        evidence,
        grafanaBasePath: '/grafana',
        request: async () => jsonResponse({ message: 'must-not-persist' }, status),
      });

      await expect(backend.post('/api/ds/query', { queries: [] })).rejects.toMatchObject({
        code: 'transport-http',
        endpoint: 'datasource-query',
        status,
      });
      expect(evidence.snapshot()).toEqual([
        expect.objectContaining({
          endpoint: 'datasource-query',
          method: 'POST',
          outcome: 'http-error',
          status,
        }),
      ]);
      expect(JSON.stringify(evidence.snapshot())).not.toContain('must-not-persist');
    }
  );

  it('normalizes HTTP, malformed JSON, network, and cancellation failures', async () => {
    const responses: Array<Response | Error> = [
      jsonResponse({ message: 'denied' }, 403),
      new Response('{not-json', { headers: { 'content-type': 'application/json' }, status: 200 }),
      new TypeError('Failed to fetch https://secret.invalid?token=must-not-persist'),
    ];
    const request = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next ?? jsonResponse({ ok: true });
    });
    const evidence = createTransportEvidenceRecorder();
    const backend = createPocBackendSrv({ evidence, grafanaBasePath: '/grafana', request });

    await expect(backend.get('/apis/dashboard.grafana.app/')).rejects.toMatchObject({
      code: 'transport-http',
      endpoint: 'dashboard-discovery',
      status: 403,
    });
    await expect(backend.get('/apis/dashboard.grafana.app/')).rejects.toMatchObject({
      code: 'transport-malformed-response',
      status: 200,
    });
    await expect(backend.get('/apis/dashboard.grafana.app/')).rejects.toMatchObject({
      code: 'transport-network',
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      backend.get('/apis/dashboard.grafana.app/', undefined, undefined, {
        abortSignal: controller.signal,
      })
    ).rejects.toMatchObject({ code: 'transport-cancelled' });

    expect(JSON.stringify(evidence.snapshot())).not.toMatch(
      /must-not-persist|authorization|cookie|responseBody/i
    );
  });

  it('aborts the host request when an Observable subscriber unsubscribes', async () => {
    let observedSignal: AbortSignal | undefined;
    const request = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          observedSignal = init?.signal ?? undefined;
          observedSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        })
    );
    const evidence = createTransportEvidenceRecorder();
    const backend = createPocBackendSrv({ evidence, grafanaBasePath: '/grafana', request });

    const subscription = backend
      .fetch({ requestId: 'observable-1', url: '/api/health' })
      .subscribe({ error: () => undefined });
    await vi.waitFor(() => expect(observedSignal).toBeDefined());
    subscription.unsubscribe();

    expect(observedSignal?.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(evidence.snapshot()).toContainEqual(
        expect.objectContaining({ outcome: 'cancelled', requestId: 'observable-1' })
      )
    );
  });

  it('returns the complete FetchResponse contract from datasourceRequest', async () => {
    const backend = createPocBackendSrv({
      grafanaBasePath: '/grafana',
      request: async () => jsonResponse({ value: 42 }),
    });

    await expect(
      backend.datasourceRequest({ url: '/api/health' })
    ).resolves.toMatchObject({
      config: { url: '/api/health' },
      data: { value: 42 },
      ok: true,
      status: 200,
    });
    await expect(firstValueFrom(backend.fetch({ url: '/api/health' }))).resolves.toMatchObject({
      data: { value: 42 },
      status: 200,
    });
  });

  it('uses a typed error for unsupported chunk streaming', async () => {
    const backend = createPocBackendSrv({
      grafanaBasePath: '/grafana',
      request: async () => jsonResponse({}),
    });

    await expect(firstValueFrom(backend.chunked({ url: '/api/live' }))).rejects.toBeInstanceOf(
      PocTransportError
    );
    await expect(firstValueFrom(backend.chunked({ url: '/api/live' }))).rejects.toMatchObject({
      code: 'transport-unsupported',
    });
  });
});
