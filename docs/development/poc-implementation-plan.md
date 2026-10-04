# Disposable Native-Rendering POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build disposable, instrumented evidence that an existing Grafana OSS 13.2.3 dashboard selected by UID can render its real Text, Stat, and Time series panels natively in an independent React application, without an iframe or the Grafana application shell.

**Architecture:** A private React host retrieves a constrained V1 dashboard DTO through a host-managed same-origin proxy. A page-scoped compatibility runtime installs each required Grafana service explicitly, converts only the controlled fixture into public Scenes primitives, and obtains exact built-in panel and TestData implementations through an isolated, auditable Grafana-source bridge. Gate A, Gate B, and Gate C execute in order; each gate must pass before the next begins. Gate D is optional and diagnostic.

**Tech Stack:** Node.js 22.23.3, Yarn 4.17.1, TypeScript 6.0.2, React/ReactDOM 19.2.8, Vite 8.2.0, Vitest 4.1.10, Playwright 1.56.1 with Chromium 141.0.7390.37, Docker Compose, Grafana OSS 13.2.3, `@grafana/*` 13.2.3, and `@grafana/scenes` 8.13.5.

**Spec:** [Minimal Standalone Rendering POC Design](../architecture/research/grafana-rendering-poc.md)

## Global Constraints

- Use Grafana OSS 13.2.3 at tag `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e`.
- Render in the host document with React DOM. An iframe is prohibited as a primary path, fallback, or error-recovery path.
- Never call `GrafanaApp.init`, mount Grafana routes, or import Grafana navigation, chrome, dashboard editing, or the application entrypoint.
- Keep the project frontend-only. The development reverse proxy is host infrastructure, not an SDK-owned backend.
- Keep authentication host-owned. No service-account, Basic-auth, or long-lived bearer secret may enter source, browser bundles, fixtures, logs, HARs, or screenshots.
- Treat `<GrafanaDashboard uid="..." />` as an experimental POC surface, not a stable API.
- Interpret `uid` as Grafana's user-facing dashboard UID: the V1 dashboard JSON `uid`, resource `metadata.name`, and `spec.uid` where present. It is not Kubernetes-style `metadata.uid`.
- Support only current-schema V1 (`schemaVersion: 42`) in the first POC. Discover and identify V2, then return a typed unsupported result. Do not use the legacy dashboard endpoint as fallback.
- Use exact Grafana visualization implementations wherever the gate requires them. Synthetic panels and mocked query data may diagnose a boundary but cannot pass Gate B or Gate C.
- Keep all Grafana DTO, Scene, `PanelPlugin`, `PanelData`, `DataFrame`, registry, and Runtime service types internal.
- Keep POC code private, unpublished, and disposable. Passing evidence does not authorize moving code into a production SDK.
- Do not begin Gate B until Gate A passes. Do not begin Gate C until Gate B passes. Do not begin Gate D until Gate C passes.
- Stop at a failed gate after one bounded remediation attempt; record the evidence instead of bypassing the failed behavior.

## Review Focus

- Verify that every import and runtime side effect remains inside the declared compatibility or source-bridge boundary.
- Verify the exact package/source identity and absence of duplicate React, ReactDOM, Emotion, RxJS, and Grafana package copies.
- Verify dashboard UID semantics, V1-only feature validation, cancellation, generation guards, and panel-local error isolation.
- Review every use, copy, adaptation, bundle, or dynamic load of Grafana application source or assets as a licensing checkpoint. This plan makes no legal conclusion.
- Treat clean lifecycle evidence and two-instance isolation as architecture requirements, not polish.
- Treat the exact Grafana Time series implementation as the mandatory proof. Text or Stat success is insufficient.

---

## Planning basis

### Verified prerequisites

- Grafana OSS 13.2.3 publishes Data, UI, Runtime, Schema, i18n, and e2e-selector packages at version 13.2.3, while the selected Scenes version is 8.13.5.
- Scenes exposes the required scene primitives, but Runtime is a singleton-backed service locator rather than a supported standalone container.
- Runtime supplies setters for backend, datasource, query, event, template, and plugin-import services, but several setters are internal or one-shot and do not provide production reset APIs.
- Runtime `config` reads `window.grafanaBootData` during module evaluation. The POC must establish its minimum boot projection before any value import of Runtime or a module that transitively imports it.
- Built-in Text, Stat, Time series, and Table implementations and TestData's frontend module are unpublished Grafana application source.
- The dashboard API supports discovery and stable V1/V2 `/dto` resources. The POC accepts only V1 schema 42 and explicitly rejects V2 conversion.
- Scenes 8.13.5 declares React 18 peers while Grafana 13.2.3 packages require React 19. The POC deliberately uses React 19.2.8 and must prove that only one React runtime is present.
- The approved POC environment uses one Grafana origin, one page-scoped compatibility runtime, one fixed datasource, and a fixed panel catalogue.

### Experiment decisions

- Use Vite because its aliases, deduplication controls, module graph, output manifest, and Rollup metadata make source closure observable.
- Use Vitest for pure unit and adapter integration tests. Use Playwright for all browser, DOM, style, network, visual, accessibility, and lifecycle acceptance tests.
- Use a private Yarn workspace only for the POC. Do not create a publishable SDK workspace or package-export contract.
- Isolate all direct Grafana application-source imports in `packages/poc-grafana-bridge`.
- Use a project-owned `SceneObjectBase` root with `SceneTimeRange`, `SceneVariableSet`, `SceneGridLayout`, `SceneGridItem`, `VizPanel`, `SceneQueryRunner`, and `SceneDataTransformer` as required by each fixture panel.
- Use the TestData `predictable_pulse` scenario for Stat and Time series; it exercises Grafana's real query endpoint without an external service.
- Use light DOM. Full Grafana global styles are a measured reference variant, not the default production answer. Shadow DOM is outside Gates A-C.

### Hypotheses under test

1. The exact Text panel can compile and render after an explicit minimum Runtime/provider bootstrap.
2. Scenes 8.13.5 activation, rendering, and deactivation operate correctly on React 19.2.8.
3. The exact TestData frontend module can be instantiated without Grafana application startup.
4. An explicit BackendSrv/DataSourceSrv/runRequest chain can drive `SceneQueryRunner` with real Grafana query responses.
5. The exact Time series source closure can be bounded without importing the application shell or reimplementing the visualization.
6. Theme, Emotion, uPlot CSS, fonts, icons, portals, and public paths can provide acceptable fidelity without unacceptable host-page side effects.
7. One page runtime can safely support two compatible dashboard instances and can reject an incompatible second runtime identity deterministically.

### Unresolved blockers entering implementation

- React 19 is outside Scenes 8.13.5's declared peer range.
- No supported standalone package distributes the four built-in panels.
- Time series uses unpublished Grafana application code and package-internal UI/Data surfaces.
- TestData's frontend module is application-owned.
- Runtime singleton and import-time configuration behavior is not designed for independent hosts.
- The minimum field-config and transformation registry closure is not yet proven.
- The minimum style and asset set is not yet known.
- Vite may not be able to reproduce Grafana's application aliases, loaders, chunking, or public-path assumptions.
- Licensing review is required before any production distribution decision involving application code or assets.

## Exact environment and versions

| Layer | Exact version or identity | Planning rule |
| --- | --- | --- |
| Node.js | `22.23.3` | Recorded in `.node-version`; CI and local verification must print the exact version |
| Package manager | Yarn `4.17.1` | Declared in the root `packageManager`; use the `node-modules` linker |
| TypeScript | `typescript: npm:@typescript/typescript6@6.0.2` | Matches the pinned Grafana compiler package |
| React | `19.2.8` | One physical copy across host, Scenes, Grafana UI, and panel source |
| ReactDOM | `19.2.8` | One physical copy and one host root per dashboard mount |
| React types | `@types/react@19.2.18`, `@types/react-dom@19.2.4` | Align with the pinned source baseline |
| Bundler | Vite `8.2.0` | No webpack fallback inside a gate; a bundler change is an architecture revision |
| React bundler plugin | `@vitejs/plugin-react@6.1.1` | Used by the independent host only |
| Unit/integration runner | Vitest `4.1.10` | Pure Node tests by default; browser semantics belong to Playwright |
| Browser runner | `@playwright/test@1.56.1` | Runs one pinned Chromium project |
| Browser | Chromium `141.0.7390.37`, Playwright build `1194` | Reference and POC screenshots use the same build |
| Accessibility | `@axe-core/playwright@4.11.1` | Findings are recorded and gate-relevant violations are reviewed |
| Grafana server/source | OSS `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` | All application-source imports must identify this commit |
| Grafana image | `grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` for `linux/amd64` | Fail setup if the resolved platform digest differs |
| Grafana packages | Data/UI/Runtime/Schema/i18n/e2e-selectors `13.2.3` | Exact resolutions; no mixed cohort |
| Scenes | `@grafana/scenes@8.13.5` | Peer mismatch remains visible and is tested, not treated as compatibility evidence |
| Shared runtime dependencies | RxJS `7.8.2`; Emotion CSS `11.13.5`; Emotion React `11.14.0`; uPlot `1.6.32`; React Router DOM `6.30.3` | Vite dedupes these; no router is created |

