import type { PanelPlugin } from '@grafana/data';
import { describe, expect, it, vi } from 'vitest';

import {
  createTextAndStatPanelCatalog,
  PanelPluginLoadError,
  STAT_MODULE_IDENTITY,
  UnsupportedPanelPluginError,
} from './catalog';
import type { PanelPluginLoadEvent } from './types';

function plugin(): PanelPlugin {
  return { meta: {}, panel: () => null } as unknown as PanelPlugin;
}

describe('Gate B Text and Stat panel catalogue', () => {
  it('loads and caches exactly text and stat with pinned metadata', async () => {
    const text = plugin();
    const stat = plugin();
    const loadTextPlugin = vi.fn(async () => text);
    const loadStatPlugin = vi.fn(async () => stat);
    const events: PanelPluginLoadEvent[] = [];
    const catalog = createTextAndStatPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadStatPlugin,
      loadTextPlugin,
    });

    const first = catalog.importPanelPlugin('stat');
    const repeated = catalog.importPanelPlugin('stat');

    expect(repeated).toBe(first);
    await expect(first).resolves.toBe(stat);
    await expect(catalog.importPanelPlugin('text')).resolves.toBe(text);
    expect(loadStatPlugin).toHaveBeenCalledOnce();
    expect(loadTextPlugin).toHaveBeenCalledOnce();
    expect(catalog.getPanelPluginFromCache('stat')).toBe(stat);
    expect(stat.meta).toMatchObject({
      id: 'stat',
      info: { version: '13.2.3' },
      module: STAT_MODULE_IDENTITY,
      name: 'Stat',
      skipDataQuery: false,
      version: '13.2.3',
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cache: 'miss',
          moduleIdentity: STAT_MODULE_IDENTITY,
          pluginId: 'stat',
          strategy: 'P1-direct-source',
          type: 'start',
        }),
        { pluginId: 'stat', type: 'cache-hit' },
        expect.objectContaining({ pluginId: 'stat', type: 'success', version: '13.2.3' }),
      ])
    );
  });

  it('rejects every ID outside text and stat without invoking either loader', async () => {
    const loadTextPlugin = vi.fn(async () => plugin());
    const loadStatPlugin = vi.fn(async () => plugin());
    const catalog = createTextAndStatPanelCatalog({ loadStatPlugin, loadTextPlugin });

    await expect(catalog.importPanelPlugin('timeseries')).rejects.toBeInstanceOf(
      UnsupportedPanelPluginError
    );
    expect(loadTextPlugin).not.toHaveBeenCalled();
    expect(loadStatPlugin).not.toHaveBeenCalled();
  });

  it('classifies Stat load failures and permits one bounded retry', async () => {
    const stat = plugin();
    const loadStatPlugin = vi
      .fn<() => Promise<PanelPlugin>>()
      .mockRejectedValueOnce(new Error('Authorization: Bearer gate-b-secret'))
      .mockResolvedValueOnce(stat);
    const events: PanelPluginLoadEvent[] = [];
    const catalog = createTextAndStatPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadStatPlugin,
      loadTextPlugin: async () => plugin(),
    });

    await expect(catalog.importPanelPlugin('stat')).rejects.toBeInstanceOf(PanelPluginLoadError);
    await expect(catalog.importPanelPlugin('stat')).resolves.toBe(stat);
    expect(loadStatPlugin).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(events)).not.toContain('gate-b-secret');
  });
});
