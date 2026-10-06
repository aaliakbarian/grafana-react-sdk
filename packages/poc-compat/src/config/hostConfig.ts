import {
  isTextRuntimePanelCatalog,
  POC_GATE_A_TEXT_PANEL_CATALOG,
  type PocRuntimePanelCatalog,
} from '../panels/panelCatalog';

export const POC_GRAFANA_NAMESPACE = 'default' as const;
export const POC_LOCALE = 'en-US' as const;
export const POC_THEME = 'light' as const;
export const POC_TIMEZONE = 'browser' as const;

export interface PocHostConfig {
  readonly assetBasePath: string;
  readonly grafanaBasePath: string;
  readonly locale: typeof POC_LOCALE;
  readonly namespace: typeof POC_GRAFANA_NAMESPACE;
  readonly panelCatalog: PocRuntimePanelCatalog;
  readonly request: typeof fetch;
  readonly theme: typeof POC_THEME;
  readonly timezone: typeof POC_TIMEZONE;
}

export interface NormalizedPocHostConfig extends PocHostConfig {
  readonly assetBasePath: string;
  readonly grafanaBasePath: string;
}

export class PocHostConfigError extends Error {
  readonly code = 'host-config-invalid';

  constructor(message: string) {
    super(message);
    this.name = 'PocHostConfigError';
  }
}

const allowedKeys = new Set<keyof PocHostConfig>([
  'assetBasePath',
  'grafanaBasePath',
  'locale',
  'namespace',
  'panelCatalog',
  'request',
  'theme',
  'timezone',
]);
const sensitiveKey =
  /(?:authorization|cookie|credential|password|passwd|secret|session|token|api[-_]?key|access[-_]?key|refresh[-_]?key)/i;

function normalizeRelativePath(value: unknown, field: string, trailingSlash: boolean): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    throw new PocHostConfigError(`${field} must be a root-relative browser path.`);
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('?') || value.includes('#')) {
    throw new PocHostConfigError(`${field} must not include an origin, query, or fragment.`);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new PocHostConfigError(`${field} must use valid URL path encoding.`);
  }
  if (decoded.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new PocHostConfigError(`${field} must not contain relative path segments.`);
  }

  const normalized = `/${decoded
    .split('/')
    .filter(Boolean)
    .join('/')}`;
  if (normalized === '/') {
    return '/';
  }
  return trailingSlash ? `${normalized}/` : normalized;
}

export function normalizePocHostConfig(input: PocHostConfig): NormalizedPocHostConfig {
  if (!input || typeof input !== 'object') {
    throw new PocHostConfigError('POC host configuration must be an object.');
  }

  for (const key of Object.keys(input)) {
    if (sensitiveKey.test(key)) {
      throw new PocHostConfigError('Credential-bearing fields are forbidden in POC runtime configuration.');
    }
    if (!allowedKeys.has(key as keyof PocHostConfig)) {
      throw new PocHostConfigError(`Unsupported POC host configuration field: ${key}.`);
    }
  }
  if (input.namespace !== POC_GRAFANA_NAMESPACE) {
    throw new PocHostConfigError(`namespace must be ${POC_GRAFANA_NAMESPACE}.`);
  }
  if (input.locale !== POC_LOCALE) {
    throw new PocHostConfigError(`locale must be ${POC_LOCALE} for the controlled POC.`);
  }
  if (input.timezone !== POC_TIMEZONE) {
    throw new PocHostConfigError(`timezone must be ${POC_TIMEZONE} for the controlled POC.`);
  }
  if (input.theme !== POC_THEME) {
    throw new PocHostConfigError(`theme must be ${POC_THEME} for the controlled POC.`);
  }
  if (typeof input.request !== 'function') {
    throw new PocHostConfigError('request must be a host-owned fetch-compatible function.');
  }
  if (!input.panelCatalog || typeof input.panelCatalog.identity !== 'string') {
    throw new PocHostConfigError('The POC runtime requires a named panel catalogue.');
  }
  const panelIds = input.panelCatalog.panelIds;
  const emptyCatalog =
    input.panelCatalog.identity.length > 0 && Array.isArray(panelIds) && panelIds.length === 0;
  const textCatalog =
    Array.isArray(panelIds) &&
    panelIds.length === 1 &&
    panelIds[0] === 'text' &&
    isTextRuntimePanelCatalog(input.panelCatalog) &&
    typeof input.panelCatalog.pluginImportUtils?.getPanelPluginFromCache === 'function' &&
    typeof input.panelCatalog.pluginImportUtils?.importPanelPlugin === 'function';
  if (!emptyCatalog && !textCatalog) {
    throw new PocHostConfigError(
      `Only an empty catalogue or ${POC_GATE_A_TEXT_PANEL_CATALOG.identity} with the closed Text importer is permitted.`
    );
  }

  return {
    assetBasePath: normalizeRelativePath(input.assetBasePath, 'assetBasePath', true),
    grafanaBasePath: normalizeRelativePath(input.grafanaBasePath, 'grafanaBasePath', false),
    locale: input.locale,
    namespace: input.namespace,
    panelCatalog: textCatalog
      ? {
          identity: POC_GATE_A_TEXT_PANEL_CATALOG.identity,
          panelIds: ['text'],
          pluginImportUtils: input.panelCatalog.pluginImportUtils,
        }
      : { identity: input.panelCatalog.identity, panelIds: [] },
    request: input.request,
    theme: input.theme,
    timezone: input.timezone,
  };
}
