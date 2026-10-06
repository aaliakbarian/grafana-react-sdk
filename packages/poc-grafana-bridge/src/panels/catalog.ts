import type { PanelPlugin, PanelPluginMeta } from '@grafana/data';

import {
  GRAFANA_SOURCE_COMMIT,
  GRAFANA_SOURCE_VERSION,
  TEXT_PANEL_V1_ENTRYPOINT,
} from '../sourceIdentity';
import type {
  PanelPluginLoadEvidence,
  PluginImportRuntimeBoundary,
  PocPanelPluginCatalog,
  PocPanelPluginLoader,
} from './types';

export const TEXT_PLUGIN_ID = 'text' as const;
export const TEXT_MODULE_IDENTITY = TEXT_PANEL_V1_ENTRYPOINT;

export class UnsupportedPanelPluginError extends Error {
  readonly code = 'panel-plugin-unsupported';
  readonly pluginId: string;

  constructor(pluginId: string) {
    super(`Panel plugin ${pluginId || '<empty>'} is not admitted by the Task 8 catalogue.`);
    this.name = 'UnsupportedPanelPluginError';
    this.pluginId = pluginId;
  }
}

export class PanelPluginLoadError extends Error {
  readonly code = 'panel-plugin-load-failed';
  readonly pluginId: string;

  constructor(pluginId: string, options?: ErrorOptions) {
    super(`The pinned ${pluginId} panel module could not be loaded.`, options);
    this.name = 'PanelPluginLoadError';
    this.pluginId = pluginId;
  }
}

function attachTextMetadata(plugin: PanelPlugin): PanelPlugin {
  plugin.meta = {
    ...plugin.meta,
    id: TEXT_PLUGIN_ID,
    name: 'Text',
    type: 'panel',
    version: GRAFANA_SOURCE_VERSION,
    module: TEXT_MODULE_IDENTITY,
    baseUrl: '',
    skipDataQuery: true,
    suggestions: true,
  } as PanelPluginMeta;
  return plugin;
}

export interface CreateTextPanelCatalogOptions {
  readonly evidence?: PanelPluginLoadEvidence;
  readonly loadTextPlugin: PocPanelPluginLoader;
}

export function createTextPanelCatalog({
  evidence,
  loadTextPlugin,
}: CreateTextPanelCatalogOptions): PocPanelPluginCatalog {
  let textPromise: Promise<PanelPlugin> | undefined;
  let textPlugin: PanelPlugin | undefined;

  return {
    getPanelPluginFromCache(id) {
      return id === TEXT_PLUGIN_ID ? textPlugin : undefined;
    },
    importPanelPlugin(id) {
      if (id !== TEXT_PLUGIN_ID) {
        evidence?.record({ category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' });
        return Promise.reject(new UnsupportedPanelPluginError(id));
      }
      if (textPromise) {
        evidence?.record({ pluginId: TEXT_PLUGIN_ID, type: 'cache-hit' });
        return textPromise;
      }

      evidence?.record({
        cache: 'miss',
        moduleIdentity: TEXT_MODULE_IDENTITY,
        pluginId: TEXT_PLUGIN_ID,
        sourceCategory: 'grafana-application-source',
        sourceCommit: GRAFANA_SOURCE_COMMIT,
        strategy: 'P1-direct-source',
        type: 'start',
      });
      textPromise = loadTextPlugin()
        .then((plugin) => {
          textPlugin = attachTextMetadata(plugin);
          evidence?.record({
            moduleIdentity: TEXT_MODULE_IDENTITY,
            pluginId: TEXT_PLUGIN_ID,
            version: GRAFANA_SOURCE_VERSION,
            type: 'success',
          });
          return textPlugin;
        })
        .catch((cause: unknown) => {
          textPromise = undefined;
          evidence?.record({
            category: 'module-load-failed',
            pluginId: TEXT_PLUGIN_ID,
            type: 'failure',
          });
          throw new PanelPluginLoadError(TEXT_PLUGIN_ID, { cause });
        });
      return textPromise;
    },
  };
}

export function installTextPanelCatalog(
  runtime: PluginImportRuntimeBoundary,
  catalog: PocPanelPluginCatalog
): void {
  runtime.setPluginImportUtils(catalog);
}
