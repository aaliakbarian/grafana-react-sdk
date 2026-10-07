import type {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  PanelData,
  TimeRange,
} from '@grafana/data';
import { Observable, lastValueFrom, of, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createPocRunRequest } from './runRequest';

function request(): DataQueryRequest {
  return {
    app: 'scenes',
    dashboardUID: 'grsdk-phase0-poc',
    interval: '1s',
    intervalMs: 1_000,
    maxDataPoints: 500,
    panelId: 2,
    panelPluginId: 'stat',
    range: {
      from: { valueOf: () => 1_000 } as TimeRange['from'],
      raw: { from: 'now-1h', to: 'now' },
      to: { valueOf: () => 4_000 } as TimeRange['to'],
    },
    rangeRaw: { from: 'now-1h', to: 'now' },
    requestId: 'poc-panel-2-1',
    scopedVars: {},
    startTime: 1,
    targets: [{ refId: 'A', scenarioId: 'predictable_pulse' } as never],
    timezone: 'browser',
  };
}

function dataResponse(): DataQueryResponse {
  return {
    data: [
      {
        fields: [
          { config: {}, name: 'Time', type: 'time', values: [1_000] },
          { config: {}, name: 'Value', type: 'number', values: [90] },
        ],
        length: 1,
        refId: 'A',
      } as DataFrame,
    ],
  };
}

describe('Task 10 runRequest adapter', () => {
  it('emits Loading then Done and preserves the scene request context', async () => {
    const query = vi.fn(() => of(dataResponse()));
    const datasource = { query } as unknown as DataSourceApi;
    const events: unknown[] = [];
    const runRequest = createPocRunRequest({
      evidence: {
        record(event) {
          events.push(event);
        },
        snapshot: () => structuredClone(events) as never,
      },
    });

    const values = await lastValueFrom(runRequest(datasource, request()).pipe(toArray()));

    expect(values.map(({ state }) => state)).toEqual(['Loading', 'Done']);
    expect(values.at(-1)).toMatchObject({
      request: {
        dashboardUID: 'grsdk-phase0-poc',
        maxDataPoints: 500,
        panelId: 2,
        requestId: 'poc-panel-2-1',
      },
      series: [{ refId: 'A' }],
    });
    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      dashboardUID: 'grsdk-phase0-poc',
      panelId: 2,
      requestId: 'poc-panel-2-1',
    }));
    expect(JSON.stringify(events)).not.toMatch(/predictable_pulse|cookie|authorization/i);
  });

  it('maps thrown query failures to PanelData Error without throwing the stream', async () => {
    const datasource = {
      query: () => new Observable<DataQueryResponse>((subscriber) => subscriber.error(new Error('server failed'))),
    } as unknown as DataSourceApi;
    const values = await lastValueFrom(createPocRunRequest()(datasource, request()).pipe(toArray()));

    expect(values.map(({ state }) => state)).toEqual(['Loading', 'Error']);
    expect(values.at(-1)?.error?.message).toContain('server failed');
  });

  it('cancels the datasource subscription and suppresses late publication', () => {
    let subscriber: { next(value: DataQueryResponse): void } | undefined;
    const teardown = vi.fn();
    const datasource = {
      query: () =>
        new Observable<DataQueryResponse>((current) => {
          subscriber = current;
          return teardown;
        }),
    } as unknown as DataSourceApi;
    const values: PanelData[] = [];
    const subscription = createPocRunRequest()(datasource, request()).subscribe((value) => values.push(value));

    expect(values.map(({ state }) => state)).toEqual(['Loading']);
    subscription.unsubscribe();
    subscriber?.next(dataResponse());

    expect(teardown).toHaveBeenCalledOnce();
    expect(values.map(({ state }) => state)).toEqual(['Loading']);
  });

  it('rejects malformed datasource packets as a classified Error state', async () => {
    const datasource = { query: () => of({ data: 'not-an-array' }) } as unknown as DataSourceApi;
    const values = await lastValueFrom(createPocRunRequest()(datasource, request()).pipe(toArray()));

    expect(values.at(-1)).toMatchObject({ state: 'Error' });
  });
});
