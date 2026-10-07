import type { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import type { BackendSrv } from '@grafana/runtime';

import type { PocQueryEvidenceRecorder } from '../instrumentation/queryTrace';

export const POC_TESTDATA_UID = 'grsdk-testdata' as const;
export const POC_TESTDATA_TYPE = 'grafana-testdata-datasource' as const;

export type PocDataSourceRuntimeErrorCode =
  | 'datasource-module-load-failed'
  | 'datasource-not-found'
  | 'datasource-registration-forbidden'
  | 'datasource-type-unsupported'
  | 'frontend-settings-malformed';

export class PocDataSourceRuntimeError extends Error {
  constructor(
    readonly code: PocDataSourceRuntimeErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PocDataSourceRuntimeError';
  }
}

interface FrontendSettingsResponse {
  readonly datasources: Record<string, unknown>;
  readonly defaultDatasource?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeMeta(value: unknown): DataSourcePluginMeta {
  const meta = isRecord(value) ? value : {};
  return {
    alerting: meta.alerting === true,
    annotations: meta.annotations === true,
    backend: meta.backend === true,
    builtIn: meta.builtIn === true,
    id: typeof meta.id === 'string' ? meta.id : POC_TESTDATA_TYPE,
    logs: meta.logs === true,
    metrics: meta.metrics !== false,
    mixed: false,
    name: typeof meta.name === 'string' ? meta.name : 'TestData',
    streaming: meta.streaming === true,
    tracing: meta.tracing === true,
    type: 'datasource',
  } as DataSourcePluginMeta;
}

function safeJsonData(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization|cookie|credential|password|secret|session|token|api[-_]?key/i.test(key)) continue;
    if (
      item === null ||
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      typeof item === 'string'
    ) {
      output[key] = item;
    }
  }
  return output;
}

export function selectPocTestDataSettings(payload: unknown): DataSourceInstanceSettings {
  if (!isRecord(payload) || !isRecord(payload.datasources)) {
    throw new PocDataSourceRuntimeError(
      'frontend-settings-malformed',
      'Grafana frontend settings did not contain a datasource map.'
    );
  }
  const candidate = Object.values(payload.datasources).find(
    (value) => isRecord(value) && value.uid === POC_TESTDATA_UID
  );
  if (!isRecord(candidate)) {
    throw new PocDataSourceRuntimeError(
      'datasource-not-found',
      `Grafana frontend settings did not contain datasource ${POC_TESTDATA_UID}.`
    );
  }
  if (candidate.type !== POC_TESTDATA_TYPE) {
    throw new PocDataSourceRuntimeError(
      'datasource-type-unsupported',
      `Datasource ${POC_TESTDATA_UID} is not the controlled TestData type.`
    );
  }
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    throw new PocDataSourceRuntimeError(
      'frontend-settings-malformed',
      'The controlled TestData settings have no name.'
    );
  }
  return {
    ...(typeof candidate.id === 'number' ? { id: candidate.id } : {}),
    access: candidate.access === 'direct' ? 'direct' : 'proxy',
    isDefault: candidate.isDefault === true,
    jsonData: safeJsonData(candidate.jsonData),
    meta: safeMeta(candidate.meta),
    name: candidate.name,
    readOnly: candidate.readOnly === true,
    type: POC_TESTDATA_TYPE,
    uid: POC_TESTDATA_UID,
    ...(typeof candidate.url === 'string' ? { url: candidate.url } : {}),
    withCredentials: false,
  };
}

export async function loadPocTestDataSettings(
  backendSrv: BackendSrv,
  evidence?: PocQueryEvidenceRecorder
): Promise<DataSourceInstanceSettings> {
  try {
    const settings = selectPocTestDataSettings(
      await backendSrv.get<FrontendSettingsResponse>('/api/frontend/settings')
    );
    evidence?.record({
      datasourceType: POC_TESTDATA_TYPE,
      datasourceUid: POC_TESTDATA_UID,
      outcome: 'success',
      type: 'settings',
    });
    return settings;
  } catch (error: unknown) {
    evidence?.record({
      datasourceType: POC_TESTDATA_TYPE,
      datasourceUid: POC_TESTDATA_UID,
      outcome: 'failure',
      type: 'settings',
    });
    throw error;
  }
}
