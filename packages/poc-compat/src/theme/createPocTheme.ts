import type { GrafanaCohort } from '../config/loadGrafanaCohort';

export type PocGrafanaTheme = GrafanaCohort['runtime']['config']['theme2'];

export function createPocTheme(cohort: GrafanaCohort): PocGrafanaTheme {
  const theme = cohort.runtime.config.theme2;
  if (!theme || theme.isLight !== true) {
    throw new Error('The Task 5 runtime requires Grafana Runtime to create the light theme.');
  }
  return theme;
}