Vitest 4.1 is selected because it is the Vite 8-compatible Vitest line and the pinned Grafana source resolves 4.1.10. Playwright remains the authoritative runner for behaviors that depend on a real browser, layout, canvas, or lifecycle.

## Initial private workspace structure

```text
grafana-react-sdk/
├── package.json                         # private workspace root; never published
├── yarn.lock
├── .yarnrc.yml
├── .node-version
├── tsconfig.base.json
├── playwright.config.ts
├── apps/
│   └── poc-host/                        # private Vite host; no router or Grafana shell
│       ├── package.json
│       ├── index.html
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── host.css
├── packages/
│   ├── poc-compat/                      # private compatibility/runtime/conversion code
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── component/
│   │       ├── config/
│   │       ├── dashboard/
│   │       ├── datasource/
│   │       ├── events/
│   │       ├── i18n/
│   │       ├── instrumentation/
│   │       ├── location/
│   │       ├── network/
│   │       ├── panels/
│   │       ├── query/
│   │       ├── registries/
│   │       ├── runtime/
│   │       ├── scenes/
│   │       └── theme/
│   └── poc-grafana-bridge/              # only workspace allowed to import public/app source
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── sourceIdentity.ts
│           ├── panels/
│           └── datasources/
├── dev/
│   └── grafana/
│       ├── compose.yaml
│       ├── .env.example
│       └── provisioning/
│           ├── dashboards/
│           └── datasources/
├── tests/
│   └── e2e/
│       ├── support/
│       └── evidence/
└── artifacts/                           # ignored local HARs, screenshots, graphs, and reports
```

The root and all three workspaces use `"private": true`. There is deliberately no `packages/sdk`, public export map, release job, API extractor, or package publication configuration.

## Runtime and request architecture

```text
<GrafanaDashboard uid="grsdk-phase0-poc" />
  |
  +-- PocRuntimeCoordinator (one compatible identity per page)
  |     +-- pre-import boot-data projection
  |     +-- BackendSrv / EventBusSrv / TemplateSrv setters
  |     +-- DataSourceSrv / runRequest setters from Gate B
  |     +-- panel catalogue / registries / theme / i18n
  |     `-- portal / styles / assets / resource accounting
  |
  +-- DashboardClient
  |     +-- GET /grafana/apis/dashboard.grafana.app/
  |     +-- GET /grafana/apis/dashboard.grafana.app/v1/.../{uid}/dto
  |     `-- V1 schema-42 validation or typed V2/unsupported result
  |
  +-- FixtureV1Converter
  |     `-- project-owned SceneObjectBase root and public Scenes primitives
  |
  +-- Fixed PanelCatalog
  |     `-- private poc-grafana-bridge -> exact v13.2.3 panel source
  |
  +-- SceneQueryRunner (Gate B onward)
  |     `-- TestData frontend -> BackendSrv -> POST /grafana/api/ds/query
  |
  `-- Grafana panel React component -> @grafana/ui -> native DOM/canvas

Absent: iframe, GrafanaApp.init, Grafana router, navigation, application
chrome, dashboard editor, arbitrary plugin loading, and SDK authentication.
```

### Ownership and package/application-code boundary

| Surface | Owner and location | Allowed use in the POC |
| --- | --- | --- |
| Host configuration, browser session, proxy, mount, link callback | Host / `apps/poc-host` | Required; no credentials cross into the component contract |
| Retrieval, Runtime adapters, conversion, scene root, lifecycle | Project / `packages/poc-compat` | Private POC code; Grafana types remain internal |
| Published Grafana packages | Exact npm cohort | Consume exact root exports behind compatibility modules |
| Grafana application panels and TestData frontend | `packages/poc-grafana-bridge` importing external pinned source | Experiment only; complete source inventory and licensing checkpoints required |
| `@grafana/*/internal` or `public/app` transitive closure | Source bridge only | Allowed only when bounded, attributed, and required by the exact renderer; never leak to host imports |
| Dashboard converter semantics | Project converter informed by named upstream source | Adapt only fixture-required behavior and record it under L2 |
| Grafana shell, routes, nav, edit UI, general plugin map/SystemJS environment | Nobody | Build-time and runtime forbidden |
| Authentication, cross-origin gateway, secrets | Host/deployment | Never implemented by the POC package |

### Browser request sequence

1. The tester establishes a Grafana session through the proxied `/grafana/login` route. Credentials remain in the Playwright process or are entered interactively.
2. The runtime requests `GET /grafana/apis/dashboard.grafana.app/` and caches only successful discovery for the runtime identity.
3. The dashboard client requests the advertised stable V1 DTO at `/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/{encodedUid}/dto`.
4. The classifier checks V1 family, `metadata.name`, optional `spec.uid`, schema 42, and the controlled feature inventory. Recognized V2 state returns `dashboard-version-unsupported`; there is no legacy fallback.
5. Before Gate B queries, the runtime requests `GET /grafana/api/frontend/settings` and selects only datasource UID `grsdk-testdata` with type `grafana-testdata-datasource`.
6. Panel modules are resolved from the local exact-source bridge. Dashboard data never selects an arbitrary module URL.
7. Gate B/C/D queries use `POST /grafana/api/ds/query` through BackendSrv/TestData and carry the dashboard UID, panel ID, datasource UID, ref ID, interval/max-data-points values, and active time range.
8. Only inventoried font/icon/static assets may be requested from the configured `/grafana` or host asset base.

### Panel source-loading sequence

| Gate | Plugin and primary source entrypoint | Required module-loading proof |
| --- | --- | --- |
| A | Text — `public/app/plugins/panel/text/module.tsx` plus legacy v1 renderer | No Text v2 editor chunk; bounded catalogue entry; sanitization/config dependencies explicit |
| B | Stat — `public/app/plugins/panel/stat/module.tsx` | Reduction/display/internal dependencies bounded; no query editor or app shell needed |
| C | Time series — `public/app/plugins/panel/timeseries/module.tsx` and current GraphNG closure | Exact current renderer; all Data/UI internal, uPlot, tooltip, legend, CSS, font/icon, and application dependencies inventoried |
| D | Table — `public/app/plugins/panel/table/module.tsx` | Optional TableNG/grid, hook, action, CSS, link, virtualization, and accessibility closure inventoried |

For every row, run P1 direct-source build first. P2 is a conditional, local, source-built compatibility artifact only when the closure is bounded and L3 is approved. P3 is diagnostic only and cannot by itself pass a gate.

## Planned internal contracts

These signatures guide implementation and tests. They are not public SDK commitments.

```ts
export interface PocHostConfig {
  grafanaBasePath: '/grafana';
  namespace: 'default';
  theme: 'light';
  request: typeof fetch;
  assetBasePath: string;
}

export interface ExperimentalGrafanaDashboardProps {
  uid: string;
  config: PocHostConfig;
  onError?: (error: PocError) => void;
}

export type PocErrorCode =
  | 'dashboard-unauthorized'
  | 'dashboard-forbidden'
  | 'dashboard-not-found'
  | 'dashboard-api-version-unsupported'
  | 'dashboard-version-unsupported'
  | 'dashboard-identity-mismatch'
  | 'dashboard-response-malformed'
  | 'dashboard-feature-unsupported'
  | 'network'
  | 'panel-load'
  | 'datasource-load'
  | 'query'
  | 'transformation'
  | 'runtime-conflict';

export interface PocPanelCatalog {
  load(id: 'text' | 'stat' | 'timeseries' | 'table'): Promise<PanelPlugin>;
}

export interface PocRuntimeLease {
  readonly fingerprint: string;
  acquireDashboardScope(instanceId: string): PocDashboardScope;
  release(): void;
}
```

`acquirePocRuntime` may coordinate initialization, but it may not hide it. Its implementation must call and test these named responsibilities in order:

1. validate the one-origin runtime identity;
2. install pre-import boot data;
3. dynamically load and verify the exact package cohort;
4. establish one theme identity;
5. initialize English i18n;
6. install BackendSrv;
7. install EventBusSrv;
8. install the constrained TemplateSrv;
9. load and install the TestData datasource service when Gate B enables it;
10. install runRequest when Gate B enables it;
11. install field and transformation registries for the admitted gate;
12. install the fixed panel importer;
13. establish asset, style, and portal infrastructure; and
14. return reference-counted dashboard-scope ownership.

Each responsibility lives in its own module and has a focused test. The coordinator must reject a second configuration with a different base path, namespace, package identity, datasource catalogue, locale, or style policy.

## Controlled environment and fixture

### Docker and network topology

