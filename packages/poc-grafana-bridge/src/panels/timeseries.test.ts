import type { PanelPlugin } from '@grafana/data';
import { describe, expect, it, vi } from 'vitest';

import {
  createTextStatAndTimeSeriesPanelCatalog,
  PanelPluginLoadError,
  TIMESERIES_MODULE_IDENTITY,
  UnsupportedPanelPluginError,
} from './catalog';
import type { PanelPluginLoadEvent } from './types';
import { configurePocTimeSeriesPlugin } from './timeseriesConfig';

function plugin(): PanelPlugin {
  return { meta: {}, panel: () => null } as unknown as PanelPlugin;
}

describe('Gate C Text, Stat, and Time series panel catalogue', () => {
  it('admits exactly text, stat, and timeseries and caches the pinned Time series plugin', async () => {
    const text = plugin();
    const stat = plugin();
    const timeseries = plugin();
    const loadTimeSeriesPlugin = vi.fn(async () => timeseries);
    const events: PanelPluginLoadEvent[] = [];
    const catalog = createTextStatAndTimeSeriesPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadStatPlugin: async () => stat,
      loadTextPlugin: async () => text,
      loadTimeSeriesPlugin,
    });

    const first = catalog.importPanelPlugin('timeseries');
    const repeated = catalog.importPanelPlugin('timeseries');

    expect(repeated).toBe(first);
    await expect(first).resolves.toBe(timeseries);
    expect(loadTimeSeriesPlugin).toHaveBeenCalledOnce();
    expect(catalog.getPanelPluginFromCache('timeseries')).toBe(timeseries);
    expect(timeseries.meta).toMatchObject({
      id: 'timeseries',
      info: { version: '13.2.3' },
      module: TIMESERIES_MODULE_IDENTITY,
      name: 'Time series',
      skipDataQuery: false,
      version: '13.2.3',
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cache: 'miss',
          moduleIdentity: TIMESERIES_MODULE_IDENTITY,
          pluginId: 'timeseries',
          strategy: 'P2-source-built-compatibility-artifact',
          type: 'start',
        }),
        { pluginId: 'timeseries', type: 'cache-hit' },
        expect.objectContaining({ pluginId: 'timeseries', type: 'success', version: '13.2.3' }),
      ])
    );
  });

  it('registers only the fixture Time series custom field paths', () => {
    let configuration: { useCustomConfig(builder: { addCustomEditor(item: { path: string }): unknown }): void } | undefined;
    const boundary = {
      useFieldConfig(next: typeof configuration) {
        configuration = next;
        return this;
      },
    };
    configurePocTimeSeriesPlugin(boundary);
    const paths: string[] = [];
    configuration?.useCustomConfig({
      addCustomEditor(item) {
        paths.push(item.path);
        return this;
      },
    });
    expect(paths).toEqual([
      'axisBorderShow',
      'axisCenteredZero',
      'axisColorMode',
      'axisLabel',
      'axisPlacement',
      'barAlignment',
      'drawStyle',
      'fillOpacity',
      'gradientMode',
      'hideFrom',
      'insertNulls',
      'lineInterpolation',
      'lineWidth',
      'pointSize',
      'scaleDistribution',
      'showPoints',
      'spanNulls',
      'stacking',
      'thresholdsStyle',
    ]);
  });

  it('rejects every fourth panel ID without arbitrary loading', async () => {
    const loadTimeSeriesPlugin = vi.fn(async () => plugin());
    const catalog = createTextStatAndTimeSeriesPanelCatalog({
      loadStatPlugin: async () => plugin(),
      loadTextPlugin: async () => plugin(),
      loadTimeSeriesPlugin,
    });

    await expect(catalog.importPanelPlugin('table')).rejects.toBeInstanceOf(
      UnsupportedPanelPluginError
    );
    expect(loadTimeSeriesPlugin).not.toHaveBeenCalled();
  });

  it('classifies Time series load failures, sanitizes evidence, and permits one retry', async () => {
    const timeseries = plugin();
    const loadTimeSeriesPlugin = vi
      .fn<() => Promise<PanelPlugin>>()
      .mockRejectedValueOnce(new Error('Authorization: Bearer gate-c-secret'))
      .mockResolvedValueOnce(timeseries);
    const events: PanelPluginLoadEvent[] = [];
    const catalog = createTextStatAndTimeSeriesPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadStatPlugin: async () => plugin(),
      loadTextPlugin: async () => plugin(),
      loadTimeSeriesPlugin,
    });

    await expect(catalog.importPanelPlugin('timeseries')).rejects.toBeInstanceOf(
      PanelPluginLoadError
    );
    await expect(catalog.importPanelPlugin('timeseries')).resolves.toBe(timeseries);
    expect(loadTimeSeriesPlugin).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(events)).not.toContain('gate-c-secret');
  });
});
