import type {
  SceneComponentProps,
  SceneGridLayout,
  SceneObject,
  SceneObjectState,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

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

export type PocDashboardSceneRoot = SceneObject<PocDashboardSceneState>;

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
  }

  return new PocDashboardSceneRootImplementation(state);
}

