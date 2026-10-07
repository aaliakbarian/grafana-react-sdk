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
});
