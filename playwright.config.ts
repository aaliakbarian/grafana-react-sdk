import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    contextOptions: {
      recordHar: {
        path: 'artifacts/playwright/task-2-host-smoke.har',
        content: 'omit',
        mode: 'minimal',
        urlFilter: /^(?!.*\/grafana(?:\/|$)).*$/,
      },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'corepack yarn workspace @grafana-react-sdk/poc-host dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
