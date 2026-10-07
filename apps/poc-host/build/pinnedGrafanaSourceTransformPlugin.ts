import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

import { transformWithOxc, type Plugin } from 'vite';

export interface PinnedGrafanaSourceTransformOptions {
  entryAlias: string;
  entrypoint: string;
  sourceRoot: string;
  virtualNamespace?: string;
}

export const PINNED_GRAFANA_SOURCE_VIRTUAL_PREFIX = '\0poc-pinned-grafana-source:';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile the one audited application-source tree without following its
 * repository-local tsconfig. Grafana's TestData tsconfig extends the
 * unpublished @grafana/plugin-configs build package, which is not a runtime
 * requirement and is intentionally absent from this standalone POC.
 */
export function pinnedGrafanaSourceTransformPlugin(
  options: PinnedGrafanaSourceTransformOptions
): Plugin {
  const sourceRoot = resolve(options.sourceRoot).replaceAll('\\', '/').replace(/\/$/, '');
  if (options.virtualNamespace && !/^[a-z][a-z0-9-]*$/.test(options.virtualNamespace)) {
    throw new Error('Pinned Grafana source virtual namespace must be a lowercase identifier.');
  }
  const virtualPrefix = `${PINNED_GRAFANA_SOURCE_VIRTUAL_PREFIX}${
    options.virtualNamespace ? `${options.virtualNamespace}:` : ''
  }`;
  const sourceRootPattern = new RegExp(`^${escapeRegExp(sourceRoot)}/`);
  const virtualPrefixPattern = new RegExp(`^${escapeRegExp(virtualPrefix)}`);
  const assertInsideSourceRoot = (file: string) => {
    const absolute = resolve(file).replaceAll('\\', '/');
    if (!sourceRootPattern.test(absolute)) {
      throw new Error(`Pinned Grafana module is outside the audited source root: ${file}`);
    }
    return absolute;
  };
  const toVirtualId = (file: string) => {
    const relativePath = relative(sourceRoot, assertInsideSourceRoot(file)).split(sep).join('/');
    return `${virtualPrefix}${relativePath}.js`;
  };
  const fromVirtualId = (id: string) => {
    const relativePath = id.slice(virtualPrefix.length).replace(/\.js$/, '');
    return assertInsideSourceRoot(resolve(sourceRoot, relativePath));
  };
  const resolveSourceFile = (candidate: string): string | undefined => {
    const hasSourceExtension = /\.(?:[cm]?[jt]sx?|json|css)$/i.test(candidate);
    const candidates = hasSourceExtension
      ? [candidate]
      : [
          candidate,
          `${candidate}.ts`,
          `${candidate}.tsx`,
          `${candidate}.js`,
          `${candidate}.jsx`,
          resolve(candidate, 'index.ts'),
          resolve(candidate, 'index.tsx'),
          resolve(candidate, 'index.js'),
          resolve(candidate, 'index.jsx'),
        ];
    return candidates.find(
      (file) => sourceRootPattern.test(file.replaceAll('\\', '/')) && existsSync(file)
    );
  };

  return {
    name: 'poc-pinned-grafana-source-transform',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === options.entryAlias) {
        return toVirtualId(resolve(sourceRoot, options.entrypoint));
      }
      if (!importer?.startsWith(virtualPrefix) || !source.startsWith('.')) {
        return null;
      }
      const importingFile = fromVirtualId(importer);
      const resolved = resolveSourceFile(resolve(dirname(importingFile), source));
      if (!resolved) {
        throw new Error(`Audited Grafana source import could not be resolved: ${source}`);
      }
      return toVirtualId(resolved);
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) {
        return null;
      }
      return readFileSync(fromVirtualId(id), 'utf8');
    },
    async transform(code, id) {
      if (!virtualPrefixPattern.test(id)) {
        return null;
      }
      const sourceFile = fromVirtualId(id);

      const result = await transformWithOxc(code, sourceFile, {
        jsx: {
          importSource: 'react',
          runtime: 'automatic',
        },
        sourcemap: true,
        tsconfig: {
          compilerOptions: {
            jsx: 'react-jsx',
          },
        },
      });

      return {
        code: result.code,
        map: result.map ?? null,
        moduleType: 'js',
      };
    },
  };
}
