import type { DataSourceInstanceSettings } from '@grafana/data';
import type {
  BackendSrv,
  DataSourceSrv,
  RuntimeDataSourceRegistration,
  TemplateSrv,
} from '@grafana/runtime';

import {
  createPocDataSourceSrv,
  type PocDataSourceConstructor,
} from '../datasource/pocDataSourceSrv';
import {
  loadPocTestDataSettings,
  POC_TESTDATA_UID,
} from '../datasource/loadFrontendSettings';
import { installPocTemplateSrv } from '../events/installTemplateSrv';
import { installPocLoggerRegistry } from '../events/installLoggerRegistry';
import type { PocQueryEvidenceRecorder } from '../instrumentation/queryTrace';
import { createPocRunRequest, type PocRunRequest } from '../query/runRequest';

export interface PocQueryRuntimeBoundary {
  getDataSourceSrv(): DataSourceSrv;
  getRunRequest(): PocRunRequest;
  getTemplateSrv(): TemplateSrv;
  setDataSourceSrv(service: DataSourceSrv): void;
  setRunRequest(runRequest: PocRunRequest): void;
  setTemplateSrv(service: TemplateSrv): void;
}

export interface InstallPocQueryRuntimeOptions {
  readonly backendSrv: BackendSrv;
  readonly evidence: PocQueryEvidenceRecorder;
  readonly initializeLoggersRegistry: () => void;
  readonly loadDataSourceClass: () => Promise<PocDataSourceConstructor>;
  readonly moduleIdentity: string;
  readonly onStep?: (step: PocQueryRuntimeInitializationStep) => void;
  readonly registerRuntimeDataSourceInstance: (entry: RuntimeDataSourceRegistration) => void;
  readonly runtime: PocQueryRuntimeBoundary;
}

export type PocQueryRuntimeInitializationStep =
  | 'logger-registry-installed'
  | 'frontend-settings-loaded'
  | 'template-service-installed'
  | 'datasource-service-installed'
  | 'testdata-instance-loaded'
  | 'testdata-runtime-instance-registered'
  | 'run-request-installed';

export interface PocQueryRuntime {
  readonly dataSourceSrv: DataSourceSrv;
  readonly evidence: PocQueryEvidenceRecorder;
  readonly runRequest: PocRunRequest;
  readonly settings: DataSourceInstanceSettings;
  readonly templateSrv: TemplateSrv;
}

export async function installPocQueryRuntime({
  backendSrv,
  evidence,
  initializeLoggersRegistry,
  loadDataSourceClass,
  moduleIdentity,
  onStep,
  registerRuntimeDataSourceInstance,
  runtime,
}: InstallPocQueryRuntimeOptions): Promise<PocQueryRuntime> {
  installPocLoggerRegistry(initializeLoggersRegistry);
  onStep?.('logger-registry-installed');
  const settings = await loadPocTestDataSettings(backendSrv, evidence);
  onStep?.('frontend-settings-loaded');
  const templateSrv = installPocTemplateSrv(runtime);
  onStep?.('template-service-installed');
  const dataSourceSrv = createPocDataSourceSrv({
    evidence,
    loadDataSourceClass,
    moduleIdentity,
    settings,
    templateSrv,
  });
  runtime.setDataSourceSrv(dataSourceSrv);
  if (runtime.getDataSourceSrv() !== dataSourceSrv) {
    throw new Error('Grafana Runtime did not retain the fixed DataSourceSrv identity.');
  }
  onStep?.('datasource-service-installed');
  const dataSource = await dataSourceSrv.get(POC_TESTDATA_UID);
  onStep?.('testdata-instance-loaded');
  // The unstable Runtime API currently requires the older RuntimeDataSource
  // shape even though this is a real DataSourceApi plugin instance. The
  // registration implementation only consumes uid and instanceSettings and
  // caches this exact instance, so add that one compatibility property.
  Object.defineProperty(dataSource, 'instanceSettings', {
    configurable: false,
    enumerable: true,
    value: settings,
    writable: false,
  });
  registerRuntimeDataSourceInstance({
    dataSource: dataSource as RuntimeDataSourceRegistration['dataSource'],
  });
  onStep?.('testdata-runtime-instance-registered');

  const runRequest = createPocRunRequest({ evidence });
  runtime.setRunRequest(runRequest);
  if (runtime.getRunRequest() !== runRequest) {
    throw new Error('Grafana Runtime did not retain the Task 10 runRequest identity.');
  }
  onStep?.('run-request-installed');

  return { dataSourceSrv, evidence, runRequest, settings, templateSrv };
}
