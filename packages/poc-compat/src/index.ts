export { acquirePocRuntime, inspectPocRuntime } from './runtime/acquirePocRuntime';
export type { PocRuntimeInspection, PocRuntimeLease } from './runtime/acquirePocRuntime';
export { GrafanaDashboard } from './component/GrafanaDashboard';
export { PocGrafanaProviders } from './theme/PocGrafanaProviders';
export {
  POC_GATE_A_TEXT_PANEL_CATALOG,
  type PocPluginImportUtils,
} from './panels/panelCatalog';
export {
  POC_TASK7_PANEL_CATALOG,
  PocSceneConversionError,
} from './dashboard/preflightFixture';
export type {
  PocFixturePanelType,
  PocPanelCatalog,
  PocSceneConversionErrorCode,
} from './dashboard/preflightFixture';
export type {
  ExperimentalGrafanaDashboardComponent,
  ExperimentalGrafanaDashboardProps,
} from './component/types';
export type { PocDashboardSceneRoot } from './scenes/PocDashboardSceneRoot';
export type {
  PocSceneConversionEvidenceEvent,
  PocSceneConversionEvidenceRecorder,
} from './scenes/convertFixtureV1';

/**
 * Keeps Scenes value evaluation behind Task 5 runtime acquisition.
 */
export async function loadPocSceneConversion() {
  return import('./scenes/convertFixtureV1');
}

/**
 * Experimental, disposable component loader; this API is not a production SDK contract.
 */
export async function loadExperimentalGrafanaDashboard() {
  const module = await import('./component/GrafanaDashboard');
  return module.GrafanaDashboard;
}
