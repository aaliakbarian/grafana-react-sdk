# Project Context

## Problem

Teams often want an existing Grafana dashboard inside a React product without presenting a second application's frame, navigation, or user experience. An iframe keeps Grafana isolated but limits integration with the host application's layout, styling, lifecycle, and interaction model. Running the Grafana web application shell carries substantially more behavior than an embedded dashboard needs.

## Objective

Create a React and TypeScript SDK that renders an existing Grafana OSS 13 dashboard natively in a React application. The host selects the dashboard by UID and remains responsible for its own application shell.

## Intended users

- React application teams that already operate Grafana OSS 13.
- Platform teams that want a reusable embedding boundary across products.
- Maintainers evaluating whether Grafana's frontend packages can support a smaller, application-neutral runtime.

## Fixed constraints

- No iframe rendering.
- No Grafana web application shell.
- No reproduction of Grafana navigation.
- A frontend-only SDK; the project will not ship a backend.
- Dashboard selection by UID.
- Prefer Grafana's native rendering packages where technically possible.

## Proven Phase 0 evidence

Within the controlled Grafana OSS 13.2.3 POC boundary, Phase 0 proved that:

- Native Grafana panel rendering without an iframe or Grafana application shell
  is feasible.
- Dashboard retrieval by user-facing Grafana UID works through the browser
  transport boundary.
- Constrained current-schema V1/schema-42 dashboard-to-Scenes conversion works.
- Real Grafana Text, Stat, and Time series panels render natively.
- Real TestData datasource query execution reaches Grafana and produces
  `PanelData` through `SceneQueryRunner`.
- React and ReactDOM 19.2.8 work in the tested combination with
  `@grafana/scenes@8.13.5`.
- Multiple compatible dashboards can share one process-wide compatibility
  runtime while retaining independent scene and query lifecycles.

These results prove the core architectural hypothesis only within the
controlled POC. They do not imply general compatibility with arbitrary Grafana
versions, dashboards, panels, plugins, datasources, transformations, or V2
dashboard schemas.

## Current production assumptions requiring Phase 1 decisions

Phase 1 must test and turn these assumptions into explicit production
decisions:

- Grafana application source and assets can be used through a legally and
  operationally acceptable distribution model.
- The bounded POC bridge can be replaced or productized without importing an
  uncontrolled portion of the Grafana application.
- Exact-version coupling can become a documented and testable Grafana support
  policy.
- Grafana Runtime singletons can be owned and isolated predictably within a
  host page.
- The React and Scenes version relationship can be supported rather than only
  observed in one POC combination.
- Bundle size, styles, global state, and transformations can be bounded without
  losing the required Grafana behavior.

## Open questions

- What licensing and distribution model is acceptable for required Grafana
  application source and assets?
- What is the production bridge boundary, and how will its exact source closure
  be built, audited, and upgraded?
- Which Grafana versions will be supported, and how will compatibility be
  tested and communicated?
- What page-level ownership and isolation policy is required for Runtime
  singletons and multiple SDK consumers?
- Which React and Scenes versions form a supported combination?
- What bundle-size budget and reduction strategy are viable?
- How will Grafana styling and global resets be contained within host
  applications?
- Which transformations will be supported, and how will their registry and
  compatibility be maintained?
- Which additional panels, datasources, dashboard features, and V2 schemas
  belong in the supported compatibility contract?

## Definition of success

The project succeeds when a React application can render a supported existing
dashboard by UID, with documented compatibility and predictable lifecycle
behavior, while the host retains control of navigation and product chrome.
Phase 0 established technical feasibility for the controlled POC. Production
success now requires Phase 1 architecture and distribution approval followed
by an SDK whose published compatibility claims are backed by tests.
