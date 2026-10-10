import type { PanelPlugin, PanelPluginMeta, PluginMetaInfo } from '@grafana/data';

import {
  GRAFANA_SOURCE_COMMIT,
  GRAFANA_SOURCE_VERSION,
  STAT_PANEL_ENTRYPOINT,
  TEXT_PANEL_V1_ENTRYPOINT,
  TIMESERIES_PANEL_P2_IDENTITY,
} from '../sourceIdentity';
import type {
  PanelPluginLoadEvidence,
  PluginImportRuntimeBoundary,
  PocPanelPluginCatalog,
  PocPanelPluginLoader,
} from './types';

export const TEXT_PLUGIN_ID = 'text' as const;
export const TEXT_MODULE_IDENTITY = TEXT_PANEL_V1_ENTRYPOINT;
export const STAT_PLUGIN_ID = 'stat' as const;
export const STAT_MODULE_IDENTITY = STAT_PANEL_ENTRYPOINT;
export const TIMESERIES_PLUGIN_ID = 'timeseries' as const;
export const TIMESERIES_MODULE_IDENTITY = TIMESERIES_PANEL_P2_IDENTITY;

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

function attachMetadata(
  plugin: PanelPlugin,
  identity: { readonly id: 'stat' | 'text' | 'timeseries'; readonly module: string; readonly name: string }
): PanelPlugin {
  plugin.meta = {
    ...plugin.meta,
    id: identity.id,
    info: {
      author: { name: 'Grafana Labs' },
      description: `Built-in Grafana ${identity.name} panel.`,
      links: [],
      logos: { large: '', small: '' },
      screenshots: [],
      updated: '',
      version: GRAFANA_SOURCE_VERSION,
    } as PluginMetaInfo,
    name: identity.name,
    type: 'panel',
    version: GRAFANA_SOURCE_VERSION,
    module: identity.module,
    baseUrl: '',
    skipDataQuery: identity.id === TEXT_PLUGIN_ID,
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
          textPlugin = attachMetadata(plugin, {
            id: TEXT_PLUGIN_ID,
            module: TEXT_MODULE_IDENTITY,
            name: 'Text',
          });
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

export interface CreateTextAndStatPanelCatalogOptions extends CreateTextPanelCatalogOptions {
  readonly loadStatPlugin: PocPanelPluginLoader;
}

export function createTextAndStatPanelCatalog({
  evidence,
  loadStatPlugin,
  loadTextPlugin,
}: CreateTextAndStatPanelCatalogOptions): PocPanelPluginCatalog {
  const textCatalog = createTextPanelCatalog({ evidence, loadTextPlugin });
  let statPromise: Promise<PanelPlugin> | undefined;
  let statPlugin: PanelPlugin | undefined;

  return {
    getPanelPluginFromCache(id) {
      return id === STAT_PLUGIN_ID
        ? statPlugin
        : id === TEXT_PLUGIN_ID
          ? textCatalog.getPanelPluginFromCache(id)
          : undefined;
    },
    importPanelPlugin(id) {
      if (id === TEXT_PLUGIN_ID) return textCatalog.importPanelPlugin(id);
      if (id !== STAT_PLUGIN_ID) {
        evidence?.record({ category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' });
        return Promise.reject(new UnsupportedPanelPluginError(id));
      }
      if (statPromise) {
        evidence?.record({ pluginId: STAT_PLUGIN_ID, type: 'cache-hit' });
        return statPromise;
      }

      evidence?.record({
        cache: 'miss',
        moduleIdentity: STAT_MODULE_IDENTITY,
        pluginId: STAT_PLUGIN_ID,
        sourceCategory: 'grafana-application-source',
        sourceCommit: GRAFANA_SOURCE_COMMIT,
        strategy: 'P1-direct-source',
        type: 'start',
      });
      statPromise = loadStatPlugin()
        .then((plugin) => {
          statPlugin = attachMetadata(plugin, {
            id: STAT_PLUGIN_ID,
            module: STAT_MODULE_IDENTITY,
            name: 'Stat',
          });
          evidence?.record({
            moduleIdentity: STAT_MODULE_IDENTITY,
            pluginId: STAT_PLUGIN_ID,
            version: GRAFANA_SOURCE_VERSION,
            type: 'success',
          });
          return statPlugin;
        })
        .catch((cause: unknown) => {
          statPromise = undefined;
          evidence?.record({
            category: 'module-load-failed',
            pluginId: STAT_PLUGIN_ID,
            type: 'failure',
          });
          throw new PanelPluginLoadError(STAT_PLUGIN_ID, { cause });
        });
      return statPromise;
    },
  };
}

export interface CreateTextStatAndTimeSeriesPanelCatalogOptions
  extends CreateTextAndStatPanelCatalogOptions {
  readonly loadTimeSeriesPlugin: PocPanelPluginLoader;
}

export function createTextStatAndTimeSeriesPanelCatalog({
  evidence,
  loadStatPlugin,
  loadTextPlugin,
  loadTimeSeriesPlugin,
}: CreateTextStatAndTimeSeriesPanelCatalogOptions): PocPanelPluginCatalog {
  const inherited = createTextAndStatPanelCatalog({ evidence, loadStatPlugin, loadTextPlugin });
  let timeseriesPromise: Promise<PanelPlugin> | undefined;
  let timeseriesPlugin: PanelPlugin | undefined;

  return {
    getPanelPluginFromCache(id) {
      return id === TIMESERIES_PLUGIN_ID
        ? timeseriesPlugin
        : inherited.getPanelPluginFromCache(id);
    },
    importPanelPlugin(id) {
      if (id === TEXT_PLUGIN_ID || id === STAT_PLUGIN_ID) {
        return inherited.importPanelPlugin(id);
      }
      if (id !== TIMESERIES_PLUGIN_ID) {
        evidence?.record({ category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' });
        return Promise.reject(new UnsupportedPanelPluginError(id));
      }
      if (timeseriesPromise) {
        evidence?.record({ pluginId: TIMESERIES_PLUGIN_ID, type: 'cache-hit' });
        return timeseriesPromise;
      }

      evidence?.record({
        cache: 'miss',
        moduleIdentity: TIMESERIES_MODULE_IDENTITY,
        pluginId: TIMESERIES_PLUGIN_ID,
        sourceCategory: 'grafana-application-source',
        sourceCommit: GRAFANA_SOURCE_COMMIT,
        strategy: 'P2-source-built-compatibility-artifact',
        type: 'start',
      });
      timeseriesPromise = loadTimeSeriesPlugin()
        .then((plugin) => {
          timeseriesPlugin = attachMetadata(plugin, {
            id: TIMESERIES_PLUGIN_ID,
            module: TIMESERIES_MODULE_IDENTITY,
            name: 'Time series',
          });
          evidence?.record({
            moduleIdentity: TIMESERIES_MODULE_IDENTITY,
            pluginId: TIMESERIES_PLUGIN_ID,
            version: GRAFANA_SOURCE_VERSION,
            type: 'success',
          });
          return timeseriesPlugin;
        })
        .catch((cause: unknown) => {
          timeseriesPromise = undefined;
          evidence?.record({
            category: 'module-load-failed',
            pluginId: TIMESERIES_PLUGIN_ID,
            type: 'failure',
          });
          throw new PanelPluginLoadError(TIMESERIES_PLUGIN_ID, { cause });
        });
      return timeseriesPromise;
    },
  };
}

export function installTextPanelCatalog(
  runtime: PluginImportRuntimeBoundary,
  catalog: PocPanelPluginCatalog
): void {
  runtime.setPluginImportUtils(catalog);
}
