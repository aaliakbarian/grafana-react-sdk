import type {
  DataRequestEnricher,
  SceneComponentProps,
  SceneGridLayout,
  SceneObject,
  SceneObjectState,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';
import type { DataQueryRequest } from '@grafana/data';

import type { PocScenesModule } from '../config/loadGrafanaCohort';

export interface PocDashboardSceneState extends SceneObjectState {
  readonly $timeRange: SceneTimeRange;
  readonly $variables: SceneVariableSet;
  readonly body: SceneGridLayout;
  readonly description: string;
  readonly legacyPanelIds: readonly number[];
  readonly refresh: '';
  readonly title: string;
  readonly uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt';
}

export type PocDashboardSceneRoot = SceneObject<PocDashboardSceneState> & DataRequestEnricher;

function PocDashboardSceneRootRenderer({ model }: SceneComponentProps<PocDashboardSceneRoot>) {
  const Body = model.state.body.Component;
  return <Body model={model.state.body} />;
}

export function createPocDashboardSceneRoot(
  scenes: PocScenesModule,
  state: PocDashboardSceneState
): PocDashboardSceneRoot {
  class PocDashboardSceneRootImplementation extends scenes.SceneObjectBase<PocDashboardSceneState> {
    static Component = PocDashboardSceneRootRenderer;

    enrichDataRequest(source: SceneObject): Partial<DataQueryRequest> | null {
      const prefix = (source.state as { requestIdPrefix?: unknown }).requestIdPrefix;
      const match = typeof prefix === 'string' ? /^poc-panel-(\d+)-$/.exec(prefix) : null;
      const panelId = match ? Number(match[1]) : undefined;
      if (!panelId) return null;
      const panelIndex = this.state.legacyPanelIds.indexOf(panelId);
      const gridItem = this.state.body.state.children[panelIndex];
      const panel = (gridItem?.state as { body?: unknown } | undefined)?.body as {
        state?: { pluginId?: unknown; title?: unknown };
      } | undefined;
      if (
        panelIndex < 0 ||
        typeof panel?.state?.pluginId !== 'string' ||
        typeof panel.state.title !== 'string'
      ) {
        return null;
      }
      return {
        dashboardTitle: this.state.title,
        dashboardUID: this.state.uid,
        panelId,
        panelName: panel.state.title,
        panelPluginId: panel.state.pluginId,
      };
    }
  }

  return new PocDashboardSceneRootImplementation(state);
}
