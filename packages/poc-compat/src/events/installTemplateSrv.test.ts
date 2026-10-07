import type { TimeRange } from '@grafana/data';
import { describe, expect, it } from 'vitest';

import { createPocTemplateSrv } from './installTemplateSrv';

describe('Task 10 constrained TemplateSrv', () => {
  it('replaces the fixture variable, scoped values, and time built-ins', () => {
    const service = createPocTemplateSrv();
    service.updateTimeRange({
      from: { valueOf: () => 1_000 },
      raw: { from: 'now-1h', to: 'now' },
      to: { valueOf: () => 4_000 },
    } as TimeRange);

    expect(service.replace('$environment/${environment:raw}/[[environment]]')).toBe(
      'phase0/phase0/phase0'
    );
    expect(service.replace('$scoped', { scoped: { text: 'Scoped', value: 'value' } })).toBe('value');
    expect(service.replace('${__from}/${__to}')).toBe('1000/4000');
    expect(service.containsTemplate('prefix-$environment')).toBe(true);
    expect(service.getVariables()).toHaveLength(1);
  });

  it('rejects unknown variables and formats instead of silently preserving them', () => {
    const service = createPocTemplateSrv();

    expect(() => service.replace('$unknown')).toThrow(/unknown variable/i);
    expect(() => service.replace('${environment:regex}')).toThrow(/format/i);
  });
});
