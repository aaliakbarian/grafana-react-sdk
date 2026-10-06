import type { ResourceTracker } from '../instrumentation/resourceTracker';

export interface PocPortalElement {
  childElementCount: number;
  id: string;
  remove(): void;
}

export interface PocPortalDocument {
  readonly body: { appendChild(element: PocPortalElement): unknown };
  createElement(tagName: string): PocPortalElement;
  getElementById(id: string): PocPortalElement | null;
}

export interface PocPortalLease {
  readonly root: PocPortalElement;
  release(): void;
}

export interface PocPortalManager {
  acquire(): PocPortalLease;
  inspect(): { readonly activeReferences: number; readonly ownsRoot: boolean };
}

export function createPortalManager(
  document: PocPortalDocument,
  resourceTracker?: ResourceTracker
): PocPortalManager {
  let activeReferences = 0;
  let ownedRoot: PocPortalElement | undefined;
  let releaseTrackedPortal: (() => void) | undefined;

  return {
    acquire() {
      let root = document.getElementById('grafana-portal-container');
      if (!root) {
        root = document.createElement('div');
        root.id = 'grafana-portal-container';
        document.body.appendChild(root);
        ownedRoot = root;
        releaseTrackedPortal = resourceTracker?.acquire('portal', 'instance');
      }
      activeReferences += 1;
      let active = true;
      return {
        root,
        release() {
          if (!active) return;
          active = false;
          activeReferences = Math.max(0, activeReferences - 1);
          if (activeReferences === 0 && ownedRoot) {
            ownedRoot.remove();
            ownedRoot = undefined;
            releaseTrackedPortal?.();
            releaseTrackedPortal = undefined;
          }
        },
      };
    },
    inspect() {
      return { activeReferences, ownsRoot: ownedRoot !== undefined };
    },
  };
}
