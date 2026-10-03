# Minimal Standalone Rendering POC Design

## Status

Design complete; implementation has not started.

This document defines a disposable, controlled experiment. It does not define the production SDK implementation, authorize distribution of Grafana application code, or supersede the project ADRs.

## Document metadata

| Item | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 8 |
| Grafana baseline | OSS `v13.2.3` |
| Grafana commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Scenes baseline | `@grafana/scenes@8.13.5` |
| Decision scope | Whether to implement a disposable standalone-rendering POC |
| Required proof | A query-backed, dashboard-derived Grafana Time series panel rendered in the native host DOM |
| Initial recommendation | **PROCEED to the gated POC; do not proceed to production SDK work on Text or Stat evidence alone** |

## Decision to be tested

The POC must prove or disprove this statement:

> An independent React application can accept a user-facing Grafana dashboard UID, retrieve the corresponding Grafana OSS 13.2.3 dashboard, convert the supported dashboard subset into a Scenes graph, execute its saved queries, and render the real Grafana Time series visualization into the host DOM without an iframe or the Grafana application shell.

The experiment is deliberately narrow. It supports one Grafana version, one origin, one controlled datasource, one V1 dashboard fixture, four known built-in panel IDs at most, and one shared page runtime. It does not claim arbitrary-dashboard, arbitrary-plugin, or arbitrary-datasource compatibility.

## Evidence vocabulary

- **Verified prerequisite**: established by the pinned package manifest, source, test, or earlier Phase 0 investigation.
- **Experiment decision**: a deliberate POC constraint chosen to isolate risk; it is not a production commitment.
- **Hypothesis**: a claim that must be proved by a gate.
- **Unresolved blocker**: an issue that can invalidate or force revision of the architecture.
- **Kill condition**: a result that stops later gates until the architecture is revised.

## Non-negotiable constraints

The POC must preserve all of these constraints:

- no iframe at any point in the DOM lifecycle;
- no `GrafanaApp.init`, Grafana route tree, Grafana navigation, or Grafana chrome;
- no project-owned backend and no authentication system owned by this project;
- no service-account token, API key, or other long-lived secret in browser code;
- dashboard selection starts with the user-facing Grafana dashboard UID;
- rendering uses native React and DOM/canvas output in the host document;
- Grafana-native panel implementations and behavior are used where the experiment claims native fidelity; and
- Grafana package and application-source types do not become the public SDK contract.

Dashboard editing, panel editing, Explore, alerting UI, dashboard navigation, arbitrary external plugins, library panels, annotations, live streaming, repeated rows/panels, and multiple Grafana origins are outside this POC.

## Verified prerequisites

1. The pinned server baseline is Grafana OSS `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e`.
2. The user-facing dashboard UID is the resource `metadata.name`. It is the `{identifier}` in `/apis/.../dashboards/{identifier}/dto`; it is not Kubernetes-style `metadata.uid`.
3. `@grafana/scenes@8.13.5` publicly exports `SceneObjectBase`, `SceneTimeRange`, `SceneVariableSet`, `SceneGridLayout`, `SceneGridItem`, `SceneQueryRunner`, `SceneDataTransformer`, `VizPanel`, and `loadResources`. It does not retrieve or convert saved dashboards.
4. `VizPanel` asks Runtime plugin-import utilities for a `PanelPlugin` and renders it through Grafana UI panel chrome and contexts.
5. `@grafana/runtime@13.2.3` publicly exports setters for `BackendSrv`, `DataSourceSrv`, `runRequest`, plugin-import utilities, application events, and `TemplateSrv`; those APIs mutate process-wide module singletons.
6. Runtime `config` is constructed from `window.grafanaBootData` during module evaluation. There is no supported, instance-scoped Runtime container.
7. `@grafana/data@13.2.3` exports the data, display, field-configuration, transformation-registry, and panel contracts needed by Scenes. The standard transformation and standard field-config registries require initialization normally performed by application code.
8. `@grafana/ui@13.2.3` supplies `PanelChrome`, theme support, Emotion-based styling, visual primitives, portals, and global styles. Correct rendering also depends on fonts, icons, uPlot styles, and browser APIs.
9. Text, Stat, Time series, and Table panel implementations are under Grafana's unpublished `public/app` source. Time series and Table have additional unpublished/internal dependencies.
10. The stable V1 and V2 dashboard DTO endpoints exist at the pinned baseline. Grafana's V1 and V2 dashboard-to-Scenes converters are application-owned and unpublished.
11. The current V1 schema default at the pinned source is `schemaVersion: 42`.
12. Grafana's built-in TestData datasource exposes deterministic `predictable_pulse` and `predictable_csv_wave` scenarios. Its frontend module is application-owned and its backend is present in Grafana OSS.

## POC hypotheses

| ID | Hypothesis | Gate |
| --- | --- | --- |
| H1 | The required Scenes subset runs correctly on one deduplicated React 19.2.8 runtime despite Scenes 8.13.5 declaring React 18 peers. | A |
| H2 | Runtime globals can be populated explicitly before scene activation without `GrafanaApp.init`. | A |
| H3 | A pinned Grafana Text `PanelPlugin` can be supplied through a fixed importer and render with usable theme/style fidelity. | A |
| H4 | Scene activation and React unmount release scene-owned work without resetting page-global Runtime singletons. | A |
| H5 | A controlled `BackendSrv`, `DataSourceSrv`, and `runRequest` path can execute a saved TestData query with cancellation. | B |
| H6 | The real Stat panel consumes the resulting `PanelData` and field/display configuration outside the shell. | B |
| H7 | The exact v13.2.3 Time series panel and its current chart dependency graph can be built, loaded, styled, and resized independently. | C |
| H8 | A current-schema V1 DTO can be converted into the minimum correct Scenes graph without instantiating application `DashboardModel` or `DashboardScene`. | A-C |
| H9 | A fixed, source-built plugin catalogue is more controllable than Grafana's application SystemJS/importer path. | A-C |
| H10 | One page-scoped compatibility runtime can serve two mounted dashboards without cross-talk. | C |

## Experiment design decisions

| Decision | POC choice | Production implication |
| --- | --- | --- |
| Dashboard family | Render only current-schema V1; discover and classify V2 but return a typed unsupported result | V2 and legacy V1 migration remain separate compatibility work |
| Scene root | Project-owned `SceneObjectBase` root with public Scenes primitives | Avoids application `DashboardScene` and `EmbeddedScene`'s window-global context |
| Panel scope | Text, Stat, required Time series, optional Table | Does not imply arbitrary built-in or external plugin support |
| Panel loading | Exact-tag source experiment and closed compile-time catalogue | Production distribution and upgrade strategy remain undecided |
| Datasource | Built-in TestData with deterministic scenarios | Proves one real query path, not general datasource compatibility |
| Runtime scope | One page-global compatibility runtime, one Grafana origin | Independent runtimes/origins are deferred because Runtime is singleton-backed |
| Network/auth | Same-origin host-managed development proxy and browser session | Cross-origin deployment remains a later host-integration problem |
| Styling | Light DOM with measured full/minimal/no-global-style variants | Final containment strategy waits for evidence |
| Bundler | Vite 8 with explicit aliases, deduplication, and module inspection | Bundler is replaceable; hidden dependencies must remain observable |
| Code lifetime | Instrumented disposable POC | Passing code is not promoted directly into the SDK |

## Exact environment and version matrix

