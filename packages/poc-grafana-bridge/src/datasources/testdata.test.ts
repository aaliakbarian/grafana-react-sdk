import type { DataSourceApi, DataSourcePlugin } from '@grafana/data';
import { describe, expect, it } from 'vitest';

import { extractTestDataDataSourceClass, TESTDATA_MODULE_IDENTITY } from './testdata';

class FakeTestDataSource {}

describe('Task 10 exact TestData datasource bridge', () => {
  it('identifies the exact pinned application entrypoint and exposes its constructor', () => {
    const plugin = { DataSourceClass: FakeTestDataSource } as unknown as DataSourcePlugin<DataSourceApi>;

    expect(TESTDATA_MODULE_IDENTITY).toBe(
      'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx'
    );
    expect(extractTestDataDataSourceClass({ plugin })).toBe(FakeTestDataSource);
  });

  it.each([{}, { plugin: {} }, { plugin: { DataSourceClass: null } }])(
    'rejects a malformed exact-source module %#',
    (module) => {
      expect(() => extractTestDataDataSourceClass(module)).toThrow(/DataSourceClass/);
    }
  );
});
