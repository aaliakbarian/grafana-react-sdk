# Grafana Scenes Investigation

Related documents:

- `docs/project/project-context.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/research/phase0-research-plan.md`
- `docs/architecture/research/grafana-source-map.md`
- `docs/architecture/decisions/`

## Document metadata

| Field | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 2: `@grafana/scenes` investigation |
| Status | Completed static source and package investigation; browser POC validation remains required |
| Research date | 2026-10-03 |
| Grafana baseline | Grafana OSS `v13.2.3` at `6193dc03311b631b9727b560d24369e683dc396e` |
| Scenes baseline | `@grafana/scenes@8.13.5`, tag `v8.13.5` at `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` |
| Recommendation | Adopt a constrained Scenes subset behind adapters |

## Scope and evidence method

This investigation asks whether the published `@grafana/scenes` package used by Grafana OSS 13.2.3 can provide dashboard state and native React rendering in an independent React application. It does not test dashboard retrieval, package installation, bundling, or browser rendering. No SDK code was implemented.

Evidence was collected from:

- the published `@grafana/scenes@8.13.5` package manifest and contents;
- the official Scenes repository at tag `v8.13.5`;
- the Grafana repository at tag `v13.2.3`;
- source tests at those pinned revisions; and
- official Grafana Scenes documentation.

Findings use these labels:

- **Verified fact**: directly supported by pinned source, tests, package metadata, or official documentation.
- **Inference**: a consequence of verified facts that has not yet been demonstrated in the independent host.
- **Open question**: requires the later runtime, UI, panel-dependency, or POC workstream.

## Executive finding

`@grafana/scenes@8.13.5` is a viable candidate for the SDK's internal scene graph, activation model, query orchestration, layouts, variables, and panel-hosting component. It is not a complete standalone dashboard runtime.

The package does not expose a saved-dashboard-to-scene converter, a Grafana `DashboardScene`, a dashboard-by-UID loader, or Grafana's built-in panel modules. Its rendering path also assumes initialized `@grafana/runtime` services and `@grafana/ui` theme infrastructure. Several compatibility features use process-wide or window-wide mutable state.

The package should therefore be evaluated only as a constrained implementation detail behind project-owned adapters. Adoption remains conditional on a POC proving React 19 operation, runtime initialization without the Grafana shell, built-in panel resolution, dashboard conversion, cleanup, and concurrent instance behavior.

## Pinned package and compatibility baseline

### Package identity

**Verified fact.** Grafana OSS 13.2.3 pins `@grafana/scenes` to `8.13.5`. The corresponding official Scenes tag and published package identify the same source commit.

| Item | Exact value | Evidence |
| --- | --- | --- |
| Package | `@grafana/scenes@8.13.5` | Published package manifest |
| Scenes tag | `v8.13.5` | Official Scenes repository |
| Tag commit | `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` | `git rev-parse v8.13.5^{}` |
| Published `gitHead` | `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` | Published `package.json` |
| npm integrity | `sha512-3b3f1Ms4h2QrCzk4YqxDPqv99PQ+ksp8pYeJ5yvAu9SFpnQMjzUd8w6Ny2e8Y3a7y1pOMo6LMuf3xQea1jEqrw==` | npm registry metadata recorded in Workstream 1 |
| License | Apache-2.0 | Package manifest and package `LICENSE` |

The Scenes repository root uses Yarn `4.15.0`; its lockfile resolves React and React DOM `18.3.1`. This is useful upstream-development context, not a consumer requirement.

### Peer dependencies

**Verified fact.** The published manifest declares these peer ranges:

| Peer | Declared range | Grafana 13.2.3 baseline |
| --- | --- | --- |
| `@grafana/data` | `>=11.6` | `13.2.3` |
| `@grafana/e2e-selectors` | `>=11.6` | `13.2.3` |
| `@grafana/i18n` | `*` | `13.2.3` |
| `@grafana/runtime` | `>=11.6` | `13.2.3` |
| `@grafana/schema` | `>=11.6` | `13.2.3` |
| `@grafana/ui` | `>=11.6` | `13.2.3` |
| `react` | `^18.0.0` | `19.2.8` |
| `react-dom` | `^18.0.0` | `19.2.8` |
| `react-router-dom` | `^6.28.0` | Root manifest: `5.3.4`; lockfile also resolves `6.30.4` through the v5-compat migration path |
| `rxjs` | `^7.8.1` | `7.8.2` |

**Verified fact.** Grafana itself resolves Scenes 8.13.5 with React 19.2.8 even though the published Scenes peer range accepts only React 18.

