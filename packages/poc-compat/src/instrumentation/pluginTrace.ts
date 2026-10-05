import { sanitizeEvidenceText } from './networkRecorder';

export interface PluginTraceIdentity {
  cacheKey: string;
  pluginId: string;
  sourceCommit: string;
  sourceEntrypoint: string;
}

export type PluginTraceEvent =
  | (PluginTraceIdentity & { sequence: number; type: 'start' })
  | { pluginId: string; sequence: number; type: 'cache-hit' }
  | {
      metadata: { id: string; version?: string };
      pluginId: string;
      sequence: number;
      type: 'success';
    }
  | { error: string; pluginId: string; sequence: number; type: 'failure' };

export interface PluginTrace {
  cacheHit(pluginId: string): void;
  failed(pluginId: string, error: unknown): void;
  snapshot(): readonly PluginTraceEvent[];
  started(identity: PluginTraceIdentity): void;
  succeeded(pluginId: string, metadata: { id: string; version?: string }): void;
}

export function createPluginTrace(): PluginTrace {
  const events: PluginTraceEvent[] = [];
  let sequence = 0;

  return {
    started(identity) {
      events.push({ ...identity, sequence: ++sequence, type: 'start' });
    },
    cacheHit(pluginId) {
      events.push({ pluginId, sequence: ++sequence, type: 'cache-hit' });
    },
    succeeded(pluginId, metadata) {
      events.push({ metadata: { ...metadata }, pluginId, sequence: ++sequence, type: 'success' });
    },
    failed(pluginId, error) {
      events.push({
        error: sanitizeEvidenceText(error),
        pluginId,
        sequence: ++sequence,
        type: 'failure',
      });
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}
