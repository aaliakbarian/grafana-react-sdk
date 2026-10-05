import type { ConsoleMessage, Page } from '@playwright/test';

import { sanitizeEvidenceText } from '../../../packages/poc-compat/src/instrumentation/networkRecorder';

export interface ConsoleAllowlistEntry {
  justification: string;
  pattern: RegExp;
}

export interface ConsoleEvidenceEntry {
  message: string;
  source: 'console-error' | 'console-warning' | 'page-crash' | 'page-error' | 'unhandled-rejection';
}

export interface ConsoleGuard {
  assertClean(): Promise<void>;
  snapshot(): Promise<readonly ConsoleEvidenceEntry[]>;
}

function consoleSource(message: ConsoleMessage): ConsoleEvidenceEntry['source'] | undefined {
  if (message.type() === 'error') {
    return 'console-error';
  }
  if (message.type() === 'warning') {
    return 'console-warning';
  }
  return undefined;
}

export async function installConsoleGuard(
  page: Page,
  allowlist: readonly ConsoleAllowlistEntry[] = []
): Promise<ConsoleGuard> {
  for (const entry of allowlist) {
    if (!entry.justification.trim()) {
      throw new Error(`Console allowlist pattern ${entry.pattern} requires a justification.`);
    }
  }

  const entries: ConsoleEvidenceEntry[] = [];
  const record = (source: ConsoleEvidenceEntry['source'], message: unknown) => {
    entries.push({ message: sanitizeEvidenceText(message), source });
  };

  await page.addInitScript(() => {
    const sanitize = (value: unknown) =>
      String(value)
        .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 <redacted>')
        .replace(
          /\b(authorization|cookie|password|secret|session|token|api[-_]?key)\s*[:=]\s*[^\s,;]+/gi,
          '$1=<redacted>'
        )
        .slice(0, 2_000);
    const rejections: string[] = [];
    Object.defineProperty(globalThis, '__POC_UNHANDLED_REJECTIONS__', {
      configurable: false,
      value: rejections,
      writable: false,
    });
    globalThis.addEventListener('unhandledrejection', (event) => {
      rejections.push(sanitize(event.reason instanceof Error ? event.reason.message : event.reason));
    });
  });

  page.on('console', (message) => {
    const source = consoleSource(message);
    if (source) {
      record(source, message.text());
    }
  });
  page.on('pageerror', (error) => record('page-error', error));
  page.on('crash', () => record('page-crash', 'Browser page crashed.'));

  const snapshot = async (): Promise<readonly ConsoleEvidenceEntry[]> => {
    const browserRejections = await page
      .evaluate(() =>
        [...((globalThis as typeof globalThis & { __POC_UNHANDLED_REJECTIONS__?: string[] })
          .__POC_UNHANDLED_REJECTIONS__ ?? [])]
      )
      .catch(() => [] as string[]);
    const combined = [
      ...entries,
      ...browserRejections.map((message) => ({
        message: sanitizeEvidenceText(message),
        source: 'unhandled-rejection' as const,
      })),
    ];
    return combined.filter(
      (entry) => !allowlist.some(({ pattern }) => pattern.test(`${entry.source}: ${entry.message}`))
    );
  };

  return {
    async assertClean() {
      const unexpected = await snapshot();
      if (unexpected.length > 0) {
        throw new Error(
          `Unexpected browser console/runtime evidence:\n${unexpected
            .map((entry) => `${entry.source}: ${entry.message}`)
            .join('\n')}`
        );
      }
    },
    snapshot,
  };
}
