export const POC_DASHBOARD_API_GROUP = 'dashboard.grafana.app' as const;
export const POC_DASHBOARD_API_VERSION = 'v1' as const;
export const POC_DASHBOARD_SCHEMA_VERSION = 42 as const;

export interface PocDashboardApiDiscovery {
  readonly advertisedVersions: readonly string[];
  readonly group: typeof POC_DASHBOARD_API_GROUP;
  readonly preferredVersion: string;
  readonly stableV1Available: true;
  readonly v2Available: boolean;
}

export interface PocDashboardMetadata {
  readonly generation: number;
  readonly name: string;
  readonly namespace: string;
  readonly resourceVersion: string;
  readonly uid?: string;
}

export interface PocDashboardV1Dto {
  readonly access: Record<string, unknown>;
  readonly apiVersion: 'dashboard.grafana.app/v1';
  readonly kind: 'DashboardWithAccessInfo';
  readonly metadata: PocDashboardMetadata;
  readonly spec: Record<string, unknown> & {
    readonly panels: readonly unknown[];
    readonly schemaVersion: number;
    readonly uid?: string;
  };
  readonly status: {
    readonly conversion: {
      readonly failed: boolean;
      readonly storedVersion: string;
    };
  };
}

export interface PocDashboardV1Result {
  readonly apiVersion: typeof POC_DASHBOARD_API_VERSION;
  readonly discovery: PocDashboardApiDiscovery;
  readonly dto: PocDashboardV1Dto;
  readonly family: 'v1';
  readonly requestedUid: string;
  readonly v2Available: boolean;
}

export interface PocDashboardLoadOptions {
  readonly signal?: AbortSignal;
}

export interface PocDashboardClient {
  loadByUid(uid: string, options?: PocDashboardLoadOptions): Promise<PocDashboardV1Result>;
}
