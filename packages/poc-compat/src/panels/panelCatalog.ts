import type { PanelPlugin, StandardEditorsRegistryItem } from '@grafana/data';

import type { PocPanelCatalog } from '../dashboard/preflightFixture';

export interface PocPluginImportUtils {
  getPanelPluginFromCache(id: string): PanelPlugin | undefined;
  importPanelPlugin(id: string): Promise<PanelPlugin>;
}

export interface PocStandardEditorsRegistry {
  setInit(initializer: () => StandardEditorsRegistryItem[]): void;
}

export interface PocEmptyRuntimePanelCatalog {
  readonly identity: string;
  readonly panelIds: readonly [];
}

export interface PocTextRuntimePanelCatalog {
  readonly identity: typeof POC_GATE_A_TEXT_PANEL_CATALOG.identity;
  readonly panelIds: readonly ['text'];
  readonly pluginImportUtils: PocPluginImportUtils;
}

export type PocRuntimePanelCatalog = PocEmptyRuntimePanelCatalog | PocTextRuntimePanelCatalog;

export const POC_GATE_A_TEXT_PANEL_CATALOG = {
  identity: 'gate-a-text-v1',
  panelIds: ['text'],
} as const satisfies PocPanelCatalog;

function UnavailableViewOnlyOptionEditor() {
  return null;
}

export function installGateATextOptionEditors(registry: PocStandardEditorsRegistry): void {
  registry.setInit(() =>
    (['radio', 'select', 'boolean'] as const).map((id) => ({
      description: `View-only Gate A registration for the Text ${id} option.`,
      editor: UnavailableViewOnlyOptionEditor,
      id,
      name: id,
    }))
  );
}

export function isTextRuntimePanelCatalog(
  catalog: PocRuntimePanelCatalog
): catalog is PocTextRuntimePanelCatalog {
  return (
    catalog.identity === POC_GATE_A_TEXT_PANEL_CATALOG.identity && catalog.panelIds[0] === 'text'
  );
}