### Server and source baseline

| Component | Exact selection | Reason and verification |
| --- | --- | --- |
| Grafana source | tag `v13.2.3`; commit `6193dc03311b631b9727b560d24369e683dc396e` | Same source baseline as Workstreams 1-7 |
| Grafana image | `grafana/grafana:13.2.3` on `linux/amd64` | `grafana/grafana` is the official OSS image repository from Grafana 12.4 onward; the old `grafana/grafana-oss` repository is no longer updated |
| Immutable image reference | `grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` | Platform manifest returned by Docker Hub for `linux/amd64` on 2026-10-03; implementation must fail if the resolved digest differs |
| Server storage | disposable local SQLite volume | Simplest controlled state; no production data |
| Dashboard API | discovery plus stable V1 `/dto` first | Matches the pinned browser API investigation |
| Namespace | `default` | Explicit POC default; configurable by host input |
| Datasource | provisioned TestData, UID `grsdk-testdata` | Deterministic data, server-side query path, no external service |
| Primary dashboard UID | `grsdk-phase0-poc` | One deterministic feature fixture |
| UID-switch fixture | `grsdk-phase0-poc-alt` | Minimal lifecycle-only clone used to prove a valid UID change |

The implementation must record `/api/health`, discovery output, image reference, platform, and resolved digest in the evidence report. The image is not pulled and no Docker configuration is created by this design workstream.

### Browser host and tooling

| Component | Exact selection | Reason |
| --- | --- | --- |
| Node.js | `22.23.3` | Satisfies Grafana's declared `>=22 <25` range and is an LTS release |
| Package manager | Yarn `4.17.1` | Matches the pinned Grafana repository |
| TypeScript | `6.0.2` | Exact compiler resolved by the pinned Grafana repository |
| React | `19.2.8` | Exact Grafana 13.2.3 runtime; required by Grafana 13 packages |
| React DOM | `19.2.8` | Must resolve to the same single runtime as React |
| Vite | `8.2.0` | Small independent host, explicit aliases/deduplication, native ESM development, Rollup module report, and controllable dev proxy |
| Vite React plugin | `@vitejs/plugin-react@6.1.1` | React 19-compatible Vite 8 integration |
| Test runner | `@playwright/test@1.56.1` | Matches the pinned Grafana repository's browser-test version |
| Test browser | Chromium `141.0.7390.37`, Playwright build `1194` | Fixed visual, DOM, network, and lifecycle evidence target |
| `@grafana/data` | `13.2.3` | Pinned cohort |
| `@grafana/ui` | `13.2.3` | Pinned cohort |
| `@grafana/runtime` | `13.2.3` | Pinned cohort |
| `@grafana/schema` | `13.2.3` | Pinned cohort |
| `@grafana/i18n` | `13.2.3` | Pinned cohort and public translation bootstrap |
| `@grafana/e2e-selectors` | `13.2.3` | Scenes peer and stable selectors where applicable |
| `@grafana/scenes` | `8.13.5` | Exact baseline selected in Workstream 1 |
| RxJS | `7.8.2` | Matches Grafana and satisfies Scenes |
| Emotion | `@emotion/css@11.13.5`; `@emotion/react@11.14.0` | Exact Grafana versions; avoids multiple Emotion copies |
| uPlot | `1.6.32` | Exact Grafana chart dependency |
| Scenes router peer | `react-router-dom@6.30.3` | Satisfies Scenes; the POC must not create a router or use `SceneApp` |

There is no formally compatible React version across the pinned packages: Scenes 8.13.5 declares `react` and `react-dom` `^18.0.0`, while Grafana 13.2.3 Data, UI, and Runtime declare `>=19`. The experiment uses React 19.2.8 because panel code and Grafana packages are the primary baseline. A package-manager peer override may silence installation diagnostics, but it does not prove compatibility. Gate A must fail on duplicate React, hook errors, or Scenes lifecycle incompatibility.

Vite is an experiment decision, not a production bundler decision. Its module graph, `resolve.alias`, `resolve.dedupe`, plugin hooks, and build manifest make hidden application-shell imports and duplicate runtimes observable. Webpack would more closely resemble Grafana's own build but would hide whether a standalone ESM-oriented host is viable.

## Controlled deployment and authentication model

The browser sees one origin: `http://localhost:5173`.

- The React host is served at `/`.
- A host-managed Vite development proxy maps `/grafana/*` to the local Grafana container on port 3000 and preserves the `/grafana` prefix.
- Grafana uses `GF_SERVER_ROOT_URL=http://localhost:5173/grafana/` and `GF_SERVER_SERVE_FROM_SUB_PATH=true` so server links, cookies, and assets agree with the browser-visible path.
- `GF_AUTH_ANONYMOUS_ENABLED=false`; local credentials are supplied interactively or through developer-owned environment configuration that is never committed.
- The tester signs in through the proxied Grafana login route. The browser owns the Grafana session cookie.
- SDK requests use relative URLs and `credentials: "include"`.
- The proxy does not add an API key, service-account token, or authorization header.
- Authentication remains a host/deployment responsibility. The proxy is development infrastructure, not an SDK backend.

This arrangement avoids a CORS experiment in Phase 0 and exercises cookie, SameSite, CSRF, and subpath behavior in a realistic same-origin deployment. Cross-origin Grafana, multiple Grafana origins, auth proxy integration, and token-based browser authentication are deferred.

## Architecture diagram

```text
Independent React host
┌──────────────────────────────────────────────────────────────────────┐
│ <GrafanaDashboard uid="grsdk-phase0-poc" />                         │
│   │                                                                  │
│   ├─ host config: basePath, namespace, fetch policy, asset base      │
│   │                                                                  │
│   ├─ DashboardClient adapter                                         │
│   │    GET API discovery                                             │
│   │    GET stable V1 dashboard DTO                                   │
│   │    validate metadata.name == requested UID                       │
│   │                                                                  │
│   ├─ DashboardClassifier                                             │
│   │    V1/schema 42 accepted                                         │
│   │    V2/legacy/unknown -> typed unsupported result                 │
│   │                                                                  │
│   ├─ V1CompatibilityConverter                                        │
│   │    scene time + constant variable + grid layout                  │
│   │    VizPanel + SceneDataTransformer + SceneQueryRunner            │
│   │                                                                  │
│   └─ page-scoped CompatibilityRuntime                                │
│        ├─ boot/config projection + one Grafana identity              │
│        ├─ BackendSrv adapter ───────────────┐                         │
│        ├─ DataSourceSrv + runRequest        ├─> /grafana/api/ds/query │
│        ├─ event bus + TemplateSrv           │                         │
│        ├─ fixed panel/datasource catalogues │                         │
│        ├─ transform/field registries        │                         │
│        └─ theme/i18n/style/asset providers  │                         │
│                                              │                         │
│   Scenes activation -> VizPanel -> PanelPlugin -> React component    │
│       -> @grafana/ui / display processing -> native DOM/canvas       │
└──────────────────────────────────────────────────────────────────────┘
                                               │
                                               v
                                 Grafana OSS 13.2.3 container
                         dashboard DTO, frontend settings, query proxy

Explicitly absent: iframe, GrafanaApp.init, Grafana router, nav, chrome,
dashboard edit model, plugin catalogue UI, and SDK-owned authentication.
```

## Compatibility boundary

The POC has five internal layers. Only the first layer resembles a future public API.