- Run the immutable `linux/amd64` Grafana image on a named Compose network `grsdk-poc`.
- Bind Grafana to `127.0.0.1:3000` for local diagnostics; the browser uses only `http://localhost:5173/grafana/` through Vite.
- Configure `GF_SERVER_ROOT_URL=http://localhost:5173/grafana/` and `GF_SERVER_SERVE_FROM_SUB_PATH=true`.
- Keep anonymous access disabled.
- Read the local admin password from ignored developer environment configuration. `.env.example` contains a placeholder, never a real credential.
- The Vite proxy preserves the `/grafana` prefix, cookies, response headers, WebSocket upgrade capability if observed, and request cancellation. It never injects credentials.
- Use a disposable named SQLite volume. Provisioning is idempotent and contains synthetic data only.

### Datasource fixture

Provision one TestData datasource:

| Field | Value |
| --- | --- |
| Name | `Grafana React SDK POC TestData` |
| UID | `grsdk-testdata` |
| Type | `grafana-testdata-datasource` |
| Default | `true` for the isolated POC only |

The accepted query scenarios are `predictable_pulse`, `slow_query`, `server_error_500`, and `table_static` or fixed CSV content. Gate B and Gate C must use Grafana's real `/api/ds/query` path. A local in-memory data mock cannot satisfy either gate.

### Dashboard fixture

Provision V1 schema 42 dashboard `grsdk-phase0-poc` with time range `now-1h` to `now`, browser timezone, no automatic refresh by default, and constant variable `environment=phase0`.

| ID | Plugin | Required saved behavior |
| --- | --- | --- |
| 1 | Text | Legacy v1 Markdown, sanitized static content containing `phase0`, no targets |
| 2 | Stat | `predictable_pulse`, last-not-null, percent unit, background color, thresholds at 50 and 80 |
| 3 | Time series | `predictable_pulse`, one-second step, `renameByRegex`, legend, tooltip, line/fill/threshold options |
| 4 | Table | Optional fixed table data, field order, unit, threshold, one external HTTPS link |

Provision `grsdk-phase0-poc-alt` with only Text panel ID 1 and a different sentinel. It exists solely for UID-change and stale-response tests.

The fixture must contain no annotations, library panels, repeated panels/rows, alerts, dashboard links, shared queries, query variables, Live streams, or external plugins.

## Gate and stop summary

| Gate | Required proof | Continue rule | Stop rule |
| --- | --- | --- | --- |
| A — Text | Runtime bootstrap, Scenes activation, exact Text panel, theme/styles, native DOM, cleanup | Continue only after every Gate A assertion passes | Stop for shell/router dependency, iframe, duplicate React, irreparable React 19 lifecycle failure, import-order failure, or cleanup leak |
| B — Stat | Real TestData resolution and query path, SceneQueryRunner, PanelData, display processing, refresh/cancel/error isolation | Continue normally after D1; D2-only success permits Gate C diagnostic work but fixes the final result at least at REVISE | Stop when no cancellable query path exists without app startup/backend/secrets, or query errors escape the panel boundary |
| C — Time series | Exact Grafana Time series, real query, transform, field config, time range, resize, style fidelity, cleanup, two instances | A passing Gate C permits the final POC decision | Stop for shell/iframe need, unbounded source closure, non-isolatable internals, reimplemented visualization, broken lifecycle, or instance cross-talk |
| D — Table | Extra field organization, links, grid/UI dependencies | Optional after C; report supported/unsupported | An isolated Table failure does not invalidate C; it narrows supported panel scope |

When a STOP rule triggers, update the evidence report, mark later tasks `NOT RUN`, and stop. Do not add a substitute renderer merely to reach a later gate.

## Test and evidence policy

Every implementation task runs the narrow test first, then the applicable cumulative checks. Every gate produces:

- exact environment, source commit, image digest, lock hash, and fixture DTO hash;
- sanitized discovery and DTO classification records;
- redacted HAR and query lifecycle trace;
- console and unhandled-error report;
- panel and datasource import trace;
- Vite module graph, forbidden-import report, chunk manifest, and raw/gzip contribution report;
- DOM snapshot and continuous zero-iframe assertion;
- reference, POC, and visual-diff screenshots;
- accessibility report;
- active/unmounted/remounted resource snapshots; and
- pass/fail decision with primary path, diagnostics, fallbacks, and next action.

Artifacts under `artifacts/` are ignored. Durable, sanitized conclusions go to `docs/architecture/research/poc-results.md`. Evidence must never contain cookies, authorization headers, local passwords, or non-synthetic dashboard data.

## Licensing checkpoints

No checkpoint below is a legal conclusion.

| Checkpoint | Trigger | Required record before continuing |
| --- | --- | --- |
| L1 | First direct import of Grafana `public/app` source | Exact files, commit, license/notice provenance, build purpose, and confirmation that no binary is published |
| L2 | Copy or adaptation of converter, service, registry, or importer behavior | Source path, semantic delta, copied/adapted lines or concepts, and reviewer disposition |
| L3 | Source-built panel/TestData compatibility artifact | Complete source/module closure, generated outputs, notices, distribution restriction, and explicit review |
| L4 | Grafana fonts, icons, CSS, SVGs, or other static assets | File inventory, provenance, license/notice review, and host-serving plan |
| L5 | Server-delivered plugin chunk diagnostic | URL, runtime/bootstrap requirements, integrity/origin behavior, and explicit statement that diagnostic success is not distribution approval |
| L6 | Final PROCEED/REVISE recommendation | Consolidated unpublished/internal dependency and asset inventory; explicit review required before any production distribution proposal |

## Task dependency sequence

```text
1 Toolchain/workspaces
  -> 2 Standalone host/proxy
  -> 3 Grafana fixture
  -> 4 Instrumentation/guards
  -> 5 Runtime foundation
  -> 6 Dashboard API
  -> 7 V1 conversion/scene root
  -> 8 Text source-loading experiment
  -> 9 GATE A
  -> 10 TestData/query runtime
  -> 11 GATE B
  -> 12 Time series source/processing closure
  -> 13 GATE C render behavior
  -> 14 GATE C lifecycle/containment
  -> 15 GATE D (optional)
  -> 16 Final evidence and decision
```

Tasks 8, 10, and 12 contain explicit conditional experiment branches. A diagnostic branch never converts a failed primary path into an unqualified pass.

---

## Task 1: Scaffold the private POC toolchain and workspace

**Files:**

- Create: `package.json`
- Create: `yarn.lock`
- Create: `.yarnrc.yml`
- Create: `.node-version`
- Create: `tsconfig.base.json`
- Create: `apps/poc-host/package.json`
- Create: `apps/poc-host/tsconfig.json`
- Create: `packages/poc-compat/package.json`
- Create: `packages/poc-compat/tsconfig.json`
- Create: `packages/poc-grafana-bridge/package.json`
- Create: `packages/poc-grafana-bridge/tsconfig.json`
- Create: `packages/poc-compat/src/toolchain.test.ts`
- Modify: `.gitignore`
- Modify: `docs/development/local-development.md`

**Interfaces:**

