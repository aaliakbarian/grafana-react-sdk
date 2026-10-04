import { describe, expect, it } from 'vitest';

describe('disposable POC toolchain', () => {
  it('runs with the pinned Node.js version', () => {
    expect(process.versions.node).toBe('22.23.3');
  });

  it('uses the Node test environment for toolchain tests', () => {
    expect(globalThis).not.toHaveProperty('document');
    expect(globalThis).not.toHaveProperty('window');
  });
});
