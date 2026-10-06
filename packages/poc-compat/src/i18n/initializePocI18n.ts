import type { GrafanaCohort } from '../config/loadGrafanaCohort';

export interface PocI18nInstallation {
  readonly language: 'en-US';
  readonly namespace: 'grafana-scenes';
}

export async function initializePocI18n(
  cohort: GrafanaCohort,
  locale: 'en-US'
): Promise<PocI18nInstallation> {
  const result = await cohort.i18n.initPluginTranslations('grafana-scenes', [
    cohort.scenes.loadResources,
  ]);
  if (result.language !== locale) {
    throw new Error(`grafana-scenes resolved ${result.language}; Task 5 requires ${locale}.`);
  }
  return { language: locale, namespace: 'grafana-scenes' };
}
