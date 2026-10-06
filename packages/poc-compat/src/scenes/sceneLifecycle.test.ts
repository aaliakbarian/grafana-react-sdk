import { describe, expect, it, vi } from 'vitest';

import { createSceneGenerationController } from './sceneLifecycle';

describe('Task 7 scene generation lifecycle', () => {
  it('aborts the previous generation and refuses stale publication after a UID change', () => {
    const lifecycle = createSceneGenerationController();
    const publish = vi.fn();
    const first = lifecycle.begin('grsdk-phase0-poc');
    const second = lifecycle.begin('grsdk-phase0-poc-alt');

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(first.publish('stale', publish)).toBe(false);
    expect(second.publish('current', publish)).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith('current');
    expect(lifecycle.inspect()).toEqual({
      activeGeneration: 2,
      activeUid: 'grsdk-phase0-poc-alt',
      cancelled: false,
    });
  });

  it('aborts current work on cleanup and remains idempotent', () => {
    const lifecycle = createSceneGenerationController();
    const current = lifecycle.begin('grsdk-phase0-poc');

    lifecycle.cancel();
    lifecycle.cancel();

    expect(current.signal.aborted).toBe(true);
    expect(current.publish('late', vi.fn())).toBe(false);
    expect(lifecycle.inspect()).toEqual({
      activeGeneration: 1,
      activeUid: 'grsdk-phase0-poc',
      cancelled: true,
    });
  });
});

