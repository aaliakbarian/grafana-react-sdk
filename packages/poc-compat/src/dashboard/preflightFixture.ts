import type { DataQuery, DataSourceRef, DataTransformerConfig, FieldConfigSource } from '@grafana/data';

import type { PocDashboardV1Result } from './types';

export const POC_FIXTURE_DATASOURCE = {
  type: 'grafana-testdata-datasource',
  uid: 'grsdk-testdata',
} as const;

export const POC_TASK7_PANEL_TYPES = ['text', 'stat', 'timeseries', 'table'] as const;
export type PocFixturePanelType = (typeof POC_TASK7_PANEL_TYPES)[number];

export interface PocPanelCatalog {
  readonly identity: string;
  readonly panelIds: readonly PocFixturePanelType[];
}

export const POC_TASK7_PANEL_CATALOG: PocPanelCatalog = {
  identity: 'task7-fixture-definitions-only',
  panelIds: POC_TASK7_PANEL_TYPES,
};

export type PocSceneConversionErrorCode =
  | 'unsupported-schema'
  | 'unsupported-panel-type'
  | 'unsupported-layout'
  | 'unsupported-dashboard-feature'
  | 'malformed-validated-input'
  | 'conversion-invariant-violation';

export class PocSceneConversionError extends Error {
  readonly code: PocSceneConversionErrorCode;
  readonly path?: string;

  constructor(code: PocSceneConversionErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'PocSceneConversionError';
    this.code = code;
    if (path) this.path = path;
  }
}

