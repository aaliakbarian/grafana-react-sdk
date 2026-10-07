import type {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceRef,
  ScopedVars,
} from '@grafana/data';
import type {
  DataSourceSrv,
  GetDataSourceListFilters,
  RuntimeDataSourceRegistration,
  TemplateSrv,
} from '@grafana/runtime';

import type { PocQueryEvidenceRecorder } from '../instrumentation/queryTrace';
import {
  POC_TESTDATA_TYPE,
  POC_TESTDATA_UID,
  PocDataSourceRuntimeError,
} from './loadFrontendSettings';

export type PocDataSourceConstructor = new (
  settings: DataSourceInstanceSettings,
  templateSrv?: TemplateSrv
) => DataSourceApi;

export interface CreatePocDataSourceSrvOptions {
  readonly evidence?: PocQueryEvidenceRecorder;
  readonly loadDataSourceClass: () => Promise<PocDataSourceConstructor>;
  readonly moduleIdentity?: string;
  readonly settings: DataSourceInstanceSettings;
  readonly templateSrv: TemplateSrv;
}

function refIdentity(ref: DataSourceRef | string | null | undefined): {
  readonly type?: string;
  readonly uid?: string;
} {
  if (ref == null) return {};
  if (typeof ref === 'string') return { uid: ref };
  return { type: ref.type, uid: ref.uid };
}

export function createPocDataSourceSrv({
  evidence,
  loadDataSourceClass,
  moduleIdentity,
  settings,
  templateSrv,
}: CreatePocDataSourceSrvOptions): DataSourceSrv {
  if (settings.uid !== POC_TESTDATA_UID || settings.type !== POC_TESTDATA_TYPE) {
    throw new PocDataSourceRuntimeError(
      'datasource-type-unsupported',
      'The fixed datasource service accepts only the controlled TestData settings.'
    );
  }
  let instancePromise: Promise<DataSourceApi> | undefined;

  const matches = (ref: DataSourceRef | string | null | undefined) => {
    const identity = refIdentity(ref);
    return (
      (identity.uid === undefined || identity.uid === settings.uid || identity.uid === settings.name) &&
      (identity.type === undefined || identity.type === settings.type)
    );
  };

  const getInstance = () => {
    if (instancePromise) {
      evidence?.record({
        cache: 'hit',
        datasourceType: POC_TESTDATA_TYPE,
        datasourceUid: POC_TESTDATA_UID,
        outcome: 'success',
        strategy: 'D1-exact-source',
        type: 'datasource-load',
      });
      return instancePromise;
    }
    evidence?.record({
      cache: 'miss',
      datasourceType: POC_TESTDATA_TYPE,
      datasourceUid: POC_TESTDATA_UID,
      ...(moduleIdentity ? { moduleIdentity } : {}),
      outcome: 'start',
      strategy: 'D1-exact-source',
      type: 'datasource-load',
    });
    instancePromise = loadDataSourceClass()
      .then((DataSourceClass) => {
        const instance = new DataSourceClass(settings, templateSrv);
        evidence?.record({
          cache: 'miss',
          datasourceType: POC_TESTDATA_TYPE,
          datasourceUid: POC_TESTDATA_UID,
          ...(moduleIdentity ? { moduleIdentity } : {}),
          outcome: 'success',
          strategy: 'D1-exact-source',
          type: 'datasource-load',
        });
        return instance;
      })
      .catch((cause: unknown) => {
        instancePromise = undefined;
        evidence?.record({
          cache: 'miss',
          datasourceType: POC_TESTDATA_TYPE,
          datasourceUid: POC_TESTDATA_UID,
          ...(moduleIdentity ? { moduleIdentity } : {}),
          outcome: 'failure',
          strategy: 'D1-exact-source',
          type: 'datasource-load',
        });
        throw new PocDataSourceRuntimeError(
          'datasource-module-load-failed',
          'The exact TestData frontend module could not be instantiated.',
          { cause }
        );
      });
    return instancePromise;
  };

  return {
    async get(ref?: DataSourceRef | string | null, _scopedVars?: ScopedVars) {
      const identity = refIdentity(ref);
      if (identity.type && identity.type !== settings.type) {
        throw new PocDataSourceRuntimeError(
          'datasource-type-unsupported',
          'The requested datasource type is outside the Task 10 catalogue.'
        );
      }
      if (!matches(ref)) {
        throw new PocDataSourceRuntimeError(
          'datasource-not-found',
          'The requested datasource UID is outside the Task 10 catalogue.'
        );
      }
      return getInstance();
    },
    getInstanceSettings(ref?: DataSourceRef | string | null) {
      return matches(ref) ? settings : undefined;
    },
    getList(filters?: GetDataSourceListFilters) {
      if (filters?.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        if (!types.includes(settings.type)) return [];
      }
      if (filters?.pluginId && filters.pluginId !== settings.type) return [];
      if (filters?.metrics === true && settings.meta.metrics !== true) return [];
      if (filters?.logs === true && settings.meta.logs !== true) return [];
      if (filters?.tracing === true && settings.meta.tracing !== true) return [];
      if (filters?.annotations === true && settings.meta.annotations !== true) return [];
      return filters?.filter?.(settings) === false ? [] : [settings];
    },
    registerRuntimeDataSource(_entry: RuntimeDataSourceRegistration) {
      throw new PocDataSourceRuntimeError(
        'datasource-registration-forbidden',
        'Runtime datasource registration is not permitted by the closed Task 10 catalogue.'
      );
    },
    async reload() {
      // Frontend settings are loaded once for this page-scoped disposable experiment.
    },
  };
}
