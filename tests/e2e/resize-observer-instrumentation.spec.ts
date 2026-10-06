import { expect, test, type Page } from '@playwright/test';

import {
  captureResourceEvidence,
  installResourceEvidence,
} from './support/resourceEvidence';

test.use({ trace: 'off' });

async function expectResizeObserverResourcesClean(page: Page, label: string): Promise<void> {
  const resources = await captureResourceEvidence(page, label);
  expect(resources.page.resizeObserver).toBe(0);
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
}

test('constructs the instrumented ResizeObserver without claiming an active resource', async ({
  page,
}) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(() => {
    const observer = new ResizeObserver(() => undefined);
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { resizeObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;
    const isInstrumentedInstance = observer instanceof ResizeObserver;
    const usesInstalledPrototype = Object.getPrototypeOf(observer) === ResizeObserver.prototype;
    const activeAfterConstruction = evidence.snapshot('resize-observer-created').page.resizeObserver;
    observer.disconnect();

    return { activeAfterConstruction, isInstrumentedInstance, usesInstalledPrototype };
  });

  expect(result).toEqual({
    activeAfterConstruction: 0,
    isInstrumentedInstance: true,
    usesInstalledPrototype: true,
  });
  await expectResizeObserverResourcesClean(page, 'resize-observer-constructed-and-disconnected');
});

test('preserves callback identity and repeated observe behavior', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const firstTarget = document.createElement('section');
    const secondTarget = document.createElement('section');
    Object.assign(firstTarget.style, { height: '20px', width: '20px' });
    Object.assign(secondTarget.style, { height: '30px', width: '30px' });
    document.body.append(firstTarget, secondTarget);

    let observer!: ResizeObserver;
    const callbackResult = new Promise<{
      entriesAreNative: boolean[];
      observerIdentity: boolean;
      targetCoverage: boolean[];
    }>((resolve) => {
      observer = new ResizeObserver((entries, callbackObserver) => {
        const targets = new Set(entries.map((entry) => entry.target));
        resolve({
          entriesAreNative: entries.map((entry) => entry instanceof ResizeObserverEntry),
          observerIdentity: callbackObserver === observer,
          targetCoverage: [targets.has(firstTarget), targets.has(secondTarget)],
        });
      });
    });

    observer.observe(firstTarget);
    observer.observe(secondTarget, { box: 'border-box' });
    const callback = await callbackResult;
    observer.disconnect();
    firstTarget.remove();
    secondTarget.remove();
    return callback;
  });

  expect(result.observerIdentity).toBe(true);
  expect(result.entriesAreNative.every(Boolean)).toBe(true);
  expect(result.targetCoverage).toEqual([true, true]);
  await expectResizeObserverResourcesClean(page, 'resize-observer-repeated-observe-clean');
});

test('unobserves targets, disconnects, and permits reuse', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const firstTarget = document.createElement('section');
    const secondTarget = document.createElement('section');
    Object.assign(firstTarget.style, { height: '20px', width: '20px' });
    Object.assign(secondTarget.style, { height: '20px', width: '20px' });
    document.body.append(firstTarget, secondTarget);
    const deliveries: string[][] = [];
    const observer = new ResizeObserver((entries) => {
      deliveries.push(entries.map((entry) => (entry.target === firstTarget ? 'first' : 'second')));
    });
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { resizeObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;

    observer.observe(firstTarget);
    observer.observe(secondTarget);
    await nextFrame();
    deliveries.length = 0;

    observer.unobserve(firstTarget);
    firstTarget.style.width = '40px';
    secondTarget.style.width = '40px';
    await nextFrame();
    const afterUnobserve = deliveries.flat();

    observer.disconnect();
    const activeAfterDisconnect = evidence.snapshot('resize-disconnected').page.resizeObserver;
    deliveries.length = 0;
    secondTarget.style.width = '60px';
    await nextFrame();
    const afterDisconnect = deliveries.flat();

    observer.observe(firstTarget);
    const activeAfterReuse = evidence.snapshot('resize-reused').page.resizeObserver;
    firstTarget.style.width = '80px';
    await nextFrame();
    const afterReuse = deliveries.flat();

    observer.disconnect();
    firstTarget.remove();
    secondTarget.remove();
    return { activeAfterDisconnect, activeAfterReuse, afterDisconnect, afterReuse, afterUnobserve };
  });

  expect(result.activeAfterDisconnect).toBe(0);
  expect(result.activeAfterReuse).toBe(1);
  expect(result.afterUnobserve).not.toContain('first');
  expect(result.afterUnobserve).toContain('second');
  expect(result.afterDisconnect).toEqual([]);
  expect(result.afterReuse).toContain('first');
  await expectResizeObserverResourcesClean(page, 'resize-observer-reuse-clean');
});

test('tracks multiple independent observers and releases both', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(() => {
    const firstTarget = document.createElement('section');
    const secondTarget = document.createElement('section');
    document.body.append(firstTarget, secondTarget);
    const first = new ResizeObserver(() => undefined);
    const second = new ResizeObserver(() => undefined);
    first.observe(firstTarget);
    second.observe(secondTarget);
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { resizeObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;
    const activeTogether = evidence.snapshot('two-resize-observers').page.resizeObserver;
    first.disconnect();
    const activeAfterFirstDisconnect = evidence.snapshot('one-resize-observer').page.resizeObserver;
    second.disconnect();
    firstTarget.remove();
    secondTarget.remove();
    return { activeAfterFirstDisconnect, activeTogether };
  });

  expect(result).toEqual({ activeAfterFirstDisconnect: 1, activeTogether: 2 });
  await expectResizeObserverResourcesClean(page, 'multiple-resize-observers-clean');
});

test('releases a component-owned observer during React unmount', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const probePath = '/@fs/workspace/tests/e2e/support/resizeObserverUnmountProbe.tsx';
    const probe = await import(/* @vite-ignore */ probePath);
    return probe.runResizeObserverUnmountProbe();
  });

  expect(result).toEqual({
    activeAfterUnmount: 0,
    activeWhileMounted: 1,
    remainingProbeElements: 0,
  });
  await expectResizeObserverResourcesClean(page, 'resize-observer-react-unmount-clean');
});
