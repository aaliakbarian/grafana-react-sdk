export interface IframeGuardNode {
  nodeName?: string;
  querySelectorAll?(selector: string): ArrayLike<IframeGuardNode>;
}

export interface IframeGuardDocument {
  documentElement: unknown;
  querySelectorAll(selector: string): ArrayLike<IframeGuardNode>;
}

export interface IframeGuardObserver {
  disconnect(): void;
  observe(target: unknown, options: { childList: boolean; subtree: boolean }): void;
}

export interface IframeGuardOptions {
  createObserver?: (
    callback: (records: Array<{ addedNodes: ArrayLike<unknown> }>) => void
  ) => IframeGuardObserver;
}

export interface IframeObservation {
  phase: 'initial' | 'mutation';
  sequence: number;
}

export interface IframeGuard {
  assertNoIframes(): void;
  snapshot(): {
    observationCount: number;
    observations: readonly IframeObservation[];
    violated: boolean;
  };
  stop(): void;
}

function collectIframes(node: unknown): IframeGuardNode[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  const candidate = node as IframeGuardNode;
  const matches: IframeGuardNode[] = [];
  if (candidate.nodeName?.toLowerCase() === 'iframe') {
    matches.push(candidate);
  }
  if (candidate.querySelectorAll) {
    matches.push(...Array.from(candidate.querySelectorAll('iframe')));
  }
  return matches;
}

export function createIframeGuard(
  document: IframeGuardDocument,
  options: IframeGuardOptions = {}
): IframeGuard {
  const observations: IframeObservation[] = [];
  let stopped = false;
  const record = (phase: IframeObservation['phase'], count: number) => {
    for (let index = 0; index < count; index += 1) {
      observations.push({ phase, sequence: observations.length + 1 });
    }
  };

  record('initial', document.querySelectorAll('iframe').length);
  const createObserver =
    options.createObserver ??
    ((callback) => new MutationObserver(callback as MutationCallback) as IframeGuardObserver);
  const observer = createObserver((records) => {
    for (const mutation of records) {
      for (const node of Array.from(mutation.addedNodes)) {
        record('mutation', collectIframes(node).length);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return {
    assertNoIframes() {
      if (observations.length > 0) {
        throw new Error(`POC iframe guard observed ${observations.length} iframe element(s).`);
      }
    },
    snapshot() {
      return {
        observationCount: observations.length,
        observations: observations.map((observation) => ({ ...observation })),
        violated: observations.length > 0,
      };
    },
    stop() {
      if (!stopped) {
        stopped = true;
        observer.disconnect();
      }
    },
  };
}
