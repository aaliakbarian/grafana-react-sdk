import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import type { Page, Request, Response } from '@playwright/test';

import {
  sanitizeBody,
  sanitizeEvidenceText,
  sanitizeHeaders,
  sanitizeUrl,
  type SanitizedEvidenceValue,
} from '../../../packages/poc-compat/src/instrumentation/networkRecorder';

export type BrowserNetworkEvidenceEvent =
  | {
      body?: SanitizedEvidenceValue;
      headers: Record<string, string>;
      id: string;
      method: string;
      resourceType: string;
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
      url: string;
    }
  | {
      error: string;
      id: string;
      sequence: number;
      type: 'failure';
      url: string;
    };

export interface NetworkEvidenceCollector {
  snapshot(): Promise<readonly BrowserNetworkEvidenceEvent[]>;
  write(path: string): Promise<void>;
}

function safeArtifactPath(path: string): string {
  const artifactsRoot = resolve('artifacts');
  const target = resolve(path);
  if (target !== artifactsRoot && !target.startsWith(`${artifactsRoot}${sep}`)) {
    throw new Error(`Evidence path must remain under artifacts/: ${relative(process.cwd(), target)}`);
  }
  return target;
}

export function installNetworkEvidence(page: Page): NetworkEvidenceCollector {
  const events: BrowserNetworkEvidenceEvent[] = [];
  const pending = new Set<Promise<void>>();
  const requestIds = new WeakMap<Request, string>();
  let requestSequence = 0;
  let eventSequence = 0;

  const enqueue = (operation: () => Promise<void>) => {
    const promise = operation().finally(() => pending.delete(promise));
    pending.add(promise);
  };
  const idFor = (request: Request) => {
    const existing = requestIds.get(request);
    if (existing) return existing;
    const id = `browser-network-${++requestSequence}`;
    requestIds.set(request, id);
    return id;
  };

  page.on('request', (request) => {
    const sequence = ++eventSequence;
    enqueue(async () => {
      const body = sanitizeBody(request.postData() ?? undefined);
      events.push({
        ...(body === undefined ? {} : { body }),
        headers: sanitizeHeaders(await request.allHeaders()),
        id: idFor(request),
        method: request.method(),
        resourceType: request.resourceType(),
        sequence,
        type: 'request',
        url: sanitizeUrl(request.url()),
      });
    });
  });
  page.on('response', (response: Response) => {
    const sequence = ++eventSequence;
    enqueue(async () => {
      events.push({
        headers: sanitizeHeaders(await response.allHeaders()),
        id: idFor(response.request()),
        sequence,
        status: response.status(),
        type: 'response',
        url: sanitizeUrl(response.url()),
      });
    });
  });
  page.on('requestfailed', (request) => {
    events.push({
      error: sanitizeEvidenceText(request.failure()?.errorText ?? 'request failed'),
      id: idFor(request),
      sequence: ++eventSequence,
      type: 'failure',
      url: sanitizeUrl(request.url()),
    });
  });

  const snapshot = async () => {
    await Promise.all([...pending]);
    return structuredClone(events).sort((left, right) => left.sequence - right.sequence);
  };

  return {
    snapshot,
    async write(path) {
      const target = safeArtifactPath(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, `${JSON.stringify(await snapshot(), null, 2)}\n`, 'utf8');
    },
  };
}
