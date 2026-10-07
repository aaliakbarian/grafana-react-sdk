export type PocQueryEvidenceEvent =
  | {
      readonly datasourceType: 'grafana-testdata-datasource';
      readonly datasourceUid: 'grsdk-testdata';
      readonly outcome: 'success' | 'failure';
      readonly type: 'settings';
    }
  | {
      readonly cache: 'hit' | 'miss';
      readonly datasourceType: 'grafana-testdata-datasource';
      readonly datasourceUid: 'grsdk-testdata';
      readonly moduleIdentity?: string;
      readonly outcome: 'success' | 'failure' | 'start';
      readonly strategy: 'D1-exact-source';
      readonly type: 'datasource-load';
    }
  | {
      readonly dashboardUid?: string;
      readonly datasourceUid: 'grsdk-testdata';
      readonly outcome: 'cancelled' | 'failure' | 'start' | 'success';
      readonly panelId?: number;
      readonly requestId: string;
      readonly state?: 'Done' | 'Error' | 'Loading';
      readonly type: 'query';
    };

export interface PocQueryEvidenceRecorder {
  record(event: PocQueryEvidenceEvent): void;
  snapshot(): readonly PocQueryEvidenceEvent[];
}

export function createPocQueryEvidenceRecorder(): PocQueryEvidenceRecorder {
  const events: PocQueryEvidenceEvent[] = [];
  return {
    record(event) {
      events.push(structuredClone(event));
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}
