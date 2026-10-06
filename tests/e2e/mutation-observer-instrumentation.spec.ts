import { expect, test, type Page } from '@playwright/test';

import {
  captureResourceEvidence,
  installResourceEvidence,
} from './support/resourceEvidence';

test.use({ trace: 'off' });

async function expectObserverResourcesClean(page: Page, label: string): Promise<void> {
  const resources = await captureResourceEvidence(page, label);
  expect(resources.page.mutationObserver).toBe(0);
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
}

test('constructs the instrumented MutationObserver in the browser realm', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(() => {
    const observer = new MutationObserver(() => undefined);
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { mutationObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;
    const isInstrumentedInstance = observer instanceof MutationObserver;
    const usesInstalledPrototype = Object.getPrototypeOf(observer) === MutationObserver.prototype;
    const activeAfterConstruction = evidence.snapshot('observer-created').page.mutationObserver;
    observer.disconnect();

    return { activeAfterConstruction, isInstrumentedInstance, usesInstalledPrototype };
  });

  expect(result).toEqual({
    activeAfterConstruction: 1,
    isInstrumentedInstance: true,
    usesInstalledPrototype: true,
  });
  await expectObserverResourcesClean(page, 'mutation-observer-constructed-and-disconnected');
});

test('preserves callback identity, record order, and repeated observe behavior', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const firstTarget = document.createElement('section');
    const secondTarget = document.createElement('section');
    document.body.append(firstTarget, secondTarget);

    let observer!: MutationObserver;
    const callbackResult = new Promise<{
      observerIdentity: boolean;
      recordCount: number;
      recordsAreNative: boolean[];
      targets: boolean[];
      types: string[];
    }>((resolve) => {
      observer = new MutationObserver((records, callbackObserver) => {
        resolve({
          observerIdentity: callbackObserver === observer,
          recordCount: records.length,
          recordsAreNative: records.map((record) => record instanceof MutationRecord),
          targets: [records[0]?.target === firstTarget, records[1]?.target === secondTarget],
          types: records.map((record) => record.type),
        });
      });
    });

    observer.observe(firstTarget, { childList: true });
    observer.observe(secondTarget, { attributes: true, attributeOldValue: true });
    const activeAfterRepeatedObserve = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { mutationObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__.snapshot('observer-repeated-observe').page.mutationObserver;
    firstTarget.appendChild(document.createElement('span'));
    secondTarget.setAttribute('data-phase', 'mutated');

    const callback = await callbackResult;
    observer.disconnect();
    firstTarget.remove();
    secondTarget.remove();
    return { ...callback, activeAfterRepeatedObserve };
  });

  expect(result).toEqual({
    activeAfterRepeatedObserve: 1,
    observerIdentity: true,
    recordCount: 2,
    recordsAreNative: [true, true],
    targets: [true, true],
    types: ['childList', 'attributes'],
  });
  await expectObserverResourcesClean(page, 'mutation-observer-repeated-observe-clean');
});

test('delegates takeRecords without cloning and empties the native pending queue', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const target = document.createElement('section');
    const child = document.createElement('span');
    document.body.appendChild(target);
    let callbackCalls = 0;
    const observer = new MutationObserver(() => {
      callbackCalls += 1;
    });
    observer.observe(target, { childList: true });
    target.appendChild(child);

    const firstRecords = observer.takeRecords();
    const secondRecords = observer.takeRecords();
    await Promise.resolve();
    observer.disconnect();
    target.remove();

    return {
      addedNodeIdentity: firstRecords[0]?.addedNodes[0] === child,
      callbackCalls,
      firstLength: firstRecords.length,
      nativePrototype: Object.getPrototypeOf(firstRecords[0]) === MutationRecord.prototype,
      nativeRecord: firstRecords[0] instanceof MutationRecord,
      secondLength: secondRecords.length,
      targetIdentity: firstRecords[0]?.target === target,
    };
  });

  expect(result).toEqual({
    addedNodeIdentity: true,
    callbackCalls: 0,
    firstLength: 1,
    nativePrototype: true,
    nativeRecord: true,
    secondLength: 0,
    targetIdentity: true,
  });
  await expectObserverResourcesClean(page, 'mutation-observer-take-records-clean');
});

test('disconnects independent observers and permits reuse after disconnect', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const waitForDelivery = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const firstTarget = document.createElement('section');
    const secondTarget = document.createElement('section');
    document.body.append(firstTarget, secondTarget);
    let firstCalls = 0;
    let secondCalls = 0;
    const firstObserver = new MutationObserver(() => {
      firstCalls += 1;
    });
    const secondObserver = new MutationObserver(() => {
      secondCalls += 1;
    });
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__: {
          snapshot(label: string): { page: { mutationObserver: number } };
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;
    const activeAfterConstruction = evidence.snapshot('two-observers-created').page.mutationObserver;
    firstObserver.observe(firstTarget, { attributes: true });
    secondObserver.observe(secondTarget, { attributes: true });

    firstTarget.setAttribute('data-step', 'one');
    secondTarget.setAttribute('data-step', 'one');
    await waitForDelivery();
    const afterFirstDelivery = { firstCalls, secondCalls };

    firstObserver.disconnect();
    const activeAfterFirstDisconnect = evidence.snapshot('first-observer-disconnected').page
      .mutationObserver;
    firstTarget.setAttribute('data-step', 'two');
    secondTarget.setAttribute('data-step', 'two');
    await waitForDelivery();
    const afterDisconnect = { firstCalls, secondCalls };

    firstObserver.observe(firstTarget, { attributes: true });
    const activeAfterReuse = evidence.snapshot('first-observer-reused').page.mutationObserver;
    firstTarget.setAttribute('data-step', 'three');
    await waitForDelivery();
    const afterReuse = { firstCalls, secondCalls };

    firstObserver.disconnect();
    secondObserver.disconnect();
    firstTarget.remove();
    secondTarget.remove();
    return {
      activeAfterConstruction,
      activeAfterFirstDisconnect,
      activeAfterReuse,
      afterDisconnect,
      afterFirstDelivery,
      afterReuse,
    };
  });

  expect(result).toEqual({
    activeAfterConstruction: 2,
    activeAfterFirstDisconnect: 1,
    activeAfterReuse: 2,
    afterDisconnect: { firstCalls: 1, secondCalls: 2 },
    afterFirstDelivery: { firstCalls: 1, secondCalls: 1 },
    afterReuse: { firstCalls: 2, secondCalls: 2 },
  });
  await expectObserverResourcesClean(page, 'mutation-observer-reuse-clean');
});

test('surfaces callback errors through the browser error channel', async ({ page }) => {
  await installResourceEvidence(page);
  await page.goto('/');

  const browserError = page.waitForEvent('pageerror');
  await page.evaluate(() => {
    const target = document.createElement('section');
    document.body.appendChild(target);
    const observer = new MutationObserver(() => {
      observer.disconnect();
      target.remove();
      throw new Error('task-7.5-mutation-callback-sentinel');
    });
    observer.observe(target, { attributes: true });
    target.setAttribute('data-trigger', 'true');
  });

  await expect(browserError).resolves.toMatchObject({
    message: expect.stringContaining('task-7.5-mutation-callback-sentinel'),
  });
  await expectObserverResourcesClean(page, 'mutation-observer-callback-error-clean');
});
