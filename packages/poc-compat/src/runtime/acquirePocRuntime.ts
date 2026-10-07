import type { BackendSrv } from '@grafana/runtime';

import type { PocHostConfig, NormalizedPocHostConfig } from '../config/hostConfig';
import { normalizePocHostConfig } from '../config/hostConfig';
import type {
  LoadGrafanaCohortOptions,
  GrafanaCohort,
  PocScenesModule,
} from '../config/loadGrafanaCohort';
import { loadGrafanaCohort } from '../config/loadGrafanaCohort';
import type { PocBootWindow } from '../config/installBootData';
import { installBootData } from '../config/installBootData';
import { createPocDashboardClient } from '../dashboard/loadDashboardV1';
import type { PocDashboardClient } from '../dashboard/types';
import type { PocAppEventBus, PocAppEventsInstallation } from '../events/installAppEvents';
import { installAppEvents } from '../events/installAppEvents';
import { initializePocI18n } from '../i18n/initializePocI18n';
import { sanitizeEvidenceText } from '../instrumentation/networkRecorder';
import { createResourceTracker } from '../instrumentation/resourceTracker';
import { installLocationPolicy } from '../location/locationPolicy';
import type { PocDataSourceConstructor } from '../datasource/pocDataSourceSrv';
import {
  createPocQueryEvidenceRecorder,
  type PocQueryEvidenceRecorder,
} from '../instrumentation/queryTrace';
import {
  installGateATextOptionEditors,
  isTextRuntimePanelCatalog,
} from '../panels/panelCatalog';
import {
  createPocBackendSrv,
  createTransportEvidenceRecorder,
  type PocTransportEvidenceRecorder,
} from '../network/backendSrvAdapter';
import type { PocGrafanaProviderValues } from '../theme/PocGrafanaProviders';
import { installAssetPolicy, type PocAssetWindow } from '../theme/assetPolicy';
import { createPocTheme } from '../theme/createPocTheme';
import {
  createPortalManager,
  type PocPortalDocument,
  type PocPortalElement,
  type PocPortalManager,
} from '../theme/portalManager';
import {
  createPocRuntimeIdentity,
  PocRuntimeConflictError,
  type PocRuntimeInstrumentationSink,
} from './runtimeIdentity';
import {
  installPocQueryRuntime,
  type PocQueryRuntime,
  type PocQueryRuntimeInitializationStep,
} from './installPocQueryRuntime';

export { PocRuntimeConflictError } from './runtimeIdentity';

export type PocRuntimeInitializationStep =
  | 'host-config-validated'
  | 'boot-data-installed'
  | 'asset-policy-installed'
  | 'grafana-cohort-loaded'
  | 'panel-catalog-installed'
  | 'text-option-editors-installed'
  | 'theme-selected'
  | 'i18n-initialized'
  | 'backend-transport-installed'
  | 'app-events-installed'
  | 'location-policy-installed'
  | PocQueryRuntimeInitializationStep
  | 'query-runtime-ready'
  | 'runtime-ready';

export interface PocQueryRuntimeOptions {
  readonly evidence?: PocQueryEvidenceRecorder;
  readonly loadDataSourceClass: () => Promise<PocDataSourceConstructor>;
  readonly moduleIdentity: string;
}

export interface PocDashboardScope {
  readonly instanceId: string;
  readonly portalRoot: PocPortalElement;
  release(): void;
}

export interface PocRuntimeLease {
  readonly appEvents: PocAppEventBus;
  readonly backendSrv: BackendSrv;
  readonly dashboardClient: PocDashboardClient;
  readonly fingerprint: string;
  readonly providerValues: PocGrafanaProviderValues;
  readonly scenes: PocScenesModule;
  readonly transportEvidence: PocTransportEvidenceRecorder;
  acquireQueryRuntime(options: PocQueryRuntimeOptions): Promise<PocQueryRuntime>;
  acquireDashboardScope(instanceId: string): PocDashboardScope;
  release(): void;
}

export interface PocRuntimeInspection {
  readonly activeDashboardScopes: number;
  readonly activeLeases: number;
  readonly failure?: string;
  readonly fingerprint?: string;
  readonly initializationSteps: readonly PocRuntimeInitializationStep[];
  readonly moduleIdentities?: GrafanaCohort['moduleIdentities'];
  readonly observedEventTypes: readonly string[];
  readonly portal: { readonly activeReferences: number; readonly ownsRoot: boolean };
  readonly queryRuntimeStatus: 'empty' | 'failed' | 'initializing' | 'ready';
  readonly status: 'empty' | 'failed' | 'initializing' | 'ready';
}

