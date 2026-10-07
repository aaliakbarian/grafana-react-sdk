import { describe, expect, it, vi } from 'vitest';
import type { FieldConfigPropertyItem } from '@grafana/data';

import { installGateBFieldConfig } from './installGateBFieldConfig';

describe('Gate B field configuration registry', () => {
  it('registers only the standard properties required by the controlled Stat fixture', () => {
    let initializer: (() => FieldConfigPropertyItem[]) | undefined;
    const registry = {
      setInit: vi.fn((next: typeof initializer) => {
        initializer = next;
      }),
    };

    const passthrough = (value: unknown) => value;
    installGateBFieldConfig(registry, {
      identityOverrideProcessor: passthrough,
      stringOverrideProcessor: passthrough,
      thresholdsOverrideProcessor: passthrough,
      valueMappingsOverrideProcessor: passthrough,
    });

    expect(registry.setInit).toHaveBeenCalledOnce();
    const items = initializer?.() ?? [];
    expect(items.map(({ id }) => id)).toEqual([
      'unit',
      'color',
      'mappings',
      'thresholds',
    ]);
    expect(items.every((item) => typeof item.process === 'function')).toBe(true);
    expect(items.find(({ id }) => id === 'unit')?.process('percent', {} as never)).toBe(
      'percent'
    );
  });
});
