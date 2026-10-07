import { describe, expect, it, vi } from 'vitest';

import { installPocLoggerRegistry } from './installLoggerRegistry';

describe('POC logger registry installation', () => {
  it('initializes each process-wide Grafana logger registry identity once', () => {
    const first = vi.fn();
    const second = vi.fn();

    installPocLoggerRegistry(first);
    installPocLoggerRegistry(first);
    installPocLoggerRegistry(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
