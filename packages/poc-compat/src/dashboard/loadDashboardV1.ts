import type { BackendSrv } from '@grafana/runtime';

import { classifyDashboardV1Dto } from './classifyDashboard';
import { createDashboardApiDiscovery } from './discoverDashboardApi';
import { dashboardTransportError, PocDashboardError } from './errors';
import type { PocDashboardClient } from './types';

export interface CreatePocDashboardClientOptions {
  readonly backendSrv: BackendSrv;
  readonly namespace: string;
  readonly runtimeFingerprint: string;
}

const validGrafanaUid = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function createPocDashboardClient({
  backendSrv,
  namespace,
  runtimeFingerprint,
}: CreatePocDashboardClientOptions): PocDashboardClient {
  const discover = createDashboardApiDiscovery(backendSrv, runtimeFingerprint);
  let requestSequence = 0;

  return {
    async loadByUid(uid, options = {}) {
      if (!validGrafanaUid.test(uid)) {
        throw new PocDashboardError(
          'dashboard-uid-invalid',
          'Dashboard uid must be a normal Grafana UID, not a title, slug, numeric ID, or resource UID.',
          { stage: 'input' }
        );
      }

      const discovery = await discover(options.signal);
      const requestId = `${runtimeFingerprint}:dashboard:${uid}:${++requestSequence}`;
      const endpoint = `/apis/dashboard.grafana.app/v1/namespaces/${encodeURIComponent(namespace)}/dashboards/${encodeURIComponent(uid)}/dto`;
      let value: unknown;
      try {
        value = await backendSrv.get<unknown>(endpoint, undefined, requestId, {
          abortSignal: options.signal,
        });
      } catch (error: unknown) {
        throw dashboardTransportError(error, 'dashboard-v1');
      }
      const dto = classifyDashboardV1Dto(value, uid, namespace);
      return {
        apiVersion: 'v1',
        discovery,
        dto,
        family: 'v1',
        requestedUid: uid,
        v2Available: discovery.v2Available,
      };
    },
  };
}
