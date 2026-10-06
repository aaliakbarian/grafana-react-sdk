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

/**
 * Disposable Task 7 boundary. It deliberately renders only graph-ready status:
 * actual Scene/VizPanel activation and plugin rendering begin in Task 8 and later.
 */
export function GrafanaDashboard({
  catalog,
  conversionEvidence,
  onError,
  onSceneReady,
  runtime,
  uid,
}: ExperimentalGrafanaDashboardProps) {
  const reactId = useId();
  const lifecycle = useRef(createSceneGenerationController());
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    const scope = runtime.acquireDashboardScope(`task7-${reactId}`);
    const generation = lifecycle.current.begin(uid);
    setState({ status: 'loading' });

    void (async () => {
      try {
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
  }, [catalog, conversionEvidence, onError, onSceneReady, reactId, runtime, uid]);

  let content: ReactNode;
  if (state.status === 'error') {
    content = <div data-poc-dashboard-error={state.category}>Dashboard unavailable.</div>;
  } else if (state.status === 'ready') {
    content = (
      <div
        data-poc-dashboard-panel-count={state.scene.state.legacyPanelIds.length}
        data-poc-dashboard-status="scene-ready"
        data-poc-dashboard-uid={state.scene.state.uid}
      >
        Scene graph ready. Panel rendering is intentionally disabled in Task 7.
      </div>
    );
  } else {
    content = <div data-poc-dashboard-status="loading">Loading dashboard definition.</div>;
  }

  return <PocSceneErrorBoundary onError={onError}>{content}</PocSceneErrorBoundary>;
}
