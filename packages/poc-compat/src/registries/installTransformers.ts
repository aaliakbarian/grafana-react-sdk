import type {
  DataTransformerInfo,
  TransformerRegistryItem,
} from '@grafana/data';

export interface PocTransformerRegistry {
  getIfExists(id: string): TransformerRegistryItem | undefined;
  list(): readonly TransformerRegistryItem[];
  setInit(initializer: () => TransformerRegistryItem[]): void;
}

export class PocTransformerUnsupportedError extends Error {
  readonly code = 'transformer-unsupported';
  readonly transformerId: string;

  constructor(transformerId: string) {
    super(`Gate C admits only renameByRegex; received ${transformerId || '<empty>'}.`);
    this.name = 'PocTransformerUnsupportedError';
    this.transformerId = transformerId;
  }
}

function UnavailableViewOnlyTransformerEditor() {
  return null;
}

export function requireGateCTransformer(transformerId: string): void {
  if (transformerId !== 'renameByRegex') {
    throw new PocTransformerUnsupportedError(transformerId);
  }
}

/** Installs the one public/deprecated transformer exercised by the controlled fixture. */
export function installGateCTransformers(
  registry: PocTransformerRegistry,
  renameByRegexTransformer: DataTransformerInfo
): void {
  if (renameByRegexTransformer.id !== 'renameByRegex') {
    throw new PocTransformerUnsupportedError(renameByRegexTransformer.id);
  }
  registry.setInit(() => [
    {
      id: 'renameByRegex',
      name: renameByRegexTransformer.name,
      description: renameByRegexTransformer.description,
      defaultOptions: renameByRegexTransformer.defaultOptions,
      editor: UnavailableViewOnlyTransformerEditor,
      imageDark: '',
      imageLight: '',
      transformation: () => Promise.resolve(renameByRegexTransformer),
    },
  ]);
  if (registry.getIfExists('renameByRegex')?.id !== 'renameByRegex') {
    throw new PocTransformerUnsupportedError('renameByRegex');
  }
}
