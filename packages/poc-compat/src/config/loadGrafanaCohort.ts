import type { BackendSrv } from '@grafana/runtime';
import type { Context } from 'react';

import {
  createRuntimeIdentityRegistry,
  type RuntimeModuleIdentityRegistry,
} from '../instrumentation/runtimeIdentity';
import type { PocBootDataInstallation, PocBootWindow } from './installBootData';

export const POC_PACKAGE_VERSIONS = {
  '@grafana/data': '13.2.3',
  '@grafana/i18n': '13.2.3',
  '@grafana/runtime': '13.2.3',
  '@grafana/scenes': '8.13.5',
  '@grafana/schema': '13.2.3',
  '@grafana/ui': '13.2.3',
  react: '19.2.8',
  'react-dom': '19.2.8',
} as const;

export type PocPackageName = keyof typeof POC_PACKAGE_VERSIONS;
export type PocPackageVersions = { readonly [Name in PocPackageName]: string };

interface PocEventBus {
  publish(event: { type?: string }): void;
  getStream(...arguments_: unknown[]): unknown;
  subscribe(...arguments_: unknown[]): unknown;
  removeAllListeners(): void;
  newScopedBus(...arguments_: unknown[]): unknown;
}

interface PocTheme {
  readonly isLight: boolean;
}

interface RuntimeModule {
  readonly config: {
    readonly appSubUrl: string;
    readonly bootData: unknown;
    readonly namespace: string;
    readonly theme2: PocTheme;
  };
  getBackendSrv(): BackendSrv;
  getAppEvents(): unknown;
  readonly locationService: Record<string, unknown>;
  setBackendSrv(instance: BackendSrv): void;
  setAppEvents(instance: PocEventBus): void;
}

interface DataModule {
  readonly EventBusSrv: new () => PocEventBus;
  readonly ThemeContext: Context<PocTheme>;
}

interface I18nModule {
  initPluginTranslations(
    id: string,
    loaders?: Array<(language: string) => Promise<unknown>>
  ): Promise<{ language: string }>;
}

interface ScenesModule {
  loadResources(language: string): Promise<unknown>;
}

export interface GrafanaCohort {
  readonly data: DataModule;
  readonly i18n: I18nModule;
  readonly moduleIdentities: Record<
    string,
    { copies: number; labels: string[]; version: string }
  >;
  readonly runtime: RuntimeModule;
  readonly scenes: ScenesModule;
  readonly schema: Record<string, unknown>;
  readonly ui: Record<string, unknown>;
  readonly versions: PocPackageVersions;
}

export type GrafanaModuleImporter = (specifier: string) => Promise<unknown>;

export class PocRuntimeImportOrderError extends Error {
  readonly code = 'runtime-import-order';

  constructor(message: string) {
    super(message);
    this.name = 'PocRuntimeImportOrderError';
  }
}

export class PocPackageVersionError extends Error {
  readonly code = 'package-version-mismatch';

  constructor(packageName: string, expected: string, actual: string) {
    super(`${packageName} must be ${expected}; loaded ${actual}.`);
    this.name = 'PocPackageVersionError';
  }
}

async function defaultImporter(specifier: string): Promise<unknown> {
  switch (specifier) {
    case '@grafana/runtime':
      return import('@grafana/runtime');
    case '@grafana/data':
      return import('@grafana/data');
    case '@grafana/i18n':
      return import('@grafana/i18n');
    case '@grafana/scenes':
      return import('@grafana/scenes');
    case '@grafana/schema':
      return import('@grafana/schema');
    case '@grafana/ui':
      return import('@grafana/ui');
    case 'react':
      return import('react');
    case 'react-dom':
      return import('react-dom');
    case '@grafana/runtime/package.json':
      return import('@grafana/runtime/package.json');
    case '@grafana/data/package.json':
      return import('@grafana/data/package.json');
    case '@grafana/i18n/package.json':
      return import('@grafana/i18n/package.json');
    case '@grafana/scenes/package.json':
      return import('@grafana/scenes/package.json');
    case '@grafana/schema/package.json':
      return import('@grafana/schema/package.json');
    case '@grafana/ui/package.json':
      return import('@grafana/ui/package.json');
    case 'react/package.json':
      return import('react/package.json');
    case 'react-dom/package.json':
      return import('react-dom/package.json');
    default:
      throw new Error(`Task 5 does not permit loading module ${specifier}.`);
  }
}

function packageVersion(module: unknown): string {
  const candidate = module as { default?: { version?: unknown }; version?: unknown };
  const version = candidate.default?.version ?? candidate.version;
  return typeof version === 'string' ? version : '<missing>';
}

export interface LoadGrafanaCohortOptions {
  readonly bootDataInstallation: PocBootDataInstallation | undefined;
  readonly identityRegistry?: RuntimeModuleIdentityRegistry;
  readonly importer?: GrafanaModuleImporter;
  readonly target: PocBootWindow;
}

export async function loadGrafanaCohort({
  bootDataInstallation,
  identityRegistry = createRuntimeIdentityRegistry(),
  importer = defaultImporter,
  target,
}: LoadGrafanaCohortOptions): Promise<GrafanaCohort> {
  if (!bootDataInstallation || target.grafanaBootData !== bootDataInstallation.bootData) {
    throw new PocRuntimeImportOrderError(
      'installBootData must install the active boot object before @grafana/runtime is evaluated.'
    );
  }

  // Runtime is intentionally first: its config singleton captures grafanaBootData during evaluation.
  const runtime = (await importer('@grafana/runtime')) as RuntimeModule;
  if (runtime.config.bootData !== bootDataInstallation.bootData) {
    throw new PocRuntimeImportOrderError(
      '@grafana/runtime was evaluated before the POC boot object was installed.'
    );
  }
  if (
    runtime.config.appSubUrl !== bootDataInstallation.bootData.settings.appSubUrl ||
    runtime.config.namespace !== bootDataInstallation.config.namespace
  ) {
    throw new PocRuntimeImportOrderError('Grafana Runtime captured an incompatible boot configuration.');
  }

  const moduleNames = Object.keys(POC_PACKAGE_VERSIONS) as PocPackageName[];
  const loadedModules = Object.fromEntries(
    await Promise.all(
      moduleNames.map(async (name) => [name, name === '@grafana/runtime' ? runtime : await importer(name)])
    )
  ) as Record<PocPackageName, unknown>;
  const versions = Object.fromEntries(
    await Promise.all(
      moduleNames.map(async (name) => {
        const actual = packageVersion(await importer(`${name}/package.json`));
        const expected = POC_PACKAGE_VERSIONS[name];
        if (actual !== expected) {
          throw new PocPackageVersionError(name, expected, actual);
        }
        return [name, actual];
      })
    )
  ) as PocPackageVersions;

  identityRegistry.record('cohort:react', loadedModules.react as object, versions.react);
  identityRegistry.record(
    'cohort:react-dom',
    loadedModules['react-dom'] as object,
    versions['react-dom']
  );

  return {
    data: loadedModules['@grafana/data'] as DataModule,
    i18n: loadedModules['@grafana/i18n'] as I18nModule,
    moduleIdentities: identityRegistry.snapshot(),
    runtime,
    scenes: loadedModules['@grafana/scenes'] as ScenesModule,
    schema: loadedModules['@grafana/schema'] as Record<string, unknown>,
    ui: loadedModules['@grafana/ui'] as Record<string, unknown>,
    versions,
  };
}