export interface PocRuntimeCoordinator {
  acquire(
    config: PocHostConfig,
    instrumentation?: PocRuntimeInstrumentationSink
  ): Promise<PocRuntimeLease>;
  inspect(): PocRuntimeInspection;
}

export interface PocRuntimeCoordinatorEnvironment {
  readonly document: PocPortalDocument;
  readonly loadCohort?: (options: LoadGrafanaCohortOptions) => Promise<GrafanaCohort>;
  readonly loadQueryRuntimeApis?: () => Promise<{
    initializeLoggersRegistry(): void;
    registerRuntimeDataSourceInstance: typeof import('@grafana/runtime/unstable')['registerRuntimeDataSourceInstance'];
  }>;
  readonly window: PocBootWindow & PocAssetWindow;
}

interface ReadyRuntime {
  readonly backendSrv: BackendSrv;
  readonly cohort: GrafanaCohort;
  readonly dashboardClient: PocDashboardClient;
  readonly events: PocAppEventsInstallation;
  readonly providerValues: PocGrafanaProviderValues;
  readonly transportEvidence: PocTransportEvidenceRecorder;
}

export function createPocRuntimeCoordinator(
  environment: PocRuntimeCoordinatorEnvironment
): PocRuntimeCoordinator {
  const resourceTracker = createResourceTracker();
  const portalManager: PocPortalManager = createPortalManager(environment.document, resourceTracker);
  const initializationSteps: PocRuntimeInitializationStep[] = [];
  const dashboardScopes = new Map<string, { leaseId: number; releasePortal(): void }>();
  let status: PocRuntimeInspection['status'] = 'empty';
  let fingerprint: string | undefined;
  let activeConfig: NormalizedPocHostConfig | undefined;
  let initialization: Promise<ReadyRuntime> | undefined;
  let readyRuntime: ReadyRuntime | undefined;
  let failure: string | undefined;
  let activeLeases = 0;
  let nextLeaseId = 0;
  let queryRuntimeStatus: PocRuntimeInspection['queryRuntimeStatus'] = 'empty';
  let queryRuntimePromise: Promise<PocQueryRuntime> | undefined;
  let queryRuntimeLoader: PocQueryRuntimeOptions['loadDataSourceClass'] | undefined;
  let queryRuntimeModuleIdentity: string | undefined;

  const recordStep = (
    step: PocRuntimeInitializationStep,
    instrumentation?: PocRuntimeInstrumentationSink
  ) => {
    initializationSteps.push(step);
    instrumentation?.record({ fingerprint, step, type: 'registration' });
  };

  const initialize = (
    config: NormalizedPocHostConfig,
    instrumentation?: PocRuntimeInstrumentationSink
  ): Promise<ReadyRuntime> => {
    status = 'initializing';
    recordStep('host-config-validated', instrumentation);

    return (async () => {
      const bootDataInstallation = installBootData(config, environment.window);
      recordStep('boot-data-installed', instrumentation);

      installAssetPolicy(config, environment.window);
      recordStep('asset-policy-installed', instrumentation);

      const cohort = await (environment.loadCohort ?? loadGrafanaCohort)({
        bootDataInstallation,
        target: environment.window,
      });
      recordStep('grafana-cohort-loaded', instrumentation);

      if (isTextRuntimePanelCatalog(config.panelCatalog)) {
        installGateATextOptionEditors(cohort.data.standardEditorsRegistry);
        recordStep('text-option-editors-installed', instrumentation);
        cohort.runtime.setPluginImportUtils(config.panelCatalog.pluginImportUtils);
        if (cohort.runtime.getPluginImportUtils() !== config.panelCatalog.pluginImportUtils) {
          throw new Error('Grafana Runtime did not retain the closed Text panel catalogue identity.');
        }
        recordStep('panel-catalog-installed', instrumentation);
      }

      const theme = createPocTheme(cohort);
      const providerValues: PocGrafanaProviderValues = {
        ThemeContext: cohort.data.ThemeContext,
        theme,
      };
      if (providerValues.theme !== cohort.runtime.config.theme2) {
        throw new Error('Runtime config and React provider must share one Grafana theme object.');
      }
      recordStep('theme-selected', instrumentation);

      await initializePocI18n(cohort, config.locale);
      recordStep('i18n-initialized', instrumentation);

      const transportEvidence = createTransportEvidenceRecorder();
      const backendSrv = createPocBackendSrv({
        evidence: transportEvidence,
        grafanaBasePath: config.grafanaBasePath,
        request: config.request,
      });
      cohort.runtime.setBackendSrv(backendSrv);
      if (cohort.runtime.getBackendSrv() !== backendSrv) {
        throw new Error('Grafana Runtime did not retain the POC BackendSrv identity.');
      }
      const dashboardClient = createPocDashboardClient({
        backendSrv,
        namespace: config.namespace,
        runtimeFingerprint: fingerprint!,
      });
      recordStep('backend-transport-installed', instrumentation);

      const events = installAppEvents(cohort, instrumentation);
      recordStep('app-events-installed', instrumentation);

      installLocationPolicy(cohort, instrumentation);
      recordStep('location-policy-installed', instrumentation);

      const result = {
        backendSrv,
        cohort,
        dashboardClient,
        events,
        providerValues,
        transportEvidence,
      } satisfies ReadyRuntime;
      readyRuntime = result;
      status = 'ready';
      recordStep('runtime-ready', instrumentation);
      return result;
    })().catch((error: unknown) => {
      status = 'failed';
      failure = sanitizeEvidenceText(error);
      instrumentation?.record({
        detail: failure,
        fingerprint,
        step: 'runtime-initialization',
        type: 'failure',
      });
      throw error;
    });
  };

  const makeLease = (
    runtime: ReadyRuntime,
    instrumentation?: PocRuntimeInstrumentationSink
  ): PocRuntimeLease => {
    const leaseId = ++nextLeaseId;
    const ownedScopes = new Set<string>();
    activeLeases += 1;
    instrumentation?.record({ fingerprint, step: 'runtime-lease-acquired', type: 'lifecycle' });
    let active = true;

    const releaseScope = (instanceId: string) => {
      const scope = dashboardScopes.get(instanceId);
      if (!scope || scope.leaseId !== leaseId) return;
      scope.releasePortal();
      dashboardScopes.delete(instanceId);
      ownedScopes.delete(instanceId);
      instrumentation?.record({
        detail: sanitizeEvidenceText(instanceId),
        fingerprint,
        step: 'dashboard-scope-released',
        type: 'lifecycle',
      });
    };

    return {
      appEvents: runtime.events.bus,
      backendSrv: runtime.backendSrv,
      dashboardClient: runtime.dashboardClient,
      fingerprint: fingerprint!,
      providerValues: runtime.providerValues,
      scenes: runtime.cohort.scenes,
      transportEvidence: runtime.transportEvidence,
      acquireQueryRuntime(options) {
        if (!active) {
          return Promise.reject(new Error('Cannot acquire query services from a released runtime lease.'));
        }
        if (
          queryRuntimePromise &&
          (queryRuntimeLoader !== options.loadDataSourceClass ||
            queryRuntimeModuleIdentity !== options.moduleIdentity)
        ) {
          return Promise.reject(
            new PocRuntimeConflictError(
              `${fingerprint}:query-runtime`,
              `${fingerprint}:conflicting-query-runtime`
            )
          );
        }
        if (!queryRuntimePromise) {
          queryRuntimeLoader = options.loadDataSourceClass;
          queryRuntimeModuleIdentity = options.moduleIdentity;
          queryRuntimeStatus = 'initializing';
          const evidence = options.evidence ?? createPocQueryEvidenceRecorder();
          queryRuntimePromise = (async () => {
            const queryRuntimeApis = await (
              environment.loadQueryRuntimeApis?.() ?? import('@grafana/runtime/unstable')
            );
            return installPocQueryRuntime({
              backendSrv: runtime.backendSrv,
              evidence,
              initializeLoggersRegistry: queryRuntimeApis.initializeLoggersRegistry,
              loadDataSourceClass: options.loadDataSourceClass,
              moduleIdentity: options.moduleIdentity,
              onStep: (step) => recordStep(step, instrumentation),
              registerRuntimeDataSourceInstance:
                queryRuntimeApis.registerRuntimeDataSourceInstance,
              runtime: runtime.cohort.runtime,
            });
          })()
            .then((queryRuntime) => {
              queryRuntimeStatus = 'ready';
              recordStep('query-runtime-ready', instrumentation);
              return queryRuntime;
            })
            .catch((error: unknown) => {
              queryRuntimeStatus = 'failed';
              throw error;
            });
        }
        return queryRuntimePromise;
      },
      acquireDashboardScope(instanceId) {
        if (!active) {
          throw new Error('Cannot acquire a dashboard scope from a released runtime lease.');
        }
        if (!instanceId || dashboardScopes.has(instanceId)) {
          throw new Error(`Dashboard scope ${instanceId || '<empty>'} is already active or invalid.`);
        }
        const portal = portalManager.acquire();
        ownedScopes.add(instanceId);
        dashboardScopes.set(instanceId, { leaseId, releasePortal: portal.release });
        instrumentation?.record({
          detail: sanitizeEvidenceText(instanceId),
          fingerprint,
          step: 'dashboard-scope-acquired',
          type: 'lifecycle',
        });
        let scopeActive = true;
        return {
          instanceId,
          portalRoot: portal.root,
          release() {
            if (!scopeActive) return;
            scopeActive = false;
            releaseScope(instanceId);
          },
        };
      },
      release() {
        if (!active) return;
        active = false;
        for (const instanceId of [...ownedScopes]) releaseScope(instanceId);
        activeLeases = Math.max(0, activeLeases - 1);
        instrumentation?.record({ fingerprint, step: 'runtime-lease-released', type: 'lifecycle' });
      },
    };
  };

  return {
    acquire(input, instrumentation) {
      // Validation is synchronous so credential-shaped or malformed host input is never retained.
      const config = normalizePocHostConfig(input);
      const requested = createPocRuntimeIdentity(config);

      if (fingerprint) {
        if (!activeConfig) {
          return Promise.reject(new Error('The POC runtime identity exists without active configuration.'));
        }
        const sameRequestFunction = activeConfig.request === config.request;
        const samePluginImportBoundary =
          activeConfig?.panelCatalog.panelIds.length === 0
            ? config.panelCatalog.panelIds.length === 0
            : isTextRuntimePanelCatalog(activeConfig.panelCatalog) &&
              isTextRuntimePanelCatalog(config.panelCatalog) &&
              activeConfig.panelCatalog.pluginImportUtils === config.panelCatalog.pluginImportUtils;
        if (fingerprint !== requested.fingerprint || !sameRequestFunction || !samePluginImportBoundary) {
          instrumentation?.record({
            fingerprint: requested.fingerprint,
            step: 'runtime-conflict',
            type: 'failure',
          });
          return Promise.reject(new PocRuntimeConflictError(fingerprint, requested.fingerprint));
        }
        if (status === 'failed') {
          return Promise.reject(new Error('The page-scoped POC runtime previously failed to initialize.'));
        }
      } else {
        fingerprint = requested.fingerprint;
        activeConfig = config;
        instrumentation?.record({ fingerprint, step: 'runtime-identity', type: 'registration' });
      }

      initialization ??= initialize(config, instrumentation);
      return initialization.then((runtime) => makeLease(runtime, instrumentation));
    },
    inspect() {
      return {
        activeDashboardScopes: dashboardScopes.size,
        activeLeases,
        ...(failure === undefined ? {} : { failure }),
        ...(fingerprint === undefined ? {} : { fingerprint }),
        initializationSteps: [...initializationSteps],
        ...(readyRuntime ? { moduleIdentities: structuredClone(readyRuntime.cohort.moduleIdentities) } : {}),
        observedEventTypes: readyRuntime?.events.snapshotObservedTypes() ?? [],
        portal: portalManager.inspect(),
        queryRuntimeStatus,
        status,
      };
    },
  };
}

let pageCoordinator: PocRuntimeCoordinator | undefined;

export function acquirePocRuntime(
  config: PocHostConfig,
  instrumentation?: PocRuntimeInstrumentationSink
): Promise<PocRuntimeLease> {
  pageCoordinator ??= createPocRuntimeCoordinator({
    document: document as unknown as PocPortalDocument,
    window: window as unknown as PocBootWindow & PocAssetWindow,
  });
  return pageCoordinator.acquire(config, instrumentation);
}

export function inspectPocRuntime(): PocRuntimeInspection {
  return (
    pageCoordinator?.inspect() ?? {
      activeDashboardScopes: 0,
      activeLeases: 0,
      initializationSteps: [],
      observedEventTypes: [],
      portal: { activeReferences: 0, ownsRoot: false },
      queryRuntimeStatus: 'empty',
      status: 'empty',
    }
  );
}
