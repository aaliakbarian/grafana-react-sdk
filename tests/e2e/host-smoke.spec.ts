import { expect, test } from '@playwright/test';

import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

test('mounts and cleanly unmounts the route-free native React host', async ({ page }) => {
  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);

  await page.goto('/');

  await expect(page.getByTestId('poc-host-shell')).toContainText('Standalone native-rendering POC');
  await expect(page.getByTestId('grafana-dashboard-root')).toBeEmpty();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('margin', '8px');
  await expect(page).toHaveURL('http://localhost:5173/');

  const lifecycle = await page.evaluate(async () => {
    const hostModulePath = '/src/main.tsx';
    const host = await import(/* @vite-ignore */ hostModulePath);
    host.unmountPocHost();

    return {
      mountChildren: document.querySelector('#root')?.childElementCount,
      iframeCount: document.querySelectorAll('iframe').length,
    };
  });

  expect(lifecycle).toEqual({ mountChildren: 0, iframeCount: 0 });

  const resources = await captureResourceEvidence(page, 'host-unmounted');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
  expect(resources.dom.portalRoots).toBe(0);
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);

  await networkEvidence.write('artifacts/playwright/task-4-host-smoke-network.json');
  await writeResourceEvidence('artifacts/playwright/task-4-host-smoke-resources.json', [resources]);
  await consoleGuard.assertClean();
});
