const DASHBOARD_UID = 'grsdk-phase0-poc';
const ALTERNATE_DASHBOARD_UID = 'grsdk-phase0-poc-alt';
const DATASOURCE_UID = 'grsdk-testdata';
const DATASOURCE_TYPE = 'grafana-testdata-datasource';
const SCHEMA_VERSION = 42;

type JsonRecord = Record<string, unknown>;

export interface PocFixtureSummary {
  alternateDashboardUid: typeof ALTERNATE_DASHBOARD_UID;
  dashboardUid: typeof DASHBOARD_UID;
  datasourceUid: typeof DATASOURCE_UID;
  panelTypes: ['text', 'stat', 'timeseries', 'table'];
  schemaVersion: typeof SCHEMA_VERSION;
}

function fail(path: string, detail: string): never {
  throw new Error(`Invalid POC fixture at ${path}: ${detail}`);
}

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected an object');
  }

  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'expected an array');
  }

  return value;
}

function equal(value: unknown, expected: unknown, path: string): void {
  if (value !== expected) {
    fail(path, `expected ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`);
  }
}

function emptyArray(value: unknown, path: string): void {
  if (array(value, path).length !== 0) {
    fail(path, 'must remain empty for the controlled POC');
  }
}

function validateDatasource(value: unknown, path: string): void {
  const datasource = record(value, path);
  equal(datasource.type, DATASOURCE_TYPE, `${path}.type`);
  equal(datasource.uid, DATASOURCE_UID, `${path}.uid`);
}

function validateGridPosition(value: unknown, expected: JsonRecord, path: string): void {
  const gridPosition = record(value, path);
  for (const [key, expectedValue] of Object.entries(expected)) {
    equal(gridPosition[key], expectedValue, `${path}.${key}`);
  }
}

function validateThresholds(value: unknown, expectedValues: Array<number | null>, path: string): void {
  const thresholds = record(value, path);
  equal(thresholds.mode, 'absolute', `${path}.mode`);
  const steps = array(thresholds.steps, `${path}.steps`);
  equal(steps.length, expectedValues.length, `${path}.steps.length`);
  steps.forEach((step, index) => {
    equal(record(step, `${path}.steps[${index}]`).value, expectedValues[index], `${path}.steps[${index}].value`);
  });
}

function validateTargetList(panel: JsonRecord, panelIndex: number, expectedScenario: string): void {
  const targetsPath = `panels[${panelIndex}].targets`;
  const targets = array(panel.targets, targetsPath);
  equal(targets.length, 1, `${targetsPath}.length`);
  const path = `${targetsPath}[0]`;
  const target = record(targets[0], path);
  validateDatasource(target.datasource, `${path}.datasource`);
  equal(target.refId, 'A', `${path}.refId`);
  equal(target.scenarioId, expectedScenario, `${path}.scenarioId`);

  if (expectedScenario === 'predictable_pulse') {
    const pulse = record(target.pulseWave, `${path}.pulseWave`);
    equal(pulse.timeStep, 1, `${path}.pulseWave.timeStep`);
    equal(pulse.onCount, 5, `${path}.pulseWave.onCount`);
    equal(pulse.offCount, 5, `${path}.pulseWave.offCount`);
    equal(pulse.onValue, 90, `${path}.pulseWave.onValue`);
    equal(pulse.offValue, 10, `${path}.pulseWave.offValue`);
  }
}

function rejectTransformations(panel: JsonRecord, path: string): void {
  if ('transformations' in panel) {
    fail(`${path}.transformations`, 'transformations are unsupported for this panel');
  }
}

function validatePanelBase(panel: JsonRecord, index: number, id: number, type: string, gridPos: JsonRecord): void {
  const path = `panels[${index}]`;
  equal(panel.id, id, `${path}.id`);
  equal(panel.type, type, `${path}.type`);
  equal(panel.pluginVersion, '13.2.3', `${path}.pluginVersion`);
  validateGridPosition(panel.gridPos, gridPos, `${path}.gridPos`);
  if ('libraryPanel' in panel || 'repeat' in panel || 'alert' in panel) {
    fail(path, 'library panels, repeats, and alerts are unsupported');
  }
}

