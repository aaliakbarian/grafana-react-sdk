import type { Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface GrafanaFixtureSession {
  cleanup(): Promise<void>;
}

export async function authenticateGrafanaFixture(page: Page): Promise<GrafanaFixtureSession> {
  const user = process.env.POC_GRAFANA_VERIFY_USER;
  const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;
  if (!user || !password) {
    throw new Error('The local Grafana fixture credentials are required for Gate A.');
  }

  const response = await page.request.post('/grafana/login', {
    data: { user, password },
  });
  if (response.status() !== 200) {
    throw new Error(`The local Grafana fixture login returned HTTP ${response.status()}.`);
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'grsdk-gate-a-auth-'));
  await page.context().storageState({ path: join(temporaryDirectory, 'storage-state.json') });

  return {
    async cleanup() {
      await rm(temporaryDirectory, { force: true, recursive: true });
    },
  };
}
