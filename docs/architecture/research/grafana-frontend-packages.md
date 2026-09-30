# Grafana Frontend Packages

## Status

Initial inventory only. No package listed here has been approved as a dependency, and this repository intentionally has no package manifest yet.

## Research objective

Identify the smallest set of Grafana OSS 13 frontend packages that could render existing dashboards outside the Grafana web application shell. Verify public support, runtime assumptions, licensing, and version compatibility before adoption.

## Candidate inventory

Package names below are starting points to verify against the exact Grafana OSS 13 release; they are not dependency selections.

| Candidate | Potential role | Questions to resolve |
| --- | --- | --- |
| `@grafana/scenes` | Dashboard/scene state and rendering | Can saved dashboards be loaded externally, and which services are assumed? |
| `@grafana/data` | Shared data types and utilities | Which APIs are public and stable for external consumers? |
| `@grafana/ui` | Grafana UI and visualization building blocks | Which providers, styles, assets, and globals are required? |
| `@grafana/runtime` | Runtime services and data-source access | Can required services be configured without the Grafana shell? |
| `@grafana/schema` | Dashboard schema types or generated models | Does its version align with stored dashboard payloads and migrations? |

Additional packages discovered during dependency tracing should be added only with a defined role.

## Evaluation checklist

For each candidate, record:

- exact package and Grafana versions;
- official publication and external-consumption status;
- license and redistribution implications;
- exported APIs used, including any internal imports;
- peer and transitive dependencies;
- React and styling assumptions;
- required Grafana globals, configuration, or services;
- browser and bundler compatibility;
- tree-shaking and measured bundle impact;
- behavior when multiple SDK instances mount; and
- upgrade risk across Grafana patch and minor versions.

## Dependency policy hypothesis

- Depend on the minimum package surface proven by the POC.
- Keep exact Grafana integration inside a compatibility layer.
- Avoid deep or undocumented imports in releasable code.
- Do not bundle a second React runtime.
- Align related Grafana package versions unless evidence supports another strategy.
- Treat package availability as insufficient evidence of external support.

## Deliverable

Replace this initial inventory with an evidence-backed dependency recommendation and compatibility table before creating `package.json`.
