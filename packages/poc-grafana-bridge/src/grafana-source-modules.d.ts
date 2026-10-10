declare module 'grafana-poc-text-panel' {
  import type { PanelPlugin } from '@grafana/data';

  export const plugin: PanelPlugin;
}

declare module 'grafana-poc-stat-panel' {
  import type { PanelPlugin } from '@grafana/data';

  export const plugin: PanelPlugin;
}

declare module 'grafana-poc-timeseries-panel' {
  import type { ComponentType } from 'react';

  export const TimeSeriesPanel: ComponentType<any>;
}

declare module 'grafana-poc-ui-uplot-utils' {
  export const getStackingGroups: any;
  export const pluginLog: any;
  export const preparePlotData2: any;
}

declare module 'grafana-poc-ui-gradient-fills' {
  export const getScaleGradientFn: any;
}

declare module 'grafana-poc-ui-plot-legend' {
  export const hasVisibleLegendSeries: any;
}

declare module 'grafana-poc-ui-tooltip-plugin' {
  export const TooltipHoverMode: any;
}

declare module 'grafana-poc-data-convert-field-type' {
  export const convertFieldType: any;
}

declare module 'grafana-poc-data-join-frames' {
  export const NULL_EXPAND: number;
  export const NULL_REMOVE: number;
  export const NULL_RETAIN: number;
  export const maybeSortFrame: any;
}

declare module 'grafana-poc-data-null-to-undef' {
  export const nullToUndefThreshold: any;
}

declare module 'grafana-poc-data-field-overrides' {
  export const findNumericFieldMinMax: any;
}

declare module 'grafana-poc-testdata-datasource' {
  import type { DataSourceApi, DataSourcePlugin } from '@grafana/data';

  export const plugin: DataSourcePlugin<DataSourceApi>;
}
