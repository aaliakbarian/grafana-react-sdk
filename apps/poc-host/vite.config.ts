import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from './build/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from './build/forbiddenGrafanaImportPlugin.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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
    forbiddenGrafanaImportPlugin({ repositoryRoot }),
    react(),
    bundleEvidencePlugin({ repositoryRoot }),
  ],
  resolve: {
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
