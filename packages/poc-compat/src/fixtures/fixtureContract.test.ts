import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validatePocFixtures } from './fixtureContract';

const primaryFixturePath = fileURLToPath(
  new URL('../../../../dev/grafana/provisioning/dashboards/grsdk-phase0-poc.json', import.meta.url)
);
const alternateFixturePath = fileURLToPath(
  new URL('../../../../dev/grafana/provisioning/dashboards/grsdk-phase0-poc-alt.json', import.meta.url)
);

function readFixture(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

describe('Grafana POC fixture contract', () => {
  it('accepts the committed deterministic schema-42 fixture pair', () => {
    const summary = validatePocFixtures(readFixture(primaryFixturePath), readFixture(alternateFixturePath));

    expect(summary).toEqual({
      alternateDashboardUid: 'grsdk-phase0-poc-alt',
      dashboardUid: 'grsdk-phase0-poc',
      datasourceUid: 'grsdk-testdata',
      panelTypes: ['text', 'stat', 'timeseries', 'table'],
      schemaVersion: 42,
    });
  });

  it('rejects a query that does not explicitly name the provisioned datasource', () => {
    const primary = structuredClone(readFixture(primaryFixturePath)) as {
      panels: Array<{ id: number; targets?: Array<{ datasource?: unknown }> }>;
    };
    const stat = primary.panels.find((panel) => panel.id === 2);

    expect(stat?.targets?.[0]).toBeDefined();
    delete stat?.targets?.[0]?.datasource;

    expect(() => validatePocFixtures(primary, readFixture(alternateFixturePath))).toThrow(
      'panels[1].targets[0].datasource'
    );
  });

  it('rejects features deliberately excluded from the controlled fixture', () => {
    const primary = structuredClone(readFixture(primaryFixturePath)) as { annotations?: unknown };
    primary.annotations = { list: [{ name: 'unexpected annotation' }] };

    expect(() => validatePocFixtures(primary, readFixture(alternateFixturePath))).toThrow('annotations');
  });

  it('rejects additional query targets and transformations outside the Time series fixture', () => {
    const primaryWithExtraTarget = structuredClone(readFixture(primaryFixturePath)) as {
      panels: Array<{ id: number; targets?: unknown[] }>;
    };
    const statWithExtraTarget = primaryWithExtraTarget.panels.find((panel) => panel.id === 2);
    statWithExtraTarget?.targets?.push(structuredClone(statWithExtraTarget.targets[0]));

    expect(() => validatePocFixtures(primaryWithExtraTarget, readFixture(alternateFixturePath))).toThrow(
      'panels[1].targets.length'
    );

    const primaryWithUnexpectedTransform = structuredClone(readFixture(primaryFixturePath)) as {
      panels: Array<{ id: number; transformations?: unknown[] }>;
    };
    const statWithUnexpectedTransform = primaryWithUnexpectedTransform.panels.find((panel) => panel.id === 2);
    if (statWithUnexpectedTransform) {
      statWithUnexpectedTransform.transformations = [{ id: 'unexpected', options: {} }];
    }

    expect(() => validatePocFixtures(primaryWithUnexpectedTransform, readFixture(alternateFixturePath))).toThrow(
      'panels[1].transformations'
    );
  });

  it('applies excluded-feature and variable checks to the alternate dashboard', () => {
    const alternateWithAnnotation = structuredClone(readFixture(alternateFixturePath)) as { annotations?: unknown };
    alternateWithAnnotation.annotations = { list: [{ name: 'unexpected annotation' }] };

    expect(() => validatePocFixtures(readFixture(primaryFixturePath), alternateWithAnnotation)).toThrow(
      'alternate.annotations'
    );

    const alternateWithQueryVariable = structuredClone(readFixture(alternateFixturePath)) as {
      templating: { list: Array<{ type: string }> };
    };
    const alternateVariable = alternateWithQueryVariable.templating.list[0];
    if (!alternateVariable) {
      throw new Error('alternate fixture must contain the environment variable');
    }
    alternateVariable.type = 'query';

    expect(() => validatePocFixtures(readFixture(primaryFixturePath), alternateWithQueryVariable)).toThrow(
      'alternate.templating.list[0].type'
    );
  });
});
