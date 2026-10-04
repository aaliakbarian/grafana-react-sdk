import { expect, test } from '@playwright/test';

test('mounts and cleanly unmounts the route-free native React host', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByTestId('poc-host-shell')).toContainText('Standalone native-rendering POC');
  await expect(page.getByTestId('grafana-dashboard-root')).toBeEmpty();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('margin', '8px');
  await expect(page).toHaveURL('http://localhost:5173/');

  const lifecycle = await page.evaluate(async () => {
    const host = await import('/src/main.tsx');
    host.unmountPocHost();

    return {
      mountChildren: document.querySelector('#root')?.childElementCount,
      iframeCount: document.querySelectorAll('iframe').length,
    };
  });

  expect(lifecycle).toEqual({ mountChildren: 0, iframeCount: 0 });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
