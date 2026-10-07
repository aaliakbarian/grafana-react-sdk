import type { ScopedVar, ScopedVars, TimeRange, TypedVariableModel } from '@grafana/data';
import type { TemplateSrv, VariableInterpolation } from '@grafana/runtime';

const variablePattern = /\$\{([A-Za-z_][\w]*)(?::([^}]+))?}|\[\[([A-Za-z_][\w]*)]]|\$([A-Za-z_][\w]*)/g;

export class PocTemplateVariableError extends Error {
  readonly code = 'template-variable-unsupported';

  constructor(message: string) {
    super(message);
    this.name = 'PocTemplateVariableError';
  }
}

function scalar(value: ScopedVar['value']): string {
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value ?? '');
}

export function createPocTemplateSrv(): TemplateSrv {
  let timeRange: TimeRange | undefined;
  const variables = [
    {
      current: { selected: true, text: 'phase0', value: 'phase0' },
      hide: 2,
      label: 'Environment',
      name: 'environment',
      query: 'phase0',
      skipUrlSync: true,
      type: 'constant',
    },
  ] as unknown as TypedVariableModel[];

  const resolve = (name: string, scopedVars?: ScopedVars): string => {
    const scoped = scopedVars?.[name];
    if (scoped) return scalar(scoped.value);
    if (name === 'environment') return 'phase0';
    if (name === '__from' && timeRange) return String(timeRange.from.valueOf());
    if (name === '__to' && timeRange) return String(timeRange.to.valueOf());
    if (name === '__interval') return scalar(scopedVars?.__interval?.value ?? '1s');
    if (name === '__interval_ms') return scalar(scopedVars?.__interval_ms?.value ?? 1_000);
    throw new PocTemplateVariableError(`Unknown variable ${name} is outside the controlled POC.`);
  };

  return {
    containsTemplate(target?: string) {
      if (!target) return false;
      variablePattern.lastIndex = 0;
      return variablePattern.test(target);
    },
    getVariables() {
      return variables;
    },
    replace(target = '', scopedVars, format, interpolations) {
      if (format !== undefined && format !== 'raw') {
        throw new PocTemplateVariableError('Only raw template formatting is supported by the controlled POC.');
      }
      variablePattern.lastIndex = 0;
      return target.replace(variablePattern, (match, braced, inlineFormat, legacy, simple) => {
        const name = String(braced ?? legacy ?? simple);
        if (inlineFormat !== undefined && inlineFormat !== 'raw') {
          throw new PocTemplateVariableError(
            `Template format ${String(inlineFormat)} is outside the controlled POC.`
          );
        }
        const value = resolve(name, scopedVars);
        interpolations?.push({
          found: true,
          match,
          value,
          variableName: name,
          ...(inlineFormat === undefined ? {} : { format: String(inlineFormat) }),
        } satisfies VariableInterpolation);
        return value;
      });
    },
    updateTimeRange(next) {
      timeRange = next;
    },
  };
}

export interface TemplateRuntimeBoundary {
  getTemplateSrv(): TemplateSrv;
  setTemplateSrv(service: TemplateSrv): void;
}

export function installPocTemplateSrv(
  runtime: TemplateRuntimeBoundary,
  templateSrv = createPocTemplateSrv()
): TemplateSrv {
  runtime.setTemplateSrv(templateSrv);
  if (runtime.getTemplateSrv() !== templateSrv) {
    throw new Error('Grafana Runtime did not retain the constrained TemplateSrv identity.');
  }
  return templateSrv;
}
