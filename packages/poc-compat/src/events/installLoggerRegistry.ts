const initializedRegistries = new WeakSet<() => void>();

/**
 * Initialize the published Runtime logger catalogue once per imported Runtime
 * identity. DataSourceWithBackend requests its datasource logger lazily when a
 * query runs; GrafanaApp normally performs this registration during startup.
 */
export function installPocLoggerRegistry(initializeLoggersRegistry: () => void): void {
  if (initializedRegistries.has(initializeLoggersRegistry)) return;
  initializeLoggersRegistry();
  initializedRegistries.add(initializeLoggersRegistry);
}
