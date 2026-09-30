# ADR-003: Prefer Grafana-native Rendering

- **Status:** Accepted
- **Date:** 2026-09-30

## Context

Reimplementing Grafana dashboard and panel behavior would create a large, fragile compatibility burden. Grafana provides frontend packages and abstractions that may supply data models, UI components, runtime services, schemas, or scene-based rendering. Their suitability for use outside the Grafana application shell has not yet been established for Grafana OSS 13.

## Decision

Prefer Grafana-maintained rendering packages and models when they can be used outside the Grafana shell with acceptable support status, bundle cost, lifecycle behavior, licensing, and compatibility. Place Grafana-specific integration behind an internal compatibility boundary.

This is a preference, not an assumption that every native package is externally consumable. Each dependency must be validated by research and the proof of concept before adoption.

## Consequences

- The SDK can preserve more Grafana behavior and reduce duplicated rendering logic where package reuse succeeds.
- Grafana package versions may strongly influence SDK compatibility and release cadence.
- Packages that assume Grafana globals, boot configuration, routing, or internal services may require adapters or may be unsuitable.
- The public SDK API should avoid exposing Grafana-internal types unless they are intentionally part of a supported contract.
- Unsupported features and plugins must be documented honestly.

## Alternatives considered

### Reimplement dashboards and panels

Rejected as the default because of scope, fidelity, maintenance, and compatibility costs. A small project-owned adapter or view is still acceptable where native reuse is not practical and the supported behavior is deliberately narrow.

### Import Grafana's complete frontend application

Rejected because the project must not run the Grafana web application shell or reproduce its navigation.
