# Roadmap

This roadmap is ordered by evidence and capability, not by calendar date. Scope and sequencing may change as research resolves technical risks.

## Phase 0: Repository foundation

- Establish project objective, constraints, contribution guidance, and conduct policy.
- Record initial architecture decisions.
- Define research questions and the rendering proof of concept.
- Select an open-source license before accepting implementation contributions.

## Phase 1: Grafana integration research

- Evaluate Grafana Scenes for external dashboard rendering.
- Inventory relevant Grafana OSS 13 frontend packages and their support status.
- Identify assumptions about the Grafana shell, global services, CSS, themes, and bundling.
- Document authentication, CORS, API, plugin, and data-source request constraints.
- Record reproducible findings and update architecture decisions where needed.

## Phase 2: Rendering proof of concept

- Load one existing dashboard by UID.
- Render a deliberately small matrix of representative built-in panels.
- Exercise time range, template variables, refresh, resize, and cleanup.
- Demonstrate operation without an iframe, Grafana shell, or SDK backend.
- Measure bundle impact and record unsupported behavior.
- Make a proceed, revise, or stop decision based on explicit exit criteria.

## Phase 3: SDK foundation

- Select package tooling and create the TypeScript/React package structure.
- Define the smallest public API supported by POC evidence.
- Introduce compatibility adapters, test fixtures, and automated checks.
- Establish error, loading, cancellation, and lifecycle contracts.
- Publish an experimental release for controlled evaluation.

## Phase 4: Alpha and compatibility expansion

- Expand the supported dashboard and panel matrix.
- Add theming and host-integration guidance.
- Test representative Grafana deployment and authentication patterns.
- Add examples, diagnostics, migration notes, and semantic versioning policy.

## Phase 5: Stable release

- Publish a supported compatibility matrix and maintenance policy.
- Complete API, security, accessibility, and operational reviews.
- Document upgrade paths and known limitations.
- Release a stable package only when compatibility claims are backed by automated and manual validation.

## Out of scope until separately approved

- Dashboard editing or persistence.
- Grafana navigation or application-shell features.
- An SDK-operated proxy or backend.
- Server-side rendering.
- Unqualified compatibility with arbitrary panel plugins.
