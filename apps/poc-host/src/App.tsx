import {
  GrafanaDashboard,
  POC_GATE_A_TEXT_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  inspectPocRuntime,
  type PocDashboardSceneRoot,
  type PocRuntimeInspection,
  type PocRuntimeLease,
  type PocSceneConversionEvidenceEvent,
  type PocSceneConversionEvidenceRecorder,
} from '@grafana-react-sdk/poc-compat';
import {
  createTextPanelCatalog,
  loadExactTextPanelPlugin,
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

export interface GateAHostInspection {
  readonly conversionEvents: readonly PocSceneConversionEvidenceEvent[];
  readonly plugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly pluginEvents: readonly PanelPluginLoadEvent[];
  readonly runtime: PocRuntimeInspection;
  readonly scenes: ReadonlyArray<{ readonly active: boolean; readonly uid: string }>;
  readonly theme?: { readonly isLight: boolean };
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

export function App() {
  const gateAEnabled = new URLSearchParams(window.location.search).get('gate') === 'a';
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>(
    'grsdk-phase0-poc'
  );

  useEffect(() => {
    if (!gateAEnabled) {
      return;
    }

    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    void acquirePocRuntime(gateAConfig)
      .then((acquired) => {
        lease = acquired;
        if (disposed) {
          acquired.release();
          return;
        }
        activeRuntimeLease = acquired;
        setRuntime(acquired);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setRuntimeError(error instanceof Error ? error.message : 'Runtime initialization failed.');
        }
      });

    return () => {
      disposed = true;
      lease?.release();
      if (activeRuntimeLease === lease) activeRuntimeLease = undefined;
    };
  }, [gateAEnabled]);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => {
    observedScenes.push(scene);
  }, []);

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
          {gateAEnabled ? (
            <>
              <div className="poc-host__gate-controls">
                <button
                  data-testid="gate-a-switch-uid"
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
              </div>
              {runtimeError ? (
                <div data-poc-gate-a-error="runtime">{runtimeError}</div>
              ) : runtime ? (
                <PocGrafanaProviders values={runtime.providerValues}>
                  <GrafanaDashboard
                    catalog={POC_GATE_A_TEXT_PANEL_CATALOG}
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