| Layer | Responsibility | Grafana types exposed publicly? |
| --- | --- | --- |
| Host boundary | `uid`, Grafana base path, namespace, theme preference, request hook, link callback, error callback | No |
| Retrieval | discovery, DTO request, response validation, typed network/auth/version errors | No |
| Conversion | accepted DTO subset to project-owned scene-root construction instructions | No |
| Compatibility runtime | singletons, services, catalogues, registries, theme, i18n, styles, assets, lifecycle accounting | No |
| Renderer | activate scene, mount panel graph, isolate failures, deactivate and release | No |

`DashboardDTO`, `PanelPlugin`, `PanelData`, `DataFrame`, `SceneObject`, Runtime service interfaces, and registry items remain implementation details. The POC may use them internally but must not turn them into a proposed public SDK surface.

## Initialization sequence

The order is part of the experiment. No step may be summarized as “initialize Grafana.”

1. **Validate host input.** Require a non-empty dashboard UID, relative Grafana base path, `default` namespace, mount element, and host-owned request behavior. Reject credentials in configuration.
2. **Install instrumentation before Grafana imports.** Start iframe detection, console capture, timer/listener/observer accounting, fetch tracing, and module-graph capture.
3. **Create the boot-data prelude before importing Runtime.** Populate the minimum `window.grafanaBootData.settings` projection required by `@grafana/runtime`: app URL/subpath, build version, feature toggles fixed for the fixture, locale/timezone defaults, datasource metadata placeholder, panel metadata placeholder, and public asset base. No user token or secret is included.
4. **Dynamically import the pinned Grafana cohort once.** Assert package versions and React identity. Vite must deduplicate React, React DOM, Emotion, RxJS, and Grafana packages.
5. **Create one theme identity.** Build a light `GrafanaTheme2`, assign the same object to Runtime `config.theme2`, and pass it through Grafana UI `ThemeContext`. A dark-theme rerun is diagnostic, not a separate gate.
6. **Initialize English i18n.** Call public `initPluginTranslations("grafana-scenes", [loadResources])` before rendering. Record any pre-initialization warning. Non-English locales are deferred.
7. **Install the backend transport.** Call `setBackendSrv` with the structural adapter described below. It uses the host request policy, relative Grafana base path, credentials inclusion, typed errors, request IDs, and abort signals.
8. **Install application events.** Create one `EventBusSrv` for the page runtime and call `setAppEvents`. Expose only the events observed by supported panels.
9. **Install template replacement.** Call `setTemplateSrv` with a constrained adapter for the fixture's constant variable and Grafana built-in scoped variables. Unknown formats fail preflight instead of being left silently unresolved.
10. **Load datasource metadata.** Request `/api/frontend/settings`, select datasource UID `grsdk-testdata`, validate type `grafana-testdata-datasource`, and place the sanitized settings in the runtime catalogue.
11. **Install the datasource service.** Call `setDataSourceSrv` with a fixed-UID implementation that returns only the POC TestData instance and its settings. No general plugin discovery is implied.
12. **Install query execution.** Call `setRunRequest` with an Observable-based runner that calls the selected datasource, emits Grafana `LoadingState` transitions, and connects unsubscribe to `AbortController` or datasource cancellation.
13. **Initialize transformations.** Configure `standardTransformersRegistry` with the exact public/deprecated `standardTransformers.renameByRegexTransformer` used by the fixture. Reject every unregistered transformation ID before scene activation.
14. **Initialize standard field configuration.** Register only the descriptors required by the four fixtures: display name, unit, decimals, min/max, color, no-value text, thresholds, mappings, and links. Compare these descriptors with application `getAllStandardFieldConfigs`; any adapted application source is separately recorded for licensing review.
15. **Install fixed plugin import utilities.** Call `setPluginImportUtils` with an allowlist for `text`, `stat`, `timeseries`, and optionally `table`. Each importer returns a cached promise for one exact `PanelPlugin` plus normalized metadata. It must never fall through to SystemJS or a server-provided arbitrary module URL.
16. **Create DOM infrastructure.** Add one reference-counted portal container, font declarations, uPlot/global-style candidate, icon/public-path policy, and host panel root. Verify browser APIs before activation.
17. **Discover and retrieve the dashboard.** Execute the versioned request sequence below and validate identity, version family, schema version, panel IDs, datasource UIDs, variables, transformations, and unsupported features.
18. **Convert the accepted DTO.** Build the minimal project-owned scene root and supported panel graph. Do not instantiate Grafana's application `DashboardModel` or `DashboardScene`.
19. **Mount once.** Render the scene component through React DOM. Let the Scenes React wrapper own activation; do not also call manual activation for the same object.
20. **Dispose in reverse ownership order.** Unmount the React root, allow scene deactivation, cancel active requests, release portal/style references, remove host listeners, and discard the scene graph. Keep the page-scoped Runtime singletons alive until the final SDK instance on the page is gone; do not attempt unsupported singleton reset between ordinary mounts.

## Compatibility runtime responsibilities

| Concern | Exact POC responsibility | Ownership | Gate |
| --- | --- | --- | --- |
| Config/bootstrap | Pre-import `grafanaBootData` projection; post-import assertion of `config`; one theme and asset base | POC-only compatibility adapter | A |
| Backend transport | Relative-URL request, credentials inclusion, response decoding, typed errors, abort propagation, request tracing | SDK adapter using host request policy | B |
| Datasource service | Fixed settings catalogue and instance cache for `grsdk-testdata` | SDK adapter | B |
| Query execution | Observable lifecycle, request enrichment, state transitions, cancellation, refresh semantics | SDK adapter | B |
| Events | One page-scoped `EventBusSrv`; document observed event types | SDK adapter | A-C |
| Panel resolution | Fixed compile-time allowlist, metadata attachment, promise cache, failure boundary | Compatibility artifact | A-C |
| Theme/provider | One `GrafanaTheme2` shared by Runtime config and `ThemeContext` | SDK provider adapter | A |
| i18n | Public English initialization plus Scenes resource loader | SDK bootstrap adapter | A |
| Transformations | One explicit transformer in Gate C; unknown IDs are errors | SDK registry adapter | C |
| Field config | Minimum required descriptors; display processors remain `@grafana/data` | SDK registry adapter | B-C |
| Location/URL | No router and no URL synchronization; location calls must be absent or intercepted as unsupported | Safely omitted with guard | A-C |
| Template variables | One constant variable and scoped built-ins only | SDK adapter | B-C |
| Assets/public path | Single host asset base for fonts/icons; build-time panel assets fingerprinted by Vite | Host config plus SDK adapter | A-C |
| Portals | One reference-counted `#grafana-portal-container` in the host document | SDK DOM adapter | A-C |
| Runtime singleton lifetime | One runtime per page, shared by all POC dashboard mounts and one Grafana origin | SDK runtime manager | A-C |

## Dashboard API and network request sequence

```text
Host renders <GrafanaDashboard uid="grsdk-phase0-poc" />
  1. GET /grafana/apis/dashboard.grafana.app/
       -> record advertised V1 and V2 resources/versions
  2. GET /grafana/apis/dashboard.grafana.app/v1/namespaces/default/
         dashboards/grsdk-phase0-poc/dto
       -> validate apiVersion, kind, metadata.name, access, spec
  3. classify V1 + schemaVersion 42 + accepted feature inventory
       -> V2 or older schema: typed unsupported error for this POC
  4. GET /grafana/api/frontend/settings
       -> locate datasource UID grsdk-testdata and asset/app settings
  5. build minimum Scenes graph and resolve allowlisted panel modules
       -> panel modules come from the local exact-source experiment,
          not an arbitrary remote module URL
  6. POST /grafana/api/ds/query
       -> TestData predictable_pulse / predictable_csv_wave / table_static
       -> PanelData -> transform -> display -> panel React component
  7. browser requests approved font/icon/static assets from one configured base
```

