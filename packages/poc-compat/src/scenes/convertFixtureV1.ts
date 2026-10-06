import type { SceneDataProvider, SceneGridItem, VizPanel } from '@grafana/scenes';

import type { PocScenesModule } from '../config/loadGrafanaCohort';
import {
  PocSceneConversionError,
  preflightFixtureV1,
  type PocFixtureDashboard,
  type PocFixturePanel,
  type PocFixturePanelType,
  type PocPanelCatalog,
} from '../dashboard/preflightFixture';
import type { PocDashboardV1Result } from '../dashboard/types';
import type { PocDashboardSceneRoot } from './PocDashboardSceneRoot';
import { createPocDashboardSceneRoot } from './PocDashboardSceneRoot';

export type PocSceneConversionEvidenceEvent =
  | {
      readonly layout: 'grid';
      readonly annotationPolicy: PocFixtureDashboard['annotationPolicy'];
      readonly outcome: 'success';
      readonly panelCount: number;
      readonly panelTypes: readonly PocFixturePanelType[];
      readonly uid: string;
    }
  | {
      readonly category: string;
      readonly layout: 'grid';
      readonly outcome: 'failure';
      readonly uid: string;
    };

export interface PocSceneConversionEvidenceRecorder {
  record(event: PocSceneConversionEvidenceEvent): void;
  snapshot(): readonly PocSceneConversionEvidenceEvent[];
}

export interface ConvertFixtureV1Options {
  readonly catalog: PocPanelCatalog;
  readonly evidence?: PocSceneConversionEvidenceRecorder;
  readonly input: PocDashboardV1Result;
  readonly runtime: { readonly scenes: PocScenesModule };
}

export interface PocDashboardSceneSnapshot {
  readonly active: boolean;
  readonly layout: 'grid';
  readonly panels: ReadonlyArray<{
    readonly dataProvider: 'none' | 'query' | 'transform';
    readonly gridPos: { readonly h: number; readonly w: number; readonly x: number; readonly y: number };
    readonly id: number;
    readonly queryCount: number;
    readonly type: string;
  }>;
  readonly refresh: '';
  readonly timeRange: { readonly from: string; readonly timeZone: string; readonly to: string };
  readonly title: string;
  readonly uid: string;
  readonly variables: ReadonlyArray<{
    readonly hide: unknown;
    readonly name: string;
    readonly value: unknown;
  }>;
}

