import {
  GrafanaDashboard,
  POC_GATE_A_TEXT_PANEL_CATALOG,
  POC_GATE_B_TEXT_STAT_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  inspectPocRuntime,
  type PocDashboardSceneRoot,
  type PocRuntimeInspection,
  type PocRuntimeLease,
  type PocSceneConversionEvidenceEvent,
  type PocSceneConversionEvidenceRecorder,
} from '@grafana-react-sdk/poc-compat';
import {
  createTextPanelCatalog,
  createTextAndStatPanelCatalog,
  loadExactStatPanelPlugin,
  loadExactTextPanelPlugin,
  loadExactTestDataDataSourceClass,
  TESTDATA_MODULE_IDENTITY,
  type PanelPluginLoadEvent,
} from '@grafana-react-sdk/poc-grafana-bridge';
import { useCallback, useEffect, useState } from 'react';

const pluginEvents: PanelPluginLoadEvent[] = [];
const conversionEvents: PocSceneConversionEvidenceEvent[] = [];
const conversionEvidence: PocSceneConversionEvidenceRecorder = {
  record: (event) => conversionEvents.push(structuredClone(event)),
  snapshot: () => structuredClone(conversionEvents),
};
const observedScenes: PocDashboardSceneRoot[] = [];
let activeRuntimeLease: PocRuntimeLease | undefined;
const hostRequest = window.fetch.bind(window);
const textPluginCatalog = createTextPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadTextPlugin: loadExactTextPanelPlugin,
});
const gateBPluginCatalog = createTextAndStatPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadStatPlugin: loadExactStatPanelPlugin,
  loadTextPlugin: loadExactTextPanelPlugin,
});
const queryEvidence = createPocQueryEvidenceRecorder();
const gateAConfig = {
  assetBasePath: '/grafana/public/',
  grafanaBasePath: '/grafana',
  locale: 'en-US',
  namespace: 'default',
  panelCatalog: {
    ...POC_GATE_A_TEXT_PANEL_CATALOG,
    pluginImportUtils: textPluginCatalog,
  },
  request: hostRequest,
  theme: 'light',
  timezone: 'browser',
} as const;
const gateBConfig = {
  ...gateAConfig,
  panelCatalog: {
    ...POC_GATE_B_TEXT_STAT_PANEL_CATALOG,
    pluginImportUtils: gateBPluginCatalog,
  },
} as const;

export interface GateAHostInspection {
  readonly conversionEvents: readonly PocSceneConversionEvidenceEvent[];
  readonly plugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly pluginEvents: readonly PanelPluginLoadEvent[];
  readonly runtime: PocRuntimeInspection;
  readonly scenes: ReadonlyArray<{ readonly active: boolean; readonly uid: string }>;
  readonly theme?: { readonly isLight: boolean };
}

export interface GateBHostInspection {
  readonly conversionEvents: readonly PocSceneConversionEvidenceEvent[];
  readonly pluginEvents: readonly PanelPluginLoadEvent[];
  readonly queryEvents: ReturnType<typeof queryEvidence.snapshot>;
  readonly runtime: PocRuntimeInspection;
  readonly scenes: ReadonlyArray<{ readonly active: boolean; readonly uid: string }>;
  readonly statScene?: {
    readonly colorMode?: unknown;
    readonly reduction?: unknown;
    readonly thresholds?: unknown;
    readonly unit?: unknown;
  };
  readonly statPlugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly transport: ReturnType<PocRuntimeLease['transportEvidence']['snapshot']>;
}

export function inspectGateAHost(): GateAHostInspection {
  const plugin = textPluginCatalog.getPanelPluginFromCache('text');
  return {
    conversionEvents: structuredClone(conversionEvents),
    ...(plugin
      ? {
          plugin: {
            id: plugin.meta.id,
            module: plugin.meta.module,
            version: plugin.meta.info.version,
          },
        }
      : {}),
    pluginEvents: structuredClone(pluginEvents),
    runtime: inspectPocRuntime(),
    scenes: observedScenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    ...(activeRuntimeLease
      ? { theme: { isLight: activeRuntimeLease.providerValues.theme.isLight } }
      : {}),
  };
}

