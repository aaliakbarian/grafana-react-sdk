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

export interface PocTextAndStatRuntimePanelCatalog {
  readonly identity: typeof POC_GATE_B_TEXT_STAT_PANEL_CATALOG.identity;
  readonly panelIds: readonly ['text', 'stat'];
  readonly pluginImportUtils: PocPluginImportUtils;
}

export type PocRuntimePanelCatalog =
  | PocEmptyRuntimePanelCatalog
  | PocTextRuntimePanelCatalog
  | PocTextAndStatRuntimePanelCatalog;

export const POC_GATE_A_TEXT_PANEL_CATALOG = {
  identity: 'gate-a-text-v1',
  panelIds: ['text'],
} as const satisfies PocPanelCatalog;

export const POC_GATE_B_TEXT_STAT_PANEL_CATALOG = {
  identity: 'gate-b-text-stat-v1',
  panelIds: ['text', 'stat'],
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

export function installGateBPanelOptionEditors(registry: PocStandardEditorsRegistry): void {
  registry.setInit(() =>
    (['radio', 'select', 'boolean', 'number', 'stats-picker'] as const).map((id) => ({
      description: `View-only Gate B registration for the ${id} panel option.`,
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

export function isTextAndStatRuntimePanelCatalog(
  catalog: PocRuntimePanelCatalog
): catalog is PocTextAndStatRuntimePanelCatalog {
  return (
    catalog.identity === POC_GATE_B_TEXT_STAT_PANEL_CATALOG.identity &&
    catalog.panelIds.length === 2 &&
    catalog.panelIds[0] === 'text' &&
    catalog.panelIds[1] === 'stat'
  );
}
