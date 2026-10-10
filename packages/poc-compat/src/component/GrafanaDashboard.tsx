import { Component, useEffect, useId, useRef, useState, type ErrorInfo, type ReactNode } from 'react';

import type { PocDashboardSceneRoot } from '../scenes/PocDashboardSceneRoot';
import { createSceneGenerationController } from '../scenes/sceneLifecycle';
import type { ExperimentalGrafanaDashboardProps } from './types';

type DashboardState =
  | { readonly status: 'loading' }
  | { readonly category: string; readonly status: 'error' }
  | { readonly scene: PocDashboardSceneRoot; readonly status: 'ready' };

interface BoundaryProps {
  readonly children: ReactNode;
  readonly onError?: (error: Error) => void;
}

interface BoundaryState {
  readonly failed: boolean;
}

class PocSceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  override render() {
    if (this.state.failed) {
      return <div data-poc-dashboard-error="scene-render-failure">Scene boundary failed.</div>;
    }
    return this.props.children;
  }
}

function errorCategory(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'dashboard-conversion-failed';
}

/** Disposable Gate A boundary. It renders only the converter-admitted Scene graph. */
export function GrafanaDashboard({
  catalog,
  conversionEvidence,
  instanceId,
  onError,
  onSceneReady,
  runtime,
  uid,
}: ExperimentalGrafanaDashboardProps) {
  const reactId = useId();
  const lifecycle = useRef(createSceneGenerationController());
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    const scope = runtime.acquireDashboardScope(`poc-dashboard-${instanceId ?? reactId}`);
    const generation = lifecycle.current.begin(uid);
    setState({ status: 'loading' });

    void (async () => {
      try {
        // React StrictMode rehearses setup/cleanup synchronously. Yield once so
        // the rehearsal cannot start and poison a shared discovery request.
        await Promise.resolve();
        if (!generation.isCurrent()) return;
        const input = await runtime.dashboardClient.loadByUid(uid, { signal: generation.signal });
        const { convertFixtureV1ToScene } = await import('../scenes/convertFixtureV1');
        const scene = convertFixtureV1ToScene({
          catalog,
          evidence: conversionEvidence,
          input,
          runtime,
        });
        generation.publish(scene, (current) => {
          setState({ scene: current, status: 'ready' });
          onSceneReady?.(current);
        });
      } catch (error: unknown) {
        if (!generation.isCurrent()) return;
        const normalized = error instanceof Error ? error : new Error('Dashboard conversion failed.');
        generation.publish(errorCategory(error), (category) => {
          setState({ category, status: 'error' });
          onError?.(normalized);
        });
      }
    })();

    return () => {
      lifecycle.current.cancel();
      scope.release();
    };
  }, [catalog, conversionEvidence, instanceId, onError, onSceneReady, reactId, runtime, uid]);

  let content: ReactNode;
  if (state.status === 'error') {
    content = <div data-poc-dashboard-error={state.category}>Dashboard unavailable.</div>;
  } else if (state.status === 'ready') {
    const Scene = state.scene.Component;
    content = (
      <div
        className="poc-grafana-dashboard"
        data-poc-dashboard-instance={instanceId ?? reactId}
        data-poc-dashboard-panel-count={state.scene.state.legacyPanelIds.length}
        data-poc-dashboard-status="rendering"
        data-poc-dashboard-uid={state.scene.state.uid}
      >
        <Scene model={state.scene} />
      </div>
    );
  } else {
    content = <div data-poc-dashboard-status="loading">Loading dashboard definition.</div>;
  }

  return (
    <PocSceneErrorBoundary key={uid} onError={onError}>
      {content}
    </PocSceneErrorBoundary>
  );
}
