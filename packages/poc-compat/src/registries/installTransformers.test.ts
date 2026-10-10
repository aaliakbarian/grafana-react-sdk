import type { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';
import { describe, expect, it, vi } from 'vitest';

import {
  installGateCTransformers,
  PocTransformerUnsupportedError,
  requireGateCTransformer,
} from './installTransformers';

describe('Gate C transformation registry', () => {
  const renameByRegexTransformer = {
    defaultOptions: { regex: '(.*)', renamePattern: '$1' },
    description: 'Rename fields by regex',
    id: 'renameByRegex',
    name: 'Rename fields by regex',
    operator: vi.fn(),
  } as unknown as DataTransformerInfo;

  function registryHarness() {
    let initializer: (() => TransformerRegistryItem[]) | undefined;
    const registry = {
      getIfExists: vi.fn((id: string) => initializer?.().find((item) => item.id === id)),
      list: vi.fn(() => initializer?.() ?? []),
      setInit: vi.fn((next: typeof initializer) => {
        initializer = next;
      }),
    };
    return { get initializer() { return initializer; }, registry };
  }

  it('registers only the published renameByRegex transformer', async () => {
    const harness = registryHarness();

    installGateCTransformers(harness.registry, renameByRegexTransformer);

    expect(harness.registry.setInit).toHaveBeenCalledOnce();
    const items = harness.initializer?.() ?? [];
    expect(items.map(({ id }) => id)).toEqual(['renameByRegex']);
    await expect(items[0]?.transformation()).resolves.toBe(
      renameByRegexTransformer
    );
  });

  it('fails closed for every unregistered transformation ID', () => {
    expect(() => requireGateCTransformer('renameByRegex')).not.toThrow();
    expect(() => requireGateCTransformer('organize')).toThrow(
      PocTransformerUnsupportedError
    );
  });

  it('does not swallow a controlled transformer failure', async () => {
    const failure = new Error('controlled transform failure');
    const throwing = {
      ...renameByRegexTransformer,
      operator: () => {
        throw failure;
      },
    };
    const harness = registryHarness();
    installGateCTransformers(harness.registry, throwing);
    const installed = await harness.initializer?.()[0]?.transformation();

    expect(() =>
      installed?.operator(
        { regex: '/Raw/', renamePattern: 'Signal' },
        { interpolate: (value: string) => value }
      )
    ).toThrow(failure);
  });
});
