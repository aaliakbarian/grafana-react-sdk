/// <reference path="../grafana-source-modules.d.ts" />

import type { PanelPlugin } from '@grafana/data';

interface GrafanaTextPanelModule {
  readonly plugin: PanelPlugin;
}

/**
 * POC-only P1 import. `grafana-poc-text-panel` is an exact Vite alias to the
 * audited v13.2.3 legacy-v1 application-source entrypoint selected by the
 * controlled fixture. It is never resolved from a dashboard value or a remote
 * URL. The upstream root selector was tested separately and cannot resolve its
 * unpublished Runtime-internal feature-flag import from the published cohort.
 */
export async function loadExactTextPanelPlugin(): Promise<PanelPlugin> {
  const module = (await import('grafana-poc-text-panel')) as GrafanaTextPanelModule;
  if (!module.plugin || typeof module.plugin !== 'object' || !('panel' in module.plugin)) {
    throw new Error('The pinned Text source module did not export a PanelPlugin-compatible object.');
  }
  return module.plugin;
}
