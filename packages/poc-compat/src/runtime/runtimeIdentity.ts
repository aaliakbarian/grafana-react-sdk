import { createRuntimeFingerprint } from '../instrumentation/runtimeIdentity';
import { sanitizeEvidenceText } from '../instrumentation/networkRecorder';
import type { NormalizedPocHostConfig } from '../config/hostConfig';
import { POC_PACKAGE_VERSIONS } from '../config/loadGrafanaCohort';

export interface PocRuntimeIdentity {
  readonly assetBasePath: string;
  readonly grafanaBasePath: string;
  readonly locale: string;
  readonly namespace: string;
  readonly packages: typeof POC_PACKAGE_VERSIONS;
  readonly panelCatalogIdentity: string;
  readonly theme: string;
  readonly timezone: string;
}

export function createPocRuntimeIdentity(config: NormalizedPocHostConfig): {
  readonly fingerprint: string;
  readonly identity: PocRuntimeIdentity;
} {
  const identity: PocRuntimeIdentity = {
    assetBasePath: config.assetBasePath,
    grafanaBasePath: config.grafanaBasePath,
    locale: config.locale,
    namespace: config.namespace,
    packages: POC_PACKAGE_VERSIONS,
    panelCatalogIdentity: config.panelCatalog.identity,
    theme: config.theme,
    timezone: config.timezone,
  };
  const result = createRuntimeFingerprint({
    grafanaBasePath: identity.grafanaBasePath,
    locale: identity.locale,
    namespace: identity.namespace,
    packages: identity.packages,
    stylePolicy: JSON.stringify({
      assetBasePath: identity.assetBasePath,
      panelCatalogIdentity: identity.panelCatalogIdentity,
      theme: identity.theme,
      timezone: identity.timezone,
    }),
  });
  return { fingerprint: result.fingerprint, identity };
}

export type PocRuntimeEvidenceEvent = {
  readonly detail?: string;
  readonly fingerprint?: string;
  readonly sequence: number;
  readonly step: string;
  readonly type: 'failure' | 'lifecycle' | 'registration';
};

export interface PocRuntimeInstrumentationSink {
  record(event: Omit<PocRuntimeEvidenceEvent, 'sequence'>): void;
}

export interface PocRuntimeEvidenceRecorder extends PocRuntimeInstrumentationSink {
  snapshot(): readonly PocRuntimeEvidenceEvent[];
}

export function createRuntimeEvidenceRecorder(): PocRuntimeEvidenceRecorder {
  const events: PocRuntimeEvidenceEvent[] = [];
  return {
    record(event) {
      events.push({
        ...event,
        ...(event.detail === undefined ? {} : { detail: sanitizeEvidenceText(event.detail) }),
        sequence: events.length + 1,
      });
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}

export class PocRuntimeConflictError extends Error {
  readonly code = 'runtime-conflict';

  constructor(
    readonly activeFingerprint: string,
    readonly requestedFingerprint: string
  ) {
    super(
      `This JavaScript realm already owns POC runtime ${activeFingerprint}; ${requestedFingerprint} is incompatible.`
    );
    this.name = 'PocRuntimeConflictError';
  }
}