Folder display metadata, annotation events, library-panel definitions, plugin catalogue pages, variable-query results, and live channels are intentionally absent. The fixture must contain none of those dependencies. The legacy `/api/dashboards/uid/{uid}` endpoint is not a fallback.

### Error classification at retrieval

| Observation | POC error |
| --- | --- |
| HTTP 401 | `DashboardUnauthorized` |
| HTTP 403 | `DashboardForbidden` |
| HTTP 404 | `DashboardNotFound` |
| Discovery lacks usable V1 | `DashboardApiVersionUnsupported` |
| V1 response identifies a V2 conversion requirement | `DashboardVersionUnsupported` with discovered V2 details |
| `metadata.name` differs from requested UID | `DashboardIdentityMismatch` |
| Invalid envelope, missing spec, or invalid panel structure | `DashboardResponseMalformed` |
| Unsupported schema, layout, variable, datasource, transform, or panel ID | `DashboardFeatureUnsupported` with JSON path |
| Fetch/timeout/abort not caused by replacement or unmount | `DashboardNetworkFailure` |

An aborted stale request is lifecycle evidence, not a user-facing network failure.

## Fixture definition

### Provisioning rules

The implementation phase will provision sanitized, synthetic files into the disposable container. This document does not create those files.

- The canonical fixture is authored directly at V1 `schemaVersion: 42`; legacy dashboard migration is not part of the acceptance path.
- It has no annotations, library panels, repeated rows, repeated panels, shared queries, alerts, live streams, dashboard links, or external plugin IDs.
- It uses time range `now-1h` to `now`, timezone `browser`, and manual refresh by default. An explicit 5-second refresh test is enabled only during the refresh scenario.
- It has one constant variable named `environment` with value `phase0`. The value appears in a panel title/label so interpolation is observable without a variable query.
- Every query references datasource `{ type: "grafana-testdata-datasource", uid: "grsdk-testdata" }` explicitly.
- Panel IDs, positions, options, field configuration, queries, and expected observable results are fixed and committed only when POC implementation is authorized.

### Panels

| Panel | Fixture contract | Purpose |
| --- | --- | --- |
| Text, ID 1 | plugin `text`; legacy v1 Markdown mode; sanitized static text containing `phase0`; no targets | Narrowest real query-free panel and sanitization/style proof |
| Stat, ID 2 | plugin `stat`; TestData `predictable_pulse`; last-not-null reduction; unit `percent`; thresholds at 50 and 80; color mode background | Query, `PanelData`, reduction, units, thresholds, mappings, refresh, cancellation |
| Time series, ID 3 | plugin `timeseries`; TestData `predictable_pulse` with fixed on/off values and one-second step; legend and tooltip enabled; line width/fill/threshold options; one `renameByRegex` transform | Required architecture proof: current Grafana chart, time range, transforms, field config, resize, interaction |
| Table, ID 4 | plugin `table`; TestData `table_static` or fixed CSV content; field ordering, units, thresholds, one external HTTPS link | Optional complex display/link/UI diagnostic |

`predictable_pulse` is selected because its cycle is based on absolute epoch time and aligns points to the configured step. It is deterministic for a fixed requested range and exercises Grafana's backend datasource query endpoint. `random_walk` is not acceptable as the primary fixture because it introduces avoidable output variance.

The lifecycle-only fixture `grsdk-phase0-poc-alt` contains the same Text panel with a different sentinel string. It exists solely to distinguish a completed valid UID change from stale output; it is not a second feature matrix.

## Dashboard conversion design

### Accepted V1 path

The POC implements a constrained compatibility conversion, not Grafana's full application serializer:

1. Accept only the V1 DTO family advertised by discovery.
2. Validate `metadata.name` against the requested dashboard UID and retain generation/resource-version metadata for diagnostics.
3. Require `spec.schemaVersion === 42`. Reject older versions instead of importing `DashboardModel` and `DashboardMigrator` into the first POC.
4. Reject unknown top-level behaviors and unsupported panel, datasource, variable, transform, repeat, library-panel, annotation, or link features before creating scenes.
5. Construct a project-owned root derived from public `SceneObjectBase`; do not use application `DashboardScene`. The root owns one `SceneTimeRange`, one `SceneVariableSet`, and one `SceneGridLayout`.
6. Map each accepted classic `gridPos` to `SceneGridItem` and each supported panel to `VizPanel` with plugin ID, title, description, transparency, options, field configuration, links, and time overrides.
7. Text receives no data provider.
8. Query-backed panels receive `SceneQueryRunner` for targets and datasource reference. When transformations are present, wrap the runner with `SceneDataTransformer` using the validated transform list.
9. Preserve panel ID and dashboard UID in query request context. Preserve `maxDataPoints`, interval, time range, scoped variable values, and request/app identifiers required by the datasource path.
10. Allow `VizPanel` to run exact panel-option migration only when the loaded plugin supports the fixture's declared plugin version. A migration outside the pinned fixture is unsupported.

Grafana application source is the behavioral reference:

- `public/app/features/dashboard-scene/serialization/transformSaveModelToScene.ts`;
- `public/app/features/dashboard-scene/utils/createPanelDataProvider.ts`;
- `public/app/features/dashboard-scene/scene/DashboardScene.tsx`; and
- `public/app/features/dashboard/state/DashboardModel.ts` and `DashboardMigrator.ts`.

The POC must record every semantic copied or adapted from those paths. It must not import the whole application converter merely to make the fixture work.

### V2 path

The POC discovers and classifies V2 but does not convert it. A V2 DTO produces a typed `DashboardVersionUnsupported` result with the selected API version and resource metadata. It is never parsed as V1 and does not fall back to the legacy endpoint.

This decision isolates native rendering from full V2 layout deserialization. If V1 Gate C passes, a later experiment may adapt the behavior of:

- `transformSaveModelSchemaV2ToScene`;
- `layoutDeserializerRegistry`; and
- `buildVizPanelState` in the V2 layout serializer utilities.

Those are unpublished application surfaces and require a separate technical and licensing review.

## Built-in panel distribution and loading experiments

Built-in panel availability is a feasibility gate, not an implementation detail hidden behind “load plugin.” Each gate adds exactly one entry to the fixed catalogue.

### Experiment P1: exact-source direct build

Use a clean checkout at `v13.2.3` and point explicit Vite aliases at the required panel entrypoints and transitive application paths. Resolve all `@grafana/*` imports to the single pinned package cohort in the host. Produce a module graph for each entrypoint:

- `public/app/plugins/panel/text/module.tsx` and the selected v1 Text module;
- `public/app/plugins/panel/stat/module.tsx`;
- `public/app/plugins/panel/timeseries/module.tsx`; and
- optionally `public/app/plugins/panel/table/module.tsx`.

For every panel, record direct application imports, package-internal imports, feature-flag reads, static assets, CSS, dynamic imports, and bundle size. The panel's `plugin.json` metadata is normalized into the fixed catalogue and its plugin version is pinned to 13.2.3.

