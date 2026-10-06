import { createElement, type Context, type ReactElement, type ReactNode } from 'react';

import type { PocGrafanaTheme } from './createPocTheme';

export interface PocGrafanaProviderValues {
  readonly ThemeContext: Context<PocGrafanaTheme>;
  readonly theme: PocGrafanaTheme;
}

export interface PocGrafanaProvidersProps {
  readonly children?: ReactNode;
  readonly values: PocGrafanaProviderValues;
}

export function PocGrafanaProviders({ children, values }: PocGrafanaProvidersProps): ReactElement {
  return createElement(values.ThemeContext.Provider, { value: values.theme }, children);
}
