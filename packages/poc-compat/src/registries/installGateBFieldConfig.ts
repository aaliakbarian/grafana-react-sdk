import type { FieldConfigPropertyItem } from '@grafana/data';

export interface PocFieldConfigRegistry {
  setInit(initializer: () => FieldConfigPropertyItem[]): void;
}

export interface PocFieldConfigProcessors {
  readonly identityOverrideProcessor: NonNullable<FieldConfigPropertyItem['process']>;
  readonly numberOverrideProcessor?: NonNullable<FieldConfigPropertyItem['process']>;
  readonly stringOverrideProcessor: NonNullable<FieldConfigPropertyItem['process']>;
  readonly thresholdsOverrideProcessor: NonNullable<FieldConfigPropertyItem['process']>;
  readonly valueMappingsOverrideProcessor: NonNullable<FieldConfigPropertyItem['process']>;
}

function UnavailableViewOnlyFieldEditor() {
  return null;
}

/**
 * Registers only the field processors exercised by the controlled Stat fixture.
 * Editors exist only because Grafana's registry item contract requires them;
 * Gate B is view-only and never renders an options editor.
 */
export function installGateBFieldConfig(
  registry: PocFieldConfigRegistry,
  processors: PocFieldConfigProcessors
): void {
  registry.setInit(() => createGateBItems(processors));
}

function createGateBItems(processors: PocFieldConfigProcessors): FieldConfigPropertyItem[] {
  const {
    identityOverrideProcessor,
    stringOverrideProcessor,
    thresholdsOverrideProcessor,
    valueMappingsOverrideProcessor,
  } = processors;
  return [
    {
      id: 'unit',
      path: 'unit',
      name: 'Unit',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: stringOverrideProcessor,
      shouldApply: () => true,
    },
    {
      id: 'color',
      path: 'color',
      name: 'Color',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: identityOverrideProcessor,
      shouldApply: () => true,
    },
    {
      id: 'mappings',
      path: 'mappings',
      name: 'Value mappings',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: valueMappingsOverrideProcessor,
      shouldApply: (field) => field.type !== 'time',
    },
    {
      id: 'thresholds',
      path: 'thresholds',
      name: 'Thresholds',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: thresholdsOverrideProcessor,
      shouldApply: () => true,
    },
  ];
}

/** Adds only the numeric bounds used by the controlled Time series fixture. */
export function installGateCFieldConfig(
  registry: PocFieldConfigRegistry,
  processors: PocFieldConfigProcessors
): void {
  if (!processors.numberOverrideProcessor) {
    throw new Error('Gate C requires Grafana data numberOverrideProcessor.');
  }
  const numberOverrideProcessor = processors.numberOverrideProcessor;
  registry.setInit(() => [
    ...createGateBItems(processors),
    {
      id: 'min',
      path: 'min',
      name: 'Minimum',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: numberOverrideProcessor,
      shouldApply: () => true,
    },
    {
      id: 'max',
      path: 'max',
      name: 'Maximum',
      editor: UnavailableViewOnlyFieldEditor,
      override: UnavailableViewOnlyFieldEditor,
      process: numberOverrideProcessor,
      shouldApply: () => true,
    },
  ]);
}