**Verified fact.** Grafana's root manifest still pins `react-router-dom` 5.3.4 while its migration layer uses `react-router-dom-v5-compat` and the lockfile also contains React Router DOM 6.30.4. This is not a simple reference layout for an independent consumer of Scenes' `^6.28.0` peer.

**Inference.** The source combination is strong evidence that Grafana's own build can run it, but it does not establish a supported, warning-free standalone consumer installation. A package manager may reject or warn about the peer mismatch, and independent React 19 lifecycle behavior has not been tested.

**Open question.** The POC must install the exact package set in a clean workspace, record peer-resolution output, and exercise React 19 Strict Mode mount/unmount behavior.

### Intended environment

**Verified fact.** The pinned package README describes Scenes as a library for dashboard-like experiences in Grafana app plugins. The official setup guide starts with `@grafana/create-plugin` or adding Scenes to a Grafana app plugin, and the `SceneApp` guide integrates with Grafana plugin routing and `PluginPage`.

**Inference.** An independent React host is outside the documented primary environment. Public exports make reuse technically plausible, but the project cannot treat outside-shell operation as an upstream-supported configuration until Grafana documents it or the project accepts ownership of the compatibility layer.

## Published package surface

### Export boundary

**Verified fact.** The published manifest exposes only:

| Export | ESM target | CommonJS target | Types target |
| --- | --- | --- | --- |
| `@grafana/scenes` | `dist/esm/index.js` | `dist/index.js` | `dist/index.d.ts` |
| `@grafana/scenes/package.json` | `package.json` | `package.json` | Not applicable |

The published tarball contains compiled distribution files, declarations, README, changelog, and license. It does not publish the TypeScript source tree. Deep imports are outside the declared export map and are not an acceptable SDK dependency.

### Public API inventory relevant to dashboard rendering