export function inspectGateBHost(): GateBHostInspection {
  const stat = gateBPluginCatalog.getPanelPluginFromCache('stat');
  const activeScene = [...observedScenes].reverse().find((scene) => scene.isActive);
  const statScene = inspectStatScene(activeScene);
  return {
    conversionEvents: structuredClone(conversionEvents),
    pluginEvents: structuredClone(pluginEvents),
    queryEvents: queryEvidence.snapshot(),
    runtime: inspectPocRuntime(),
    scenes: observedScenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    ...(statScene ? { statScene } : {}),
    ...(stat
      ? {
          statPlugin: {
            id: stat.meta.id,
            module: stat.meta.module,
            version: stat.meta.info.version,
          },
        }
      : {}),
    transport: activeRuntimeLease?.transportEvidence.snapshot() ?? [],
  };
}

interface GateBQueryRunnerHandle {
  readonly state?: { readonly queries?: ReadonlyArray<Record<string, unknown>> };
  runQueries?: () => void;
  setState?: (state: { readonly queries: ReadonlyArray<Record<string, unknown>> }) => void;
}

function getStatQueryRunner(scene: PocDashboardSceneRoot | undefined): GateBQueryRunnerHandle | undefined {
  if (!scene) return;
  const index = scene.state.legacyPanelIds.indexOf(2);
  const child = scene.state.body.state.children[index] as
    | { state?: { body?: { state?: { $data?: GateBQueryRunnerHandle } } } }
    | undefined;
  return child?.state?.body?.state?.$data;
}

function inspectStatScene(scene: PocDashboardSceneRoot | undefined) {
  if (!scene) return;
  const index = scene.state.legacyPanelIds.indexOf(2);
  const panel = (scene.state.body.state.children[index] as
    | {
        state?: {
          body?: {
            state?: {
              fieldConfig?: {
                defaults?: { thresholds?: unknown; unit?: unknown };
              };
              options?: { colorMode?: unknown; reduceOptions?: unknown };
            };
          };
        };
      }
    | undefined)?.state?.body?.state;
  if (!panel) return;
  return {
    colorMode: panel.options?.colorMode,
    reduction: panel.options?.reduceOptions,
    thresholds: panel.fieldConfig?.defaults?.thresholds,
    unit: panel.fieldConfig?.defaults?.unit,
  };
}

function refreshStat(scene: PocDashboardSceneRoot | undefined) {
  getStatQueryRunner(scene)?.runQueries?.();
}

function configureGateBQueryDiagnostic(scene: PocDashboardSceneRoot, mode: string | null) {
  if (mode !== 'server-error' && mode !== 'slow') return;
  const runner = getStatQueryRunner(scene);
  const queries = runner?.state?.queries;
  if (!runner?.setState || !queries) return;
  runner.setState({
    queries: queries.map((query) => ({
      ...query,
      scenarioId: mode === 'slow' ? 'slow_query' : 'server_error_500',
      ...(mode === 'slow' ? { stringInput: '5s' } : { errorType: 'server_panic' }),
    })),
  });
}

