import type { BackendSrv } from '@grafana/runtime';

import { dashboardTransportError, malformedDashboard, PocDashboardError } from './errors';
import {
  POC_DASHBOARD_API_GROUP,
  POC_DASHBOARD_API_VERSION,
  type PocDashboardApiDiscovery,
} from './types';

interface ApiVersionEntry {
  readonly groupVersion?: unknown;
  readonly version?: unknown;
}

function parseDiscovery(value: unknown): PocDashboardApiDiscovery {
  if (!value || typeof value !== 'object') throw malformedDashboard('$', 'discovery');
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== 'APIGroup') throw malformedDashboard('kind', 'discovery');
  if (candidate.name !== POC_DASHBOARD_API_GROUP) throw malformedDashboard('name', 'discovery');
  if (!Array.isArray(candidate.versions)) throw malformedDashboard('versions', 'discovery');

  const advertisedVersions = candidate.versions.map((entry: ApiVersionEntry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.version !== 'string') {
      throw malformedDashboard(`versions[${index}].version`, 'discovery');
    }
    return entry.version;
  });
  const preferred = candidate.preferredVersion;
  if (!preferred || typeof preferred !== 'object' || typeof (preferred as ApiVersionEntry).version !== 'string') {
    throw malformedDashboard('preferredVersion.version', 'discovery');
  }
  if (!advertisedVersions.includes(POC_DASHBOARD_API_VERSION)) {
    throw new PocDashboardError(
      'dashboard-api-version-unsupported',
      'Grafana does not advertise the required stable dashboard V1 API.',
      { advertisedVersions, stage: 'discovery' }
    );
  }

  return {
    advertisedVersions,
    group: POC_DASHBOARD_API_GROUP,
    preferredVersion: (preferred as ApiVersionEntry).version as string,
    stableV1Available: true,
    v2Available: advertisedVersions.includes('v2'),
  };
}

export function createDashboardApiDiscovery(backendSrv: BackendSrv, runtimeFingerprint: string) {
  let successful: PocDashboardApiDiscovery | undefined;
  let pending: Promise<PocDashboardApiDiscovery> | undefined;

  return async (signal?: AbortSignal): Promise<PocDashboardApiDiscovery> => {
    if (successful) return successful;
    pending ??= backendSrv
      .get<unknown>('/apis/dashboard.grafana.app/', undefined, `${runtimeFingerprint}:dashboard-discovery`, {
        abortSignal: signal,
      })
      .then(parseDiscovery)
      .then((result) => {
        successful = result;
        return result;
      })
      .catch((error: unknown) => {
        pending = undefined;
        if (error instanceof PocDashboardError) throw error;
        throw dashboardTransportError(error, 'discovery');
      });
    return pending;
  };
}