export function createSceneConversionEvidenceRecorder(): PocSceneConversionEvidenceRecorder {
  const events: PocSceneConversionEvidenceEvent[] = [];
  return {
    record(event) {
      events.push(structuredClone(event));
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}

function createDataProvider(
  scenes: PocScenesModule,
  panel: PocFixturePanel
): SceneDataProvider | undefined {
  if (panel.targets.length === 0) return undefined;
  if (!panel.datasource) {
    throw new PocSceneConversionError(
      'conversion-invariant-violation',
      'A query-backed panel reached conversion without a datasource.',
      `panel:${panel.id}`
    );
  }
  const queryRunner = new scenes.SceneQueryRunner({
    datasource: structuredClone(panel.datasource),
    queries: [...structuredClone(panel.targets)],
    requestIdPrefix: `poc-panel-${panel.id}-`,
    runQueriesMode: 'auto',
  });
  if (panel.transformations.length === 0) return queryRunner;
  return new scenes.SceneDataTransformer({
    $data: queryRunner,
    transformations: [...structuredClone(panel.transformations)],
  });
}

function createPanel(
  scenes: PocScenesModule,
  panel: PocFixturePanel
): { readonly gridItem: SceneGridItem; readonly vizPanel: VizPanel } {
  const dataProvider = createDataProvider(scenes, panel);
  const vizPanel = new scenes.VizPanel({
    ...(dataProvider ? { $data: dataProvider } : {}),
    ...(panel.description === undefined ? {} : { description: panel.description }),
    displayMode: panel.transparent ? 'transparent' : 'default',
    fieldConfig: structuredClone(panel.fieldConfig),
    key: `panel-${panel.id}`,
    options: structuredClone(panel.options),
    pluginId: panel.type,
    pluginVersion: panel.pluginVersion,
    title: panel.title,
  });
  const gridItem = new scenes.SceneGridItem({
    body: vizPanel,
    height: panel.gridPos.h,
    isDraggable: false,
    isResizable: false,
    key: `grid-item-${panel.id}`,
    width: panel.gridPos.w,
    x: panel.gridPos.x,
    y: panel.gridPos.y,
  });
  return { gridItem, vizPanel };
}

function constructScene(
  dashboard: PocFixtureDashboard,
  scenes: PocScenesModule
): PocDashboardSceneRoot {
  const variables = dashboard.variables.map(
    (variable) =>
      new scenes.ConstantVariable({
        hide: variable.hide,
        label: variable.label,
        name: variable.name,
        skipUrlSync: variable.skipUrlSync,
        type: 'constant',
        value: variable.value,
      })
  );
  const panels = dashboard.panels.map((panel) => createPanel(scenes, panel));
  const body = new scenes.SceneGridLayout({
    children: panels.map(({ gridItem }) => gridItem),
    isDraggable: false,
    isLazy: false,
    isResizable: false,
  });
  const timeRange = new scenes.SceneTimeRange({
    fiscalYearStartMonth: dashboard.fiscalYearStartMonth,
    from: dashboard.time.from,
    timeZone: dashboard.timezone,
    to: dashboard.time.to,
  });
  const variableSet = new scenes.SceneVariableSet({ variables });

  return createPocDashboardSceneRoot(scenes, {
    $timeRange: timeRange,
    $variables: variableSet,
    body,
    description: dashboard.description,
    key: `dashboard-${dashboard.uid}`,
    legacyPanelIds: dashboard.panels.map(({ id }) => id),
    refresh: dashboard.refresh,
    title: dashboard.title,
    uid: dashboard.uid,
  });
}

export function convertFixtureV1ToScene({
  catalog,
  evidence,
  input,
  runtime,
}: ConvertFixtureV1Options): PocDashboardSceneRoot {
  const uid = input?.requestedUid ?? '<invalid>';
  try {
    const dashboard = preflightFixtureV1(input, catalog);
    const root = constructScene(dashboard, runtime.scenes);
    evidence?.record({
      annotationPolicy: dashboard.annotationPolicy,
      layout: 'grid',
      outcome: 'success',
      panelCount: dashboard.panels.length,
      panelTypes: dashboard.panels.map(({ type }) => type),
      uid: dashboard.uid,
    });
    return root;
  } catch (error: unknown) {
    const failure =
      error instanceof PocSceneConversionError
        ? error
        : new PocSceneConversionError(
            'conversion-invariant-violation',
            'A published Scenes constructor rejected the validated fixture graph.'
          );
    evidence?.record({
      category: failure.code,
      layout: 'grid',
      outcome: 'failure',
      uid,
    });
    throw failure;
  }
}

export function inspectPocDashboardScene(
  root: PocDashboardSceneRoot,
  scenes: PocScenesModule
): PocDashboardSceneSnapshot {
  const panels = root.state.body.state.children.map((child, index) => {
    const gridItem = child as SceneGridItem;
    const panel = gridItem.state.body as VizPanel;
    const provider = panel.state.$data;
    let dataProvider: 'none' | 'query' | 'transform' = 'none';
    let queryCount = 0;
    if (provider instanceof scenes.SceneDataTransformer) {
      dataProvider = 'transform';
      const source = provider.state.$data;
      if (source instanceof scenes.SceneQueryRunner) queryCount = source.state.queries.length;
    } else if (provider instanceof scenes.SceneQueryRunner) {
      dataProvider = 'query';
      queryCount = provider.state.queries.length;
    }
    return {
      dataProvider,
      gridPos: {
        h: gridItem.state.height ?? 0,
        w: gridItem.state.width ?? 0,
        x: gridItem.state.x ?? 0,
        y: gridItem.state.y ?? 0,
      },
      id: root.state.legacyPanelIds[index]!,
      queryCount,
      type: panel.state.pluginId,
    };
  });
  const variables = root.state.$variables.state.variables.map((variable) => ({
    hide: variable.state.hide,
    name: variable.state.name,
    value: variable instanceof scenes.ConstantVariable ? variable.state.value : undefined,
  }));

  return {
    active: root.isActive,
    layout: 'grid',
    panels,
    refresh: root.state.refresh,
    timeRange: {
      from: root.state.$timeRange.state.from,
      timeZone: String(root.state.$timeRange.state.timeZone),
      to: root.state.$timeRange.state.to,
    },
    title: root.state.title,
    uid: root.state.uid,
    variables,
  };
}
