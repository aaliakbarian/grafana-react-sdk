import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

import { normalizePocHostConfig } from './hostConfig';
import { installBootData } from './installBootData';
import {
  loadGrafanaCohort,
  PocPackageVersionError,
  PocRuntimeImportOrderError,
  type GrafanaModuleImporter,
} from './loadGrafanaCohort';

const hostConfig = normalizePocHostConfig({
  assetBasePath: '/grafana/public/',
  grafanaBasePath: '/grafana/',
  locale: 'en-US',
  namespace: 'default',
  panelCatalog: { identity: 'task5-empty-catalog', panelIds: [] },
  request: vi.fn<typeof fetch>(),
  theme: 'light',
  timezone: 'browser',
});

function createTarget() {
  return {
    location: {
      hash: '',
      href: 'http://localhost:5173/',
      origin: 'http://localhost:5173',
      pathname: '/',
      search: '',
    },
  };
}

function createImporter(bootData: unknown, runtimeBootData: unknown = bootData) {
  const theme = { isLight: true };
  const reactMarker = {};
  const reactDomMarker = {};
  const versions: Record<string, string> = {
    '@grafana/data': '13.2.3',
    '@grafana/i18n': '13.2.3',
    '@grafana/runtime': '13.2.3',
    '@grafana/scenes': '8.13.5',
    '@grafana/schema': '13.2.3',
    '@grafana/ui': '13.2.3',
    react: '19.2.8',
    'react-dom': '19.2.8',
  };
  const modules: Record<string, unknown> = {
    '@grafana/runtime': {
      config: {
        appSubUrl:
          (runtimeBootData as { settings?: { appSubUrl?: string } } | undefined)?.settings
            ?.appSubUrl ?? '<missing>',
        bootData: runtimeBootData,
        namespace: 'default',
        theme2: theme,
      },
      getAppEvents: vi.fn(),
      locationService: {},
      setAppEvents: vi.fn(),
    },
    '@grafana/data': { EventBusSrv: class {}, ThemeContext: {} },
    '@grafana/i18n': { initPluginTranslations: vi.fn() },
    '@grafana/scenes': { loadResources: vi.fn() },
    '@grafana/schema': {},
    '@grafana/ui': {},
    react: reactMarker,
    'react-dom': reactDomMarker,
  };
  for (const [name, version] of Object.entries(versions)) {
    modules[`${name}/package.json`] = { default: { version } };
  }

  const calls: string[] = [];
  const importer: GrafanaModuleImporter = async (specifier) => {
    calls.push(specifier);
    const loaded = modules[specifier];
    if (!loaded) {
      throw new Error(`Unexpected module: ${specifier}`);
    }
    return loaded;
  };
  return { calls, importer };
}

describe('Grafana Runtime import order', () => {
  it('keeps the host/Scenes router on v6 while Grafana UI compatibility resolves router v5', () => {
    const rootRequire = createRequire(import.meta.url);
    const uiRequire = createRequire(rootRequire.resolve('@grafana/ui/package.json'));
    const compatRequire = createRequire(uiRequire.resolve('react-router-dom-v5-compat/package.json'));

    expect(rootRequire('react-router-dom/package.json').version).toBe('6.30.3');
    expect(uiRequire('react-router-dom/package.json').version).toBe('5.3.4');
    expect(compatRequire('react-router-dom/package.json').version).toBe('5.3.4');
  });

  it('rejects package loading before the boot prelude is installed', async () => {
    const target = createTarget();
    const { calls, importer } = createImporter(undefined);

    await expect(
      loadGrafanaCohort({ bootDataInstallation: undefined, importer, target })
    ).rejects.toBeInstanceOf(PocRuntimeImportOrderError);
    expect(calls).toEqual([]);
  });

  it('loads Runtime first and verifies that it captured the installed boot object', async () => {
    const target = createTarget();
    const bootDataInstallation = installBootData(hostConfig, target);
    const { calls, importer } = createImporter(bootDataInstallation.bootData);

    const cohort = await loadGrafanaCohort({ bootDataInstallation, importer, target });

    expect(calls[0]).toBe('@grafana/runtime');
    expect(bootDataInstallation.bootData.settings).toMatchObject({
      appSubUrl: '',
      appUrl: 'http://localhost:5173/',
    });
    expect(cohort.runtime.config.bootData).toBe(bootDataInstallation.bootData);
    expect(cohort.versions).toMatchObject({
      '@grafana/runtime': '13.2.3',
      '@grafana/scenes': '8.13.5',
      react: '19.2.8',
      'react-dom': '19.2.8',
    });
    expect(cohort.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });
  });

  it('detects Runtime that was evaluated against a different boot object', async () => {
    const target = createTarget();
    const bootDataInstallation = installBootData(hostConfig, target);
    const { importer } = createImporter(bootDataInstallation.bootData, { settings: {} });

    await expect(
      loadGrafanaCohort({ bootDataInstallation, importer, target })
    ).rejects.toMatchObject({ code: 'runtime-import-order' });
  });

  it('rejects a package cohort that drifts from the pinned versions', async () => {
    const target = createTarget();
    const bootDataInstallation = installBootData(hostConfig, target);
    const { importer } = createImporter(bootDataInstallation.bootData);
    const driftingImporter: GrafanaModuleImporter = (specifier) =>
      specifier === '@grafana/scenes/package.json'
        ? Promise.resolve({ default: { version: '8.13.6' } })
        : importer(specifier);

    await expect(
      loadGrafanaCohort({ bootDataInstallation, importer: driftingImporter, target })
    ).rejects.toBeInstanceOf(PocPackageVersionError);
  });
});
