import type { GrafanaCohort } from '../config/loadGrafanaCohort';
import type { PocRuntimeInstrumentationSink } from '../runtime/runtimeIdentity';

export class PocNavigationUnsupportedError extends Error {
  readonly code = 'navigation-unsupported';

  constructor(operation: string) {
    super(`Grafana navigation is unsupported by the standalone POC (${operation}).`);
    this.name = 'PocNavigationUnsupportedError';
  }
}

export interface PocLocationPolicy {
  readonly mode: 'read-only-host-location';
  readonly service: GrafanaCohort['runtime']['locationService'];
}

export function installLocationPolicy(
  cohort: GrafanaCohort,
  instrumentation?: PocRuntimeInstrumentationSink
): PocLocationPolicy {
  const service = cohort.runtime.locationService;
  const reject = (operation: string) => () => {
    instrumentation?.record({ detail: operation, step: 'navigation-rejected', type: 'failure' });
    throw new PocNavigationUnsupportedError(operation);
  };

  // Runtime's production setter is test-only. Patch only mutators on the already-created
  // page singleton; read APIs remain available without a Grafana route tree or router.
  for (const operation of [
    'go',
    'goBack',
    'goForward',
    'partial',
    'push',
    'reload',
    'replace',
    'update',
  ] as const) {
    if (typeof service[operation] === 'function') {
      service[operation] = reject(operation);
    }
  }
  const history =
    typeof service.getHistory === 'function'
      ? (service.getHistory as () => Record<string, unknown>)()
      : undefined;
  if (history && history !== service) {
    for (const operation of ['go', 'goBack', 'goForward', 'push', 'replace'] as const) {
      if (typeof history[operation] === 'function') {
        history[operation] = reject(`history.${operation}`);
      }
    }
  }

  instrumentation?.record({ step: 'location-policy', type: 'registration' });
  return { mode: 'read-only-host-location', service };
}
