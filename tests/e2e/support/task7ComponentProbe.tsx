import { createRoot } from 'react-dom/client';

import { GrafanaDashboard } from '../../../packages/poc-compat/src/component/GrafanaDashboard';
import type { PocPanelCatalog } from '../../../packages/poc-compat/src/dashboard/preflightFixture';
import type { PocRuntimeLease } from '../../../packages/poc-compat/src/runtime/acquirePocRuntime';

function waitForReady(container: HTMLElement, uid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (container.querySelector(`[data-poc-dashboard-uid="${uid}"]`)) {
        resolve();
        return;
      }
      if (performance.now() - started >= 10_000) {
        reject(new Error(`Task 7 diagnostic component did not publish ${uid}.`));
        return;
      }
      window.setTimeout(check, 10);
    };
    check();
  });
}

export async function runTask7ComponentProbe(runtime: PocRuntimeLease, catalog: PocPanelCatalog) {
  const container = document.createElement('section');
  container.dataset.pocTask7Probe = 'true';
  document.body.appendChild(container);
  const root = createRoot(container);
  const readyUids: string[] = [];
  const render = (uid: string) =>
    root.render(
      <GrafanaDashboard
        catalog={catalog}
        onSceneReady={(scene) => readyUids.push(scene.state.uid)}
        runtime={runtime}
        uid={uid}
      />
    );

  render('grsdk-phase0-poc');
  await waitForReady(container, 'grsdk-phase0-poc');
  const primaryPanelCount = Number(
    container.querySelector('[data-poc-dashboard-panel-count]')?.getAttribute('data-poc-dashboard-panel-count')
  );
  render('grsdk-phase0-poc-alt');
  await waitForReady(container, 'grsdk-phase0-poc-alt');
  const alternatePanelCount = Number(
    container.querySelector('[data-poc-dashboard-panel-count]')?.getAttribute('data-poc-dashboard-panel-count')
  );

  root.unmount();
  container.remove();
  await Promise.resolve();
  return {
    alternatePanelCount,
    primaryPanelCount,
    readyUids,
    remainingProbeElements: document.querySelectorAll('[data-poc-task7-probe]').length,
  };
}
