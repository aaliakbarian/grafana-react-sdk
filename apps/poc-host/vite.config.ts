import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from './build/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from './build/forbiddenGrafanaImportPlugin.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const textExperimentEnabled = process.env.POC_TEXT_PANEL_EXPERIMENT === '1';
const expectedGrafanaCommit = '6193dc03311b631b9727b560d24369e683dc396e';

function verifyGrafanaSourceCheckout(sourceDir: string): void {
  statSync(resolve(sourceDir, 'public/app/plugins/panel/text/module.tsx'));
  const commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const dirty = execFileSync('git', ['-C', sourceDir, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim();
  if (commit !== expectedGrafanaCommit) {
    throw new Error(
      `Task 8 requires Grafana source ${expectedGrafanaCommit}; observed ${commit || '<missing>'}.`
    );
  }
  if (dirty) {
    throw new Error('Task 8 P1 requires a clean Grafana source checkout.');
  }
}

if (textExperimentEnabled && !grafanaSourceDir) {
  throw new Error('POC_TEXT_PANEL_EXPERIMENT=1 requires GRAFANA_SOURCE_DIR.');
}
if (grafanaSourceDir) {
  verifyGrafanaSourceCheckout(grafanaSourceDir);
}

const reviewedSourceRoots = grafanaSourceDir
  ? [resolve(grafanaSourceDir, 'public/app/plugins/panel/text')]
  : [];
const reviewedSourceFiles = grafanaSourceDir
  ? [
      resolve(grafanaSourceDir, 'public/app/core/config'),
      resolve(grafanaSourceDir, 'public/app/core/config.ts'),
    ]
  : [];

export default defineConfig({
  // This is the Task 5 dynamic Grafana cohort plus Task 6's direct RxJS boundary.
  // Pre-bundling this list prevents optimizer reloads during browser probes.
  optimizeDeps: {
    include: [
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/ui',
      // Task 6's BackendSrv adapter imports Observable directly. Declaring it
      // prevents Vite from discovering RxJS mid-probe and reloading the page.
      'rxjs',
    ],
  },
  plugins: [
    forbiddenGrafanaImportPlugin({
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: reviewedSourceRoots,
    }),
    react(),
    bundleEvidencePlugin({ repositoryRoot }),
  ],
  resolve: {
    alias: grafanaSourceDir
      ? {
          app: resolve(grafanaSourceDir, 'public/app'),
          'grafana-poc-text-panel': resolve(
            grafanaSourceDir,
            'public/app/plugins/panel/text/v1/module.tsx'
          ),
        }
      : undefined,
    dedupe: [
      'react',
      'react-dom',
      '@emotion/css',
      '@emotion/react',
      'rxjs',
      '@grafana/data',
      '@grafana/e2e-selectors',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/ui',
    ],
  },
  build: textExperimentEnabled
    ? {
        rollupOptions: {
          input: {
            index: resolve(repositoryRoot, 'apps/poc-host/index.html'),
            task8Catalog: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/catalog.ts'
            ),
            task8Text: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/text.ts'),
          },
          preserveEntrySignatures: 'strict',
        },
      }
    : undefined,
  server: {
    allowedHosts: ['dev'],
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/grafana': {
        target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: false,
        secure: false,
        ws: true,
      },
    },
  },
});
