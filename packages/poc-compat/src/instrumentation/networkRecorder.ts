export type SanitizedEvidenceValue =
  | boolean
  | number
  | string
  | null
  | SanitizedEvidenceValue[]
  | { [key: string]: SanitizedEvidenceValue };

export type HeaderInput =
  | Headers
  | Iterable<readonly [string, string]>
  | Record<string, string | readonly string[] | undefined>;

export interface NetworkRequestInput {
  body?: unknown;
  headers?: HeaderInput;
  method?: string;
  url: string;
}

export interface NetworkResponseInput {
  headers?: HeaderInput;
  status: number;
}

export type NetworkEvidenceEvent =
  | {
      body?: SanitizedEvidenceValue;
      headers: Record<string, string>;
      id: string;
      method: string;
      sequence: number;
      type: 'request';
      url: string;
    }
  | {
      headers: Record<string, string>;
      id: string;
      sequence: number;
      status: number;
      type: 'response';
    }
  | {
      error: string;
      id: string;
      sequence: number;
      type: 'failure';
    }
  | {
      id: string;
      sequence: number;
      type: 'abort';
    };

const REDACTED = '<redacted>';
const sensitiveName =
  /(?:authorization|cookie|credential|password|passwd|secret|session|token|api[-_]?key|access[-_]?key|refresh[-_]?key)/i;

function headerEntries(headers: HeaderInput | undefined): Array<[string, string]> {
  if (!headers) {
    return [];
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return [...headers.entries()];
  }

  if (Symbol.iterator in Object(headers) && !Array.isArray(headers)) {
    return [...(headers as Iterable<readonly [string, string]>)].map(([name, value]) => [name, value]);
  }

  if (Array.isArray(headers)) {
    return headers.map(([name, value]) => [name, value]);
  }

  return Object.entries(headers as Record<string, string | readonly string[] | undefined>).flatMap(
    ([name, value]) => {
      if (value === undefined) {
        return [];
      }
      return [[name, typeof value === 'string' ? value : value.join(', ')]];
    }
  );
}

export function sanitizeHeaders(headers: HeaderInput | undefined): Record<string, string> {
  return Object.fromEntries(
    headerEntries(headers)
      .map(([name, value]) => [name.toLowerCase(), sensitiveName.test(name) ? REDACTED : value] as const)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function sanitizeUrl(rawUrl: string): string {
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(rawUrl);
  const url = new URL(rawUrl, 'http://poc.invalid');

  if (url.username) {
    url.username = REDACTED;
  }
  if (url.password) {
    url.password = REDACTED;
  }
  for (const name of [...url.searchParams.keys()]) {
    if (sensitiveName.test(name)) {
      url.searchParams.set(name, REDACTED);
    }
  }

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

export function sanitizeEvidenceText(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  return text
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 <redacted>')
    .replace(/\b(authorization|cookie|password|secret|session|token|api[-_]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=<redacted>')
    .replace(/https?:\/\/[^\s"')]+/gi, (candidate) => {
      try {
        return sanitizeUrl(candidate);
      } catch {
        return '<redacted-url>';
      }
    })
    .slice(0, 2_000);
}

function sanitizeValue(value: unknown, key = '', depth = 0): SanitizedEvidenceValue {
  if (sensitiveName.test(key)) {
    return REDACTED;
  }
  if (depth > 8) {
    return '<omitted:max-depth>';
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeEvidenceText(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, '', depth + 1));
  }
  if (typeof value === 'object') {
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      return '<omitted:form-data>';
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return `<omitted:blob:${value.size}>`;
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return '<omitted:binary>';
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([nestedKey, nestedValue]) => [
          nestedKey,
          sanitizeValue(nestedValue, nestedKey, depth + 1),
        ])
    );
  }
  return `<omitted:${typeof value}>`;
}

export function sanitizeBody(body: unknown): SanitizedEvidenceValue | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body === 'string') {
    try {
      return sanitizeValue(JSON.parse(body));
    } catch {
      return `<omitted:string:${new TextEncoder().encode(body).byteLength}>`;
    }
  }
  return sanitizeValue(body);
}

export interface NetworkRecorder {
  requestAborted(id: string): void;
  requestFailed(id: string, error: unknown): void;
  requestFinished(id: string, response: NetworkResponseInput): void;
  requestStarted(request: NetworkRequestInput): string;
  snapshot(): readonly NetworkEvidenceEvent[];
}

export function createNetworkRecorder(): NetworkRecorder {
  const events: NetworkEvidenceEvent[] = [];
  let requestSequence = 0;
  let eventSequence = 0;

  return {
    requestStarted(request) {
      const id = `network-${++requestSequence}`;
      const body = sanitizeBody(request.body);
      events.push({
        ...(body === undefined ? {} : { body }),
        headers: sanitizeHeaders(request.headers),
        id,
        method: (request.method ?? 'GET').toUpperCase(),
        sequence: ++eventSequence,
        type: 'request',
        url: sanitizeUrl(request.url),
      });
      return id;
    },
    requestFinished(id, response) {
      events.push({
        headers: sanitizeHeaders(response.headers),
        id,
        sequence: ++eventSequence,
        status: response.status,
        type: 'response',
      });
    },
    requestFailed(id, error) {
      events.push({
        error: sanitizeEvidenceText(error),
        id,
        sequence: ++eventSequence,
        type: 'failure',
      });
    },
    requestAborted(id) {
      events.push({ id, sequence: ++eventSequence, type: 'abort' });
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}

export interface FetchInstrumentationTarget {
  fetch: typeof fetch;
}

export function installFetchInstrumentation(
  target: FetchInstrumentationTarget,
  recorder: NetworkRecorder
): () => void {
  const originalFetch = target.fetch;

  target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const id = recorder.requestStarted({
      body: init?.body,
      headers: init?.headers ?? request?.headers,
      method: init?.method ?? request?.method,
      url: request?.url ?? String(input),
    });
    const signal = init?.signal ?? request?.signal;
    const onAbort = () => recorder.requestAborted(id);
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await originalFetch.call(target, input, init);
      recorder.requestFinished(id, { headers: response.headers, status: response.status });
      return response;
    } catch (error) {
      if (!signal?.aborted) {
        recorder.requestFailed(id, error);
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }) as typeof fetch;

  return () => {
    target.fetch = originalFetch;
  };
}
