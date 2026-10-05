export type ResourceLifetime = 'instance' | 'page';

export type ResourceKind =
  | 'abortController'
  | 'animationFrame'
  | 'eventListener'
  | 'fetch'
  | 'interval'
  | 'mutationObserver'
  | 'portal'
  | 'portalChild'
  | 'resizeObserver'
  | 'sceneActivation'
  | 'styleElement'
  | 'subscription'
  | 'timeout';

const resourceKinds: readonly ResourceKind[] = [
  'abortController',
  'animationFrame',
  'eventListener',
  'fetch',
  'interval',
  'mutationObserver',
  'portal',
  'portalChild',
  'resizeObserver',
  'sceneActivation',
  'styleElement',
  'subscription',
  'timeout',
];

export type ResourceCounts = Record<ResourceKind, number>;

export interface DomResourceSnapshot {
  emotionStyleElements: number;
  iframeElements: number;
  portalChildren: number;
  portalRoots: number;
  styleElements: number;
}

export interface ResourceSnapshot {
  dom?: DomResourceSnapshot;
  instance: ResourceCounts;
  page: ResourceCounts;
}

export interface ResourceTracker {
  acquire(kind: ResourceKind, lifetime: ResourceLifetime): () => void;
  assertBalanced(lifetime?: ResourceLifetime): string[];
  snapshot(document?: Document): ResourceSnapshot;
}

function emptyCounts(): ResourceCounts {
  return Object.fromEntries(resourceKinds.map((kind) => [kind, 0])) as ResourceCounts;
}

export function createResourceTracker(): ResourceTracker {
  const counts = { instance: emptyCounts(), page: emptyCounts() };

  return {
    acquire(kind, lifetime) {
      counts[lifetime][kind] += 1;
      let active = true;
      return () => {
        if (!active) {
          return;
        }
        active = false;
        counts[lifetime][kind] = Math.max(0, counts[lifetime][kind] - 1);
      };
    },
    assertBalanced(lifetime) {
      const lifetimes: ResourceLifetime[] = lifetime ? [lifetime] : ['page', 'instance'];
      return lifetimes.flatMap((currentLifetime) =>
        resourceKinds.flatMap((kind) => {
          const value = counts[currentLifetime][kind];
          if (value === 0) {
            return [];
          }
          return [lifetime ? `${kind}=${value}` : `${currentLifetime}.${kind}=${value}`];
        })
      );
    },
    snapshot(document) {
      return {
        ...(document
          ? {
              dom: {
                emotionStyleElements: document.querySelectorAll('style[data-emotion]').length,
                iframeElements: document.querySelectorAll('iframe').length,
                portalChildren: document.querySelector('#grafana-portal-container')?.childElementCount ?? 0,
                portalRoots: document.querySelectorAll('#grafana-portal-container').length,
                styleElements: document.querySelectorAll('style').length,
              },
            }
          : {}),
        instance: { ...counts.instance },
        page: { ...counts.page },
      };
    },
  };
}

export interface BrowserResourceInstrumentation {
  dispose(): void;
  trackPortal(lifetime?: ResourceLifetime): () => void;
  trackPortalChild(lifetime?: ResourceLifetime): () => void;
  trackSceneActivation(lifetime?: ResourceLifetime): () => void;
  trackStyleElement(lifetime?: ResourceLifetime): () => void;
  trackSubscription(lifetime?: ResourceLifetime): () => void;
}

type InstrumentableWindow = Window & typeof globalThis;

