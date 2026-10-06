export interface PocSceneGenerationInspection {
  readonly activeGeneration: number;
  readonly activeUid?: string;
  readonly cancelled: boolean;
}

export interface PocSceneGeneration {
  readonly generation: number;
  readonly signal: AbortSignal;
  readonly uid: string;
  isCurrent(): boolean;
  publish<T>(value: T, publish: (value: T) => void): boolean;
}

export interface PocSceneGenerationController {
  begin(uid: string): PocSceneGeneration;
  cancel(): void;
  inspect(): PocSceneGenerationInspection;
}

export function createSceneGenerationController(): PocSceneGenerationController {
  let generation = 0;
  let active: { readonly controller: AbortController; readonly generation: number; readonly uid: string } | undefined;

  return {
    begin(uid) {
      active?.controller.abort();
      const controller = new AbortController();
      const current = { controller, generation: ++generation, uid };
      active = current;
      const isCurrent = () => active === current && !controller.signal.aborted;
      return {
        generation: current.generation,
        signal: controller.signal,
        uid,
        isCurrent,
        publish(value, publish) {
          if (!isCurrent()) return false;
          publish(value);
          return true;
        },
      };
    },
    cancel() {
      active?.controller.abort();
    },
    inspect() {
      return {
        activeGeneration: generation,
        ...(active ? { activeUid: active.uid, cancelled: active.controller.signal.aborted } : { cancelled: true }),
      };
    },
  };
}

