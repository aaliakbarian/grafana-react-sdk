import { describe, expect, it, vi } from 'vitest';

import { installGateCFieldConfig } from './installGateBFieldConfig';

describe('Gate C field configuration registry', () => {
  it('adds only min and max to the inherited Gate B standard field surface', () => {
    const setInit = vi.fn();
    const identity = vi.fn();
    const number = vi.fn();
    const string = vi.fn();
    const thresholds = vi.fn();
    const mappings = vi.fn();

    installGateCFieldConfig(
      { setInit },
      {
        identityOverrideProcessor: identity,
        numberOverrideProcessor: number,
        stringOverrideProcessor: string,
        thresholdsOverrideProcessor: thresholds,
        valueMappingsOverrideProcessor: mappings,
      }
    );

    const items = setInit.mock.calls[0]?.[0]();
    expect(items.map((item: { id: string }) => item.id)).toEqual([
      'unit',
      'color',
      'mappings',
      'thresholds',
      'min',
      'max',
    ]);
    expect(items.find((item: { id: string }) => item.id === 'min').process).toBe(number);
    expect(items.find((item: { id: string }) => item.id === 'max').process).toBe(number);
  });
});