P1 passes only if the module can be built without importing `public/app/app.ts`, application routes, navigation, dashboard shell, edit UI, or a general built-in plugin map.

### Experiment P2: source-built compatibility artifact

If direct aliases are too coupled, build a disposable local artifact with one entrypoint per admitted panel and explicit replacements for excluded application services. It may include the minimum exact-tag application code required by the real renderer, but it must:

- retain source paths and notices;
- produce a complete source/module inventory;
- avoid arbitrary deep imports from the host;
- expose only `PanelPlugin` loaders to the POC;
- remain tied to the exact Grafana commit; and
- not be published, committed as a binary, or treated as production architecture.

P2 is a technical experiment and a licensing checkpoint. It does not establish that the artifact may be distributed.

### Experiment P3: server-distributed module diagnostic

Inspect the running Grafana server's metadata and built assets to determine whether its built-in modules are independently loadable. Record module URLs, SystemJS expectations, webpack public-path/runtime coupling, translations, SRI/sandbox behavior, and cross-origin restrictions. Attempt loading only in the controlled environment.

P3 is diagnostic. A result that requires Grafana's webpack bootstrap, built-in plugin map, or application SystemJS environment does not pass the standalone requirement.

### Fixed importer acceptance rules

- The Runtime importer is a closed `text`/`stat`/`timeseries`/`table` map.
- Every load has start, success, failure, cache-hit, source revision, and module-identity telemetry.
- Unsupported panel IDs fail only their panel boundary and never trigger an arbitrary URL import.
- A component reimplemented from low-level primitives cannot pass Gate C as the real Grafana Time series visualization.
- Server-loaded or source-built code must be attributable to the exact commit.
- If Time series can be built only by including substantial application shell code, Gate C fails.

## Datasource strategy experiments

### Primary experiment D1: exact TestData frontend module

Build the pinned application datasource entrypoint `public/app/plugins/datasource/grafana-testdata-datasource/module.tsx`, instantiate its `TestDataDataSource`, and register it for UID `grsdk-testdata`. This exercises its template replacement and `DataSourceWithBackend` behavior before requests reach `/api/ds/query`.

D1 must record its unpublished imports and build boundary just like a panel module. The datasource package is private application source even though the server backend is part of Grafana OSS.

### Control D2: constrained backend-query adapter

If D1 fails, use a POC-only `DataSourceApi` adapter that sends the saved TestData targets to Grafana's `/api/ds/query` endpoint through the installed BackendSrv. This control answers whether transport, `SceneQueryRunner`, `PanelData`, and visualization rendering work independently of datasource frontend-module loading.

D2 cannot establish general datasource compatibility. It omits datasource-specific interpolation, supplementary requests, streaming, annotations, frontend transformations, editor logic, and resource APIs. A POC that reaches Gate C only through D2 can support **REVISE**, not an unqualified production **PROCEED**.

### Diagnostic D3: server plugin-module loading

Attempt the server's published module URL only to characterize SystemJS, public path, module metadata, and bundler coupling. It is rejected as the primary strategy if it needs the Grafana application loader or permits arbitrary plugin execution.

### Query controls

- `predictable_pulse` supplies deterministic Stat and Time series data.
- `slow_query` supplies an in-flight request for stale-request and unmount cancellation tests.
- `server_error_500` supplies a deterministic query failure.
- `table_static` or fixed `csv_content` supplies Table data.
- Every request must include datasource UID, panel ID, dashboard UID, ref ID, interval/max-data-points values, and the active time range where Grafana's request contract requires them.

## Style, theme, DOM, and asset strategy

The initial experiment uses light DOM. Shadow DOM is not a Gate A-C fallback because Grafana portals, global selectors, font declarations, and Emotion output would create a separate integration experiment.

### Theme

- Create one light `GrafanaTheme2` through the pinned UI theme factory behind a compatibility adapter.
- Store the same theme identity in Runtime `config.theme2` and UI `ThemeContext`.
- Render a dark-theme diagnostic only after Gate C; it is not required to decide architecture viability.

### Emotion and CSS

- Dedupe `@emotion/css` and `@emotion/react` to the exact matrix versions.
- Do not assume an Emotion `CacheProvider` captures `@emotion/css` output.
- Compare three measured modes on the same fixture: no additional global styles, full Grafana `GlobalStyles` as a reference, and a minimum scoped style set.
- Gate acceptance uses the smallest mode that preserves panel correctness. Full `GlobalStyles` is a reference, not an automatic production choice.
- Record every global selector and computed-style change outside the POC root.

### Required style and asset checks

- uPlot stylesheet behavior for Time series;
- Table grid styles if Gate D runs;
- Inter and Roboto Mono loading, with 200 responses and no fallback-font warning;
- panel/icon SVG requests from one configured asset base;
- one reference-counted portal root and zero children after unmount;
- tooltip, menu, and overlay z-index behavior inside a host with its own design-system styles;
- `ResizeObserver`, `requestAnimationFrame`, canvas, `matchMedia`, and DOM measurement availability; and
- no CSS reset or typography mutation outside the declared style mode.

The implementation must compare the POC panel against the same fixture rendered by the pinned Grafana server in the same Chromium build. Font and icon files copied from Grafana application assets, if any, are licensing checkpoints.

## Sequential kill-or-continue gates

The gates are cumulative and must execute in order. A failed gate stops later gates until its failure category is understood and the design is revised.

### Gate A — Native render foundation: Text

#### Build

- Start the page runtime and install only the services required by a query-free panel.
- Retrieve `grsdk-phase0-poc` by UID and validate the V1 DTO.
- Convert only Text panel ID 1 into a project-owned root, grid item, and `VizPanel`.
- Supply the exact v13.2.3 Text `PanelPlugin` through the fixed importer.
- Render legacy v1 Markdown mode to avoid making the feature-flagged Text v2 editor/query path part of the first gate.

#### Must prove

- one React 19.2.8 runtime and no invalid-hook or peer-runtime failure;
- explicit Runtime bootstrap without `GrafanaApp.init`;
- Scenes activation outside the Grafana route tree;
- real Grafana Text panel output under `PanelChrome` in the host DOM;
- correct theme, typography, Markdown sanitization, portal infrastructure, and panel dimensions;
- zero iframes created, including transiently;
- no Grafana navigation, shell, or route components in the module graph;
- unmount deactivates the scene and restores all instance-owned resource counts to baseline; and
- remount produces the same output without duplicate styles or portal roots.

#### Kill conditions

- the real Text panel cannot load without the Grafana application bootstrap or route tree;
- React 19 causes Scenes lifecycle/render failures that cannot be isolated behind a small patch;
- Runtime config cannot be established before dependent modules execute;
- mount or unmount leaks active scene subscriptions, requests, timers, observers, or DOM nodes; or
- panel code can run only by accepting an iframe or booting `GrafanaApp.init`.

### Gate B — Query-backed panel: Stat

#### Build

- Add the TestData settings/instance, BackendSrv adapter, DataSourceSrv, `runRequest`, field-config descriptors, and query tracing.
- Convert Stat panel ID 2 with a `SceneQueryRunner`.
- Prefer datasource experiment D1; use D2 only as a labeled diagnostic control.

#### Must prove