export interface PocFixtureGridPosition {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

export interface PocFixtureConstantVariable {
  readonly hide: 2;
  readonly label: string;
  readonly name: string;
  readonly skipUrlSync: true;
  readonly type: 'constant';
  readonly value: string;
}

export interface PocFixturePanel {
  readonly datasource?: DataSourceRef;
  readonly description?: string;
  readonly fieldConfig: FieldConfigSource;
  readonly gridPos: PocFixtureGridPosition;
  readonly id: number;
  readonly options: Record<string, unknown>;
  readonly pluginVersion: '13.2.3';
  readonly targets: readonly DataQuery[];
  readonly title: string;
  readonly transformations: readonly DataTransformerConfig[];
  readonly transparent: boolean;
  readonly type: PocFixturePanelType;
}

export interface PocFixtureDashboard {
  readonly annotationPolicy: 'builtin-default-omitted' | 'none';
  readonly description: string;
  readonly fiscalYearStartMonth: 0;
  readonly panels: readonly PocFixturePanel[];
  readonly refresh: '';
  readonly schemaVersion: 42;
  readonly time: { readonly from: string; readonly to: string };
  readonly timezone: 'browser';
  readonly title: string;
  readonly uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt';
  readonly variables: readonly PocFixtureConstantVariable[];
}

const fixtureUids = new Set(['grsdk-phase0-poc', 'grsdk-phase0-poc-alt']);
const panelTypes = new Set<string>(POC_TASK7_PANEL_TYPES);
const allowedSpecKeys = new Set([
  'annotations',
  'description',
  'editable',
  'fiscalYearStartMonth',
  'graphTooltip',
  'id',
  'links',
  'liveNow',
  'panels',
  'preload',
  'refresh',
  'schemaVersion',
  'tags',
  'templating',
  'time',
  'timepicker',
  'timezone',
  'title',
  'uid',
  'version',
  'weekStart',
]);
const allowedPanelKeys = new Set([
  'datasource',
  'description',
  'fieldConfig',
  'gridPos',
  'id',
  'links',
  'options',
  'pluginVersion',
  'targets',
  'title',
  'transformations',
  'transparent',
  'type',
]);
const optionKeys: Record<PocFixturePanelType, ReadonlySet<string>> = {
  stat: new Set([
    'colorMode',
    'graphMode',
    'justifyMode',
    'orientation',
    'percentChangeColorMode',
    'reduceOptions',
    'showPercentChange',
    'textMode',
    'wideLayout',
  ]),
  table: new Set(['cellHeight', 'footer', 'showHeader']),
  text: new Set(['code', 'content', 'mode']),
  timeseries: new Set(['legend', 'tooltip']),
};
const fieldDefaultKeys: Record<PocFixturePanelType, ReadonlySet<string>> = {
  stat: new Set(['color', 'mappings', 'thresholds', 'unit']),
  table: new Set(['custom', 'links', 'thresholds', 'unit']),
  text: new Set(),
  timeseries: new Set(['color', 'custom', 'max', 'min', 'thresholds', 'unit']),
};
const expectedLayout = {
  'grsdk-phase0-poc': [
    { gridPos: { h: 6, w: 8, x: 0, y: 0 }, id: 1, type: 'text' },
    { gridPos: { h: 6, w: 8, x: 8, y: 0 }, id: 2, type: 'stat' },
    { gridPos: { h: 10, w: 16, x: 0, y: 6 }, id: 3, type: 'timeseries' },
    { gridPos: { h: 10, w: 8, x: 16, y: 0 }, id: 4, type: 'table' },
  ],
  'grsdk-phase0-poc-alt': [
    { gridPos: { h: 8, w: 24, x: 0, y: 0 }, id: 1, type: 'text' },
  ],
} as const;

function conversionError(
  code: PocSceneConversionErrorCode,
  path: string,
  message: string
): never {
  throw new PocSceneConversionError(code, message, path);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    conversionError('malformed-validated-input', path, `Expected an object at ${path}.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    conversionError('malformed-validated-input', path, `Expected an array at ${path}.`);
  }
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    conversionError('malformed-validated-input', path, `Expected a string at ${path}.`);
  }
  return value;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string
) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      conversionError(
        'unsupported-dashboard-feature',
        `${path}.${key}`,
        `Task 7 does not support ${path}.${key}.`
      );
    }
  }
}

function requireEmptyArray(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length !== 0) {
    conversionError(
      'unsupported-dashboard-feature',
      path,
      `Task 7 requires ${path} to be empty.`
    );
  }
}

function dataSource(value: unknown, path: string): DataSourceRef {
  const source = record(value, path);
  rejectUnknownKeys(source, new Set(['type', 'uid']), path);
  if (
    source.type !== POC_FIXTURE_DATASOURCE.type ||
    source.uid !== POC_FIXTURE_DATASOURCE.uid
  ) {
    conversionError(
      'unsupported-dashboard-feature',
      path,
      'Task 7 supports only the deterministic TestData datasource.'
    );
  }
  return { type: POC_FIXTURE_DATASOURCE.type, uid: POC_FIXTURE_DATASOURCE.uid };
}

function gridPosition(value: unknown, path: string): PocFixtureGridPosition {
  const grid = record(value, path);
  rejectUnknownKeys(grid, new Set(['h', 'w', 'x', 'y']), path);
  for (const key of ['h', 'w', 'x', 'y'] as const) {
    if (!Number.isInteger(grid[key]) || (grid[key] as number) < 0) {
      conversionError('malformed-validated-input', `${path}.${key}`, 'Grid values must be non-negative integers.');
    }
  }
  if ((grid.h as number) < 1 || (grid.w as number) < 1 || (grid.x as number) + (grid.w as number) > 24) {
    conversionError('unsupported-layout', path, 'Grid position falls outside the fixed 24-column layout.');
  }
  return { h: grid.h as number, w: grid.w as number, x: grid.x as number, y: grid.y as number };
}

function validateThresholds(value: unknown, path: string) {
  const thresholds = record(value, path);
  rejectUnknownKeys(thresholds, new Set(['mode', 'steps']), path);
  if (thresholds.mode !== 'absolute') {
    conversionError('unsupported-dashboard-feature', `${path}.mode`, 'Only absolute fixture thresholds are supported.');
  }
  for (const [index, candidate] of array(thresholds.steps, `${path}.steps`).entries()) {
    const step = record(candidate, `${path}.steps[${index}]`);
    rejectUnknownKeys(step, new Set(['color', 'value']), `${path}.steps[${index}]`);
    if (
      typeof step.color !== 'string' ||
      (step.value !== undefined && step.value !== null && typeof step.value !== 'number')
    ) {
      conversionError('malformed-validated-input', `${path}.steps[${index}]`, 'Threshold steps require color and numeric/null value.');
    }
  }
}

function validateCustomFieldConfig(
  value: unknown,
  type: PocFixturePanelType,
  path: string
) {
  const custom = record(value, path);
  if (type === 'timeseries') {
    rejectUnknownKeys(
      custom,
      new Set([
        'axisBorderShow',
        'axisCenteredZero',
        'axisColorMode',
        'axisLabel',
        'axisPlacement',
        'barAlignment',
        'drawStyle',
        'fillOpacity',
        'gradientMode',
        'hideFrom',
        'insertNulls',
        'lineInterpolation',
        'lineWidth',
        'pointSize',
        'scaleDistribution',
        'showPoints',
        'spanNulls',
        'stacking',
        'thresholdsStyle',
      ]),
      path
    );
    const hideFrom = record(custom.hideFrom, `${path}.hideFrom`);
    rejectUnknownKeys(hideFrom, new Set(['legend', 'tooltip', 'viz']), `${path}.hideFrom`);
    const scaleDistribution = record(custom.scaleDistribution, `${path}.scaleDistribution`);
    rejectUnknownKeys(scaleDistribution, new Set(['type']), `${path}.scaleDistribution`);
    const stacking = record(custom.stacking, `${path}.stacking`);
    rejectUnknownKeys(stacking, new Set(['group', 'mode']), `${path}.stacking`);
    const thresholdsStyle = record(custom.thresholdsStyle, `${path}.thresholdsStyle`);
    rejectUnknownKeys(thresholdsStyle, new Set(['mode']), `${path}.thresholdsStyle`);
  } else if (type === 'table') {
    rejectUnknownKeys(custom, new Set(['align', 'cellOptions', 'filterable', 'inspect']), path);
    const cellOptions = record(custom.cellOptions, `${path}.cellOptions`);
    rejectUnknownKeys(cellOptions, new Set(['type']), `${path}.cellOptions`);
  } else {
    conversionError('unsupported-dashboard-feature', path, `${type} does not use custom field configuration in the fixture.`);
  }
}

function validateFieldConfig(value: unknown, type: PocFixturePanelType, path: string): FieldConfigSource {
  const fieldConfig = record(value, path);
  rejectUnknownKeys(fieldConfig, new Set(['defaults', 'overrides']), path);
  const defaults = record(fieldConfig.defaults, `${path}.defaults`);
  rejectUnknownKeys(defaults, fieldDefaultKeys[type], `${path}.defaults`);
  requireEmptyArray(fieldConfig.overrides, `${path}.overrides`);

  if (defaults.color !== undefined) {
    const color = record(defaults.color, `${path}.defaults.color`);
    rejectUnknownKeys(color, new Set(['mode']), `${path}.defaults.color`);
    string(color.mode, `${path}.defaults.color.mode`);
  }
  if (defaults.thresholds !== undefined) {
    validateThresholds(defaults.thresholds, `${path}.defaults.thresholds`);
  }
  if (defaults.mappings !== undefined) {
    requireEmptyArray(defaults.mappings, `${path}.defaults.mappings`);
  }
  if (defaults.custom !== undefined) {
    validateCustomFieldConfig(defaults.custom, type, `${path}.defaults.custom`);
  }
  if (defaults.unit !== undefined) string(defaults.unit, `${path}.defaults.unit`);
  for (const numeric of ['min', 'max']) {
    if (defaults[numeric] !== undefined && typeof defaults[numeric] !== 'number') {
      conversionError('malformed-validated-input', `${path}.defaults.${numeric}`, `${numeric} must be numeric.`);
    }
  }

  if (type === 'table' && defaults.links !== undefined) {
    const links = array(defaults.links, `${path}.defaults.links`);
    for (const [index, candidate] of links.entries()) {
      const link = record(candidate, `${path}.defaults.links[${index}]`);
      rejectUnknownKeys(link, new Set(['targetBlank', 'title', 'url']), `${path}.defaults.links[${index}]`);
      if (
        link.targetBlank !== true ||
        typeof link.title !== 'string' ||
        typeof link.url !== 'string' ||
        !link.url.startsWith('https://')
      ) {
        conversionError(
          'unsupported-dashboard-feature',
          `${path}.defaults.links[${index}]`,
          'The Table fixture supports only its explicit HTTPS field link shape.'
        );
      }
    }
  }

  return structuredClone(fieldConfig) as unknown as FieldConfigSource;
}

function validateOptions(value: unknown, type: PocFixturePanelType, path: string): Record<string, unknown> {
  const options = record(value, path);
  rejectUnknownKeys(options, optionKeys[type], path);
  if (type === 'text') {
    const code = record(options.code, `${path}.code`);
    rejectUnknownKeys(code, new Set(['language', 'showLineNumbers', 'showMiniMap']), `${path}.code`);
    if (options.mode !== 'markdown' || typeof options.content !== 'string') {
      conversionError('unsupported-dashboard-feature', path, 'Task 7 supports only the Markdown Text fixture.');
    }
  } else if (type === 'stat') {
    const reduceOptions = record(options.reduceOptions, `${path}.reduceOptions`);
    rejectUnknownKeys(
      reduceOptions,
      new Set(['calcs', 'fields', 'values']),
      `${path}.reduceOptions`
    );
  } else if (type === 'timeseries') {
    const legend = record(options.legend, `${path}.legend`);
    rejectUnknownKeys(
      legend,
      new Set(['calcs', 'displayMode', 'placement', 'showLegend']),
      `${path}.legend`
    );
    const tooltip = record(options.tooltip, `${path}.tooltip`);
    rejectUnknownKeys(tooltip, new Set(['hideZeros', 'mode', 'sort']), `${path}.tooltip`);
  } else {
    const footer = record(options.footer, `${path}.footer`);
    rejectUnknownKeys(
      footer,
      new Set(['countRows', 'enablePagination', 'fields', 'reducer', 'show']),
      `${path}.footer`
    );
  }
  return structuredClone(options);
}

function validateTargets(
  value: unknown,
  type: PocFixturePanelType,
  panelDatasource: DataSourceRef | undefined,
  path: string
): DataQuery[] {
  if (type === 'text') {
    if (value === undefined) return [];
    requireEmptyArray(value, path);
    return [];
  }
  const targets = array(value, path);
  if (targets.length !== 1 || !panelDatasource) {
    conversionError('unsupported-dashboard-feature', path, 'Query-backed fixture panels require one TestData target.');
  }
  const target = record(targets[0], `${path}[0]`);
  const allowed =
    type === 'table'
      ? new Set(['datasource', 'refId', 'scenarioId'])
      : new Set(['alias', 'datasource', 'pulseWave', 'refId', 'scenarioId']);
  rejectUnknownKeys(target, allowed, `${path}[0]`);
  dataSource(target.datasource, `${path}[0].datasource`);
  if (target.refId !== 'A') {
    conversionError('unsupported-dashboard-feature', `${path}[0].refId`, 'The fixture requires target refId A.');
  }
  const expectedScenario = type === 'table' ? 'table_static' : 'predictable_pulse';
  if (target.scenarioId !== expectedScenario) {
    conversionError('unsupported-dashboard-feature', `${path}[0].scenarioId`, 'Unsupported TestData scenario.');
  }
  if (expectedScenario === 'predictable_pulse') {
    const pulse = record(target.pulseWave, `${path}[0].pulseWave`);
    rejectUnknownKeys(pulse, new Set(['offCount', 'offValue', 'onCount', 'onValue', 'timeStep']), `${path}[0].pulseWave`);
    for (const key of ['offCount', 'offValue', 'onCount', 'onValue', 'timeStep']) {
      if (typeof pulse[key] !== 'number') {
        conversionError('malformed-validated-input', `${path}[0].pulseWave.${key}`, 'Pulse values must be numeric.');
      }
    }
  }
  return structuredClone(targets) as DataQuery[];
}

function validateTransformations(
  value: unknown,
  type: PocFixturePanelType,
  path: string
): DataTransformerConfig[] {
  if (value === undefined) {
    if (type === 'timeseries') {
      conversionError('unsupported-dashboard-feature', path, 'The Time series fixture requires renameByRegex.');
    }
    return [];
  }
  const transformations = array(value, path);
  if (type !== 'timeseries') {
    requireEmptyArray(transformations, path);
    return [];
  }
  if (transformations.length !== 1) {
    conversionError('unsupported-dashboard-feature', path, 'The Time series fixture requires exactly one transform.');
  }
  const transformation = record(transformations[0], `${path}[0]`);
  rejectUnknownKeys(transformation, new Set(['id', 'options']), `${path}[0]`);
  const options = record(transformation.options, `${path}[0].options`);
  rejectUnknownKeys(options, new Set(['regex', 'renamePattern']), `${path}[0].options`);
  if (
    transformation.id !== 'renameByRegex' ||
    typeof options.regex !== 'string' ||
    typeof options.renamePattern !== 'string'
  ) {
    conversionError('unsupported-dashboard-feature', path, 'Task 7 supports only renameByRegex.');
  }
  return structuredClone(transformations) as DataTransformerConfig[];
}

function validatePanel(
  value: unknown,
  index: number
): PocFixturePanel {
  const path = `spec.panels[${index}]`;
  const panel = record(value, path);
  const typeValue = panel.type;
  if (typeValue === 'row') {
    conversionError('unsupported-layout', `${path}.type`, 'Rows are outside the fixed grid layout.');
  }
  if (typeof typeValue !== 'string' || !panelTypes.has(typeValue)) {
    conversionError('unsupported-panel-type', `${path}.type`, 'Panel type is outside the Task 7 fixture catalog.');
  }
  const type = typeValue as PocFixturePanelType;
  rejectUnknownKeys(panel, allowedPanelKeys, path);
  for (const feature of ['alert', 'libraryPanel', 'repeat', 'repeatDirection', 'maxPerRow', 'timeFrom', 'timeShift']) {
    if (feature in panel) {
      conversionError('unsupported-dashboard-feature', `${path}.${feature}`, `Task 7 does not support ${feature}.`);
    }
  }
  if (panel.links !== undefined) requireEmptyArray(panel.links, `${path}.links`);
  if (!Number.isInteger(panel.id) || (panel.id as number) < 1) {
    conversionError('malformed-validated-input', `${path}.id`, 'Panel id must be a positive integer.');
  }
  if (panel.pluginVersion !== '13.2.3') {
    conversionError('unsupported-dashboard-feature', `${path}.pluginVersion`, 'Panel pluginVersion must be 13.2.3.');
  }
  const datasource = panel.datasource === undefined ? undefined : dataSource(panel.datasource, `${path}.datasource`);
  if (type === 'text' && datasource !== undefined) {
    conversionError('unsupported-dashboard-feature', `${path}.datasource`, 'The Text fixture is query-free.');
  }
  const description = panel.description === undefined ? undefined : string(panel.description, `${path}.description`);
  if (panel.transparent !== undefined && typeof panel.transparent !== 'boolean') {
    conversionError('malformed-validated-input', `${path}.transparent`, 'transparent must be boolean.');
  }
  return {
    ...(datasource ? { datasource } : {}),
    ...(description === undefined ? {} : { description }),
    fieldConfig:
      panel.fieldConfig === undefined && type === 'text'
        ? { defaults: {}, overrides: [] }
        : validateFieldConfig(panel.fieldConfig, type, `${path}.fieldConfig`),
    gridPos: gridPosition(panel.gridPos, `${path}.gridPos`),
    id: panel.id as number,
    options: validateOptions(panel.options, type, `${path}.options`),
    pluginVersion: '13.2.3',
    targets: validateTargets(panel.targets, type, datasource, `${path}.targets`),
    title: string(panel.title, `${path}.title`),
    transformations: validateTransformations(panel.transformations, type, `${path}.transformations`),
    transparent: panel.transparent === true,
    type,
  };
}

function validateVariables(value: unknown): PocFixtureConstantVariable[] {
  const templating = record(value, 'spec.templating');
  rejectUnknownKeys(templating, new Set(['list']), 'spec.templating');
  const variables = array(templating.list, 'spec.templating.list');
  if (variables.length !== 1) {
    conversionError('unsupported-dashboard-feature', 'spec.templating.list', 'The fixture requires one constant variable.');
  }
  const variable = record(variables[0], 'spec.templating.list[0]');
  rejectUnknownKeys(
    variable,
    new Set(['current', 'hide', 'label', 'name', 'query', 'skipUrlSync', 'type']),
    'spec.templating.list[0]'
  );
  if (variable.type !== 'constant') {
    conversionError('unsupported-dashboard-feature', 'spec.templating.list[0].type', 'Only constant variables are supported.');
  }
  const current = record(variable.current, 'spec.templating.list[0].current');
  rejectUnknownKeys(current, new Set(['selected', 'text', 'value']), 'spec.templating.list[0].current');
  if (
    variable.name !== 'environment' ||
    variable.label !== 'Environment' ||
    variable.hide !== 2 ||
    variable.skipUrlSync !== true ||
    variable.query !== 'phase0' ||
    current.selected !== true ||
    current.text !== 'phase0' ||
    current.value !== 'phase0'
  ) {
    conversionError('unsupported-dashboard-feature', 'spec.templating.list[0]', 'Constant variable differs from the controlled fixture.');
  }
  return [
    {
      hide: 2,
      label: 'Environment',
      name: 'environment',
      skipUrlSync: true,
      type: 'constant',
      value: 'phase0',
    },
  ];
}

function validateExactLayout(uid: PocFixtureDashboard['uid'], panels: readonly PocFixturePanel[]) {
  const expected = expectedLayout[uid];
  if (panels.length !== expected.length) {
    conversionError('unsupported-layout', 'spec.panels', 'Panel inventory differs from the controlled fixture.');
  }
  const expectedById = new Map<number, (typeof expected)[number]>(
    expected.map((panel) => [panel.id, panel])
  );
  for (const [index, panel] of panels.entries()) {
    const wanted = expectedById.get(panel.id);
    if (
      !wanted ||
      panel.id !== wanted.id ||
      panel.type !== wanted.type ||
      panel.gridPos.h !== wanted.gridPos.h ||
      panel.gridPos.w !== wanted.gridPos.w ||
      panel.gridPos.x !== wanted.gridPos.x ||
      panel.gridPos.y !== wanted.gridPos.y
    ) {
      conversionError('unsupported-layout', `spec.panels[${index}].gridPos`, 'Panel order or grid geometry differs from the controlled fixture.');
    }
  }
}

function validateAnnotations(value: unknown): PocFixtureDashboard['annotationPolicy'] {
  const annotations = record(value, 'spec.annotations');
  rejectUnknownKeys(annotations, new Set(['list']), 'spec.annotations');
  const list = array(annotations.list, 'spec.annotations.list');
  if (list.length === 0) return 'none';
  if (list.length !== 1) {
    conversionError('unsupported-dashboard-feature', 'spec.annotations.list', 'Configured annotations are outside Task 7.');
  }
  const annotation = record(list[0], 'spec.annotations.list[0]');
  rejectUnknownKeys(
    annotation,
    new Set(['builtIn', 'datasource', 'enable', 'hide', 'iconColor', 'name', 'type']),
    'spec.annotations.list[0]'
  );
  if (
    !annotation.datasource ||
    typeof annotation.datasource !== 'object' ||
    Array.isArray(annotation.datasource)
  ) {
    conversionError('unsupported-dashboard-feature', 'spec.annotations.list[0]', 'Configured annotations are outside Task 7.');
  }
  const datasource = annotation.datasource as Record<string, unknown>;
  rejectUnknownKeys(datasource, new Set(['type', 'uid']), 'spec.annotations.list[0].datasource');
  if (
    annotation.builtIn !== 1 ||
    datasource.type !== 'grafana' ||
    datasource.uid !== '-- Grafana --' ||
    annotation.enable !== true ||
    annotation.hide !== true ||
    annotation.iconColor !== 'rgba(0, 211, 255, 1)' ||
    annotation.name !== 'Annotations & Alerts' ||
    annotation.type !== 'dashboard'
  ) {
    conversionError('unsupported-dashboard-feature', 'spec.annotations.list[0]', 'Configured annotations are outside Task 7.');
  }
  // Grafana's V1 DTO canonicalization injects this hidden built-in record even
  // when the provisioned fixture has an empty annotations list. It is matched
  // exactly and reported; no annotation SceneDataLayer is constructed.
  return 'builtin-default-omitted';
}

export function preflightFixtureV1(
  input: PocDashboardV1Result,
  catalog: PocPanelCatalog
): PocFixtureDashboard {
  if (
    !catalog ||
    typeof catalog.identity !== 'string' ||
    catalog.identity.length === 0 ||
    !Array.isArray(catalog.panelIds) ||
    catalog.panelIds.length === 0 ||
    catalog.panelIds.some((panelId) => !panelTypes.has(panelId))
  ) {
    conversionError(
      'unsupported-panel-type',
      'catalog.panelIds',
      'The active POC gate must admit at least one known fixture panel type.'
    );
  }
  if (input?.family !== 'v1' || input.apiVersion !== 'v1' || input.dto?.apiVersion !== 'dashboard.grafana.app/v1') {
    conversionError('unsupported-schema', 'family', 'Task 7 accepts only a validated stable V1 DTO result.');
  }
  if (input.dto.spec.schemaVersion !== 42) {
    conversionError('unsupported-schema', 'spec.schemaVersion', 'Task 7 accepts only schemaVersion 42.');
  }
  if (input.dto.status.conversion.failed) {
    conversionError('unsupported-schema', 'status.conversion', 'V2 and failed cross-version conversions are unsupported.');
  }
  const uid = input.dto.metadata.name;
  if (
    !fixtureUids.has(uid) ||
    input.requestedUid !== uid ||
    (input.dto.spec.uid !== undefined && input.dto.spec.uid !== uid)
  ) {
    conversionError('conversion-invariant-violation', 'metadata.name', 'Dashboard UID is outside the validated fixture identity.');
  }
  const fixtureUid = uid as PocFixtureDashboard['uid'];
  const spec = record(input.dto.spec, 'spec');
  rejectUnknownKeys(spec, allowedSpecKeys, 'spec');
  if (spec.schemaVersion !== 42) {
    conversionError('unsupported-schema', 'spec.schemaVersion', 'Task 7 accepts only schemaVersion 42.');
  }
  if (spec.liveNow !== false) {
    conversionError('unsupported-dashboard-feature', 'spec.liveNow', 'Live dashboard refresh is unsupported.');
  }
  if (spec.editable !== false) {
    conversionError('unsupported-dashboard-feature', 'spec.editable', 'Editing is outside the read-only Task 7 fixture.');
  }
  if (spec.preload !== false) {
    conversionError('unsupported-dashboard-feature', 'spec.preload', 'Dashboard preloading is outside Task 7.');
  }
  const timepicker = record(spec.timepicker, 'spec.timepicker');
  rejectUnknownKeys(timepicker, new Set(), 'spec.timepicker');
  const annotationPolicy = validateAnnotations(spec.annotations);
  requireEmptyArray(spec.links, 'spec.links');
  if (spec.graphTooltip !== 0) {
    conversionError('unsupported-dashboard-feature', 'spec.graphTooltip', 'Shared tooltip behavior is outside Task 7.');
  }
  if (spec.refresh !== '') {
    conversionError('unsupported-dashboard-feature', 'spec.refresh', 'Automatic refresh is outside Task 7.');
  }
  if (spec.timezone !== 'browser' || spec.fiscalYearStartMonth !== 0 || spec.weekStart !== '') {
    conversionError('unsupported-dashboard-feature', 'spec.timezone', 'The fixture requires browser timezone and default calendar settings.');
  }
  const time = record(spec.time, 'spec.time');
  rejectUnknownKeys(time, new Set(['from', 'to']), 'spec.time');
  const panels = array(spec.panels, 'spec.panels').map((panel, index) => validatePanel(panel, index));
  validateExactLayout(fixtureUid, panels);
  if (new Set(panels.map((panel) => panel.id)).size !== panels.length) {
    conversionError('conversion-invariant-violation', 'spec.panels', 'Panel ids must be unique.');
  }

  return {
    annotationPolicy,
    description: string(spec.description, 'spec.description'),
    fiscalYearStartMonth: 0,
    panels: panels.filter((panel) => catalog.panelIds.includes(panel.type)),
    refresh: '',
    schemaVersion: 42,
    time: { from: string(time.from, 'spec.time.from'), to: string(time.to, 'spec.time.to') },
    timezone: 'browser',
    title: string(spec.title, 'spec.title'),
    uid: fixtureUid,
    variables: validateVariables(spec.templating),
  };
}
