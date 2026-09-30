# ADR-002: Frontend-only SDK

- **Status:** Accepted
- **Date:** 2026-09-30

## Context

A companion backend could proxy Grafana APIs, hold credentials, normalize responses, or hide browser connectivity constraints. It would also add deployment, security, scaling, and operational responsibilities outside a React SDK's intended boundary.

## Decision

The project will ship a frontend-only SDK and no required backend service. The host application must provide a browser-usable path to its Grafana instance and an authorization-aware request mechanism or configuration.

## Consequences

- The SDK remains deployable as part of a normal React application bundle.
- The SDK will not store secrets or mint credentials.
- CORS, cookie policy, token exposure, network topology, and Grafana access rules must be solved by the adopting environment.
- Existing host-owned gateways may be used, but none will be implemented or required as a product of this repository.
- Some organizations may need infrastructure changes before they can adopt the SDK safely.

## Alternatives considered

### Ship an SDK-specific proxy

Rejected because it would turn the project into a frontend-and-service platform and expand its security and operational scope.

### Require direct anonymous Grafana access

Rejected because it would be too restrictive and could encourage insecure deployments.