- the saved datasource UID resolves to one known instance;
- a real POST query reaches Grafana and returns a DataQueryResponse;
- `SceneQueryRunner` emits loading and done `PanelData` states;
- Stat displays the deterministic reduced value, percent unit, and expected threshold color;
- manual refresh issues a new request without retaining the previous subscription;
- time-range replacement or UID replacement aborts/supersedes the stale request;
- unmount cancels a `slow_query`; and
- `server_error_500` is contained to the Stat panel with a classified query error.

#### Failure classification

| Failure point | Evidence that identifies it |
| --- | --- |
| Datasource module loading | Import telemetry fails before instance construction; D2 control succeeds |
| Runtime service initialization | Getter/setter or config assertion fails before request creation |
| Query execution | Correct request is emitted but cancellation, decoding, Observable state, or server response fails |
| Data/display processing | Valid response reaches `PanelData` but reduction/unit/threshold output is wrong |
| Visualization rendering | Correct processed values reach Stat props but the component fails |

#### Kill conditions

- no cancellable query path can be installed without Grafana application startup;
- the only working path embeds a browser secret or requires an SDK backend;
- `SceneQueryRunner` cannot operate with the explicit service adapters; or
- query failure terminates the dashboard root rather than the affected panel boundary.

### Gate C — Required architecture proof: Time series

Gate C is mandatory. Gate A and Gate B success alone do not make the POC successful.

#### Build

- Add Time series panel ID 3 and its exact v13.2.3 `PanelPlugin`.
- Register only the fixture's `renameByRegex` transformer and verify its observable renamed-series result.
- Apply saved line, fill, legend, tooltip, threshold, unit, and field-override options.
- Use the scene time range in the TestData request and compare the result with the pinned Grafana reference rendering.

#### Must prove

- the loaded component is Grafana's current v13.2.3 Time series implementation, not a look-alike;
- deterministic query-backed series render to native canvas/DOM;
- the requested from/to range is present in the query and changing the range changes both request and plot;
- the fixture transformation changes the displayed series name;
- saved field configuration and panel options visibly apply;
- legend, tooltip, and keyboard/focus behavior work without Grafana chrome;
- resizing the container from 1200 px to 600 px and back updates the plot without errors or stale observers;
- manual refresh replaces data cleanly;
- unmount releases chart hooks, animation frames, observers, portal content, query subscriptions, and scene subscriptions; and
- two dashboard instances share one compatibility runtime while retaining independent ranges, panel state, and request ownership.

#### Kill conditions

- the exact Time series panel requires Grafana shell/routes or an iframe;
- the source closure cannot be bounded because it pulls substantial dashboard/edit/application code;
- unpublished/internal dependencies cannot be isolated in one exact-version compatibility artifact;
- chart rendering, time range, field config, transformation, resize, or cleanup cannot be made correct without reimplementing the visualization; or
- required global state makes two simultaneous dashboards interfere with one another.

### Gate D — Additional complexity diagnostic: Table

Gate D runs only after Gate C passes. It is useful but not required for the Time series architecture decision.

#### Build and observations

- Add Table panel ID 4 and its exact v13.2.3 module.
- Exercise frame/field organization, display names, units, thresholds, sorting, resizing, keyboard navigation, and one external link.
- Route the external link through a host callback; do not enable Explore or internal Grafana navigation.
- Record data-grid CSS, portal, virtualization, cell-action, and accessibility dependencies.

Table failure does not retroactively fail Gate C if the issue is isolated and Table is marked unsupported. It does require an explicit supported-panel decision before production planning.

## Lifecycle scenarios

| Scenario | Action | Required evidence |
| --- | --- | --- |
| Initial mount | Create runtime, load UID, activate scene, render | One DTO request, expected panel loads/queries, one React root |
| Refresh | Manual refresh then temporary 5-second interval | New request IDs; old subscription complete; no overlapping runaway timers |
| Time-range change | `now-1h` to `now-15m` | Query range changes; Stat/Time series update; Text unchanged |
| UID change | Primary UID to lifecycle clone before a delayed request completes | Old fetch/query aborted or ignored; only clone sentinel remains |
| Invalid UID then recovery | Valid to missing to valid | Typed error boundary and successful clean retry |
| Unmount | Unmount during `slow_query` | Abort observed; scene inactive; instance-owned counts return to baseline |
| Remount | Reuse page runtime with a new scene | No duplicate registries/styles/portal; deterministic output |
| Repeated churn | 20 mount/unmount and 20 UID-change cycles | No monotonically growing subscription, timer, observer, portal, or retained-root count |
| Two instances | Mount primary and clone together | Independent range/refresh/errors; one shared plugin promise/runtime; no state cross-talk |

Runtime services are page-scoped and singleton-backed. The POC does not promise independent runtime teardown or multiple base URLs. The final unmount releases SDK-owned DOM and resources but may leave immutable Grafana module singletons installed until page unload; this must be documented and measured rather than disguised as full reset support.

## Failure scenarios and isolation

| Scenario | Injection | Expected boundary and result |
| --- | --- | --- |
| Invalid UID | Request `grsdk-does-not-exist` | Retrieval boundary returns `DashboardNotFound`; no scene constructed |
| Unauthorized dashboard | Clear/expire browser session | Retrieval boundary returns `DashboardUnauthorized`; no credential prompt owned by SDK |
| Forbidden dashboard | Use viewer lacking access | Retrieval boundary returns `DashboardForbidden` |
| Unsupported API/version | Stub discovery or feed V2/old schema | Classifier returns typed unsupported result; no V1 misparse |
| Malformed DTO | Intercept and remove `spec` or alter identity | Validation error contains response path; no scene constructed |
| Missing panel module | Remove allowlist entry for one panel | That panel renders supported error state; sibling panels remain active |
| Panel import rejects | Force importer promise rejection | Panel error boundary contains load error; promise/cache telemetry recorded |
| Datasource load failure | Reject TestData module import | Classified datasource-load failure; D2 may run only as diagnostic control |
| Query failure | Use `server_error_500` | Panel-level query error; root and sibling panels remain responsive |
| Stale request | Switch UID during `slow_query` | Abort or stale-response suppression; old data never enters new scene |
| Transformation missing | Remove `renameByRegex` registration | Preflight `DashboardFeatureUnsupported`; never silently skip |
| Transformation throws | Install controlled throwing transform in test only | Panel data failure isolated; error attributed to transform ID |
| Unsupported options | Add one unknown/currently unsupported option | Explicit preflight or compatibility warning; never silent false fidelity |
| Missing font/icon | Block asset URL | Network and console failure captured; visual gate fails if required asset has no approved fallback |

## Instrumentation and evidence collection

### Network

- Playwright request/response listeners and a retained HAR for each gate;
- request IDs linked from dashboard load through query completion/cancellation;
- bodies redacted for cookies and authorization headers;
- assertions on method, path, datasource UID, dashboard UID, panel ID, ref ID, time range, status, and abort; and
- a failed-request log that distinguishes browser abort from network failure.

### Console and runtime identity

- fail gates on unexpected console error, React hook warning, Emotion warning, unhandled rejection, or i18n-before-init warning;
- store an allowlist with justification for any unavoidable warning;
- run the package manager's dependency explanation/list to prove one React and React DOM;
- assert React identity across host, Scenes, UI, and panel entrypoints through a POC-only injected marker; and
- record all Runtime setter calls and reject reconfiguration to a different base path.

### Resource retention

Install counters before Grafana imports for:

