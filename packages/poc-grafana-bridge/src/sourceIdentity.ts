export const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const GRAFANA_SOURCE_VERSION = '13.2.3' as const;
export const TEXT_PANEL_ENTRYPOINT =
  'public/app/plugins/panel/text/module.tsx' as const;
export const TEXT_PANEL_V1_ENTRYPOINT =
  'public/app/plugins/panel/text/v1/module.tsx' as const;
export const STAT_PANEL_ENTRYPOINT =
  'public/app/plugins/panel/stat/module.tsx' as const;
export const TIMESERIES_PANEL_ENTRYPOINT =
  'public/app/plugins/panel/timeseries/module.tsx' as const;
export const TIMESERIES_PANEL_P2_IDENTITY =
  'poc-p2:public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx' as const;
export const TESTDATA_DATASOURCE_ENTRYPOINT =
  'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx' as const;

export class GrafanaSourceIdentityError extends Error {
  readonly code = 'grafana-source-identity-invalid';

  constructor(message: string) {
    super(message);
    this.name = 'GrafanaSourceIdentityError';
  }
}

export interface ObservedGrafanaSourceIdentity {
  readonly commit: string;
  readonly dirty: boolean;
}

export function assertGrafanaSourceIdentity(identity: ObservedGrafanaSourceIdentity): void {
  if (identity.commit !== GRAFANA_SOURCE_COMMIT) {
    throw new GrafanaSourceIdentityError(
      `Grafana source must resolve to ${GRAFANA_SOURCE_COMMIT}; observed ${identity.commit || '<missing>'}.`
    );
  }
  if (identity.dirty) {
    throw new GrafanaSourceIdentityError(
      'Grafana source checkout must be clean; patched upstream source is not valid P1 evidence.'
    );
  }
}
