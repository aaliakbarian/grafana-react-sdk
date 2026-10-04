import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const hostDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(hostDirectory, 'index.html');
const manifestPath = resolve(hostDirectory, 'package.json');
const viteConfigPath = resolve(hostDirectory, 'vite.config.ts');

describe('standalone POC host contract', () => {
  it('exposes exactly one native React mount element', () => {
    expect(existsSync(indexPath), 'apps/poc-host/index.html must exist').toBe(true);

    const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
    expect(html.match(/id=["']root["']/g)).toHaveLength(1);
    expect(html).not.toMatch(/<iframe\b/i);
  });

  it('does not add a router dependency', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(manifest.dependencies).not.toHaveProperty('react-router');
    expect(manifest.dependencies).not.toHaveProperty('react-router-dom');
    expect(manifest.devDependencies).not.toHaveProperty('react-router');
    expect(manifest.devDependencies).not.toHaveProperty('react-router-dom');
    expect(manifest.scripts?.dev).not.toMatch(/--host\b/);
  });

  it('deduplicates the shared runtime and exposes a credential-neutral Grafana proxy', async () => {
    expect(existsSync(viteConfigPath), 'apps/poc-host/vite.config.ts must exist').toBe(true);

    if (!existsSync(viteConfigPath)) {
      return;
    }

    const module = (await import(pathToFileURL(viteConfigPath).href)) as {
      default: {
        resolve?: { dedupe?: string[] };
        server?: {
          host?: string;
          port?: number;
          proxy?: Record<
            string,
            {
              target?: string;
              changeOrigin?: boolean;
              headers?: Record<string, string>;
              rewrite?: (path: string) => string;
            }
          >;
        };
      };
    };

    expect(module.default.resolve?.dedupe).toEqual(
      expect.arrayContaining([
        'react',
        'react-dom',
        '@emotion/css',
        '@emotion/react',
        'rxjs',
        '@grafana/data',
        '@grafana/runtime',
        '@grafana/scenes',
        '@grafana/schema',
        '@grafana/ui',
      ])
    );

    const proxy = module.default.server?.proxy?.['/grafana'];
    if (process.env.POC_VITE_HOST === undefined) {
      expect(module.default.server).toMatchObject({ host: 'localhost', port: 5173 });
    } else {
      expect(process.env.POC_VITE_HOST).toBe('0.0.0.0');
      expect(module.default.server).toMatchObject({ host: '0.0.0.0', port: 5173 });
    }
    expect(proxy).toMatchObject({
      target: 'http://127.0.0.1:3000',
      changeOrigin: false,
    });
    expect(proxy?.headers).toBeUndefined();
    expect(proxy?.rewrite).toBeUndefined();
  });
});