- Consumes: exact version matrix in this plan.
- Produces: private workspace names `@grafana-react-sdk/poc-host`, `@grafana-react-sdk/poc-compat`, and `@grafana-react-sdk/poc-grafana-bridge`.
- Produces root commands: `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `build:poc`, and `inspect:bundle`.

**Steps:**

- [ ] Write `packages/poc-compat/src/toolchain.test.ts` to assert the expected Node major/minor and the intended test-runner environment; confirm the test cannot run before the workspace exists.
- [ ] Create a private root manifest with exact versions, workspaces `apps/*` and `packages/*`, `packageManager: yarn@4.17.1`, and no publish/release fields.
- [ ] Pin every dependency in the exact matrix. Use `typescript: npm:@typescript/typescript6@6.0.2`; do not use caret or tilde ranges.
- [ ] Configure Yarn with `nodeLinker: node-modules`, telemetry disabled, and install scripts disabled unless a reviewed dependency demonstrably requires one.
- [ ] Do not hide the Scenes/React peer warning with a package extension. Capture `yarn explain peer-requirements` output as an explicit known risk.
- [ ] Add TypeScript project references without creating a production SDK package.
- [ ] Add ignored paths for `.yarn/cache` if used, Playwright output, `artifacts/`, Vite output, coverage, local env files, Grafana data volumes, and source-checkout paths.
- [ ] Update local-development documentation with copyable commands and a warning that POC setup is private/disposable.
- [ ] Run `corepack yarn install` and commit the resulting lockfile.
- [ ] Run `corepack yarn install --immutable`.
- [ ] Run `corepack yarn vitest run packages/poc-compat/src/toolchain.test.ts`.
- [ ] Run `corepack yarn typecheck`.
- [ ] Run `corepack yarn why react react-dom @grafana/scenes` and save the sanitized dependency identity output under `artifacts/toolchain/`.

**Expected result:** The exact toolchain installs reproducibly, the smoke test and type check pass, the peer mismatch is visible, and no implementation or production package exists.

**Proposed commit:** `chore: scaffold disposable poc workspace`

## Task 2: Create the route-free standalone React host and development proxy

**Files:**

- Create: `apps/poc-host/index.html`
- Create: `apps/poc-host/vite.config.ts`
- Create: `apps/poc-host/src/main.tsx`
- Create: `apps/poc-host/src/App.tsx`
- Create: `apps/poc-host/src/host.css`
- Create: `apps/poc-host/src/host.test.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/host-smoke.spec.ts`

**Interfaces:**

- Consumes: private workspace setup from Task 1.
- Produces: `http://localhost:5173/` host and `/grafana/*` development proxy to `http://127.0.0.1:3000`.
- Produces: one React 19.2.8 root in Strict Mode, with no router and no Grafana imports yet.

**Steps:**

- [ ] Write `host.test.ts` to fail until the host config exposes exactly one mount element and no router dependency.
- [ ] Configure Vite `resolve.dedupe` for React, ReactDOM, Emotion, RxJS, and the pinned Grafana packages.
- [ ] Configure the `/grafana` proxy to preserve the prefix, cookie headers, status codes, streaming bodies, and abort behavior. Do not add credentials or authorization headers.
- [ ] Render a host sentinel design system around an empty `data-testid="grafana-dashboard-root"` region. The sentinel styles are later used to detect CSS leakage.
- [ ] Configure Playwright for the pinned Chromium build, one worker for gate evidence, retained trace on failure, and redacted HAR support.
- [ ] Write a browser smoke test asserting native host DOM, zero iframes, no router/nav landmarks from Grafana, and no unexpected console errors.
- [ ] Run `corepack yarn test:unit -- apps/poc-host/src/host.test.ts`.
- [ ] Run `corepack yarn build:poc`.
- [ ] Run `corepack yarn playwright test tests/e2e/host-smoke.spec.ts --project=chromium`.

**Expected result:** A minimal React host builds and renders without Grafana, routing, navigation, an iframe, or global host-style mutation.

**Proposed commit:** `feat: add standalone poc host shell`

## Task 3: Provision the deterministic Grafana 13.2.3 environment

**Files:**

- Create: `dev/grafana/compose.yaml`
- Create: `dev/grafana/.env.example`
- Create: `dev/grafana/provisioning/datasources/poc-testdata.yaml`
- Create: `dev/grafana/provisioning/dashboards/provider.yaml`
- Create: `dev/grafana/provisioning/dashboards/grsdk-phase0-poc.json`
- Create: `dev/grafana/provisioning/dashboards/grsdk-phase0-poc-alt.json`
- Create: `packages/poc-compat/src/fixtures/fixtureContract.ts`
- Create: `packages/poc-compat/src/fixtures/fixtureContract.test.ts`

**Interfaces:**

- Consumes: immutable Docker image and fixture contract in this plan.
- Produces: datasource UID `grsdk-testdata`; dashboard UIDs `grsdk-phase0-poc` and `grsdk-phase0-poc-alt`.
- Produces: browser-visible Grafana base path `/grafana` and namespace `default`.

**Steps:**

- [ ] Write a failing fixture-contract test that loads the committed synthetic dashboard JSON and checks UID, schema 42, panel IDs, plugin IDs, datasource references, variable, exclusions, and deterministic options.
- [ ] Add Compose configuration using the exact image digest and `platform: linux/amd64`.
- [ ] Bind port 3000 only to loopback, configure the Grafana subpath/root URL, disable anonymous access, and use a disposable named volume/network.
- [ ] Require local credentials through environment interpolation. Commit only placeholders and document that Playwright receives credentials from the process environment, never Vite `define` or client code.
- [ ] Provision TestData and both dashboards idempotently.
- [ ] Set every query datasource reference explicitly to `{ type: "grafana-testdata-datasource", uid: "grsdk-testdata" }`.
- [ ] Run `docker compose -f dev/grafana/compose.yaml config --quiet`.
- [ ] Run `docker manifest inspect grafana/grafana:13.2.3` and verify the selected `linux/amd64` digest before starting the container.
- [ ] Run `docker compose -f dev/grafana/compose.yaml up -d --wait`.
- [ ] Run `curl --fail http://127.0.0.1:3000/api/health` and record version/commit/database.
- [ ] Run `corepack yarn test:unit -- packages/poc-compat/src/fixtures/fixtureContract.test.ts`.
- [ ] Render the fixture in the pinned Grafana UI and capture reference screenshots in ignored evidence storage.

**Expected result:** The pinned container starts with one deterministic datasource and two synthetic V1 dashboards; the fixture contract test rejects accidental unsupported features.

**Proposed commit:** `test: add deterministic Grafana poc fixture`

## Task 4: Add evidence instrumentation and forbidden-import guards

**Files:**

- Create: `packages/poc-compat/src/instrumentation/networkRecorder.ts`
- Create: `packages/poc-compat/src/instrumentation/resourceTracker.ts`
- Create: `packages/poc-compat/src/instrumentation/iframeGuard.ts`
- Create: `packages/poc-compat/src/instrumentation/runtimeIdentity.ts`
- Create: `packages/poc-compat/src/instrumentation/pluginTrace.ts`
- Create: `packages/poc-compat/src/instrumentation/instrumentation.test.ts`
- Create: `apps/poc-host/build/forbiddenGrafanaImportPlugin.ts`
- Create: `apps/poc-host/build/bundleEvidencePlugin.ts`
- Create: `tests/e2e/support/consoleGuard.ts`
- Create: `tests/e2e/support/networkEvidence.ts`
- Create: `tests/e2e/support/resourceEvidence.ts`

**Interfaces:**

- Consumes: browser APIs before Grafana modules import.
- Produces: redacted network events, runtime/package identities, plugin load events, resource snapshots, continuous iframe observations, and build-module reports.
- Rejects: `public/app/app.ts`, route registration, navigation/chrome, dashboard edit shell, arbitrary SystemJS fallback, and unexpected `@grafana/*/internal` imports outside the source bridge.

**Steps:**

- [ ] Write failing unit tests for header redaction, URL/body sanitization, counter balance, iframe mutation detection, runtime fingerprint equality, and forbidden module IDs.
- [ ] Instrument fetch/AbortController, timers, intervals, RAF, event listeners, ResizeObserver, MutationObserver, subscriptions, scene activation, portals, and Emotion/style elements.
- [ ] Separate page-lifetime resources from dashboard-instance resources in every snapshot.
- [ ] Add a Vite plugin that records resolved module IDs and fails the build for forbidden shell imports.
- [ ] Add bundle evidence generation for chunks, source modules, dynamic imports, CSS/assets, raw size, and gzip size.
- [ ] Fail browser tests on unexpected console errors, React/Emotion/i18n warnings, unhandled rejections, and page errors.
- [ ] Run `corepack yarn test:unit -- packages/poc-compat/src/instrumentation/instrumentation.test.ts`.
- [ ] Run `corepack yarn build:poc` and inspect the initial module report.
- [ ] Run the host smoke browser test with the instrumentation enabled and confirm zero iframe observations.

**Expected result:** Every later gate can produce reproducible, sanitized evidence and automatically reject shell imports, hidden iframes, and unclassified browser failures.

**Proposed commit:** `test: add poc evidence and import guards`

## Task 5: Implement explicit compatibility-runtime foundation

**Files:**

- Create: `packages/poc-compat/src/config/hostConfig.ts`
- Create: `packages/poc-compat/src/config/installBootData.ts`
- Create: `packages/poc-compat/src/config/loadGrafanaCohort.ts`
- Create: `packages/poc-compat/src/runtime/runtimeIdentity.ts`
- Create: `packages/poc-compat/src/runtime/acquirePocRuntime.ts`
- Create: `packages/poc-compat/src/events/installAppEvents.ts`
- Create: `packages/poc-compat/src/location/locationPolicy.ts`
- Create: `packages/poc-compat/src/theme/createPocTheme.ts`
- Create: `packages/poc-compat/src/theme/PocGrafanaProviders.tsx`
- Create: `packages/poc-compat/src/i18n/initializePocI18n.ts`
- Create: `packages/poc-compat/src/theme/portalManager.ts`
- Create: `packages/poc-compat/src/theme/assetPolicy.ts`
- Create: `packages/poc-compat/src/runtime/acquirePocRuntime.test.ts`
- Create: `packages/poc-compat/src/config/importOrder.test.ts`

**Interfaces:**

- Consumes: `PocHostConfig`, panel catalogue placeholder, instrumentation sink.
- Produces: `Promise<PocRuntimeLease>` with a stable fingerprint and reference-counted dashboard scopes.
- Side effects: minimum `window.grafanaBootData`, Runtime `config`, one `EventBusSrv`, English i18n, one `GrafanaTheme2`, one portal root, and one asset/public-path policy.

**Steps:**

- [ ] Write import-order tests that fail if Runtime is evaluated before `installBootData` and conflict tests that fail if two different runtime fingerprints are accepted.
- [ ] Validate that base path is relative and normalized, namespace is `default`, UID credentials are absent, and the theme is `light`.
- [ ] Populate only the documented minimum boot settings before any Grafana value import. Use type-only imports where possible.
- [ ] Dynamically import the exact package cohort and assert versions plus one React/ReactDOM identity marker.
- [ ] Create one theme object and assert object identity between Runtime `config.theme2` and the UI provider.
- [ ] Initialize `grafana-scenes` English translations before any scene render.
- [ ] Install one page-scoped `EventBusSrv`; record observed event types.
- [ ] Do not install a router. Guard any location mutation as unsupported and fail if a supported fixture invokes navigation.
- [ ] Create one reference-counted portal container and asset policy. Removing the final dashboard releases POC-owned DOM while leaving unresettable Grafana module singletons documented as page-lifetime state.
- [ ] Make the coordinator call each named module in an asserted order. Do not add a generic catch-all “initialize Grafana” function.
- [ ] Run the two narrow Vitest files.
- [ ] Run `corepack yarn typecheck` and `corepack yarn build:poc`.

**Expected result:** An explicit page runtime can be acquired twice with the same identity, rejects a conflicting identity, initializes before Grafana imports, and owns theme/i18n/event/DOM responsibilities without the Grafana shell.

**Proposed commit:** `feat: add explicit poc runtime foundation`

## Task 6: Implement dashboard discovery, V1 retrieval, and typed errors

**Files:**

- Create: `packages/poc-compat/src/network/backendSrvAdapter.ts`
- Create: `packages/poc-compat/src/network/backendSrvAdapter.test.ts`
- Create: `packages/poc-compat/src/dashboard/types.ts`
- Create: `packages/poc-compat/src/dashboard/errors.ts`
- Create: `packages/poc-compat/src/dashboard/discoverDashboardApi.ts`
- Create: `packages/poc-compat/src/dashboard/loadDashboardV1.ts`
- Create: `packages/poc-compat/src/dashboard/classifyDashboard.ts`
- Create: `packages/poc-compat/src/dashboard/dashboardClient.test.ts`
- Create: `tests/e2e/dashboard-api.spec.ts`

**Interfaces:**

- Consumes: host request function, `/grafana` base path, namespace `default`, requested user-facing UID, and AbortSignal.
- Produces: validated private `PocV1DashboardDto` or a typed `PocError`.
- Requests: `GET /grafana/apis/dashboard.grafana.app/`, then `GET /grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/{encodedUid}/dto`.

**Steps:**

- [ ] Write request-construction, credentials, cancellation, decoding, and error-classification tests before the adapter.
- [ ] Install the structural BackendSrv adapter through the named Runtime setter. Preserve request stage, HTTP status, safe details, request ID, and AbortSignal.
- [ ] Cache successful discovery per runtime fingerprint; do not cache failed discovery.
- [ ] Select advertised stable V1. Record V2 availability but do not fetch or convert V2 for a valid V1 fixture.
- [ ] Validate `apiVersion`, `kind`, envelope, `spec`, access metadata, and resource identity.
- [ ] Assert requested UID equals `metadata.name`; when `spec.uid` is present, assert the same user-facing UID. Ignore Kubernetes-style `metadata.uid` for dashboard lookup identity.
- [ ] Accept only schema 42 and current V1 family. Return `dashboard-version-unsupported` for V2 and `dashboard-feature-unsupported` for older schema or unsupported semantics.
- [ ] Map 401, 403, dashboard 404, discovery 404, network failure, malformed JSON, identity mismatch, and cancellation separately.
- [ ] Never fall back to `/api/dashboards/uid/{uid}`.
- [ ] Write Playwright assertions for real discovery/DTO calls through the same-origin proxy, including cookie-owned authentication and request abortion.
- [ ] Run the narrow unit tests and `corepack yarn playwright test tests/e2e/dashboard-api.spec.ts --project=chromium`.

**Expected result:** The host retrieves the controlled dashboard by user-facing UID, validates V1 schema 42, classifies all retrieval failures, and returns a typed unsupported result for V2 without leaking credentials.

**Proposed commit:** `feat: retrieve constrained dashboards by uid`

## Task 7: Convert the fixture V1 DTO into the minimum Scenes graph

**Files:**

- Create: `packages/poc-compat/src/dashboard/preflightFixture.ts`
- Create: `packages/poc-compat/src/dashboard/preflightFixture.test.ts`
- Create: `packages/poc-compat/src/scenes/PocDashboardSceneRoot.tsx`
- Create: `packages/poc-compat/src/scenes/convertFixtureV1.ts`
- Create: `packages/poc-compat/src/scenes/convertFixtureV1.test.ts`
- Create: `packages/poc-compat/src/scenes/sceneLifecycle.ts`
- Create: `packages/poc-compat/src/scenes/sceneLifecycle.test.ts`
- Create: `packages/poc-compat/src/component/GrafanaDashboard.tsx`
- Create: `packages/poc-compat/src/component/types.ts`
- Create: `packages/poc-compat/src/index.ts`

**Interfaces:**

- Consumes: validated V1 schema-42 fixture DTO, fixed `PocPanelCatalog`, runtime lease, and generation/AbortSignal ownership.
- Produces: project-owned scene root containing `SceneTimeRange`, constant `SceneVariableSet`, `SceneGridLayout`, `SceneGridItem`, and gate-admitted `VizPanel` nodes.
- Produces experimental component: `GrafanaDashboard(props: ExperimentalGrafanaDashboardProps): React.ReactElement`.

**Steps:**

- [ ] Write preflight tests that accept only the fixture's exact layout, constant variable, panels admitted by the active gate, TestData UID, and allowed transform IDs.
- [ ] Write failing conversion tests for Text with no data provider and for query-backed panels with `SceneQueryRunner` plus optional `SceneDataTransformer`.
- [ ] Reject annotations, library panels, repeats, alerts, dashboard links, shared queries, Live, external plugins, query variables, unknown transforms/options, and unknown top-level features before scene activation.
- [ ] Map `gridPos`, panel ID/title/description/transparency, options, field configuration, links, time overrides, targets, datasource, and the constant variable explicitly.
- [ ] Record each behavior adapted from Grafana application converter sources under licensing checkpoint L2; do not import `DashboardModel`, `DashboardMigrator`, `DashboardScene`, or the complete application converter.
- [ ] Wrap dashboard load/conversion/mount in a monotonically increasing generation. Abort old requests and ignore late plugin/query completions after UID change or unmount.
- [ ] Let the Scenes React wrapper own activation. Do not manually activate the same graph in parallel.
- [ ] Add loading, dashboard-level error, and scene error boundaries using project-owned UI outside the panel renderer.
- [ ] Run all narrow tests and `corepack yarn typecheck`.

**Expected result:** The controlled V1 DTO converts deterministically into a minimal scene graph, unsupported semantics fail closed, and UID changes cannot publish stale graphs.

**Proposed commit:** `feat: convert fixture dashboard into scenes`

## Task 8: Run the Text built-in panel loading experiment

**Files:**

- Create: `packages/poc-grafana-bridge/src/sourceIdentity.ts`
- Create: `packages/poc-grafana-bridge/src/panels/types.ts`
- Create: `packages/poc-grafana-bridge/src/panels/catalog.ts`
- Create: `packages/poc-grafana-bridge/src/panels/text.ts`
- Create: `packages/poc-grafana-bridge/src/panels/text.test.ts`
- Modify: `apps/poc-host/vite.config.ts`
- Create: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: clean external checkout identified by `GRAFANA_SOURCE_DIR`, exactly at commit `6193dc03311b631b9727b560d24369e683dc396e`.
- Imports primary entrypoint: `public/app/plugins/panel/text/module.tsx` and the selected legacy v1 Text component closure.
- Produces: cached `Promise<PanelPlugin>` for plugin ID `text` plus source/module telemetry.

**Steps:**

- [ ] Complete licensing checkpoint L1 before committing any direct `public/app` import.
- [ ] Create or select a clean external source checkout, for example `git clone --filter=blob:none --branch v13.2.3 --single-branch https://github.com/grafana/grafana.git ../grafana-v13.2.3`, then set ignored local `GRAFANA_SOURCE_DIR` to its absolute path.
- [ ] Add a source-identity preflight that runs `git rev-parse HEAD` in the configured checkout and fails on any other commit or a dirty source patch not recorded in evidence.
- [ ] Write the catalogue test first: only `text` is admitted, repeat loads share one promise, unknown IDs fail without URL fallback, and metadata reports version 13.2.3.
- [ ] Configure explicit Vite aliases for the pinned checkout's required `app` paths while forcing all `@grafana/*`, React, ReactDOM, Emotion, and RxJS imports to the root cohort.
- [ ] Attempt P1 direct-source compilation. Record every `public/app`, internal-package, feature flag, asset, CSS, and dynamic import in the module report.
- [ ] Keep read-only Text on the legacy v1 path and prove the v2 editor chunk is absent.
- [ ] Fail P1 if the graph includes the app entrypoint, routes, navigation, dashboard/edit shell, a general built-in plugin map, or arbitrary SystemJS loading.
- [ ] If P1 fails only because a bounded source closure cannot be exposed cleanly through Vite aliases, stop and complete checkpoint L3 before the conditional P2 task below.
- [ ] If the closure is unbounded or requires forbidden shell code, record Gate A `FAIL`, mark Tasks 9-16 `NOT RUN`, and stop.
- [ ] Run `corepack yarn test:unit -- packages/poc-grafana-bridge/src/panels/text.test.ts`.
- [ ] Run `corepack yarn build:poc` and `corepack yarn inspect:bundle -- --entry text`.
- [ ] Add the source identity, import graph, licensing checkpoint status, and P1 result to `poc-results.md`.

