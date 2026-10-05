import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
