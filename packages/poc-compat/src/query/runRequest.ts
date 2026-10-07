import type {
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { Observable, from } from 'rxjs';

import type { PocQueryEvidenceRecorder } from '../instrumentation/queryTrace';
import { POC_TESTDATA_UID } from '../datasource/loadFrontendSettings';

export type PocRunRequest = (
  datasource: DataSourceApi,
  request: DataQueryRequest,
  queryFunction?: typeof datasource.query
) => Observable<PanelData>;

export interface CreatePocRunRequestOptions {
  readonly evidence?: PocQueryEvidenceRecorder;
}

const LOADING = 'Loading' as LoadingState;
const DONE = 'Done' as LoadingState;
const ERROR = 'Error' as LoadingState;

function queryError(error: unknown): DataQueryError {
  const message = error instanceof Error ? error.message : 'Datasource query failed.';
  return { message };
}

function requestEvidence(
  request: DataQueryRequest,
  outcome: 'cancelled' | 'failure' | 'start' | 'success',
  state?: 'Done' | 'Error' | 'Loading'
) {
  return {
    ...(typeof request.dashboardUID === 'string' ? { dashboardUid: request.dashboardUID } : {}),
    datasourceUid: POC_TESTDATA_UID,
    outcome,
    ...(typeof request.panelId === 'number' ? { panelId: request.panelId } : {}),
    requestId: request.requestId,
    ...(state ? { state } : {}),
    type: 'query' as const,
  };
}

function loadingPanelData(request: DataQueryRequest): PanelData {
  return {
    annotations: [],
    request,
    series: [],
    state: LOADING,
    timeRange: request.range,
  };
}

export function createPocRunRequest(options: CreatePocRunRequestOptions = {}): PocRunRequest {
  return (datasource, request, queryFunction) =>
    new Observable<PanelData>((subscriber) => {
      const packets = new Map<string, DataQueryResponse>();
      let terminal = false;
      const initial = loadingPanelData(request);
      options.evidence?.record(requestEvidence(request, 'start', 'Loading'));
      subscriber.next(initial);

      if (request.targets.length === 0) {
        terminal = true;
        const done = { ...initial, state: DONE };
        options.evidence?.record(requestEvidence(request, 'success', 'Done'));
        subscriber.next(done);
        subscriber.complete();
        return;
      }

      let result: ReturnType<DataSourceApi['query']>;
      try {
        result = queryFunction ? queryFunction(request) : datasource.query(request);
      } catch (error: unknown) {
        terminal = true;
        options.evidence?.record(requestEvidence(request, 'failure', 'Error'));
        subscriber.next({ ...initial, error: queryError(error), state: ERROR });
        subscriber.complete();
        return;
      }

      const querySubscription = from(result).subscribe({
        complete() {
          if (!terminal && packets.size === 0 && !subscriber.closed) {
            terminal = true;
            options.evidence?.record(requestEvidence(request, 'success', 'Done'));
            subscriber.next({ ...initial, state: DONE });
          }
          subscriber.complete();
        },
        error(error: unknown) {
          if (subscriber.closed) return;
          terminal = true;
          options.evidence?.record(requestEvidence(request, 'failure', 'Error'));
          subscriber.next({ ...initial, error: queryError(error), state: ERROR });
          subscriber.complete();
        },
        next(packet) {
          if (subscriber.closed) return;
          if (!Array.isArray(packet.data)) {
            terminal = true;
            options.evidence?.record(requestEvidence(request, 'failure', 'Error'));
            subscriber.next({
              ...initial,
              error: queryError(new Error('Datasource response data must be an array.')),
              state: ERROR,
            });
            subscriber.complete();
            return;
          }

          const key = packet.key ?? packet.data[0]?.refId ?? 'A';
          packets.set(key, packet);
          const hidden = new Set(request.targets.filter((target) => target.hide).map(({ refId }) => refId));
          const series: DataFrame[] = [];
          const annotations: DataFrame[] = [];
          const errors: DataQueryError[] = [];
          for (const response of packets.values()) {
            if (response.error) errors.push(response.error);
            if (response.errors) errors.push(...response.errors);
            for (const frame of response.data as DataFrame[]) {
              if (frame.refId && hidden.has(frame.refId)) continue;
              if (frame.meta?.dataTopic === 'annotations') annotations.push(frame);
              else series.push(frame);
            }
          }
          request.endTime = Date.now();
          const state = errors.length > 0 ? ERROR : (packet.state ?? DONE);
          terminal = state === DONE || state === ERROR;
          const panelData: PanelData = {
            annotations,
            ...(errors.length > 0 ? { error: errors[0], errors } : {}),
            request,
            series,
            state,
            timeRange: request.range,
          };
          options.evidence?.record(
            requestEvidence(request, state === ERROR ? 'failure' : 'success', state === ERROR ? 'Error' : 'Done')
          );
          subscriber.next(panelData);
        },
      });

      return () => {
        querySubscription.unsubscribe();
        if (!terminal) options.evidence?.record(requestEvidence(request, 'cancelled'));
      };
    });
}
