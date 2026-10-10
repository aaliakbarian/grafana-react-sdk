export type PocStyleMode = 'none' | 'full-reference' | 'minimum-scoped';

export interface PocStyleModeRoot {
  readonly dataset: Record<string, string | undefined>;
}

export interface PocStyleModeLease {
  release(): void;
}

export interface PocStyleModeManager {
  acquire(mode: PocStyleMode): PocStyleModeLease;
  inspect(): { readonly activeReferences: number; readonly mode?: PocStyleMode };
}

export function createPocStyleModeManager(root: PocStyleModeRoot): PocStyleModeManager {
  let mode: PocStyleMode | undefined;
  let activeReferences = 0;

  return {
    acquire(requestedMode) {
      if (mode !== undefined && mode !== requestedMode) {
        throw new Error(`Conflicting POC style modes: ${mode} and ${requestedMode}.`);
      }
      mode = requestedMode;
      activeReferences += 1;
      root.dataset.pocGrafanaStyleMode = requestedMode;
      let active = true;
      return {
        release() {
          if (!active) return;
          active = false;
          activeReferences = Math.max(0, activeReferences - 1);
          if (activeReferences === 0) {
            delete root.dataset.pocGrafanaStyleMode;
            mode = undefined;
          }
        },
      };
    },
    inspect() {
      return { activeReferences, ...(mode === undefined ? {} : { mode }) };
    },
  };
}