- `setTimeout`/`clearTimeout` and `setInterval`/`clearInterval`;
- `requestAnimationFrame`/`cancelAnimationFrame`;
- `addEventListener`/`removeEventListener` on window/document/host root;
- `ResizeObserver` and `MutationObserver` construction/disconnect;
- fetch/AbortController operations;
- query Observables/subscriptions;
- scene activation/deactivation; and
- portal roots/children and Emotion/style elements.

Compare baseline, active, unmounted, and remounted snapshots. Page-runtime resources explicitly intended to persist are listed separately from instance-owned resources.

### Plugin and bundle composition

- log importer ID, source entrypoint, exact commit, cache key, start/end/failure, and resulting plugin metadata;
- generate the Vite/Rollup module graph, chunk manifest, source map, and raw/gzip sizes for every gate;
- fail the build if forbidden entrypoints such as `public/app/app.ts`, route registration, navigation, or dashboard edit shell appear;
- identify every `public/app`, `@grafana/*/internal`, SystemJS, worker, WASM, CSS, font, and asset import;
- verify no second React, Emotion, RxJS, Grafana package version, or panel implementation is bundled; and
- record dynamic-import and public-path behavior in both development and production builds.

### DOM, visual, and accessibility

- keep a `MutationObserver` assertion that the iframe count is zero throughout the test, not only at the end;
- capture semantic DOM, canvas dimensions, computed theme/style samples, focus order, and screenshots;
- compare Text, Stat, and Time series with the same dashboard in the pinned Grafana server and same Chromium build;
- mask timestamps/cursors and use a maximum 2% differing-pixel budget at a fixed rendering threshold for stable panel regions;
- run keyboard navigation and an automated accessibility scan, then record deviations from the Grafana reference; and
- assert the host's sentinel typography, button, and link styles do not change outside the POC root.

### Evidence bundle per gate

Each gate produces:

1. environment/version/digest record;
2. exact fixture revision and DTO hash;
3. discovery response and sanitized DTO classification report;
4. network HAR and query lifecycle log;
5. console output and warning allowlist;
6. plugin/datasource import trace;
7. module graph and forbidden-import report;
8. bundle size report;
9. DOM snapshot and iframe assertion;
10. reference and POC screenshots plus diff;
11. lifecycle resource snapshots; and
12. pass/fail result with failure category and next action.

No captured evidence may contain session cookies, authorization headers, user data, production dashboard JSON, or datasource secrets.

## Measurable success criteria

The POC is successful only when all of the following pass:

1. The component input is the user-facing UID `grsdk-phase0-poc` and the DTO response has the same `metadata.name`.
2. Discovery and the V1 DTO are retrieved from the Grafana 13.2.3 container; the dashboard is not supplied as an embedded fixture to the renderer.
3. Zero iframe elements are observed from bootstrap through final cleanup.
4. Static module analysis finds no Grafana app entrypoint, route tree, navigation, or chrome, and runtime instrumentation records zero calls to `GrafanaApp.init`.
5. Text, Stat, and Time series are real v13.2.3 Grafana panel modules resolved by the fixed catalogue and rendered through native React/DOM/canvas.
6. Gate C renders a query-backed Time series from TestData with the fixture's options, field configuration, deterministic data, transformation result, legend, and tooltip.
7. The POC and Grafana reference have no missing required assets, matching sampled theme tokens/computed styles, and no more than 2% differing pixels in stable masked panel regions.
8. Changing the time range changes the Time series request range and visible plot; manual refresh produces a new request and clean state transition.
9. Resize from 1200 px to 600 px and back completes without console errors and with plot dimensions tracking the container within one animation frame after observer delivery.
10. Replaced UID, replaced time range, and unmount cancel or suppress every stale request; no stale result is rendered.
11. After unmount, active query subscriptions are zero, instance-owned timers/animation frames/observers/listeners return to baseline, portal children are zero, and the scene is inactive.
12. Twenty lifecycle cycles show no monotonically increasing retained scene root, subscription, timer, observer, portal, or style-element count.
13. Two dashboard instances use one page runtime and one cached plugin promise while keeping range, request, panel, and error state independent.
14. Query, plugin, datasource, transformation, and retrieval failures remain inside their documented boundaries.
15. Authentication is provided only by the host/browser session; the browser bundle and evidence contain no service-account secret.
16. The report records raw and gzip bundle contributions per gate, all unpublished/internal code, and every global side effect.

Gate D may fail without failing these criteria if Table is explicitly marked unsupported. Gate C may not be waived.

## Stop and revise criteria

### STOP

Stop the architecture and do not begin production SDK work if any of these remains true after one bounded remediation attempt:

- Gate A requires an iframe, `GrafanaApp.init`, Grafana routes/navigation/chrome, or a second React runtime.
- Scenes cannot run reliably on React 19.2.8 and no small, isolated, maintainable compatibility patch exists.
- Runtime configuration or services cannot be installed before dependent modules evaluate without booting the application shell.
- The real Time series component cannot render outside Grafana or requires a substantial, unbounded slice of application/dashboard/edit code.
- Time range, query execution, field/display processing, transforms, responsive sizing, or cleanup require replacing the Time series visualization with a reimplementation.
- application globals make two dashboard instances corrupt each other's state within one origin/runtime.
- browser authentication requires embedding a long-lived secret or adding an SDK-owned backend.
- the panel/application-source use cannot proceed under the project's eventual distribution model after explicit licensing review.

### REVISE

Return **REVISE** rather than **PROCEED** when the core proof works but any of these remains:

- Gate C succeeds only with the D2 generic TestData backend adapter, leaving datasource frontend loading unresolved;
- the current-schema V1 fixture works but V2 or legacy migration is a required near-term product constraint;
- exact panel code works only in a pinned generated compatibility artifact whose upgrade process is not yet bounded;
- style containment needs a host stylesheet contract or Shadow DOM follow-up;
- singleton lifetime supports one origin but needs an explicit page-runtime manager;
- Table or another required product panel is unsupported;
- bundle composition is operationally unacceptable even though rendering works; or
- licensing review is incomplete for a proposed production distribution technique.

### CONTINUE

Continue from one gate to the next only when that gate's must-pass assertions succeed and every warning, internal import, resource delta, and fallback is classified. A successful diagnostic fallback does not erase the failure of the primary experiment.

## Package and application-code boundary

| Surface | POC use | Publication status | Licensing checkpoint |
| --- | --- | --- | --- |
| `@grafana/data`, `ui`, `runtime`, `schema`, `i18n` 13.2.3 | Exact npm packages | Published; package manifests identify Apache-2.0 | Verify notices and redistribution obligations |
| `@grafana/scenes@8.13.5` | Constrained public subset | Published; Apache-2.0 | Verify notices; document unsupported React peer override |
| V1/V2 DTO types | Validation/classification reference and internal types | Published schema plus generated/app code | Review any copied generated/application code |
| V1 converter semantics | Reproduce only accepted fixture mappings | `public/app` application source | Review each copied/adapted semantic or source fragment |
| V2 converter/layout registry | Not used; reference only | `public/app` application source | Required before any later adaptation |
| `DashboardModel`/migrator | Not imported; older schemas rejected | `public/app` application source | Required if later copied/adapted |
| Text/Stat/Time series/Table modules | Exact source build or compatibility artifact | Unpublished `public/app` source | Explicit review before committing, sharing, publishing, or distributing artifacts |
| Time series application chart code | Exact renderer dependency | Unpublished application source and internal package APIs | Explicit source-closure and license review |
| Table hooks/data grid integration | Gate D only | Unpublished application source/internal APIs | Explicit source-closure and license review |
| Built-in plugin map/importer | Rejected in favor of fixed catalogue; reference only | Unpublished application source | Review if any logic is adapted |
| Runtime concrete services | Structural adapters; source is behavioral reference | Concrete implementations are application-owned | Review any copied request/query behavior |
| Registry initializers | Minimum explicit registry; application lists used as reference | Initializers are application-owned | Review adapted field-config descriptors/transform UI metadata |
| TestData frontend module | D1 exact-source experiment | Private application package | Explicit review before any distribution |
| Grafana fonts/icons/static assets | POC fidelity where required | Application assets with file-specific provenance | Inventory and review each copied/bundled asset |
| Server-delivered plugin chunks | P3 diagnostic only | Grafana distribution/application artifacts | Review terms and operational security before reuse |

