import type {
  BackendSrv,
  BackendSrvRequest,
  FetchResponse,
} from '@grafana/runtime';
import { Observable } from 'rxjs';

export type PocTransportErrorCode =
  | 'transport-cancelled'
  | 'transport-credential-header-forbidden'
  | 'transport-http'
  | 'transport-malformed-response'
  | 'transport-network'
  | 'transport-unsupported'
  | 'transport-url-invalid';

export type PocTransportEndpoint =
  | 'dashboard-discovery'
  | 'dashboard-v1-dto'
  | 'datasource-query'
  | 'frontend-settings'
  | 'other-grafana';

export type PocTransportOutcome =
  | 'cancelled'
  | 'http-error'
  | 'malformed'
  | 'network-error'
  | 'success'
  | 'unsupported';

export interface PocTransportEvidenceEvent {
  readonly durationMs: number;
  readonly endpoint: PocTransportEndpoint;
  readonly method: string;
  readonly outcome: PocTransportOutcome;
  readonly requestId?: string;
  readonly sequence: number;
  readonly status?: number;
}

export interface PocTransportEvidenceRecorder {
  record(event: Omit<PocTransportEvidenceEvent, 'sequence'>): void;
  snapshot(): readonly PocTransportEvidenceEvent[];
}

export interface PocBackendSrvOptions {
  readonly evidence?: PocTransportEvidenceRecorder;
  readonly grafanaBasePath: string;
  readonly request: typeof fetch;
}

export class PocTransportError extends Error {
  constructor(
    readonly code: PocTransportErrorCode,
    message: string,
    readonly endpoint: PocTransportEndpoint,
    readonly status?: number,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'PocTransportError';
  }
}

const forbiddenCredentialHeader =
  /^(?:authorization|cookie|proxy-authorization|x-api-key|x-auth-token)$/i;

export function createTransportEvidenceRecorder(): PocTransportEvidenceRecorder {
  const events: PocTransportEvidenceEvent[] = [];
  return {
    record(event) {
      events.push({ ...event, sequence: events.length + 1 });
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/') || basePath.startsWith('//') || basePath.includes('?') || basePath.includes('#')) {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana base path must be a root-relative path.',
      'other-grafana'
    );
  }
  const normalized = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  validatePath(normalized || '/');
  return normalized;
}

function validatePath(rawPath: string): void {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana request must use valid URL path encoding.',
      'other-grafana'
    );
  }
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana request must not contain relative path segments.',
      'other-grafana'
    );
  }
}

