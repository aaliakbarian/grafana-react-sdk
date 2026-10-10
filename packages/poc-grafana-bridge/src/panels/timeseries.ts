/// <reference path="../grafana-source-modules.d.ts" />

import { PanelPlugin } from '@grafana/data';
import type { ComponentType } from 'react';

import { configurePocTimeSeriesPlugin } from './timeseriesConfig';

interface GrafanaTimeSeriesPanelModule {
  readonly TimeSeriesPanel: ComponentType<any>;
}

/** POC-only exact import of Grafana OSS 13.2.3's application-owned Time series entrypoint. */
export async function loadExactTimeSeriesPanelPlugin(): Promise<PanelPlugin> {
  const module = (await import('grafana-poc-timeseries-panel')) as GrafanaTimeSeriesPanelModule;
  if (typeof module.TimeSeriesPanel !== 'function') {
    throw new Error('The pinned Time series source artifact did not export the exact panel component.');
  }
  return configurePocTimeSeriesPlugin(new PanelPlugin(module.TimeSeriesPanel));
}
