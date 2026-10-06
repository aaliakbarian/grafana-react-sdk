import { getPluginImportUtils, setPluginImportUtils } from '@grafana/runtime';

import {
  createTextPanelCatalog,
  installTextPanelCatalog,
} from '../../../packages/poc-grafana-bridge/src/panels/catalog';
import { loadExactTextPanelPlugin } from '../../../packages/poc-grafana-bridge/src/panels/text';
import type { PanelPluginLoadEvent } from '../../../packages/poc-grafana-bridge/src/panels/types';

export async function runTask8TextPluginProbe() {
  const events: PanelPluginLoadEvent[] = [];
  const catalog = createTextPanelCatalog({
    evidence: { record: (event) => events.push(structuredClone(event)) },
    loadTextPlugin: loadExactTextPanelPlugin,
  });
  installTextPanelCatalog({ setPluginImportUtils }, catalog);
  const runtimeImporter = getPluginImportUtils();
  const firstPromise = runtimeImporter.importPanelPlugin('text');
  const secondPromise = runtimeImporter.importPanelPlugin('text');
  const first = await firstPromise;
  const second = await secondPromise;

  let unknownCategory = '';
  try {
    await runtimeImporter.importPanelPlugin('stat');
  } catch (error: unknown) {
    unknownCategory =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'unclassified';
  }

  return {
    cacheIdentity: runtimeImporter.getPanelPluginFromCache('text') === first,
    events,
    metadata: {
      id: first.meta.id,
      module: first.meta.module,
      name: first.meta.name,
      skipDataQuery: first.meta.skipDataQuery,
      version: (first.meta as typeof first.meta & { version?: string }).version,
    },
    panelComponentName: first.panel?.name,
    promiseIdentity: firstPromise === secondPromise,
    pluginIdentity: first === second,
    unknownCategory,
  };
}
