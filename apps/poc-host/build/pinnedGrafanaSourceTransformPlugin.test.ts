import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pinnedGrafanaSourceTransformPlugin } from './pinnedGrafanaSourceTransformPlugin.ts';

describe('pinned Grafana source transform', () => {
  it('transforms only TypeScript files below the exact audited source root', async () => {
    const sourceRoot = '/grafana/public/app/plugins/datasource/grafana-testdata-datasource';
    const plugin = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-testdata-datasource',
      entrypoint: 'module.tsx',
      sourceRoot,
    });
    const transform = plugin.transform;
    expect(typeof transform).toBe('function');

    const result = await (transform as (code: string, id: string) => Promise<unknown>)(
      'export const Component = () => <div>testdata</div>;',
      '\0poc-pinned-grafana-source:module.tsx.js'
    );
    expect(result).toMatchObject({ code: expect.stringContaining('jsx') });

    await expect(
      (transform as (code: string, id: string) => Promise<unknown>)(
        'export const untouched = true;',
        '/grafana/public/app/plugins/panel/text/module.tsx'
      )
    ).resolves.toBeNull();
  });

  it('maps only the exact alias and relative imports into the virtual source boundary', async () => {
    const sourceRoot = '/grafana/public/app/plugins/datasource/grafana-testdata-datasource';
    const plugin = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-testdata-datasource',
      entrypoint: 'module.tsx',
      sourceRoot,
    });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;

    expect(resolveId('grafana-poc-testdata-datasource')).toBe(
      '\0poc-pinned-grafana-source:module.tsx.js'
    );
    expect(resolveId('grafana-poc-text-panel')).toBeNull();
  });

  it('rejects a forged virtual module ID that escapes the audited source root', () => {
    const plugin = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-testdata-datasource',
      entrypoint: 'module.tsx',
      sourceRoot: '/grafana/public/app/plugins/datasource/grafana-testdata-datasource',
    });
    const load = plugin.load as (id: string) => unknown;

    expect(() =>
      load('\0poc-pinned-grafana-source:../../../../core/secrets.ts.js')
    ).toThrow(/outside the audited source root/i);
  });

  it('isolates relative imports when two audited source trees use the transform', () => {
    const stat = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-stat-panel',
      entrypoint: 'module.tsx',
      sourceRoot: '/grafana/public/app/plugins/panel/stat',
      virtualNamespace: 'stat',
    });
    const testData = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-testdata-datasource',
      entrypoint: 'module.tsx',
      sourceRoot: '/grafana/public/app/plugins/datasource/grafana-testdata-datasource',
      virtualNamespace: 'testdata',
    });
    const statResolve = stat.resolveId as (source: string, importer?: string) => unknown;
    const testDataResolve = testData.resolveId as (source: string, importer?: string) => unknown;

    const statEntry = statResolve('grafana-poc-stat-panel');
    expect(statEntry).toBe('\0poc-pinned-grafana-source:stat:module.tsx.js');
    expect(testDataResolve('./StatPanel', String(statEntry))).toBeNull();
    expect(statResolve('./datasource', '\0poc-pinned-grafana-source:testdata:module.tsx.js')).toBeNull();
  });

  it('resolves an extensionless dotted Grafana source import', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'poc-grafana-source-'));
    try {
      writeFileSync(join(sourceRoot, 'module.tsx'), "export * from './panelcfg.gen';");
      writeFileSync(join(sourceRoot, 'panelcfg.gen.ts'), 'export const options = {};');
      const plugin = pinnedGrafanaSourceTransformPlugin({
        entryAlias: 'grafana-poc-stat-panel',
        entrypoint: 'module.tsx',
        sourceRoot,
        virtualNamespace: 'stat',
      });
      const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
      const entry = resolveId('grafana-poc-stat-panel');

      expect(resolveId('./panelcfg.gen', String(entry))).toBe(
        '\0poc-pinned-grafana-source:stat:panelcfg.gen.ts.js'
      );
    } finally {
      rmSync(sourceRoot, { force: true, recursive: true });
    }
  });

  it('redirects only explicitly reviewed imports in an audited source-built artifact', () => {
    const plugin = pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-poc-timeseries-panel',
      entrypoint: 'TimeSeriesPanel.tsx',
      importReplacements: {
        './plugins/AnnotationsPlugin': '/repo/poc/timeseriesAdapters.tsx',
      },
      sourceRoot: '/grafana/public/app/plugins/panel/timeseries',
      virtualNamespace: 'timeseries',
    });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
    const entry = String(resolveId('grafana-poc-timeseries-panel'));

    expect(resolveId('./plugins/AnnotationsPlugin', entry)).toBe(
      '/repo/poc/timeseriesAdapters.tsx'
    );
    expect(() => resolveId('./plugins/OutsideRangePlugin', entry)).toThrow(
      'Audited Grafana source import could not be resolved'
    );
  });
});