export function resolveGrafanaRequestUrl(grafanaBasePath: string, rawUrl: string): string {
  const basePath = normalizeBasePath(grafanaBasePath);
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(rawUrl)) {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana request URL must be root-relative.',
      'other-grafana'
    );
  }

  validatePath(rawUrl.split(/[?#]/, 1)[0] ?? rawUrl);
  const parsed = new URL(rawUrl, 'http://poc.invalid');
  if (basePath && parsed.pathname.startsWith(basePath) && !parsed.pathname.startsWith(`${basePath}/`)) {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana request URL is outside the configured Grafana base path.',
      'other-grafana'
    );
  }
  if (basePath && (parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`))) {
    return `${parsed.pathname}${parsed.search}`;
  }
  if (!parsed.pathname.startsWith('/api/') && parsed.pathname !== '/api' && !parsed.pathname.startsWith('/apis/')) {
    throw new PocTransportError(
      'transport-url-invalid',
      'Grafana request URL is outside the supported API paths.',
      'other-grafana'
    );
  }
  return `${basePath}${parsed.pathname}${parsed.search}`;
}

export function classifyTransportEndpoint(rawUrl: string): PocTransportEndpoint {
  const pathname = new URL(rawUrl, 'http://poc.invalid').pathname;
  if (/\/apis\/dashboard\.grafana\.app\/?$/.test(pathname)) return 'dashboard-discovery';
  if (/\/apis\/dashboard\.grafana\.app\/v1\/namespaces\/[^/]+\/dashboards\/[^/]+\/dto$/.test(pathname)) {
    return 'dashboard-v1-dto';
  }
  if (/\/api\/ds\/query$/.test(pathname)) return 'datasource-query';
  if (/\/api\/frontend\/settings$/.test(pathname)) return 'frontend-settings';
  return 'other-grafana';
}

function appendParams(url: string, params: Record<string, unknown> | undefined): string {
  if (!params) return url;
  const parsed = new URL(url, 'http://poc.invalid');
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      parsed.searchParams.append(name, String(item));
    }
  }
  return `${parsed.pathname}${parsed.search}`;
}

function createHeaders(input: BackendSrvRequest['headers']): Headers {
  const headers = new Headers(input as HeadersInit | undefined);
  for (const name of headers.keys()) {
    if (forbiddenCredentialHeader.test(name)) {
      throw new PocTransportError(
        'transport-credential-header-forbidden',
        'Credential-bearing headers must be owned by the host request boundary.',
        'other-grafana'
      );
    }
  }
  return headers;
}

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
}

async function decodeResponse(response: Response, responseType: BackendSrvRequest['responseType']): Promise<unknown> {
  switch (responseType ?? 'json') {
    case 'arraybuffer':
      return response.arrayBuffer();
    case 'blob':
      return response.blob();
    case 'text':
      return response.text();
    case 'json': {
      const text = await response.text();
      return text === '' ? undefined : JSON.parse(text);
    }
  }
}

export function createPocBackendSrv({
  evidence = createTransportEvidenceRecorder(),
  grafanaBasePath,
  request,
}: PocBackendSrvOptions): BackendSrv {
  const activeRequests = new Map<string, AbortController>();

  const execute = async <T>(config: BackendSrvRequest, localController?: AbortController): Promise<FetchResponse<T>> => {
    const method = (config.method ?? 'GET').toUpperCase();
    const url = appendParams(resolveGrafanaRequestUrl(grafanaBasePath, config.url), config.params);
    const endpoint = classifyTransportEndpoint(url);
    const startedAt = performance.now();
    const controller = localController ?? new AbortController();
    const externalSignal = config.abortSignal;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
    if (externalSignal?.aborted) controller.abort(externalSignal.reason);

    if (config.requestId) {
      activeRequests.get(config.requestId)?.abort('superseded');
      activeRequests.set(config.requestId, controller);
    }

    try {
      const headers = createHeaders(config.headers);
      let body: BodyInit | undefined;
      if (config.data !== undefined && method !== 'GET' && method !== 'HEAD') {
        if (
          typeof config.data === 'string' ||
          config.data instanceof Blob ||
          config.data instanceof FormData ||
          config.data instanceof URLSearchParams ||
          config.data instanceof ArrayBuffer ||
          ArrayBuffer.isView(config.data)
        ) {
          body = config.data as BodyInit;
        } else {
          headers.set('content-type', headers.get('content-type') ?? 'application/json');
          body = JSON.stringify(config.data);
        }
      }

      const response = await request(url, {
        ...(body === undefined ? {} : { body }),
        credentials: config.credentials ?? 'include',
        headers,
        method,
        signal: controller.signal,
      });
      if (!response.ok) {
        evidence.record({
          durationMs: elapsed(startedAt),
          endpoint,
          method,
          outcome: 'http-error',
          ...(config.requestId ? { requestId: config.requestId } : {}),
          status: response.status,
        });
        throw new PocTransportError(
          'transport-http',
          `Grafana request failed with HTTP ${response.status}.`,
          endpoint,
          response.status,
          config.requestId
        );
      }

      let data: T;
      try {
        data = (await decodeResponse(response, config.responseType)) as T;
      } catch {
        evidence.record({
          durationMs: elapsed(startedAt),
          endpoint,
          method,
          outcome: 'malformed',
          ...(config.requestId ? { requestId: config.requestId } : {}),
          status: response.status,
        });
        throw new PocTransportError(
          'transport-malformed-response',
          'Grafana returned a response that could not be decoded.',
          endpoint,
          response.status,
          config.requestId
        );
      }

      evidence.record({
        durationMs: elapsed(startedAt),
        endpoint,
        method,
        outcome: 'success',
        ...(config.requestId ? { requestId: config.requestId } : {}),
        status: response.status,
      });
      return {
        config,
        data,
        headers: response.headers,
        ok: response.ok,
        redirected: response.redirected,
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        url: response.url,
      };
    } catch (error: unknown) {
      if (error instanceof PocTransportError) throw error;
      if (isAbort(error, controller.signal)) {
        evidence.record({
          durationMs: elapsed(startedAt),
          endpoint,
          method,
          outcome: 'cancelled',
          ...(config.requestId ? { requestId: config.requestId } : {}),
        });
        throw new PocTransportError(
          'transport-cancelled',
          'Grafana request was cancelled.',
          endpoint,
          undefined,
          config.requestId
        );
      }
      evidence.record({
        durationMs: elapsed(startedAt),
        endpoint,
        method,
        outcome: 'network-error',
        ...(config.requestId ? { requestId: config.requestId } : {}),
      });
      throw new PocTransportError(
        'transport-network',
        'Grafana request failed at the host network boundary.',
        endpoint,
        undefined,
        config.requestId
      );
    } finally {
      externalSignal?.removeEventListener('abort', abortFromExternal);
      if (config.requestId && activeRequests.get(config.requestId) === controller) {
        activeRequests.delete(config.requestId);
      }
    }
  };

  const promiseData = async <T>(config: BackendSrvRequest): Promise<T> =>
    (await execute<T>(config)).data;

  return {
    get: <T>(url: string, params?: unknown, requestId?: string, options?: Partial<BackendSrvRequest>) =>
      promiseData<T>({
        ...options,
        method: 'GET',
        params: params as BackendSrvRequest['params'],
        requestId,
        url,
      }),
    delete: <T>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) =>
      promiseData<T>({ ...options, data, method: 'DELETE', url }),
    post: <T>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) =>
      promiseData<T>({ ...options, data, method: 'POST', url }),
    patch: <T>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) =>
      promiseData<T>({ ...options, data, method: 'PATCH', url }),
    put: <T>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) =>
      promiseData<T>({ ...options, data, method: 'PUT', url }),
    request: <T>(options: BackendSrvRequest) => promiseData<T>(options),
    datasourceRequest: <T>(options: BackendSrvRequest) => execute<T>(options),
    fetch: <T>(options: BackendSrvRequest) =>
      new Observable<FetchResponse<T>>((subscriber) => {
        const controller = new AbortController();
        void execute<T>(options, controller).then(
          (response) => {
            if (!subscriber.closed) {
              subscriber.next(response);
              subscriber.complete();
            }
          },
          (error: unknown) => {
            if (!subscriber.closed) subscriber.error(error);
          }
        );
        return () => controller.abort('observable-unsubscribed');
      }),
    chunked: (options: BackendSrvRequest) =>
      new Observable<FetchResponse<Uint8Array | undefined>>((subscriber) => {
        const endpoint = classifyTransportEndpoint(options.url);
        evidence.record({
          durationMs: 0,
          endpoint,
          method: (options.method ?? 'GET').toUpperCase(),
          outcome: 'unsupported',
          ...(options.requestId ? { requestId: options.requestId } : {}),
        });
        subscriber.error(
          new PocTransportError(
            'transport-unsupported',
            'Chunked Grafana responses are outside the Task 6 POC boundary.',
            endpoint,
            undefined,
            options.requestId
          )
        );
      }),
  };
}