function validatePrimary(value: unknown): JsonRecord[] {
  const dashboard = record(value, '$');
  equal(dashboard.uid, DASHBOARD_UID, 'uid');
  equal(dashboard.schemaVersion, SCHEMA_VERSION, 'schemaVersion');
  equal(dashboard.timezone, 'browser', 'timezone');
  equal(dashboard.refresh, '', 'refresh');
  equal(dashboard.liveNow, false, 'liveNow');

  const time = record(dashboard.time, 'time');
  equal(time.from, 'now-1h', 'time.from');
  equal(time.to, 'now', 'time.to');

  emptyArray(record(dashboard.annotations, 'annotations').list, 'annotations.list');
  emptyArray(dashboard.links, 'links');

  const variables = array(record(dashboard.templating, 'templating').list, 'templating.list');
  equal(variables.length, 1, 'templating.list.length');
  const environment = record(variables[0], 'templating.list[0]');
  equal(environment.type, 'constant', 'templating.list[0].type');
  equal(environment.name, 'environment', 'templating.list[0].name');
  equal(environment.query, 'phase0', 'templating.list[0].query');

  const panels = array(dashboard.panels, 'panels').map((panel, index) => record(panel, `panels[${index}]`));
  equal(panels.length, 4, 'panels.length');

  const text = panels[0] ?? fail('panels[0]', 'missing Text panel');
  validatePanelBase(text, 0, 1, 'text', { h: 6, w: 8, x: 0, y: 0 });
  equal('targets' in text, false, 'panels[0].targets');
  rejectTransformations(text, 'panels[0]');
  const textOptions = record(text.options, 'panels[0].options');
  equal(textOptions.mode, 'markdown', 'panels[0].options.mode');
  if (typeof textOptions.content !== 'string' || !textOptions.content.includes('phase0')) {
    fail('panels[0].options.content', 'must contain the phase0 sentinel');
  }

  const stat = panels[1] ?? fail('panels[1]', 'missing Stat panel');
  validatePanelBase(stat, 1, 2, 'stat', { h: 6, w: 8, x: 8, y: 0 });
  validateDatasource(stat.datasource, 'panels[1].datasource');
  validateTargetList(stat, 1, 'predictable_pulse');
  rejectTransformations(stat, 'panels[1]');
  const statDefaults = record(record(stat.fieldConfig, 'panels[1].fieldConfig').defaults, 'panels[1].fieldConfig.defaults');
  equal(statDefaults.unit, 'percent', 'panels[1].fieldConfig.defaults.unit');
  validateThresholds(statDefaults.thresholds, [null, 50, 80], 'panels[1].fieldConfig.defaults.thresholds');
  const statOptions = record(stat.options, 'panels[1].options');
  equal(statOptions.colorMode, 'background', 'panels[1].options.colorMode');
  const reduceOptions = record(statOptions.reduceOptions, 'panels[1].options.reduceOptions');
  equal(array(reduceOptions.calcs, 'panels[1].options.reduceOptions.calcs')[0], 'lastNotNull', 'panels[1].options.reduceOptions.calcs[0]');

  const timeseries = panels[2] ?? fail('panels[2]', 'missing Time series panel');
  validatePanelBase(timeseries, 2, 3, 'timeseries', { h: 10, w: 16, x: 0, y: 6 });
  validateDatasource(timeseries.datasource, 'panels[2].datasource');
  validateTargetList(timeseries, 2, 'predictable_pulse');
  const transformations = array(timeseries.transformations, 'panels[2].transformations');
  equal(transformations.length, 1, 'panels[2].transformations.length');
  equal(record(transformations[0], 'panels[2].transformations[0]').id, 'renameByRegex', 'panels[2].transformations[0].id');

  const table = panels[3] ?? fail('panels[3]', 'missing Table panel');
  validatePanelBase(table, 3, 4, 'table', { h: 10, w: 8, x: 16, y: 0 });
  validateDatasource(table.datasource, 'panels[3].datasource');
  validateTargetList(table, 3, 'table_static');
  rejectTransformations(table, 'panels[3]');
  const tableDefaults = record(record(table.fieldConfig, 'panels[3].fieldConfig').defaults, 'panels[3].fieldConfig.defaults');
  const links = array(tableDefaults.links, 'panels[3].fieldConfig.defaults.links');
  const link = record(links[0], 'panels[3].fieldConfig.defaults.links[0]');
  if (typeof link.url !== 'string' || !link.url.startsWith('https://')) {
    fail('panels[3].fieldConfig.defaults.links[0].url', 'must be an external HTTPS URL');
  }

  return panels;
}

function validateAlternate(value: unknown): void {
  const dashboard = record(value, '$alternate');
  equal(dashboard.uid, ALTERNATE_DASHBOARD_UID, 'alternate.uid');
  equal(dashboard.schemaVersion, SCHEMA_VERSION, 'alternate.schemaVersion');
  equal(dashboard.timezone, 'browser', 'alternate.timezone');
  equal(dashboard.refresh, '', 'alternate.refresh');
  equal(dashboard.liveNow, false, 'alternate.liveNow');
  emptyArray(record(dashboard.annotations, 'alternate.annotations').list, 'alternate.annotations.list');
  emptyArray(dashboard.links, 'alternate.links');

  const variables = array(
    record(dashboard.templating, 'alternate.templating').list,
    'alternate.templating.list'
  );
  equal(variables.length, 1, 'alternate.templating.list.length');
  const environment = record(variables[0], 'alternate.templating.list[0]');
  equal(environment.type, 'constant', 'alternate.templating.list[0].type');
  equal(environment.name, 'environment', 'alternate.templating.list[0].name');
  equal(environment.query, 'phase0', 'alternate.templating.list[0].query');

  const panels = array(dashboard.panels, 'alternate.panels');
  equal(panels.length, 1, 'alternate.panels.length');
  const text = record(panels[0], 'alternate.panels[0]');
  validatePanelBase(text, 0, 1, 'text', { h: 8, w: 24, x: 0, y: 0 });
  equal('targets' in text, false, 'alternate.panels[0].targets');
  rejectTransformations(text, 'alternate.panels[0]');
  const options = record(text.options, 'alternate.panels[0].options');
  if (typeof options.content !== 'string' || !options.content.includes('phase0-alt')) {
    fail('alternate.panels[0].options.content', 'must contain the phase0-alt sentinel');
  }
}

export function validatePocFixtures(primary: unknown, alternate: unknown): PocFixtureSummary {
  const panels = validatePrimary(primary);
  validateAlternate(alternate);

  return {
    alternateDashboardUid: ALTERNATE_DASHBOARD_UID,
    dashboardUid: DASHBOARD_UID,
    datasourceUid: DATASOURCE_UID,
    panelTypes: panels.map((panel) => panel.type) as PocFixtureSummary['panelTypes'],
    schemaVersion: SCHEMA_VERSION,
  };
}