export function installBrowserResourceTracking(
  target: InstrumentableWindow,
  tracker: ResourceTracker,
  defaultLifetime: ResourceLifetime = 'instance'
): BrowserResourceInstrumentation {
  const restore: Array<() => void> = [];
  const outstanding = new Set<() => void>();
  const acquire = (kind: ResourceKind, lifetime = defaultLifetime) => {
    const release = tracker.acquire(kind, lifetime);
    const trackedRelease = () => {
      release();
      outstanding.delete(trackedRelease);
    };
    outstanding.add(trackedRelease);
    return trackedRelease;
  };

  const originalSetTimeout = target.setTimeout.bind(target);
  const originalClearTimeout = target.clearTimeout.bind(target);
  const timeoutReleases = new Map<number, () => void>();
  target.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
    let timer = 0;
    const release = acquire('timeout');
    const wrapped = (...callbackArguments: unknown[]) => {
      timeoutReleases.delete(timer);
      release();
      if (typeof handler === 'function') {
        handler(...callbackArguments);
      } else {
        target.eval(handler);
      }
    };
    timer = originalSetTimeout(wrapped, timeout, ...arguments_);
    timeoutReleases.set(timer, release);
    return timer;
  }) as typeof target.setTimeout;
  target.clearTimeout = ((timer?: number) => {
    timeoutReleases.get(timer ?? 0)?.();
    timeoutReleases.delete(timer ?? 0);
    originalClearTimeout(timer);
  }) as typeof target.clearTimeout;
  restore.push(() => {
    target.setTimeout = originalSetTimeout as typeof target.setTimeout;
    target.clearTimeout = originalClearTimeout as typeof target.clearTimeout;
  });

  const originalSetInterval = target.setInterval.bind(target);
  const originalClearInterval = target.clearInterval.bind(target);
  const intervalReleases = new Map<number, () => void>();
  target.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
    const timer = originalSetInterval(handler, timeout, ...arguments_);
    intervalReleases.set(timer, acquire('interval'));
    return timer;
  }) as typeof target.setInterval;
  target.clearInterval = ((timer?: number) => {
    intervalReleases.get(timer ?? 0)?.();
    intervalReleases.delete(timer ?? 0);
    originalClearInterval(timer);
  }) as typeof target.clearInterval;
  restore.push(() => {
    target.setInterval = originalSetInterval as typeof target.setInterval;
    target.clearInterval = originalClearInterval as typeof target.clearInterval;
  });

  const originalRequestAnimationFrame = target.requestAnimationFrame.bind(target);
  const originalCancelAnimationFrame = target.cancelAnimationFrame.bind(target);
  const animationReleases = new Map<number, () => void>();
  target.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    let frame = 0;
    const release = acquire('animationFrame');
    frame = originalRequestAnimationFrame((time) => {
      animationReleases.delete(frame);
      release();
      callback(time);
    });
    animationReleases.set(frame, release);
    return frame;
  }) as typeof target.requestAnimationFrame;
  target.cancelAnimationFrame = ((frame: number) => {
    animationReleases.get(frame)?.();
    animationReleases.delete(frame);
    originalCancelAnimationFrame(frame);
  }) as typeof target.cancelAnimationFrame;
  restore.push(() => {
    target.requestAnimationFrame = originalRequestAnimationFrame;
    target.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  const originalFetch = target.fetch.bind(target);
  target.fetch = (async (...arguments_: Parameters<typeof fetch>) => {
    const release = acquire('fetch');
    try {
      return await originalFetch(...arguments_);
    } finally {
      release();
    }
  }) as typeof target.fetch;
  restore.push(() => {
    target.fetch = originalFetch as typeof target.fetch;
  });

  const OriginalAbortController = target.AbortController;
  target.AbortController = class TrackedAbortController extends OriginalAbortController {
    readonly #release = acquire('abortController');

    constructor() {
      super();
      this.signal.addEventListener('abort', this.#release, { once: true });
    }
  } as typeof AbortController;
  restore.push(() => {
    target.AbortController = OriginalAbortController;
  });

  const OriginalMutationObserver = target.MutationObserver;
  target.MutationObserver = class TrackedMutationObserver extends OriginalMutationObserver {
    #active = true;
    #release = acquire('mutationObserver');

    override observe(targetNode: Node, options?: MutationObserverInit): void {
      if (!this.#active) {
        this.#release = acquire('mutationObserver');
        this.#active = true;
      }
      super.observe(targetNode, options);
    }

    override disconnect(): void {
      super.disconnect();
      this.#release();
      this.#active = false;
    }
  } as typeof MutationObserver;
  restore.push(() => {
    target.MutationObserver = OriginalMutationObserver;
  });

  const OriginalResizeObserver = target.ResizeObserver;
  if (OriginalResizeObserver) {
    target.ResizeObserver = class TrackedResizeObserver extends OriginalResizeObserver {
      #active = true;
      #release = acquire('resizeObserver');

      override observe(targetElement: Element, options?: ResizeObserverOptions): void {
        if (!this.#active) {
          this.#release = acquire('resizeObserver');
          this.#active = true;
        }
        super.observe(targetElement, options);
      }

      override disconnect(): void {
        super.disconnect();
        this.#release();
        this.#active = false;
      }
    } as typeof ResizeObserver;
    restore.push(() => {
      target.ResizeObserver = OriginalResizeObserver;
    });
  }

  const eventTargetPrototype = target.EventTarget.prototype;
  const originalAddEventListener = eventTargetPrototype.addEventListener;
  const originalRemoveEventListener = eventTargetPrototype.removeEventListener;
  const listenerRecords = new WeakMap<
    EventTarget,
    Map<EventListenerOrEventListenerObject, Map<string, { release: () => void; wrapped: EventListener }>>
  >();
  const optionKey = (type: string, options?: boolean | AddEventListenerOptions) =>
    `${type}:${typeof options === 'boolean' ? options : Boolean(options?.capture)}`;

  eventTargetPrototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (!listener) {
      return originalAddEventListener.call(this, type, listener, options);
    }
    const byListener = listenerRecords.get(this) ?? new Map();
    listenerRecords.set(this, byListener);
    const byOption = byListener.get(listener) ?? new Map();
    byListener.set(listener, byOption);
    const key = optionKey(type, options);
    if (byOption.has(key)) {
      return;
    }
    const release = acquire('eventListener');
    const wrapped: EventListener = (event) => {
      if (typeof listener === 'function') {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
      if (typeof options === 'object' && options.once) {
        release();
        byOption.delete(key);
      }
    };
    byOption.set(key, { release, wrapped });
    originalAddEventListener.call(this, type, wrapped, options);
  };
  eventTargetPrototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    if (!listener) {
      return originalRemoveEventListener.call(this, type, listener, options);
    }
    const key = optionKey(type, options);
    const record = listenerRecords.get(this)?.get(listener)?.get(key);
    if (record) {
      record.release();
      listenerRecords.get(this)?.get(listener)?.delete(key);
      return originalRemoveEventListener.call(this, type, record.wrapped, options);
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };
  restore.push(() => {
    eventTargetPrototype.addEventListener = originalAddEventListener;
    eventTargetPrototype.removeEventListener = originalRemoveEventListener;
  });

  return {
    dispose() {
      for (const restoreOperation of restore.reverse()) {
        restoreOperation();
      }
      for (const release of [...outstanding]) {
        release();
      }
    },
    trackPortal: (lifetime = defaultLifetime) => acquire('portal', lifetime),
    trackPortalChild: (lifetime = defaultLifetime) => acquire('portalChild', lifetime),
    trackSceneActivation: (lifetime = defaultLifetime) => acquire('sceneActivation', lifetime),
    trackStyleElement: (lifetime = defaultLifetime) => acquire('styleElement', lifetime),
    trackSubscription: (lifetime = defaultLifetime) => acquire('subscription', lifetime),
  };
}
