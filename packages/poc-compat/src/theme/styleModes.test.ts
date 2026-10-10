import { describe, expect, it } from 'vitest';

import { createPocStyleModeManager } from './styleModes';

describe('Gate C style mode manager', () => {
  it('reference-counts the selected document style mode and restores the host marker', () => {
    const root = {
      dataset: {} as Record<string, string | undefined>,
    };
    const manager = createPocStyleModeManager(root);

    const first = manager.acquire('minimum-scoped');
    const second = manager.acquire('minimum-scoped');
    expect(root.dataset.pocGrafanaStyleMode).toBe('minimum-scoped');
    expect(manager.inspect()).toEqual({ activeReferences: 2, mode: 'minimum-scoped' });

    first.release();
    expect(root.dataset.pocGrafanaStyleMode).toBe('minimum-scoped');
    second.release();
    expect(root.dataset.pocGrafanaStyleMode).toBeUndefined();
    expect(manager.inspect()).toEqual({ activeReferences: 0, mode: undefined });
  });

  it('rejects conflicting no-global/full-reference/minimum-scoped modes', () => {
    const root = { dataset: {} as Record<string, string | undefined> };
    const manager = createPocStyleModeManager(root);
    const minimum = manager.acquire('minimum-scoped');

    expect(() => manager.acquire('full-reference')).toThrow(/conflicting/i);
    expect(() => manager.acquire('none')).toThrow(/conflicting/i);
    minimum.release();
  });
});