No legal conclusion is made here. “Published npm package,” “open source,” and “technically loadable” are not treated as equivalent permissions. Before any production distribution decision, a reviewer must examine the exact source closure, licenses, notices, modification obligations, source-offer implications, asset licenses, and remote-loading model.

## Unresolved blockers entering implementation

1. **React peer mismatch:** Scenes 8.13.5 declares React 18 while Grafana 13.2.3 requires React 19.
2. **Built-in panel distribution:** all four panel implementations are application-owned; no supported standalone npm entrypoint exists.
3. **Time series closure:** the current renderer depends on unpublished application components and `@grafana/ui/internal`/`@grafana/data/internal` surfaces.
4. **Datasource frontend distribution:** TestData's frontend module is a private application package and general datasource module loading is larger than this POC.
5. **Runtime globals:** config and service setters are page-global, lack supported reset, and constrain the SDK to one Grafana identity/origin per page.
6. **V1 conversion/migration:** the POC accepts only schema 42; broader V1 migration depends on application logic.
7. **V2 conversion:** classification is designed, but V2 layout/query conversion is deliberately not implemented.
8. **Field registry parity:** required rendering entries must be separated from application-owned editor initialization without silent fidelity loss.
9. **Style containment:** full global styles may collide with the host; the minimum light-DOM style set is not yet known.
10. **Assets:** fonts, icons, public paths, and source-build asset URLs need a reproducible and reviewable distribution mechanism.
11. **Bundler coupling:** exact panel code may assume Grafana webpack aliases, loaders, feature flags, or dynamic-import behavior that Vite cannot safely reproduce.
12. **Licensing:** any copied, adapted, bundled, or remotely loaded application code/assets need explicit review before distribution.

## Final decision template

```text
Decision: PROCEED | REVISE | STOP
Date:
Grafana image/digest:
Grafana source commit:
Host/toolchain lock hash:
Fixture DTO hash:

Gate A — Text foundation: PASS | FAIL | NOT RUN
Primary panel-loading experiment: P1 | P2 | P3
Evidence links:
Failures/fallbacks:

Gate B — Stat query path: PASS | FAIL | NOT RUN
Datasource experiment: D1 | D2 | D3
Evidence links:
Failures/fallbacks:

Gate C — Time series required proof: PASS | FAIL | NOT RUN
Exact component/source closure:
Evidence links:
Failures/fallbacks:

Gate D — Table diagnostic: PASS | FAIL | NOT RUN | DEFERRED
Evidence links:
Support implication:

Core constraints:
- UID retrieval from Grafana: PASS | FAIL
- zero iframe over lifecycle: PASS | FAIL
- GrafanaApp.init/route/chrome absent: PASS | FAIL
- native Time series rendering: PASS | FAIL
- query/time-range/refresh: PASS | FAIL
- style fidelity: PASS | FAIL
- lifecycle cleanup: PASS | FAIL
- two-instance isolation: PASS | FAIL

Unpublished/internal code inventory:
Licensing review status (no legal conclusion):
Bundle raw/gzip by gate:
Global side effects:
Remaining blockers:
Required architecture revisions:
Production work authorized: NO (separate decision required)
Rationale:
```

Decision rules:

- **PROCEED** requires Gates A, B, and C to pass with no STOP condition. It authorizes only a production architecture proposal and further research, not reuse or publication of POC code.
- **REVISE** applies when native Time series rendering is proven but a bounded datasource, packaging, style, singleton, version, or licensing boundary must change before production design.
- **STOP** applies when Gate A cannot establish the foundation, Gate C cannot render the exact Time series architecture, or any non-negotiable constraint must be abandoned.
- Gate D informs panel scope but is not required for the core Time series decision.

## Production boundary

Successful POC code is disposable research code. It is expected to contain instrumentation, fixed fixture assumptions, explicit version hacks, and narrow adapters that would be inappropriate in a public SDK.

No POC source should automatically move into production. A separate architecture decision must evaluate supported dashboard versions, supported datasources/panels, package generation, upgrade automation, public API design, style containment, security, accessibility, observability, bundle budgets, tests, and licensing. The production design must be derived from the evidence, not from the accidental shape of the first working experiment.

## Upstream evidence references

### Baseline and container

- [Grafana `v13.2.3` source](https://github.com/grafana/grafana/tree/v13.2.3)
- [Grafana Docker installation documentation](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)
- [Grafana OSS 13.2.3 download page](https://grafana.com/grafana/download/13.2.3?edition=oss)
- [Official `grafana/grafana` image tags](https://hub.docker.com/r/grafana/grafana/tags)

### Dashboard retrieval and conversion references

- [Dashboard API documentation at `v13.2.3`](https://github.com/grafana/grafana/blob/v13.2.3/docs/sources/developer-resources/api-reference/http-api/dashboard.md)
- [API resource identity documentation](https://github.com/grafana/grafana/blob/v13.2.3/docs/sources/developer-resources/api-reference/http-api/apis.md)
- [V1 dashboard API client](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v1.ts)
- [V2 dashboard API client](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v2.ts)
- [V1 dashboard-to-Scenes reference](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelToScene.ts)
- [V1 panel data-provider construction](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/utils/createPanelDataProvider.ts)
- [V2 dashboard-to-Scenes reference](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene.ts)

### Rendering and runtime references

- [Scenes 8.13.5 package manifest](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/package.json)
- [Scenes `VizPanel`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx)
- [Scenes `VizPanelRenderer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx)
- [Scenes `SceneQueryRunner`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts)
- [Runtime backend service surface](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/backendSrv.ts)
- [Runtime datasource service surface](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSourceSrv.ts)
- [Runtime query-runner setter](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/QueryRunner.ts)
- [Runtime plugin import utilities](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/utils/plugin.ts)
- [Grafana application startup and registry initialization](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts)

### Panels, datasource, styles, and registries

- [Text panel module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/module.tsx)
- [Stat panel module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/stat/module.tsx)
- [Time series panel module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/module.tsx)
- [Table panel module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/table/module.tsx)
- [TestData datasource module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/datasource/grafana-testdata-datasource/module.tsx)
- [TestData datasource query implementation](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts)
- [`PanelChrome`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx)
- [Grafana global styles](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/GlobalStyles/GlobalStyles.tsx)
- [Standard transformations exported by Data](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformers.ts)
- [Application standard-transform registry](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/transformers/standardTransformers.tsx)
- [Application standard field-config registry](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/OptionsUI/registry.tsx)