export function App() {
  const gate = new URLSearchParams(window.location.search).get('gate');
  const gateAEnabled = gate === 'a';
  const gateBEnabled = gate === 'b';
  const gateBQueryDiagnostic = new URLSearchParams(window.location.search).get('gateBQuery');
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>(
    'grsdk-phase0-poc'
  );

  useEffect(() => {
    if (!gateAEnabled && !gateBEnabled) {
      return;
    }

    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const releaseLease = () => {
      lease?.release();
      if (activeRuntimeLease === lease) activeRuntimeLease = undefined;
      lease = undefined;
    };
    void acquirePocRuntime(gateBEnabled ? gateBConfig : gateAConfig)
      .then(async (acquired) => {
        lease = acquired;
        if (gateBEnabled) {
          await acquired.acquireQueryRuntime({
            evidence: queryEvidence,
            loadDataSourceClass: loadExactTestDataDataSourceClass,
            moduleIdentity: TESTDATA_MODULE_IDENTITY,
          });
          // Populate the closed runtime cache before Scenes first renders.
          // Stat declares `setNoPadding()`: allowing the loading plugin to render
          // first makes React 19 observe PanelChrome changing from padded to
          // unpadded shorthand/longhand styles and emit an upstream warning.
          await Promise.allSettled([
            gateBPluginCatalog.importPanelPlugin('text'),
            gateBPluginCatalog.importPanelPlugin('stat'),
          ]);
        }
        if (disposed) {
          releaseLease();
          return;
        }
        activeRuntimeLease = acquired;
        setRuntime(acquired);
      })
      .catch((error: unknown) => {
        releaseLease();
        if (!disposed) {
          setRuntimeError(error instanceof Error ? error.message : 'Runtime initialization failed.');
        }
      });

    return () => {
      disposed = true;
      releaseLease();
    };
  }, [gateAEnabled, gateBEnabled]);

  const recordScene = useCallback(
    (scene: PocDashboardSceneRoot) => {
      if (gateBEnabled) configureGateBQueryDiagnostic(scene, gateBQueryDiagnostic);
      observedScenes.push(scene);
    },
    [gateBEnabled, gateBQueryDiagnostic]
  );

  return (
    <main className="poc-host" data-testid="poc-host-shell">
      <header className="poc-host__header">
        <p className="poc-host__eyebrow">Disposable research host</p>
        <h1>Standalone native-rendering POC</h1>
        <p>
          This independent React shell reserves a native DOM boundary for later Grafana rendering gates.
        </p>
      </header>

      <section className="poc-host__sentinel" aria-labelledby="host-sentinel-title">
        <h2 id="host-sentinel-title">Host style sentinel</h2>
        <p data-testid="host-style-sentinel">
          These host-owned styles must remain unchanged when Grafana styling is introduced.
        </p>
        <div
          className="poc-host__dashboard-boundary"
          data-testid="grafana-dashboard-root"
          aria-label="Grafana dashboard rendering boundary"
        >
          {gateAEnabled || gateBEnabled ? (
            <>
              <div className="poc-host__gate-controls">
                <button
                  data-testid={gateBEnabled ? 'gate-b-switch-uid' : 'gate-a-switch-uid'}
                  type="button"
                  onClick={() =>
                    setUid((current) =>
                      current === 'grsdk-phase0-poc'
                        ? 'grsdk-phase0-poc-alt'
                        : 'grsdk-phase0-poc'
                    )
                  }
                >
                  Switch fixture UID
                </button>
                {gateBEnabled ? (
                  <button
                    data-testid="gate-b-refresh"
                    type="button"
                    onClick={() =>
                      refreshStat([...observedScenes].reverse().find((scene) => scene.isActive))
                    }
                  >
                    Refresh Stat
                  </button>
                ) : null}
              </div>
              {runtimeError ? (
                <div data-poc-gate-a-error="runtime">{runtimeError}</div>
              ) : runtime ? (
                <PocGrafanaProviders values={runtime.providerValues}>
                  <GrafanaDashboard
                    catalog={
                      gateBEnabled
                        ? POC_GATE_B_TEXT_STAT_PANEL_CATALOG
                        : POC_GATE_A_TEXT_PANEL_CATALOG
                    }
                    conversionEvidence={conversionEvidence}
                    onSceneReady={recordScene}
                    runtime={runtime}
                    uid={uid}
                  />
                </PocGrafanaProviders>
              ) : (
                <div data-poc-gate-a-status="runtime-loading">Preparing compatibility runtime.</div>
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
