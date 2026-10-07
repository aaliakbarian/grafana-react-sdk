/// <reference path="../grafana-source-modules.d.ts" />

import type { PanelPlugin } from '@grafana/data';

interface GrafanaStatPanelModule {
  readonly plugin: PanelPlugin;
}

/** POC-only exact import of Grafana OSS 13.2.3's application-owned Stat entrypoint. */
export async function loadExactStatPanelPlugin(): Promise<PanelPlugin> {
  const module = (await import('grafana-poc-stat-panel')) as GrafanaStatPanelModule;
  if (!module.plugin || typeof module.plugin !== 'object' || !('panel' in module.plugin)) {
    throw new Error('The pinned Stat source module did not export a PanelPlugin-compatible object.');
  }
  return module.plugin;
}
