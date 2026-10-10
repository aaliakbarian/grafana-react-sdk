const fixtureCustomFieldPaths = [
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
] as const;

interface PocFieldConfigBuilder {
  addCustomEditor(item: {
    readonly editor: () => null;
    readonly id: string;
    readonly name: string;
    readonly override: () => null;
    readonly path: string;
    readonly process: (value: unknown) => unknown;
    readonly shouldApply: () => true;
  }): unknown;
}

interface PocTimeSeriesPluginBoundary {
  useFieldConfig(config: { useCustomConfig(builder: PocFieldConfigBuilder): void }): this;
}

function UnavailableViewOnlyFieldEditor() {
  return null;
}

/** P2 compatibility adaptation: preserve only custom fields admitted by the controlled fixture. */
export function configurePocTimeSeriesPlugin<T extends PocTimeSeriesPluginBoundary>(plugin: T): T {
  return plugin.useFieldConfig({
    useCustomConfig(builder) {
      for (const path of fixtureCustomFieldPaths) {
        builder.addCustomEditor({
          editor: UnavailableViewOnlyFieldEditor,
          id: path,
          name: path,
          override: UnavailableViewOnlyFieldEditor,
          path,
          process: (value) => value,
          shouldApply: () => true,
        });
      }
    },
  });
}
