import type { NormalizedPocHostConfig } from './hostConfig';

export interface PocBootWindow {
  grafanaBootData?: PocMinimalBootData;
  location: {
    hash: string;
    href: string;
    origin: string;
    pathname: string;
    search: string;
  };
}

export interface PocMinimalBootData {
  readonly assets: { readonly dark: ''; readonly light: '' };
  readonly navTree: readonly [];
  readonly settings: {
    readonly appSubUrl: string;
    readonly appUrl: string;
    readonly buildInfo: {
      readonly commit: '6193dc03311b631b9727b560d24369e683dc396e';
      readonly env: 'production';
      readonly version: '13.2.3';
    };
    readonly featureToggles: Record<string, boolean>;
    readonly language: 'en-US';
    readonly minRefreshInterval: '5s';
    readonly namespace: 'default';
  };
  readonly user: {
    language: 'en-US';
    lightTheme: true;
    theme: 'light';
    timezone: 'browser';
  };
}

export interface PocBootDataInstallation {
  readonly bootData: PocMinimalBootData;
  readonly config: NormalizedPocHostConfig;
  readonly target: PocBootWindow;
}

const installations = new WeakMap<object, PocBootDataInstallation>();

export function installBootData(
  config: NormalizedPocHostConfig,
  target: PocBootWindow
): PocBootDataInstallation {
  const existing = installations.get(target as object);
  if (existing) {
    if (existing.config.grafanaBasePath !== config.grafanaBasePath) {
      throw new Error('A different POC boot-data identity is already installed in this JavaScript realm.');
    }
    return existing;
  }
  if (target.grafanaBootData) {
    throw new Error('window.grafanaBootData already exists outside the POC compatibility runtime.');
  }

  // Runtime creates its default history object while the package is evaluated.
  // Keep that dormant singleton rooted at the host page; /grafana is a transport
  // boundary owned by hostConfig, not a Grafana router basename.
  const appUrl = `${target.location.origin}/`;
  const bootData: PocMinimalBootData = {
    assets: { dark: '', light: '' },
    navTree: [],
    settings: {
      appSubUrl: '',
      appUrl,
      buildInfo: {
        commit: '6193dc03311b631b9727b560d24369e683dc396e',
        env: 'production',
        version: '13.2.3',
      },
      featureToggles: {},
      language: config.locale,
      minRefreshInterval: '5s',
      namespace: config.namespace,
    },
    user: {
      language: config.locale,
      lightTheme: true,
      theme: config.theme,
      timezone: config.timezone,
    },
  };
  target.grafanaBootData = bootData;
  const installation = { bootData, config, target } satisfies PocBootDataInstallation;
  installations.set(target as object, installation);
  return installation;
}
