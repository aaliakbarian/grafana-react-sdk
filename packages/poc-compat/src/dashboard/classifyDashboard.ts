import { malformedDashboard, PocDashboardError } from './errors';
import {
  POC_DASHBOARD_API_GROUP,
  POC_DASHBOARD_SCHEMA_VERSION,
  type PocDashboardV1Dto,
} from './types';

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw malformedDashboard(path, 'dashboard-v1');
  }
  return value as Record<string, unknown>;
}

export function classifyDashboardV1Dto(
  value: unknown,
  requestedUid: string,
  namespace: string
): PocDashboardV1Dto {
  const dto = record(value, '$');
  const status = record(dto.status, 'status');
  const conversion = record(status.conversion, 'status.conversion');
  if (typeof conversion.failed !== 'boolean' || typeof conversion.storedVersion !== 'string') {
    throw malformedDashboard('status.conversion', 'dashboard-v1');
  }
  if (conversion.failed) {
    throw new PocDashboardError(
      'dashboard-version-unsupported',
      'Grafana could not convert the stored dashboard to stable V1.',
      { stage: 'dashboard-v1', storedVersion: conversion.storedVersion }
    );
  }
  if (dto.apiVersion !== `${POC_DASHBOARD_API_GROUP}/v1`) {
    throw new PocDashboardError(
      'dashboard-version-unsupported',
      'Grafana returned a dashboard outside the stable V1 boundary.',
      { path: 'apiVersion', stage: 'dashboard-v1' }
    );
  }
  if (dto.kind !== 'DashboardWithAccessInfo') throw malformedDashboard('kind', 'dashboard-v1');

  const metadata = record(dto.metadata, 'metadata');
  if (metadata.name !== requestedUid) {
    throw new PocDashboardError(
      'dashboard-identity-mismatch',
      'Dashboard metadata.name does not match the requested Grafana UID.',
      { path: 'metadata.name', stage: 'dashboard-v1' }
    );
  }
  if (metadata.namespace !== namespace) throw malformedDashboard('metadata.namespace', 'dashboard-v1');
  if (typeof metadata.generation !== 'number') throw malformedDashboard('metadata.generation', 'dashboard-v1');
  if (typeof metadata.resourceVersion !== 'string') {
    throw malformedDashboard('metadata.resourceVersion', 'dashboard-v1');
  }
  if (metadata.uid !== undefined && typeof metadata.uid !== 'string') {
    throw malformedDashboard('metadata.uid', 'dashboard-v1');
  }

  const access = record(dto.access, 'access');
  record(access.annotationsPermissions, 'access.annotationsPermissions');
  for (const field of ['canAdmin', 'canDelete', 'canEdit', 'canSave', 'canStar', 'isPublic']) {
    if (typeof access[field] !== 'boolean') throw malformedDashboard(`access.${field}`, 'dashboard-v1');
  }
  for (const field of ['slug', 'url']) {
    if (typeof access[field] !== 'string') throw malformedDashboard(`access.${field}`, 'dashboard-v1');
  }
  const spec = record(dto.spec, 'spec');
  if (!Array.isArray(spec.panels)) throw malformedDashboard('spec.panels', 'dashboard-v1');
  if (typeof spec.schemaVersion !== 'number') throw malformedDashboard('spec.schemaVersion', 'dashboard-v1');
  if (spec.uid !== undefined && spec.uid !== requestedUid) {
    throw new PocDashboardError(
      'dashboard-identity-mismatch',
      'Dashboard spec.uid does not match the requested Grafana UID.',
      { path: 'spec.uid', stage: 'dashboard-v1' }
    );
  }
  if (spec.schemaVersion !== POC_DASHBOARD_SCHEMA_VERSION) {
    throw new PocDashboardError(
      'dashboard-feature-unsupported',
      `Task 6 supports only fixture schemaVersion ${POC_DASHBOARD_SCHEMA_VERSION}.`,
      { path: 'spec.schemaVersion', stage: 'dashboard-v1' }
    );
  }

  return dto as unknown as PocDashboardV1Dto;
}
