import type { NormalizedPocHostConfig } from '../config/hostConfig';

export interface PocAssetWindow {
  __grafana_public_path__?: string;
}

export interface PocAssetPolicy {
  readonly publicPath: string;
  readonly strategy: 'host-relative-grafana-assets';
}

export function installAssetPolicy(
  config: NormalizedPocHostConfig,
  target: PocAssetWindow
): PocAssetPolicy {
  if (
    target.__grafana_public_path__ !== undefined &&
    target.__grafana_public_path__ !== config.assetBasePath
  ) {
    throw new Error('A conflicting Grafana asset public path is already installed.');
  }
  target.__grafana_public_path__ = config.assetBasePath;
  return {
    publicPath: config.assetBasePath,
    strategy: 'host-relative-grafana-assets',
  };
}
