import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

interface ResizeObserverProbeProps {
  readonly onObserverInstalled: () => void;
}

function ResizeObserverProbe({ onObserverInstalled }: ResizeObserverProbeProps) {
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver(() => undefined);
    observer.observe(target.current!);
    onObserverInstalled();
    return () => observer.disconnect();
  }, [onObserverInstalled]);

  return <div ref={target} data-poc-resize-observer-probe="true" />;
}

export async function runResizeObserverUnmountProbe() {
  const container = document.createElement('section');
  document.body.appendChild(container);
  const root = createRoot(container);
  let signalObserverInstalled!: () => void;
  const observerInstalled = new Promise<void>((resolve) => {
    signalObserverInstalled = resolve;
  });
  root.render(<ResizeObserverProbe onObserverInstalled={signalObserverInstalled} />);
  await observerInstalled;
  const evidence = (
    globalThis as typeof globalThis & {
      __POC_RESOURCE_EVIDENCE__: {
        snapshot(label: string): { page: { resizeObserver: number } };
      };
    }
  ).__POC_RESOURCE_EVIDENCE__;
  const activeWhileMounted = evidence.snapshot('resize-component-mounted').page.resizeObserver;
  root.unmount();
  await Promise.resolve();
  container.remove();

  return {
    activeAfterUnmount: evidence.snapshot('resize-component-unmounted').page.resizeObserver,
    activeWhileMounted,
    remainingProbeElements: document.querySelectorAll('[data-poc-resize-observer-probe]').length,
  };
}