**Expected result:** The exact Text plugin is available through one closed, cached importer with a bounded module graph and no application shell.

**Proposed commit:** `spike: load exact Grafana text panel source`

### Conditional Task 8A: Build a disposable Text compatibility artifact

Run only when P1 fails for bounded alias/build reasons, checkpoint L3 is explicitly approved, and no forbidden shell dependency was found.

**Files:**

- Create: `packages/poc-grafana-bridge/build/text.entry.ts`
- Create: `packages/poc-grafana-bridge/build/vite.text.config.ts`
- Create: `packages/poc-grafana-bridge/NOTICE.poc.md`
- Modify: `packages/poc-grafana-bridge/src/panels/text.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Steps:**

- [ ] Build one local, unpublished entrypoint exposing only the exact `PanelPlugin` loader.
- [ ] Preserve source paths, source maps, notices, source commit, and complete module inventory.
- [ ] Do not commit built binary output or publish the artifact.
- [ ] Run the same forbidden-import and bundle inspection checks as P1.
- [ ] If P2 passes, label the architecture result at least `REVISE`; if it fails, stop Gate A.

**Expected result:** A bounded source-built bridge can be evaluated without implying a production distribution strategy.

**Proposed commit:** `spike: isolate text panel compatibility artifact`

### Conditional Task 8B: Diagnose server-distributed Text module loading

Run only to explain a P1/P2 failure. It cannot pass Gate A by itself.

**Files:**

- Create: `packages/poc-grafana-bridge/src/diagnostics/serverPanelModule.ts`
- Create: `tests/e2e/server-panel-diagnostic.spec.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Steps:**