The following symbols are re-exported from [`packages/scenes/src/index.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/index.ts) and therefore belong to the root package surface at this version.

| Capability | Representative public exports | Proposed use |
| --- | --- | --- |
| Scene state and lifecycle | `SceneObjectBase`, `useSceneObjectState`, `sceneGraph`, scene object types and events | Internal state graph behind an adapter |
| Root/container | `EmbeddedScene`, `NestedScene`, `SceneReactObject` | Candidate root; `EmbeddedScene` has a global compatibility side effect |
| Time and refresh | `SceneTimeRange`, `SceneTimeZoneOverride`, `SceneTimePicker`, `SceneRefreshPicker` | Candidate dashboard time state and controls |
| Query and data | `SceneQueryRunner`, `SceneDataNode`, `SceneDataTransformer`, `DataProviderProxy`, data layers | Candidate query and transformation path |
| Variables | `SceneVariableSet` plus constant, custom, query, datasource, interval, textbox, switch, ad hoc, group-by, local, and scopes variants | Candidate template-variable representation |
| Panel hosting | `VizPanel`, `VizPanelMenu`, panel and field-config builders | Candidate native panel host |
| Layout | Flex, CSS grid, dashboard grid, split, lazy, and repeater objects | Candidate dashboard layout primitives |
| URL state | `UrlSyncManager`, `useUrlSync`, `UrlSyncContextProvider`, `SceneObjectUrlSyncConfig`, URL state helpers | Optional host integration, not required for initial rendering |
| Runtime registration | `registerRuntimePanelPlugin`, `registerRuntimeDataSource`, `RuntimeDataSource` | Possible test/custom-plugin path; globally scoped |
| Localization | `loadResources` | Scenes translation resource loader |
| App integration | `SceneApp`, `SceneAppPage`, `useSceneApp` | Exclude: routing and `PluginPage` couple this path to Grafana app integration |

### Capabilities not supplied by the package

**Verified fact.** Searches of the pinned source and published declarations found no `DashboardScene`, `DashboardModel`, `transformSaveModelToScene`, V1/V2 dashboard deserializer, dashboard API client, or dashboard-by-UID loader.

The Grafana-owned implementations remain under these unpublished application paths:

- `public/app/features/dashboard-scene/scene/DashboardScene.tsx`;
- `public/app/features/dashboard-scene/serialization/`;
- `public/app/features/dashboard/services/` and `public/app/features/dashboard/api/`;
- `public/app/features/plugins/`; and
- `public/app/plugins/panel/`.

**Inference.** Scenes can represent the result of dashboard conversion but cannot, through its public API alone, construct an equivalent graph from a Grafana V1 or V2 dashboard DTO.

## Dashboard scene creation primitives

### What Scenes can construct

**Verified fact.** Public primitives can compose a dashboard-like graph with:

- an `EmbeddedScene` or project-owned `SceneObjectBase` root;
- a `SceneTimeRange`, `SceneVariableSet`, and optional `SceneDataLayerSet` on the graph;
- `SceneGridLayout`, `SceneGridRow`, and `SceneGridItem` nodes;
- one `VizPanel` for each visualization;
- a `SceneQueryRunner` and optional `SceneDataTransformer` per panel or shared higher in the graph; and
- controls for variables, refresh, and time range.

The official layout documentation says `SceneGridLayout` is the default layout used by Grafana's core dashboard experience. The Workstream 1 source trace confirms that Grafana's app-owned V1 and V2 converters build these public primitives and add Grafana-specific dashboard objects and behaviors around them.

### What the SDK would still need to own or adapt

| Conversion concern | Scenes primitive exists? | Public converter exists? | Disposition |
| --- | --- | --- | --- |
| V1 migration and legacy `DashboardModel` semantics | No | No | Unpublished boundary; research a versioned adapter or constrain accepted input |
| V2 layout and element deserialization | Layout targets exist | No | Versioned adapter required |
| Panel model to `VizPanelState` | Yes | No | Versioned adapter required |
| Targets to `SceneQueryRunner` | Yes | No | Versioned adapter required |
| Transformations to `SceneDataTransformer` | Yes | No | Versioned adapter required |
| Variables, annotations, repeats, links, and dashboard behaviors | Mostly | No end-to-end converter | Map feature by feature and reject unsupported cases explicitly |
| Dashboard loading by UID and API-version discovery | No | No | Separate dashboard API adapter required |

**Open question.** Licensing and maintenance analysis must decide whether any Grafana application-source logic can be adapted, independently reimplemented against schemas, or must be treated as a feasibility blocker.

## `VizPanel` lifecycle

The relevant implementation is [`packages/scenes/src/components/VizPanel/VizPanel.tsx`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx), with rendering in [`VizPanelRenderer.tsx`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx).

### Activation and plugin resolution

**Verified fact.** The lifecycle is:

1. `SceneComponentWrapper` mounts and calls `model.activate()` in a React effect.
2. `VizPanel._onActivate` calls `_loadPlugin` when the instance has no cached `_plugin`.
3. `loadPanelPluginSync` first calls `getPluginImportUtils().getPanelPluginFromCache(pluginId)`, then checks the Scenes module-level runtime plugin map.
4. On a miss, `_loadPlugin` calls `getPluginImportUtils().importPanelPlugin(pluginId)`.
5. `_pluginLoaded` runs panel migrations when needed, applies defaults, may wrap the data provider in `SceneDataTransformer`, stores the `PanelPlugin`, and updates state.
6. For plugins with `skipDataQuery`, it subscribes to the scene time range so the panel rerenders on time changes.
7. `VizPanelRenderer` finds the nearest data and time nodes, applies field configuration, provides `PluginContextProvider` and `PanelContextProvider`, and renders `plugin.panel` inside `PanelChrome` and `ErrorBoundaryAlert`.

**Verified fact.** Runtime registration does not remove the plugin-import-service prerequisite. `loadPanelPluginSync` invokes `getPluginImportUtils()` before it checks `runtimePanelPlugins`; an uninitialized plugin import utility therefore throws even for a runtime-registered panel.

### Rendering dependencies

`VizPanel` and its renderer directly require:

- `config.buildInfo.version`, `config.theme2`, and `config.featureToggles`;
- `getPluginImportUtils()`;
- `getAppEvents()` when no cursor-sync event bus is present;
- `@grafana/ui` panel chrome, theme hooks, tooltip, icon, error boundary, and panel context;
- `@grafana/data` plugin/data types, field override processing, markdown rendering, and plugin context; and
- `@grafana/i18n` translations.

**Inference.** `VizPanel` is reusable without Grafana navigation, but not without a Grafana-compatible runtime configuration, event bus, theme, i18n setup, and panel resolver.

### Asynchronous load risk

**Verified fact.** `_loadPlugin` awaits the plugin promise and then calls `_pluginLoaded`; the method has no abort signal, activation generation, or `isActive` check. The catch path also mutates panel state.

**Inference.** A late plugin resolution can update an inactive panel object. This is not proof of a DOM leak, but repeated UID changes or rapid unmounts require explicit POC observation.

## `SceneQueryRunner` requirements

The relevant implementation is [`packages/scenes/src/querying/SceneQueryRunner.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts), with datasource resolution in [`utils/getDataSource.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/utils/getDataSource.ts).

### Required services and graph state

**Verified fact.** A non-empty query run requires:

- a reachable `SceneTimeRangeLike` from `sceneGraph.getTimeRange`;
- variable dependency state when the queries or datasource reference variables;
- a datasource resolved from the Scenes runtime datasource map, an inline `DataSourceApi`, or `getDataSourceSrv().get(...)`;
- `getRunRequest()` to execute the datasource request and normalize the result stream; and
- a valid `config.buildInfo.version`, read while creating the safe serialized scene-object scoped variable.

The runner creates `DataQueryRequest` values with time range, timezone, interval, scoped variables, max data points, cache options, scopes, and optional data-request enrichment supplied by an ancestor. It assigns request IDs from a module-level counter.

### Activation and cleanup

**Verified fact.** In automatic mode, activation subscribes to the scene time range and extra query providers, then runs when data is absent or stale. It also subscribes to data layers. Before each new run it unsubscribes the previous query subscription.

On deactivation, `_onDeactivate`:

- unsubscribes the active query, data-layer, and time-range subscriptions;
- clears the corresponding references;
- discards nonterminal data so reactivation starts cleanly; and
- cleans the drilldown dependency manager.

`SceneObjectBase` subsequently removes the object's event listeners and unsubscribes its `_subs` collection.

**Verified fact.** Time-range updates defer `runWithTimeRange` with an untracked zero-delay timer. Container-width-triggered work is also deferred, although that path checks `isActive` before querying.

**Open question.** The POC must verify that deactivation before datasource resolution or a deferred time-range callback cannot publish stale results, and that unsubscribing the request observable cancels underlying network or streaming work.

## Runtime, provider, and browser assumptions

### Required integration matrix

This table gives every dependency needed by the candidate dashboard subset an explicit disposition. “Required” means required for the relevant feature, not necessarily for every possible scene.

| Dependency | Scenes source/symbol | When needed | Scope | Disposition |
| --- | --- | --- | --- | --- |
| Runtime configuration | `config` in `VizPanel`, `SceneTimeRange`, refresh, layouts, macros, annotation helpers, and safe-scoped-variable wrapping | Core panel path | Process-wide singleton initialized from `window.grafanaBootData` by default | Required adapter/initialization; Workstream 5 must establish a supported minimal configuration path |
| Panel importer/cache | `getPluginImportUtils` in `VizPanel` and `loadPanelPluginSync` | Every `VizPanel` load | Process-wide, set-once runtime singleton | Required panel resolver adapter; built-in panel availability is a POC blocker |
| Application event bus | `getAppEvents` in `VizPanel` and `VizPanelRenderer` | Core panel path without local cursor sync | Process-wide runtime singleton | Supply an isolated compatible event bus; prove cross-instance event behavior |
| Datasource service | `getDataSourceSrv` in `getDataSource`, datasource variables, and ad hoc variables | Normal saved-dashboard queries and datasource variables | Process-wide runtime singleton | Required datasource adapter; runtime datasource instances alone are insufficient for arbitrary saved dashboards |
| Query execution | `getRunRequest` in `SceneQueryRunner`, query variables, and annotations | Data panels and query variables | Process-wide, set-once runtime callback | Required query adapter; Workstream 5 must verify public setup and cancellation contract |
| Template service | `getTemplateSrv` in legacy annotation execution and ad hoc compatibility patch | Legacy annotations and some datasource behavior | Process-wide singleton, patched by auto ad hoc variables | Avoid where possible; otherwise provide compatibility service and test restoration/isolation |
| Theme context | `useStyles2`/`useTheme2` throughout components; `config.theme2` in field processing | All normal UI rendering | React context plus runtime config | Host-provided `ThemeContext.Provider`; exact `GlobalStyles`, fonts, and portal subset belongs to Workstream 4 |
| Internationalization | `t`, `Trans`, and public `loadResources` | Labels and controls, including default `VizPanel` title | Shared i18n runtime plus package resources | Initialize explicitly and load Scenes resources; minimal contract remains to test |
| Location service | `SceneTimeRange.getUrlState`, URL macros, `UrlSyncManager`; runtime location hooks | URL synchronization or URL macros | Default runtime singleton or context provider | Keep optional; provide a host location adapter only when URL sync is enabled |
| React Router | `useUrlSync`, `SceneApp`, and `SceneAppPage` | URL sync and Scenes app routing | React context | Exclude `SceneApp`; initial POC may omit URL sync, then test host-router integration separately |
| Grafana `PluginPage` | `SceneAppPageView` | Scenes app page integration | Grafana application UI | Exclude as shell/navigation behavior |
| Scopes context | `ScopesVariable` | Dashboards using scopes | Runtime React context | Defer or adapt as an explicitly optional feature |
| Browser globals | `window`, `document`, `performance`, timers, measurements, visibility events | Rendering, sizing, refresh, compatibility | Browser document/window | Accept for a frontend SDK; SSR is out of current scope and must fail predictably if exposed |
| Dashboard API/client | Not provided by Scenes | Dashboard selection by UID | App-owned source today | Project adapter; do not import Grafana application startup or routing |
| Dashboard conversion | Not provided by Scenes | Every saved dashboard | App-owned source today | Versioned conversion boundary; principal nonpublic dependency |
| Built-in panel modules | Not provided by Scenes | Grafana-native visualization fidelity | App-owned source/import map today | Resolve through a supported distribution mechanism or stop; do not deep-import accidentally |

### Theme and configuration coupling

**Verified fact.** `EmbeddedScene` itself calls `useStyles2`. `VizPanel` uses `config.theme2` during field override processing, while its renderer and chrome use the theme context. A context theme and runtime `config.theme2` that disagree can therefore feed different themes into different parts of one panel.

**Inference.** The host adapter must establish one theme value in both required channels and update them coherently. Merely wrapping the component in a theme provider is not proven sufficient.

**Verified fact.** Importing `@grafana/runtime` creates `config` from `window.grafanaBootData`; when absent, it logs an error outside tests and creates sparse fallback boot data. Scenes then reads nested values including `config.bootData.user.weekStart`, `config.bootData.user.timezone`, `config.theme2`, `config.buildInfo.version`, `config.featureToggles`, and `config.minRefreshInterval`.

**Inference.** The sparse fallback is not a valid standalone bootstrap contract because Scenes dereferences values that the fallback does not guarantee.

### Events

**Verified fact.** Every `SceneObjectBase` constructs its own `EventBusSrv`, and scene events can bubble through that object's parent graph. This state is instance-local.

**Verified fact.** Panel context falls back to the runtime's global application event bus when a local cursor synchronization scope is absent. `VizPanelRenderer` also obtains the global bus to publish panel-attention events.

**Inference.** Scene events are naturally isolated, but panel application events are not. Multiple SDK instances could communicate accidentally unless the adapter provides and namespaces a deliberate shared bus or Scenes gains an instance-level injection point.

### URL and location

**Verified fact.** `UrlSyncManager` accepts a `LocationService` constructor argument and cleans its subscriptions through `cleanUp`. This is a useful injection seam.

**Verified fact.** The public `useUrlSync` hook also requires `react-router-dom`'s `useLocation` and calls `useLocationService`; it therefore needs both router context and `LocationServiceProvider`. `SceneTimeRange.getUrlState` directly reads the exported runtime `locationService`, not the manager's injected service.

**Inference.** Full URL synchronization is not entirely instance-injected. The initial standalone POC should keep scene state host-controlled and omit URL sync; a later POC can determine whether one host location service can safely serve multiple scene roots.

## Global singleton and multi-instance analysis

### Scenes-owned shared state

| Shared state | Source | Cleanup/unregister | Multi-instance consequence |
| --- | --- | --- | --- |
| `window.__grafanaSceneContext` | `EmbeddedScene` via `setWindowGrafanaSceneContext` | Restores the previous value only when the deactivated scene is still current | Last-activated scene is visible to legacy `TimeSrv`, `TemplateSrv`, and datasources |
| `runtimePanelPlugins` map | `registerRuntimePanelPlugin.ts` | No public unregister/reset | Plugin IDs are process-wide and duplicate registration throws |
| `runtimeDataSources` map | `RuntimeDataSource.ts` | No public unregister/reset | Datasource UIDs are process-wide and duplicate registration throws |
| Patched `TemplateSrv.getAdhocFilters` | `patchGetAdhocFilters.ts` | Active variable set is removed, but original method is not restored | First auto ad hoc variable permanently patches the shared service for the page lifetime |
| Active ad hoc filter set | `patchGetAdhocFilters.ts` | Entries removed on variable deactivation | Lookup can traverse active filters from multiple roots; same-datasource matching may cross roots |
| Week-start setting/cache | `evaluateTimeRange.ts` and `SceneTimeRange._onActivate` | Deactivation resets the global data-library week start from runtime config | Concurrent roots with different week starts can overwrite one another |
| `sceneAppCache` | `SceneApp.tsx` | No public eviction | Avoided by excluding `SceneApp` |
| Request ID counters and loading-plugin instance | Query/annotation runners and `VizPanelRenderer` | No reset required for correctness shown | Shared identity/cache, low direct isolation risk |

### `EmbeddedScene` compatibility pointer

**Verified fact.** On activation, `EmbeddedScene` saves the existing `window.__grafanaSceneContext`, assigns itself, and returns a cleanup that restores the saved value if it is still current. Upstream tests cover a single scene and nested last-in-first-out activation.

**Inference.** Two concurrently visible scenes cannot both be the active legacy context. Last-in-first-out cleanup restores nested activation correctly, but arbitrary concurrent mount/unmount ordering can restore a scene that was already deactivated and leave a stale pointer. Legacy datasources that depend on the global pointer are therefore incompatible with strong multi-instance isolation.

A project-owned root derived from `SceneObjectBase` could avoid this write, but then compatibility with old `TimeSrv`, `TemplateSrv`, and datasource calls is unproven. That is a POC branch, not a settled design.

### Runtime-owned shared state

**Verified fact.** `@grafana/runtime` stores configuration, application events, datasource service, template service, query callback, plugin import utilities, and default location service at module scope. `setPluginImportUtils` and `setRunRequest` reject a second non-test initialization.

**Inference.** Multiple scene graphs can coexist only within one compatible process runtime. Supporting two dashboards backed by different Grafana base URLs, credentials, organizations, themes, or plugin catalogs in one JavaScript realm is not currently established and may require multiplexing inside each adapter rather than reinitializing Runtime.

### Multi-instance verdict

Per-object state, subscriptions, event buses, and activation counts are instance-owned. Full runtime isolation is not. Multi-instance support is therefore **unverified and high risk**, especially for different Grafana connections or legacy variables/datasources. The SDK must not advertise it until the POC exercises concurrent roots, reversed unmount order, duplicated plugin IDs, separate credentials, and shared event traffic.

## Activation, deactivation, and cleanup

### Core lifecycle

**Verified fact.** [`SceneObjectBase`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/core/SceneObjectBase.tsx) uses reference-counted activation:

- the first `activate()` call runs activation handlers and activates `$timeRange`, `$variables`, `$data`, and behaviors;
- subsequent callers increment the reference count without reactivating;
- the last returned cancellation function runs all deactivation handlers, removes event listeners, and unsubscribes `_subs`;
- calling one cancellation function twice throws; and
- replacing `$data`, `$variables`, `$timeRange`, or behaviors while active deactivates removed objects and activates replacements.

`SceneComponentWrapper` calls `activate()` after mount and returns its cancellation function from the React effect. Pinned tests verify unmount deactivation, subscription cleanup, child deactivation, reference counting, and double-cancellation failure.

### Feature-specific cleanup

| Feature | Verified cleanup | Residual concern |
| --- | --- | --- |
| Query runner | Unsubscribes query, time, and data-layer subscriptions; clears drilldown state | Pending datasource promise and zero-delay time callback have no explicit cancellation token |
| Refresh picker | Clears interval, removes visibility listener, unsubscribes auto-range listener | Browser behavior under Strict Mode still needs observation |
| Live-now behavior | Clears its interval | None found in static trace |
| URL sync | `UrlSyncManager.cleanUp` unsubscribes and clears root/location references | Runtime location singleton remains process-wide |
| `VizPanel` | `_subs` cleans the skip-data-query time subscription | In-flight plugin import is not cancelled; plugin instance/cache persists |
| `EmbeddedScene` | Attempts to restore the previous window scene pointer | Concurrent non-LIFO deactivation is unsafe for the compatibility pointer |
| Ad hoc variables | Removes active filter set entry | Shared `TemplateSrv` method remains patched |
| Runtime registrations | None | Panel and datasource maps retain registrations for page lifetime |

**Inference.** The lifecycle foundation is substantially reusable, but “unmount cleans everything” is too strong. The adapter must own abortable dashboard fetches, guard async scene replacement, and define the lifetime of process-wide registrations and runtime services.

## Dependence on unpublished Grafana application code

### Required for current Grafana dashboard parity

**Verified fact.** Grafana 13.2.3 uses unpublished application code for:

- dashboard API discovery and loading by UID;
- V1 migrations through `DashboardModel`;
- V1 and V2 dashboard-to-scene conversion;
- the Grafana-specific `DashboardScene` root, behaviors, menus, and layout serializers;
- panel metadata discovery;
- built-in panel dynamic imports;
- third-party panel SystemJS/import-map handling; and
- the concrete runtime bootstrap that installs service singletons.

Scenes imports none of those application paths directly. Instead, it receives results through scene objects and Runtime getters.

**Inference.** This separation is favorable for an adapter architecture: the package is not intrinsically tied to Grafana's navigation shell. It is unfavorable for turnkey reuse: exact dashboard fidelity depends on functionality that is neither shipped by Scenes nor exposed as a stable public Grafana package API.

### Explicit boundary decisions

| Application capability | Decision for the candidate path |
| --- | --- |
| Grafana application bootstrap (`GrafanaApp.init`) | Reject; violates the no-shell constraint |
| `SceneApp`/`PluginPage` routing integration | Reject; host owns routing and navigation |
| Public Scenes graph and rendering primitives | Keep behind project adapters |
| Grafana `DashboardScene` class | Do not deep-import; reproduce only necessary behavior through public primitives if feasible |
| V1/V2 conversion | Treat as a versioned compatibility boundary; feasibility and licensing must be resolved before implementation |
| Built-in panel importer and modules | Treat as a release-blocking adapter question; no silent fallback to non-native panels |
| Runtime service setup | Define a minimal, explicit process runtime; do not invoke full Grafana startup |
| Shell-only analytics, impressions, chrome, and navigation effects | Exclude |

## POC feature coverage and gates

This is a static readiness assessment, not POC evidence.

| Behavior | Public Scenes primitive | Static assessment | POC gate |
| --- | --- | --- | --- |
| Root graph and layout | `SceneObjectBase`, `EmbeddedScene`, grid/flex layouts | Candidate | Render without `SceneApp` or `PluginPage` |
| Time range | `SceneTimeRange`, picker | Candidate with config/location coupling | Change time and verify requests plus cleanup |
| Refresh | `SceneRefreshPicker` | Candidate | Verify timers stop on unmount and visibility changes |
| Query execution | `SceneQueryRunner` | Candidate with runtime services | Resolve datasource, run, cancel, switch UID |
| Variables | Public variable classes | Candidate by type | Test constant, custom, query, datasource, and ad hoc separately |
| Transformations | `SceneDataTransformer` | Candidate | Confirm saved transform registry initialization |
| Annotations | Data-layer exports | Candidate with legacy runtime dependencies | Test one standard and one legacy datasource path |
| Repeated panels/rows | Repeater exports | Candidate | Compare saved-dashboard behavior and keys |
| Panel rendering | `VizPanel` | Candidate with plugin resolver/theme/events | Render representative built-in panels |
| Dashboard DTO conversion | None | Blocked statically | Convert both one V1 and one V2 fixture without deep imports |
| Built-in visualization loading | No modules/importer included | Blocked statically | Load exact Grafana-native panel code through an acceptable distribution path |
| Multiple roots | Instance graph plus shared globals | High risk | Mount two roots, reverse unmount order, separate runtime identities |
| React 19 | Used by Grafana despite React 18 peer declaration | Unverified | Clean install and Strict Mode lifecycle run |

The POC should stop if it requires the Grafana application entry point, route tree, navigation, or an iframe. It should also stop and report a blocker if native built-in panels cannot be obtained through an acceptable supported and distributable path.

## Verified facts

1. Grafana OSS 13.2.3 pins `@grafana/scenes@8.13.5`, and the published package points to the pinned Scenes tag commit.
2. The package exposes a single public JavaScript/types entry point plus its manifest; deep source paths are not exported.
3. Public exports include the core scene graph, lifecycle, time, query, variables, transformations, layouts, repeaters, `EmbeddedScene`, and `VizPanel` primitives.
4. The package contains no public dashboard-by-UID loader, saved-dashboard converter, Grafana `DashboardScene`, legacy dashboard migration path, or built-in panel implementation.
5. Official documentation targets Grafana app plugins rather than independent React hosts.
6. The package declares React 18 peers, while the pinned Grafana baseline consumes it with React 19.2.8.
7. `VizPanel` resolves plugins through the runtime plugin-import singleton and renders them with Grafana data, UI, runtime, and i18n facilities.
8. `SceneQueryRunner` resolves datasources through a Scenes runtime map, an inline datasource, or the runtime datasource service, and executes through the runtime run-request callback.
9. Scene activation is reference-counted and the core deactivation path disposes registered handlers, event listeners, and subscriptions.
10. `EmbeddedScene`, runtime registrations, ad hoc compatibility, week-start handling, and several Runtime services use shared mutable state.
11. `SceneApp` brings React Router and Grafana `PluginPage`; it is not required to construct an `EmbeddedScene` graph and should be excluded from this SDK path.
12. Grafana's complete dashboard conversion and panel-loading path still crosses unpublished application-source boundaries.

## Inferences

1. Scenes is suitable as a package-native set of rendering and state primitives, but not as the SDK's entire dashboard runtime.
2. A constrained subset can preserve the no-iframe and no-shell constraints if the project owns explicit adapters for dashboard retrieval, conversion, Runtime services, theme/i18n, and plugin resolution.
3. `EmbeddedScene` is safe only for one effective legacy scene context at a time; a custom root may improve isolation but may reduce compatibility with older datasources.
4. One process-wide Grafana compatibility runtime is more realistic than fully independent per-component runtimes with the current APIs.
5. Built-in panel distribution and dashboard conversion, not the basic scene lifecycle, are the largest feasibility risks.
6. The ongoing adapter and regression burden will be material because application-only conversion and import behavior can change between Grafana patches even when Scenes' public primitives remain stable.

## Open questions

1. Can the exact package set install and run cleanly with React 19.2.8 in an independent host despite Scenes' React 18 peer range?
2. What supported mechanism can initialize or configure `@grafana/runtime` without depending on `window.grafanaBootData` or full Grafana startup?
3. Can a host supply the data source service, run-request callback, application events, template service, and plugin import utilities entirely through published Runtime exports?
4. How can Grafana's built-in panel modules and third-party panel assets be loaded without unpublished app imports or reproducing the Grafana shell?
5. Can V1 migrations and V1/V2 dashboard conversion be maintained legally and operationally behind a versioned adapter?
6. Which dashboard features require Grafana-specific `DashboardScene` behaviors rather than public Scenes primitives?
7. Which `@grafana/ui` provider, global styles, fonts, portals, and browser polyfills are the minimum for faithful panel rendering?
8. How should Scenes translation resources be registered, and what occurs before i18n initialization?
9. Does unmount cancel underlying HTTP/stream work, or only unsubscribe the local observable?
10. Can a late datasource or panel-plugin promise mutate an obsolete scene after a UID change, and can an adapter guard it reliably?
11. Can two roots render concurrently without cross-talk in app events, ad hoc filters, URL state, week start, template interpolation, or the window scene pointer?
12. Can two Grafana servers or organizations coexist in one page when the Runtime service slots are process-wide and some setters are one-shot?

## Recommendation

**Adopt a constrained Scenes subset behind adapters.**

Use the public scene graph, lifecycle, `SceneQueryRunner`, variables, transformations, layouts, and `VizPanel` only behind a project-owned compatibility boundary. Exclude `SceneApp`, `SceneAppPage`, `PluginPage`, and Grafana navigation. Do not expose Scenes types as the SDK's eventual public contract and do not deep-import Grafana application code.

This recommendation is provisional, not dependency approval. Advance to the remaining Phase 0 workstreams and require the minimal POC to prove these go/no-go gates:

1. exact-version React 19 installation and rendering;
2. minimal Runtime, theme, and i18n initialization without Grafana boot or shell;
3. native built-in panel resolution through an acceptable distribution path;
4. V1 and V2 dashboard conversion through a bounded, maintainable path;
5. cancellation and stale-async protection across UID changes and unmounts; and
6. concurrent-root behavior, including legacy compatibility globals.

If native panels or dashboard conversion cannot cross the published-package boundary acceptably, reject this candidate at the POC gate and evaluate direct composition of published `@grafana/data` and `@grafana/ui` contracts with separately distributable panel plugins as the next Grafana-native path. That fallback would preserve native plugin contracts but would give up Scenes as the primary dashboard runtime.

## Upstream references

- [Scenes package manifest at `v8.13.5`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/package.json)
- [Scenes public entry point](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/index.ts)
- [Scenes package README](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/README.md)
- [Official Scenes setup guide](https://grafana.com/developers/scenes/)
- [Official Scenes app guide](https://grafana.com/developers/scenes/scene-app)
- [Official Scenes layout guide](https://grafana.com/developers/scenes/scene-layout/)
- [`SceneObjectBase`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/core/SceneObjectBase.tsx)
- [`SceneComponentWrapper`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/core/SceneComponentWrapper.tsx)
- [`EmbeddedScene`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/EmbeddedScene.tsx)
- [`setWindowGrafanaSceneContext`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/utils/compatibility/setWindowGrafanaSceneContext.ts)
- [`VizPanel`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx)
- [`VizPanelRenderer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx)
- [`registerRuntimePanelPlugin`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/registerRuntimePanelPlugin.ts)
- [`SceneQueryRunner`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts)
- [`getDataSource`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/utils/getDataSource.ts)
- [`RuntimeDataSource`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/RuntimeDataSource.ts)
- [`UrlSyncManager`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/services/UrlSyncManager.ts)
- [`useUrlSync`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/services/useUrlSync.ts)
- [`AdHocFiltersVariable` compatibility patch](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/variables/adhoc/patchGetAdhocFilters.ts)
- [Grafana Runtime configuration at `v13.2.3`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/config.ts)
- [Grafana Runtime query service](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/QueryRunner.ts)
- [Grafana Runtime plugin import utilities](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/utils/plugin.ts)
- [Grafana dashboard scene source](https://github.com/grafana/grafana/tree/v13.2.3/public/app/features/dashboard-scene)
- [Grafana panel plugin source](https://github.com/grafana/grafana/tree/v13.2.3/public/app/plugins/panel)
