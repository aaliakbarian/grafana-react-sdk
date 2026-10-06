import type { PanelPlugin } from '@grafana/data';
import { describe, expect, it, vi } from 'vitest';

import {
  createTextPanelCatalog,
  installTextPanelCatalog,
  PanelPluginLoadError,
  TEXT_MODULE_IDENTITY,
  UnsupportedPanelPluginError,
} from './catalog';
import type { PanelPluginLoadEvent } from './types';
import {
  assertGrafanaSourceIdentity,
  GrafanaSourceIdentityError,
} from '../sourceIdentity';

function createEvidence() {
  const events: PanelPluginLoadEvent[] = [];
  return {
    events,
    sink: { record: (event: PanelPluginLoadEvent) => events.push(structuredClone(event)) },
  };
}

function createPanelPlugin(): PanelPlugin {
  return { meta: {}, panel: () => null } as unknown as PanelPlugin;
}

describe('Task 8 Text panel catalogue', () => {
  it('accepts only the clean pinned Grafana source identity', () => {
    expect(() =>
      assertGrafanaSourceIdentity({
        commit: '6193dc03311b631b9727b560d24369e683dc396e',
        dirty: false,
      })
    ).not.toThrow();
    expect(() =>
      assertGrafanaSourceIdentity({
        commit: '90ffed056f0884267356c12a0eeb72a022af53f1',
        dirty: false,
      })
    ).toThrow(GrafanaSourceIdentityError);
    expect(() =>
      assertGrafanaSourceIdentity({
        commit: '6193dc03311b631b9727b560d24369e683dc396e',
        dirty: true,
      })
    ).toThrow(/clean/i);
  });

  it('admits only text, shares one promise, caches the plugin, and reports pinned metadata', async () => {
    const plugin = createPanelPlugin();
    const loadTextPlugin = vi.fn(async () => plugin);
    const evidence = createEvidence();
    const catalog = createTextPanelCatalog({ evidence: evidence.sink, loadTextPlugin });

    const first = catalog.importPanelPlugin('text');
    const second = catalog.importPanelPlugin('text');

    expect(second).toBe(first);
    await expect(first).resolves.toBe(plugin);
    expect(loadTextPlugin).toHaveBeenCalledTimes(1);
    expect(catalog.getPanelPluginFromCache('text')).toBe(plugin);
    expect(plugin.meta).toMatchObject({
      id: 'text',
      module: TEXT_MODULE_IDENTITY,
      name: 'Text',
      skipDataQuery: true,
      version: '13.2.3',
    });
    expect(evidence.events).toEqual([
      expect.objectContaining({
        cache: 'miss',
        pluginId: 'text',
        sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
        strategy: 'P1-direct-source',
        type: 'start',
      }),
      { pluginId: 'text', type: 'cache-hit' },
      expect.objectContaining({ pluginId: 'text', type: 'success', version: '13.2.3' }),
    ]);
  });

  it('rejects unknown IDs without invoking a loader or constructing a URL', async () => {
    const loadTextPlugin = vi.fn(async () => createPanelPlugin());
    const evidence = createEvidence();
    const catalog = createTextPanelCatalog({ evidence: evidence.sink, loadTextPlugin });

    await expect(catalog.importPanelPlugin('https://example.test/plugin.js')).rejects.toBeInstanceOf(
      UnsupportedPanelPluginError
    );
    expect(loadTextPlugin).not.toHaveBeenCalled();
    expect(catalog.getPanelPluginFromCache('stat')).toBeUndefined();
    expect(evidence.events).toEqual([
      {
        category: 'unknown-plugin',
        pluginId: '<unsupported>',
        type: 'failure',
      },
    ]);
  });

  it('classifies failures without placing source errors in evidence and permits a bounded retry', async () => {
    const plugin = createPanelPlugin();
    const loadTextPlugin = vi
      .fn<() => Promise<PanelPlugin>>()
      .mockRejectedValueOnce(new Error('Authorization: Bearer task-8-secret'))
      .mockResolvedValueOnce(plugin);
    const evidence = createEvidence();
    const catalog = createTextPanelCatalog({ evidence: evidence.sink, loadTextPlugin });

    await expect(catalog.importPanelPlugin('text')).rejects.toBeInstanceOf(PanelPluginLoadError);
    await expect(catalog.importPanelPlugin('text')).resolves.toBe(plugin);
    expect(JSON.stringify(evidence.events)).not.toContain('task-8-secret');
    expect(loadTextPlugin).toHaveBeenCalledTimes(2);
  });

  it('registers the exact closed catalogue through the Runtime utility boundary', () => {
    const catalog = createTextPanelCatalog({
      loadTextPlugin: async () => createPanelPlugin(),
    });
    const setPluginImportUtils = vi.fn();

    installTextPanelCatalog({ setPluginImportUtils }, catalog);

    expect(setPluginImportUtils).toHaveBeenCalledOnce();
    expect(setPluginImportUtils).toHaveBeenCalledWith(catalog);
  });
});
