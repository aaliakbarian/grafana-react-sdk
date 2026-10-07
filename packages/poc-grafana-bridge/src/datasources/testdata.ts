/// <reference path="../grafana-source-modules.d.ts" />

import type { DataSourceApi, DataSourceInstanceSettings, DataSourcePlugin } from '@grafana/data';
import type { TemplateSrv } from '@grafana/runtime';

import { TESTDATA_DATASOURCE_ENTRYPOINT } from '../sourceIdentity';

export const TESTDATA_MODULE_IDENTITY = TESTDATA_DATASOURCE_ENTRYPOINT;

export type TestDataDataSourceConstructor = new (
  instanceSettings: DataSourceInstanceSettings,
  templateSrv?: TemplateSrv
) => DataSourceApi;

interface GrafanaTestDataModule {
  readonly plugin: DataSourcePlugin<DataSourceApi>;
}

export function extractTestDataDataSourceClass(module: unknown): TestDataDataSourceConstructor {
  const candidate = module as Partial<GrafanaTestDataModule> | undefined;
  const DataSourceClass = candidate?.plugin?.DataSourceClass;
  if (typeof DataSourceClass !== 'function') {
    throw new Error('The pinned TestData source module did not expose a DataSourceClass constructor.');
  }
  return DataSourceClass as TestDataDataSourceConstructor;
}

/** POC-only D1 import of the unmodified Grafana OSS 13.2.3 application module. */
export async function loadExactTestDataDataSourceClass(): Promise<TestDataDataSourceConstructor> {
  return extractTestDataDataSourceClass(await import('grafana-poc-testdata-datasource'));
}
