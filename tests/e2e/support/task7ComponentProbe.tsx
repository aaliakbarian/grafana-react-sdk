import { createRoot } from 'react-dom/client';

import { GrafanaDashboard } from '../../../packages/poc-compat/src/component/GrafanaDashboard';
import type { PocPanelCatalog } from '../../../packages/poc-compat/src/dashboard/preflightFixture';
import type { PocRuntimeLease } from '../../../packages/poc-compat/src/runtime/acquirePocRuntime';

function createReadyObserver(container: HTMLElement) {
  let pending:
    | {
        reject(error: Error): void;
        resolve(): void;
        timer: number;
        uid: string;
      }
    | undefined;
  const check = () => {
    if (!pending || !container.querySelector(`[data-poc-dashboard-uid="${pending.uid}"]`)) {
      return;
    }
    window.clearTimeout(pending.timer);
    const { resolve } = pending;
    pending = undefined;
    resolve();
  };
  const observer = new MutationObserver(check);
  observer.observe(container, { attributes: true, childList: true, subtree: true });

  return {
    disconnect() {
      observer.disconnect();
      if (pending) {
        window.clearTimeout(pending.timer);
        pending.reject(new Error(`Task 7 diagnostic component stopped before publishing ${pending.uid}.`));
        pending = undefined;
      }
    },
    waitFor(uid: string): Promise<void> {
      if (pending) {
        throw new Error(`Task 7 diagnostic component is already waiting for ${pending.uid}.`);
      }
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending = undefined;
          reject(new Error(`Task 7 diagnostic component did not publish ${uid}.`));
        }, 10_000);
        pending = { reject, resolve, timer, uid };
        check();
      });
    },
  };
}

export async function runTask7ComponentProbe(runtime: PocRuntimeLease, catalog: PocPanelCatalog) {
  const container = document.createElement('section');
  container.dataset.pocTask7Probe = 'true';
  document.body.appendChild(container);
  const root = createRoot(container);
  const readyObserver = createReadyObserver(container);
  const readyUids: string[] = [];
  let alternatePanelCount = 0;
  let primaryPanelCount = 0;
  const render = (uid: string) =>
    root.render(
      <GrafanaDashboard
        catalog={catalog}
        onSceneReady={(scene) => readyUids.push(scene.state.uid)}
        runtime={runtime}
        uid={uid}
      />
    );

  try {
    render('grsdk-phase0-poc');
    await readyObserver.waitFor('grsdk-phase0-poc');
    primaryPanelCount = Number(
      container.querySelector('[data-poc-dashboard-panel-count]')?.getAttribute('data-poc-dashboard-panel-count')
    );
    render('grsdk-phase0-poc-alt');
    await readyObserver.waitFor('grsdk-phase0-poc-alt');
    alternatePanelCount = Number(
      container.querySelector('[data-poc-dashboard-panel-count]')?.getAttribute('data-poc-dashboard-panel-count')
    );
  } finally {
    root.unmount();
    readyObserver.disconnect();
    container.remove();
    await Promise.resolve();
  }

  return {
    alternatePanelCount,
    primaryPanelCount,
    readyUids,
    remainingProbeElements: document.querySelectorAll('[data-poc-task7-probe]').length,
  };
}
