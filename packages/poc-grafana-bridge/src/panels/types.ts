import type { PanelPlugin } from '@grafana/data';

export type PocPanelPluginId = 'text';
export type PocPanelPluginLoader = () => Promise<PanelPlugin>;

export type PanelPluginLoadEvent =
  | {
      readonly cache: 'miss';
      readonly moduleIdentity: string;
      readonly pluginId: PocPanelPluginId;
      readonly sourceCategory: 'grafana-application-source';
      readonly sourceCommit: string;
      readonly strategy: 'P1-direct-source';
      readonly type: 'start';
    }
  | { readonly pluginId: PocPanelPluginId; readonly type: 'cache-hit' }
  | {
      readonly moduleIdentity: string;
      readonly pluginId: PocPanelPluginId;
      readonly version: string;
      readonly type: 'success';
    }
  | {
      readonly category: 'module-load-failed' | 'unknown-plugin';
      readonly pluginId: string;
      readonly type: 'failure';
    };

export interface PanelPluginLoadEvidence {
  record(event: PanelPluginLoadEvent): void;
}

export interface PocPanelPluginCatalog {
  getPanelPluginFromCache(id: string): PanelPlugin | undefined;
  importPanelPlugin(id: string): Promise<PanelPlugin>;
}

export interface PluginImportRuntimeBoundary {
  setPluginImportUtils(utils: PocPanelPluginCatalog): void;
}
