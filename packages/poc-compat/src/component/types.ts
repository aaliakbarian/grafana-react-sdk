import type { ReactElement } from 'react';

import type {
  PocPanelCatalog,
  PocSceneConversionError,
} from '../dashboard/preflightFixture';
import type { PocSceneConversionEvidenceRecorder } from '../scenes/convertFixtureV1';
import type { PocDashboardSceneRoot } from '../scenes/PocDashboardSceneRoot';
import type { PocRuntimeLease } from '../runtime/acquirePocRuntime';

export interface ExperimentalGrafanaDashboardProps {
  readonly catalog: PocPanelCatalog;
  readonly conversionEvidence?: PocSceneConversionEvidenceRecorder;
  readonly instanceId?: string;
  readonly onError?: (error: Error | PocSceneConversionError) => void;
  readonly onSceneReady?: (scene: PocDashboardSceneRoot) => void;
  readonly runtime: PocRuntimeLease;
  readonly uid: string;
}

export type ExperimentalGrafanaDashboardComponent = (
  props: ExperimentalGrafanaDashboardProps
) => ReactElement;
