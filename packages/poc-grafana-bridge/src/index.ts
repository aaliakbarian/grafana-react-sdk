export {
  createTextPanelCatalog,
  createTextAndStatPanelCatalog,
  createTextStatAndTimeSeriesPanelCatalog,
  installTextPanelCatalog,
  TEXT_MODULE_IDENTITY,
  TEXT_PLUGIN_ID,
  STAT_MODULE_IDENTITY,
  STAT_PLUGIN_ID,
  TIMESERIES_MODULE_IDENTITY,
  TIMESERIES_PLUGIN_ID,
} from './panels/catalog';
export { loadExactTextPanelPlugin } from './panels/text';
export { loadExactStatPanelPlugin } from './panels/stat';
export { loadExactTimeSeriesPanelPlugin } from './panels/timeseries';
export type {
  PanelPluginLoadEvent,
  PanelPluginLoadEvidence,
  PocPanelPluginCatalog,
} from './panels/types';
export {
  extractTestDataDataSourceClass,
  loadExactTestDataDataSourceClass,
  TESTDATA_MODULE_IDENTITY,
} from './datasources/testdata';
export type { TestDataDataSourceConstructor } from './datasources/testdata';
