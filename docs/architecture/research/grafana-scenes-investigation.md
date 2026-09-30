# Grafana Scenes Investigation

## Status

Not started. This document defines the investigation; it does not claim that Grafana Scenes is suitable for the SDK.

## Research question

Can the Grafana Scenes packages available for Grafana OSS 13 load or represent an existing dashboard and render it inside an independent React application without starting the Grafana application shell?

## Areas to investigate

- Package support status, published entry points, licensing, and version alignment.
- Conversion from a saved dashboard definition to a scene or equivalent model.
- Required React providers, runtime services, globals, configuration, and boot data.
- Time range, refresh, template variables, annotations, transformations, and panel interactions.
- Panel plugin discovery and loading outside the Grafana shell.
- Mount, update, resize, cancellation, and disposal behavior.
- Theme, CSS, portals, and other effects on the host document.
- Bundle size, code splitting, and duplicate React dependency risks.

## Method

1. Pin the exact Grafana OSS 13 and candidate package versions under evaluation.
2. Review official package documentation, source entry points, examples, and licenses.
3. Trace the minimum initialization path needed to create a dashboard scene.
4. Build a disposable experiment outside the production SDK package structure.
5. Record every shim, internal import, global, and shell service required.
6. Exercise the representative behaviors in the POC matrix.
7. Repeat cleanup and UID-change scenarios to detect retained state.

## Evidence to capture

| Area | Evidence required | Finding |
| --- | --- | --- |
| External support | Official documentation or maintained example | Not evaluated |
| Dashboard conversion | Reproduction using a saved dashboard response | Not evaluated |
| Runtime dependencies | List of providers, services, globals, and shims | Not evaluated |
| Rendering fidelity | Results for each POC dashboard feature | Not evaluated |
| Lifecycle | Mount, update, unmount, and cancellation observations | Not evaluated |
| Packaging | Bundle report and dependency graph | Not evaluated |

## Exit criteria

The investigation is complete when it can recommend one of the following with reproducible evidence:

- adopt Scenes as the primary rendering runtime;
- adopt a constrained subset with documented adapters and limitations; or
- reject Scenes for this project and evaluate another Grafana-native path.

The recommendation must identify unsupported behavior, reliance on internal APIs, and the expected maintenance cost.