- [ ] Complete licensing checkpoint L5.
- [ ] Record module URLs, SystemJS/import-map needs, webpack runtime/public path, translations, origin/integrity behavior, and shell coupling.
- [ ] Never allow arbitrary dashboard plugin IDs to select remote code.
- [ ] Report the diagnostic and stop; do not promote this path automatically.

**Proposed commit:** `research: diagnose server panel module loading`

## Task 9: Implement and verify Gate A — Text

**Files:**

- Modify: `packages/poc-compat/src/panels/panelCatalog.ts`
- Modify: `packages/poc-compat/src/runtime/acquirePocRuntime.ts`
- Modify: `packages/poc-compat/src/component/GrafanaDashboard.tsx`
- Modify: `apps/poc-host/src/App.tsx`
- Create: `tests/e2e/gate-a-text.spec.ts`
- Create: `tests/e2e/support/grafanaAuth.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: `uid="grsdk-phase0-poc"`, host/browser Grafana session, Text importer, validated V1 DTO.
- Produces: exact Text panel ID 1 under `VizPanel`/panel chrome in native host DOM.

**Steps:**

- [ ] Write the Gate A browser test first and confirm it fails before the panel is connected.
- [ ] Authenticate through `/grafana/login` using process environment values available only to Playwright; save browser storage state outside source control.
- [ ] Retrieve the dashboard by UID, convert only panel ID 1, and render it through the experimental component.
- [ ] Assert React 19.2.8 identity, no hook/peer errors, Runtime bootstrap order, English i18n readiness, and one shared theme object.
- [ ] Assert the exact Text plugin identity, legacy Markdown sanitization, dimensions, typography, panel chrome, portal root, and expected `phase0` sentinel.
- [ ] Keep a MutationObserver active for the whole test and assert iframe count always remains zero.
- [ ] Assert no `GrafanaApp.init`, router, navigation, chrome, dashboard editor, or unexpected Text editor chunk appears in runtime/module evidence.
- [ ] Unmount and assert the scene is inactive, instance-owned requests/subscriptions/timers/RAF/observers/listeners/portal children return to baseline, and no host sentinel style changes.
- [ ] Remount and assert identical output with one portal root and no duplicate persistent styles.
- [ ] Run `corepack yarn playwright test tests/e2e/gate-a-text.spec.ts --project=chromium`.
- [ ] Run `corepack yarn build:poc` and the Text bundle inspection.
- [ ] Record all twelve evidence categories and mark Gate A `PASS` or `FAIL`.

**Expected result:** Gate A passes only when the real Text panel renders through Scenes in native DOM with explicit runtime/providers and clean mount/unmount behavior.

**Proposed commit:** `feat: prove native text panel rendering`

**Gate boundary:** If any Gate A kill condition remains after one bounded remediation, stop. Do not start Task 10.

## Task 10: Add the TestData datasource and query-runtime experiment

**Files:**

- Create: `packages/poc-grafana-bridge/src/datasources/testdata.ts`
- Create: `packages/poc-grafana-bridge/src/datasources/testdata.test.ts`
- Create: `packages/poc-compat/src/datasource/loadFrontendSettings.ts`
- Create: `packages/poc-compat/src/datasource/pocDataSourceSrv.ts`
- Create: `packages/poc-compat/src/datasource/pocDataSourceSrv.test.ts`
- Create: `packages/poc-compat/src/query/runRequest.ts`
- Create: `packages/poc-compat/src/query/runRequest.test.ts`
- Create: `packages/poc-compat/src/events/installTemplateSrv.ts`
- Modify: `packages/poc-compat/src/runtime/acquirePocRuntime.ts`
- Modify: `apps/poc-host/vite.config.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: `/api/frontend/settings`, datasource UID `grsdk-testdata`, exact TestData frontend module, host BackendSrv, scene request, and unsubscribe/AbortSignal.
- Primary import: `public/app/plugins/datasource/grafana-testdata-datasource/module.tsx` and exact `TestDataDataSource` closure.
- Produces: fixed-UID DataSourceSrv and Observable runRequest emitting Grafana `LoadingState`/`PanelData` transitions.

**Steps:**

- [ ] Complete licensing checkpoints L1/L3 for the TestData application module before committing direct imports or a source-built bridge.
- [ ] Write tests for settings validation, fixed UID/type resolution, instance caching, unknown datasource rejection, request enrichment, Loading/Done/Error states, unsubscribe cancellation, and stale-generation suppression.
- [ ] Load `/api/frontend/settings`, select only `grsdk-testdata`, sanitize settings, and reject mismatched type or missing UID.
- [ ] Attempt D1 exact-source TestData compilation and record its entire unpublished/internal module closure.
- [ ] Instantiate one TestData datasource and install a DataSourceSrv that cannot resolve any other UID.
- [ ] Implement the constrained TemplateSrv for `environment=phase0` and Grafana scoped built-ins used by the fixture. Unknown formats fail preflight.
- [ ] Implement runRequest as an Observable that preserves dashboard UID, panel ID, ref ID, interval, max data points, and time range; connect unsubscribe to the actual datasource/transport cancellation path.
- [ ] Add network/query IDs that link SceneQueryRunner state to `/api/ds/query`.
- [ ] Run the narrow unit/integration tests and inspect the TestData module graph.
- [ ] Update the evidence report with D1 result.

**Expected result:** D1 supplies one real TestData instance and a cancellable query path without Grafana application startup.

**Proposed commit:** `feat: add constrained TestData query runtime`

### Conditional Task 10A: Add the D2 backend-query diagnostic

Run only if D1 fails before query execution. D2 must use real Grafana `/api/ds/query`; it may not return mock frames.

**Files:**

- Create: `packages/poc-compat/src/datasource/testDataBackendDiagnostic.ts`
- Create: `packages/poc-compat/src/datasource/testDataBackendDiagnostic.test.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Steps:**

- [ ] Map only the saved TestData target shapes used by the fixture to `/api/ds/query`.
- [ ] Label all telemetry and UI evidence `D2 diagnostic`.
- [ ] Re-run runRequest, cancellation, and error-state tests with real server responses.
- [ ] If D2 succeeds, later Gate B/C work may continue for diagnosis, but the final decision cannot be unqualified `PROCEED`; record `REVISE`.
- [ ] If D2 also fails, stop before Gate B rendering.

**Proposed commit:** `spike: isolate TestData backend query path`

### Conditional Task 10B: Diagnose server-distributed datasource loading

Run only to explain a D1 failure. D3 cannot pass Gate B and must never become an arbitrary datasource loader.

**Files:**

- Create: `packages/poc-grafana-bridge/src/diagnostics/serverDatasourceModule.ts`
- Create: `tests/e2e/server-datasource-diagnostic.spec.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Steps:**

