declare module 'grafana-poc-text-panel' {
  import type { PanelPlugin } from '@grafana/data';

  export const plugin: PanelPlugin;
}

declare module 'grafana-poc-stat-panel' {
  import type { PanelPlugin } from '@grafana/data';

  export const plugin: PanelPlugin;
}

declare module 'grafana-poc-testdata-datasource' {
  import type { DataSourceApi, DataSourcePlugin } from '@grafana/data';

  export const plugin: DataSourcePlugin<DataSourceApi>;
}
