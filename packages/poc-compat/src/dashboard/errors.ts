import { PocTransportError } from '../network/backendSrvAdapter';

export type PocDashboardErrorCode =
  | 'cancelled'
  | 'dashboard-api-version-unsupported'
  | 'dashboard-feature-unsupported'
  | 'dashboard-forbidden'
  | 'dashboard-identity-mismatch'
  | 'dashboard-not-found'
  | 'dashboard-response-malformed'
  | 'dashboard-unauthorized'
  | 'dashboard-uid-invalid'
  | 'dashboard-version-unsupported'
  | 'network';

export type PocDashboardStage = 'dashboard-v1' | 'discovery' | 'input';

export interface PocDashboardErrorDetails {
  readonly advertisedVersions?: readonly string[];
  readonly path?: string;
  readonly requestId?: string;
  readonly stage: PocDashboardStage;
  readonly status?: number;
  readonly storedVersion?: string;
}

export class PocDashboardError extends Error {
  readonly advertisedVersions?: readonly string[];
  readonly code: PocDashboardErrorCode;
  readonly path?: string;
  readonly requestId?: string;
  readonly stage: PocDashboardStage;
  readonly status?: number;
  readonly storedVersion?: string;

  constructor(code: PocDashboardErrorCode, message: string, details: PocDashboardErrorDetails) {
    super(message);
    this.name = 'PocDashboardError';
    this.code = code;
    this.stage = details.stage;
    if (details.advertisedVersions) this.advertisedVersions = [...details.advertisedVersions];
    if (details.path) this.path = details.path;
    if (details.requestId) this.requestId = details.requestId;
    if (details.status !== undefined) this.status = details.status;
    if (details.storedVersion) this.storedVersion = details.storedVersion;
  }
}

export function dashboardTransportError(error: unknown, stage: Exclude<PocDashboardStage, 'input'>): PocDashboardError {
  if (!(error instanceof PocTransportError)) {
    return new PocDashboardError('network', 'Dashboard request failed at the host network boundary.', { stage });
  }
  if (error.code === 'transport-cancelled') {
    return new PocDashboardError('cancelled', 'Dashboard request was cancelled.', {
      ...(error.requestId ? { requestId: error.requestId } : {}),
      stage,
    });
  }
  if (error.code === 'transport-malformed-response') {
    return new PocDashboardError('dashboard-response-malformed', 'Grafana returned malformed JSON.', {
      stage,
      ...(error.requestId ? { requestId: error.requestId } : {}),
      ...(error.status === undefined ? {} : { status: error.status }),
    });
  }
  if (error.code === 'transport-http') {
    if (error.status === 401) {
      return new PocDashboardError('dashboard-unauthorized', 'Grafana authentication is required.', {
        stage,
        ...(error.requestId ? { requestId: error.requestId } : {}),
        status: 401,
      });
    }
    if (error.status === 403) {
      return new PocDashboardError('dashboard-forbidden', 'Grafana denied access to the dashboard API.', {
        stage,
        ...(error.requestId ? { requestId: error.requestId } : {}),
        status: 403,
      });
    }
    if (error.status === 404) {
      if (stage === 'dashboard-v1') {
        return new PocDashboardError('dashboard-not-found', 'The requested Grafana dashboard does not exist.', {
          stage,
          ...(error.requestId ? { requestId: error.requestId } : {}),
          status: 404,
        });
      }
      return new PocDashboardError(
        'dashboard-api-version-unsupported',
        'Grafana does not expose the required dashboard API group.',
        {
          ...(error.requestId ? { requestId: error.requestId } : {}),
          stage,
          status: 404,
        }
      );
    }
    return new PocDashboardError('network', 'Grafana returned an unsuccessful HTTP response.', {
      stage,
      ...(error.requestId ? { requestId: error.requestId } : {}),
      ...(error.status === undefined ? {} : { status: error.status }),
    });
  }
  return new PocDashboardError('network', 'Dashboard request failed at the host network boundary.', {
    ...(error.requestId ? { requestId: error.requestId } : {}),
    stage,
  });
}

export function malformedDashboard(path: string, stage: Exclude<PocDashboardStage, 'input'>): PocDashboardError {
  return new PocDashboardError(
    'dashboard-response-malformed',
    `Grafana dashboard response is malformed at ${path}.`,
    { path, stage }
  );
}