- [ ] Complete L5 for server-delivered datasource code.
- [ ] Record frontend-settings metadata, module URL, SystemJS/import-map needs, webpack runtime/public path, translations, integrity/origin behavior, and Grafana-shell coupling.
- [ ] Restrict the diagnostic to datasource UID `grsdk-testdata` and type `grafana-testdata-datasource`.
- [ ] Do not treat a server module requiring Grafana's application loader as standalone success.
- [ ] Record the result and return to the D1/D2 decision rule.

**Proposed commit:** `research: diagnose server datasource module loading`

## Task 11: Implement and verify Gate B — Stat

**Files:**

- Create: `packages/poc-grafana-bridge/src/panels/stat.ts`
- Create: `packages/poc-grafana-bridge/src/panels/stat.test.ts`
- Create: `packages/poc-compat/src/registries/installFieldConfig.ts`
- Create: `packages/poc-compat/src/registries/installFieldConfig.test.ts`
- Modify: `packages/poc-grafana-bridge/src/panels/catalog.ts`
- Modify: `packages/poc-compat/src/scenes/convertFixtureV1.ts`
- Create: `tests/e2e/gate-b-stat.spec.ts`
- Create: `tests/e2e/gate-b-stat-failures.spec.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: Stat panel ID 2, `grsdk-testdata`, SceneQueryRunner, predictable pulse response, minimum field configuration.
- Produces: exact Stat `PanelPlugin` and visible deterministic reduced percent value with threshold background.

**Steps:**

- [ ] Complete L1/L2/L3 as applicable for Stat and application-owned field-config descriptors.
- [ ] Write source-catalogue and field-config tests before adding the module. Admit only display name, unit, decimals, min/max, color, no-value text, thresholds, mappings, and links required by the fixtures.
- [ ] Compile the exact Stat entrypoint `public/app/plugins/panel/stat/module.tsx`; reject forbidden/unbounded imports and record internal Data/UI use.
- [ ] Convert Stat panel ID 2 with a SceneQueryRunner. Do not supply local mock `PanelData` in the acceptance path.
- [ ] Assert a real POST reaches `/grafana/api/ds/query` with correct datasource/dashboard/panel/ref/time fields.
- [ ] Assert SceneQueryRunner emits loading then done, Stat reduces last-not-null, applies percent unit, and selects the expected threshold/background color.
- [ ] Trigger manual refresh and assert a new request ID with no retained previous subscription.
- [ ] Switch time range/UID during `slow_query`; assert abort or stale suppression and no old result in the new panel.
- [ ] Unmount during `slow_query`; assert request/subscription cleanup.
- [ ] Use `server_error_500`; assert a classified panel-local query error while Text and the dashboard root remain responsive.
- [ ] Classify failures explicitly as datasource load, runtime setup, query execution, display processing, or visualization rendering.
- [ ] Run both Gate B Playwright files, cumulative unit tests, type check, build, and bundle inspection.
- [ ] Record D1/D2 identity and Gate B result.

**Expected result:** Gate B passes on D1 only when the exact Stat panel is driven by a real, cancellable Grafana TestData query and isolates failures to the panel.

**Proposed commit:** `feat: prove query-backed stat rendering`

**Gate boundary:** Stop before Task 12 if no real cancellable query path works, SceneQueryRunner cannot use explicit adapters, auth needs a browser secret/SDK backend, or query failure escapes the panel boundary. D2-only success permits diagnostic continuation but fixes the eventual decision at `REVISE` or `STOP`.

## Task 12: Bound the Time series module, processing, style, and asset closure

**Files:**

- Create: `packages/poc-grafana-bridge/src/panels/timeseries.ts`
- Create: `packages/poc-grafana-bridge/src/panels/timeseries.test.ts`
- Create: `packages/poc-compat/src/registries/installTransformers.ts`
- Create: `packages/poc-compat/src/registries/installTransformers.test.ts`
- Create: `packages/poc-compat/src/theme/styleModes.ts`
- Create: `packages/poc-compat/src/theme/styleModes.test.ts`
- Create: `packages/poc-compat/src/theme/poc-panel.css`
- Modify: `packages/poc-grafana-bridge/src/panels/catalog.ts`
- Modify: `apps/poc-host/vite.config.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Primary import: `public/app/plugins/panel/timeseries/module.tsx` plus exact current visualization closure.
- Consumes: public/deprecated `renameByRegexTransformer`, minimum field registry, uPlot CSS, theme, fonts/icons, portal and asset base.
- Produces: exact `timeseries` `PanelPlugin`, one admitted transformer ID, and three measured style modes: none, full-reference, minimum-scoped.

**Steps:**

- [ ] Complete L1-L4 before committing source or asset use.
- [ ] Write catalogue, transformer allowlist, unknown-transform, transform-throw, and style-reference-count tests first.
- [ ] Compile the exact Time series entrypoint and generate a complete source closure. Identify every `public/app`, `@grafana/data/internal`, `@grafana/ui/internal`, `@grafana/runtime/internal`, feature-flag, annotation/exemplar/alert, CSS, icon, font, and asset dependency.
- [ ] Fail if the closure includes application startup, routes, navigation, dashboard editing, or an unbounded general service/plugin map.
- [ ] If a bounded exact-version source-built artifact is required, follow Task 8A's L3 rules and label the final architecture at least `REVISE`.
- [ ] Do not replace GraphNG/current Time series with a graveyard component, simplified uPlot wrapper, or project-owned chart.
- [ ] Register only `renameByRegex`. Unknown transformer IDs fail preflight; a controlled throwing transformer yields a classified panel-local error in tests.
- [ ] Add uPlot CSS and test style reference counting.
- [ ] Exercise no-global, full Grafana `GlobalStyles` reference, and minimum-scoped modes. Measure host sentinel changes and choose the smallest mode that preserves correct Time series behavior for the POC.
- [ ] Serve approved Inter/Roboto Mono/icon/static assets from one base path and assert 200 responses, correct content types, and no fallback warnings. Record every asset under L4.
- [ ] Run narrow tests, source/bundle inspection, and forbidden-import checks before connecting the panel to the scene.

**Expected result:** The exact Time series renderer has a bounded, attributable source closure; the required transformer, field/display, CSS, font/icon, and asset dependencies are explicit.

**Proposed commit:** `spike: bound Grafana time series rendering closure`

**Stop point:** If the closure requires substantial shell/dashboard/edit code, non-isolatable internals, or a visualization reimplementation, mark Gate C `FAIL` and stop before Task 13.

## Task 13: Implement Gate C Time series rendering behavior

**Files:**

- Modify: `packages/poc-compat/src/scenes/convertFixtureV1.ts`
- Modify: `packages/poc-compat/src/registries/installFieldConfig.ts`
- Modify: `packages/poc-compat/src/runtime/acquirePocRuntime.ts`
- Modify: `apps/poc-host/src/App.tsx`
- Create: `tests/e2e/gate-c-timeseries.spec.ts`
- Create: `tests/e2e/gate-c-timeseries-visual.spec.ts`
- Create: `tests/e2e/support/visualReference.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: Time series panel ID 3, real TestData response, scene time range, `renameByRegex`, saved options/field config, exact plugin, approved style/assets.
- Produces: native Grafana Time series DOM/canvas with observable renamed series, legend, tooltip, threshold, and responsive plot.

**Steps:**

- [ ] Write Gate C browser assertions before adding panel ID 3 to conversion.
- [ ] Convert Time series targets, transformation, options, field configuration, datasource, and time range exactly from the controlled DTO.
- [ ] Assert component/source identity proves the current v13.2.3 Time series implementation.
- [ ] Assert deterministic series render through a real `/api/ds/query` request; no acceptance test may inject local frames.
- [ ] Assert request from/to values equal scene range. Change `now-1h` to `now-15m` and verify both request and visible plot change.
- [ ] Assert `renameByRegex` changes the displayed series name and saved line/fill/legend/tooltip/threshold/unit settings visibly apply.
- [ ] Exercise tooltip, legend, focus, and keyboard behavior without Grafana chrome or internal navigation.
- [ ] Resize the container from 1200 px to 600 px and back. Assert plot dimensions track within one animation frame after observer delivery and no stale observer remains.
- [ ] Trigger manual refresh and assert clean data replacement without overlapping retained subscriptions.
- [ ] Capture the same panel in the pinned Grafana server and POC using the same Chromium build, masks, viewport, time range, and deterministic query. Require no missing required assets and at most 2% differing pixels in stable masked regions.
- [ ] Run accessibility checks and document reviewed deviations.
- [ ] Run Gate C behavior/visual Playwright files, cumulative tests, build, and bundle inspection.
- [ ] Record all evidence but do not mark Gate C complete until Task 14 passes.

**Expected result:** The exact Grafana Time series visualization renders query-backed, transformed, styled, interactive data in native DOM/canvas and responds correctly to time and size changes.

**Proposed commit:** `feat: render exact Grafana time series panel`

## Task 14: Verify Gate C cleanup, UID changes, and two-instance isolation

**Files:**

- Create: `tests/e2e/gate-c-lifecycle.spec.ts`
- Create: `tests/e2e/gate-c-two-instances.spec.ts`
- Create: `tests/e2e/gate-c-failures.spec.ts`
- Modify: `packages/poc-compat/src/component/GrafanaDashboard.tsx`
- Modify: `packages/poc-compat/src/scenes/sceneLifecycle.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: primary/alternate UID, runtime reference counting, generation guard, query/plugin promises, resource instrumentation.
- Produces: final Gate C lifecycle verdict.

