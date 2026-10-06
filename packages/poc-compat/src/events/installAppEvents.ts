import type { GrafanaCohort } from '../config/loadGrafanaCohort';
import { sanitizeEvidenceText } from '../instrumentation/networkRecorder';
import type { PocRuntimeInstrumentationSink } from '../runtime/runtimeIdentity';

export type PocAppEventBus = InstanceType<GrafanaCohort['data']['EventBusSrv']>;

export interface PocAppEventsInstallation {
  readonly bus: PocAppEventBus;
  snapshotObservedTypes(): readonly string[];
}

export function installAppEvents(
  cohort: GrafanaCohort,
  instrumentation?: PocRuntimeInstrumentationSink
): PocAppEventsInstallation {
  const bus = new cohort.data.EventBusSrv();
  const observedTypes: string[] = [];
  const originalPublish = bus.publish.bind(bus);
  bus.publish = (event) => {
    const eventType = typeof event.type === 'string' ? event.type : '<untyped-event>';
    observedTypes.push(eventType);
    instrumentation?.record({
      detail: sanitizeEvidenceText(eventType),
      step: 'app-event-published',
      type: 'lifecycle',
    });
    originalPublish(event);
  };

  cohort.runtime.setAppEvents(bus);
  if (cohort.runtime.getAppEvents() !== bus) {
    throw new Error('Grafana Runtime did not retain the POC application event bus.');
  }
  instrumentation?.record({ step: 'app-events', type: 'registration' });
  return {
    bus,
    snapshotObservedTypes: () => [...observedTypes],
  };
}