**Steps:**

- [ ] Write lifecycle tests for initial mount, refresh, time-range change, rapid UID change during `slow_query`, unmount, remount, and valid recovery after invalid UID.
- [ ] Run 20 mount/unmount and 20 UID-change cycles. Assert no monotonic increase in retained scene roots, subscriptions, timers, RAF, observers, listeners, portals, or style elements.
- [ ] Assert late dashboard/plugin/query completion cannot update a newer generation.
- [ ] Mount two dashboards that share one runtime and cached plugin promise. Give them independent time ranges, refreshes, errors, and instance IDs; assert no cross-talk.
- [ ] Attempt a second incompatible Grafana base path/runtime fingerprint and assert deterministic `runtime-conflict` without overwriting globals.
- [ ] Inject missing panel, datasource-load, query, and transformation failures. Assert exact boundaries and sibling survival.
- [ ] Reconfirm zero iframe observations and zero calls/imports for GrafanaApp, routes, navigation, or chrome over the complete lifecycle suite.
- [ ] Run all Gate C Playwright files serially and then in the configured complete suite.
- [ ] Run `corepack yarn build:poc`, bundle inspection, and `corepack yarn why react react-dom`.
- [ ] Mark Gate C `PASS` only when Task 13 rendering and Task 14 lifecycle assertions both pass. Otherwise apply the Gate C STOP rules.

**Expected result:** Gate C proves the core architecture only if the exact Time series behavior and cleanup/two-instance model both pass.

**Proposed commit:** `test: verify time series lifecycle isolation`

**Gate boundary:** Any Gate C failure is a POC `STOP`. `REVISE` is available only when Gate C succeeds and a bounded packaging, datasource, style, singleton, version, bundle, or licensing issue remains. Gate C may never be waived.

## Task 15: Run optional Gate D — Table diagnostic

Run only after Gate C passes and the maintainers still need Table evidence for scope decisions.

**Files:**

- Create: `packages/poc-grafana-bridge/src/panels/table.ts`
- Create: `packages/poc-grafana-bridge/src/panels/table.test.ts`
- Modify: `packages/poc-grafana-bridge/src/panels/catalog.ts`
- Modify: `packages/poc-compat/src/scenes/convertFixtureV1.ts`
- Create: `tests/e2e/gate-d-table.spec.ts`
- Modify: `docs/architecture/research/poc-results.md`

**Interfaces:**

- Consumes: optional Table panel ID 4, real TestData table response, exact Table plugin, host external-link callback.
- Produces: diagnostic verdict for field organization, table/grid UI closure, links, accessibility, style, and cleanup.

**Steps:**

- [ ] Complete L1-L4 for Table source, grid CSS, hooks, and assets.
- [ ] Compile `public/app/plugins/panel/table/module.tsx`, record application/internal closure, and apply the same forbidden-import rules.
- [ ] Add only the Table fixture's field order, display names, units, thresholds, sorting, and external HTTPS link.
- [ ] Route external links through a host callback. Do not initialize Explore or Grafana navigation.
- [ ] Test sorting, resizing, keyboard navigation, virtualization/observer cleanup, portal behavior, CSS containment, links, and accessibility.
- [ ] Run the Gate D browser test and bundle inspection.
- [ ] Record `PASS`, `FAIL`, or `DEFERRED`. An isolated failure narrows supported panel scope but does not retroactively fail Gate C.

**Expected result:** Table evidence either extends the supported experiment surface or identifies a cleanly isolated unsupported panel class.

**Proposed commit:** `spike: evaluate native table panel rendering`

## Task 16: Complete failure coverage and publish the POC evidence decision

**Files:**

- Create: `tests/e2e/failure-matrix.spec.ts`
- Create: `tests/e2e/no-shell-invariants.spec.ts`
- Modify: `docs/architecture/research/poc-results.md`
- Modify: `docs/development/local-development.md`

**Interfaces:**

- Consumes: all completed gate evidence and licensing checkpoint records.
- Produces: final `PROCEED`, `REVISE`, or `STOP` research decision; does not authorize production implementation.

**Steps:**

- [ ] Cover invalid UID, unauthorized, forbidden, unsupported V2, unsupported/old V1 schema, malformed DTO, missing panel module, datasource-load failure, query failure, missing/throwing transform, unsupported options, and missing required asset.
- [ ] Assert discovery failure is not misclassified as dashboard-not-found and no error triggers the legacy dashboard endpoint.
- [ ] Assert no iframe appears and no shell/router/navigation/chrome/app-entry module appears in development or production-build evidence.
- [ ] Run the complete unit, integration, browser, type, and build suite.
- [ ] Re-run the immutable install and exact dependency identity checks.
- [ ] Review HARs, traces, reports, and screenshots for secrets before retaining any sanitized evidence.
- [ ] Complete L6 with the exact unpublished/internal source and asset inventory. Record review status without making a legal conclusion.
- [ ] Fill every field in the decision template from the approved POC design, including gate results, D1/D2/P1/P2 identities, bundle sizes, global side effects, blockers, and production authorization `NO`.
- [ ] Choose `PROCEED` only if Gates A, B on the primary path, and C pass with no STOP condition.
- [ ] Choose `REVISE` when Time series proof succeeds but a bounded packaging, datasource, styling, singleton, version, bundle, or licensing boundary remains.
- [ ] Choose `STOP` when Gate A or Gate C fails, a core constraint must be abandoned, or a fundamental lifecycle/security/source-closure blocker remains.
- [ ] Update local-development documentation with the exact proven commands and known platform limitations.

**Verification commands:**

```bash
corepack yarn install --immutable
corepack yarn typecheck
corepack yarn test:unit
corepack yarn test:integration
corepack yarn playwright test --project=chromium
corepack yarn build:poc
corepack yarn inspect:bundle
corepack yarn why react react-dom @grafana/scenes @grafana/data @grafana/ui @grafana/runtime
docker compose -f dev/grafana/compose.yaml config --quiet
```

**Expected result:** The repository contains reproducible evidence and an honest architecture decision. It still contains no production SDK implementation or distribution decision.

**Proposed commit:** `docs: record native rendering poc decision`

---

## Final implementation acceptance checklist

- [ ] The existing dashboard was selected by the user-facing UID `grsdk-phase0-poc` and retrieved from Grafana.
- [ ] The accepted response was V1 schema 42; V2 produced a typed unsupported result.
- [ ] No iframe was observed at any point.
- [ ] No Grafana app entrypoint, shell, router, navigation, chrome, or `GrafanaApp.init` was used.
- [ ] Text, Stat, and Time series were exact Grafana 13.2.3 panel implementations.
- [ ] Stat and Time series used a real Grafana TestData query path, not mocked PanelData.
- [ ] Gate C demonstrated time range, refresh, transformation, field config, styling, interaction, and resize behavior.
- [ ] UID change, cancellation, unmount, remount, repeated churn, and two-instance tests passed.
- [ ] Runtime singletons accepted one compatible page identity and rejected an incompatible one.
- [ ] Required styles/assets were attributed, loaded, contained, and recorded.
- [ ] Every unpublished/internal source or asset use was inventoried for licensing review.
- [ ] Evidence was sanitized and contains no credentials or private data.
- [ ] The final decision is `PROCEED`, `REVISE`, or `STOP`, and production work remains separately unauthorized.

## Production boundary

All code described here is disposable research code. It may contain fixed fixture assumptions, direct source aliases, instrumentation, exact-version patches, private Runtime setters, and narrow adapters that are unsuitable for a public SDK.

A successful POC authorizes only a separate production-architecture proposal. It does not authorize publishing the source bridge, distributing Grafana application code/assets, stabilizing the experimental component, or copying the POC structure into a production package.
