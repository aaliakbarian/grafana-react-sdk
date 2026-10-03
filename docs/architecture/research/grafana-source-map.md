# Grafana OSS 13 Source Map

Related documents:

- `docs/project/project-context.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/research/phase0-research-plan.md`
- `docs/architecture/decisions/`

## Document metadata

| Field | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 1: Grafana repository and source investigation |
| Status | Completed source investigation; standalone rendering feasibility requires further package analysis and POC validation |
| Research date | 2026-09-30 |
| Selected baseline | Grafana OSS `v13.2.3` |
| Baseline commit | `6193dc03311b631b9727b560d24369e683dc396e` |

## Scope and evidence labels

This document maps Grafana's dashboard-by-UID path from retrieval to native React panel rendering. It is a static source investigation only: no SDK code was written, no package was installed, and no browser POC was run.

Findings use these labels:

- **Verified fact**: directly supported by the pinned source, release metadata, package manifest, or npm registry metadata.
- **Inference**: a reasoned consequence of verified facts that has not yet been demonstrated in an independent React host.
- **Open question**: requires a later package investigation or controlled POC.

## Baseline selection

### Release availability and selection rule

**Verified fact.** The official Git remote contains stable Grafana 13 tags from `v13.0.0` through `v13.2.3`. The [Grafana 13.2.3 release](https://github.com/grafana/grafana/releases/tag/v13.2.3) is marked **Latest**, was released on 2026-09-29, and identifies commit `6193dc0`. It includes security fixes, so selecting an earlier patch solely because it was encountered first would create an avoidable and stale baseline.

The selected baseline is therefore the latest non-prerelease Grafana OSS 13 release available at the start of this investigation:

| Item | Exact value | Evidence |
| --- | --- | --- |
| Release/tag | `v13.2.3` | Official release page and `refs/tags/v13.2.3` |
| Annotated tag object | `5dff8abc79d46598be0b176c92867cac4a8d8f14` | `git rev-parse refs/tags/v13.2.3` |
| Peeled commit | `6193dc03311b631b9727b560d24369e683dc396e` | `git rev-parse refs/tags/v13.2.3^{}` |
| Commit subject | `Release: 13.2.3 (#133774)` | Pinned commit metadata |
| Commit timestamp | `2026-09-29T11:01:04+02:00` | Pinned commit metadata |

All Grafana repository links below are pinned to `v13.2.3`. This baseline must not float automatically when another Grafana 13 patch is released.

### Frontend and toolchain versions

**Verified fact.** The [root manifest](https://github.com/grafana/grafana/blob/v13.2.3/package.json) and package manifests pin the following versions:

| Package/tool | Version or constraint | Publication evidence |
| --- | --- | --- |
| Grafana | `13.2.3` | Root `package.json` |
| [`@grafana/data`](https://registry.npmjs.org/%40grafana%2Fdata/13.2.3) | `13.2.3` | npm integrity `sha512-EClmL+1ri5uQi0oTbXQCvNvRQ8a+mHbzX+CUlWvu+N4gVLRD0Zfa3k/POfJyxArdlpH3j3mN/3hmfnuogm63Nw==` |
| [`@grafana/ui`](https://registry.npmjs.org/%40grafana%2Fui/13.2.3) | `13.2.3` | npm integrity `sha512-hs7y5Hk1n962kZQR9rtZvjOiMW+RsIUcb70F8JTQhFaDz17Sw4aJGjHVnnp0cBnluG6UTMcDC3+/rLeXJAEIgw==` |
| [`@grafana/runtime`](https://registry.npmjs.org/%40grafana%2Fruntime/13.2.3) | `13.2.3` | npm integrity `sha512-TS8Qdzkg3uOUefgpfl+6kIK6LeOE60PLLBMvDayCMXmqhoqM/c4ufNVyPOTkAfFiM8BA2AFgG8d+qelJQnYtuQ==` |
| [`@grafana/schema`](https://registry.npmjs.org/%40grafana%2Fschema/13.2.3) | `13.2.3` | npm integrity `sha512-rk8FEO7yuFfRTK/JD39747SZFQ+iCTQbpm6Mh2OjnqGx/g/uQQFx56t64eCLXWEyoR68ru4cigcGKrXk+ozrLg==` |
| [`@grafana/scenes`](https://registry.npmjs.org/%40grafana%2Fscenes/8.13.5) | `8.13.5` | npm integrity `sha512-3b3f1Ms4h2QrCzk4YqxDPqv99PQ+ksp8pYeJ5yvAu9SFpnQMjzUd8w6Ny2e8Y3a7y1pOMo6LMuf3xQea1jEqrw==` |
| [`@grafana/scenes-react`](https://registry.npmjs.org/%40grafana%2Fscenes-react/8.13.5) | `8.13.5` | npm integrity `sha512-GON4dsKE+aZwLjPsdH1jrVFuj44wJSHDwhzcO73Z2Ew8xn7EiJe8kHE3tzj5U7tS0bSf6wjYAhMf7J5skFmKmw==` |
| React / React DOM | `19.2.8` | Root `package.json` |
| Node.js | `>= 22 <25` | Root `engines.node` |
| Package manager | Yarn `4.17.1` | Root `packageManager` and `.yarnrc.yml` |

The four Grafana packages at `13.2.3` declare React and React DOM peer constraints of `>=19`. The published Scenes `8.13.5` metadata declares React and React DOM peers of `^18.0.0`, while Grafana itself resolves React `19.2.8` with that Scenes version.

**Open question.** A standalone host must test this Scenes peer-range mismatch under its selected package manager. Grafana's own lockfile demonstrates the combination is used in the monorepo, but that does not prove a clean or supported consumer installation.

### Licensing boundary

**Verified fact.** The Grafana root manifest is `AGPL-3.0-only`. The published `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/schema`, `@grafana/scenes`, and `@grafana/scenes-react` package metadata is `Apache-2.0`.

The dashboard loader, dashboard-to-scene converters, plugin importer, and built-in panel modules mapped below live under Grafana's application source rather than those published package surfaces.

**Open question.** Any proposal to copy, adapt, or redistribute Grafana application-source modules needs a project licensing review. This source map makes no legal conclusion.

## Repository frontend topology

**Verified fact.** Grafana is a Yarn workspace. The root workspace includes `packages/*` and `public/app/plugins/*/*`, but the dashboard experience is split between published packages and Grafana application code.

| Area | Role in the traced path | Representative source |
| --- | --- | --- |
| `packages/grafana-data` | Data frames, panel plugin contracts, registries, field processing, themes, and shared models | [`packages/grafana-data`](https://github.com/grafana/grafana/tree/v13.2.3/packages/grafana-data) |
| `packages/grafana-ui` | Panel chrome, error boundaries, theme-aware UI, and visualization building blocks | [`packages/grafana-ui`](https://github.com/grafana/grafana/tree/v13.2.3/packages/grafana-ui) |
| `packages/grafana-runtime` | Config and singleton service contracts for backend, data sources, queries, events, location, plugin imports, and embedded component indirection | [`packages/grafana-runtime`](https://github.com/grafana/grafana/tree/v13.2.3/packages/grafana-runtime) |
| `packages/grafana-schema` | V1 and V2 dashboard and panel schema types | [`packages/grafana-schema`](https://github.com/grafana/grafana/tree/v13.2.3/packages/grafana-schema) |
| `public/app/features/dashboard-scene` | Grafana-owned dashboard state managers, serializers, layouts, behaviors, and embedded renderer | [`dashboard-scene`](https://github.com/grafana/grafana/tree/v13.2.3/public/app/features/dashboard-scene) |
| `public/app/features/dashboard` | Dashboard API clients and loader services | [`dashboard`](https://github.com/grafana/grafana/tree/v13.2.3/public/app/features/dashboard) |
| `public/app/features/plugins` | Panel metadata lookup, module loading, SystemJS loading, and built-in import map | [`plugins`](https://github.com/grafana/grafana/tree/v13.2.3/public/app/features/plugins) |
| `public/app/plugins/panel` | Built-in panel implementations such as `timeseries`, `stat`, `table`, and `text` | [`panel plugins`](https://github.com/grafana/grafana/tree/v13.2.3/public/app/plugins/panel) |
| `public/app/app.ts` | Full Grafana application bootstrap and singleton/registry initialization | [`GrafanaApp.init`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts) |
| `pkg/api` and `pkg/services/dashboards` | Server-side legacy HTTP handlers and dashboard services | [`pkg/api/dashboard.go`](https://github.com/grafana/grafana/blob/v13.2.3/pkg/api/dashboard.go) |

The [`public/app/plugins/panel/timeseries`](https://github.com/grafana/grafana/tree/v13.2.3/public/app/plugins/panel/timeseries) directory has no independently published package manifest. The same is true for the other representative built-in panel directories inspected.

## Dashboard loading flow by UID

### Primary embedded flow

**Verified fact.** Grafana 13's embedded component does not start with a legacy dashboard React model. It requests a dashboard and converts it to a Scenes object graph:

1. [`EmbeddedDashboard`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/embedding/EmbeddedDashboard.tsx) receives `uid` and calls `getDashboardScenePageStateManager().loadDashboard({ uid, route: DashboardRoutes.Embedded })`.
2. [`DashboardScenePageStateManagerBase.loadScene`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/pages/DashboardScenePageStateManager.ts) resolves available API versions, calls `fetchDashboard`, enriches load options, and calls `transformResponseToScene`.
3. `UnifiedDashboardScenePageStateManager.withVersionHandling` delegates to the V1 or V2 state manager and switches managers when a `DashboardVersionError` reports a different stored version.
4. [`DashboardLoaderSrv.loadDashboard`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/services/DashboardLoaderSrv.ts) selects `getDashboardAPI('v1')` for V1 state; `DashboardLoaderSrvV2` selects V2.
5. [`getDashboardAPI`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/dashboard_api.ts) uses `DashboardAPIVersionResolver`, then creates the V1, V2, or unified client.
6. [`DashboardAPIVersionResolver.resolve`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/DashboardAPIVersionResolver.ts) discovers versions for API group `dashboard.grafana.app`, preferring stable `v1` or `v2` and falling back to `v1beta1` or `v2beta1` if discovery fails.
7. [`K8sDashboardAPI.getDashboardDTO`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v1.ts) or [`K8sDashboardV2API.getDashboardDTO`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v2.ts) requests the dashboard's `dto` subresource.
8. [`ScopedResourceClient`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/apiserver/client.ts) constructs `/apis/{group}/{version}/namespaces/{namespace}/{resource}` and `subresource` appends `/{uid}/dto`.
9. The selected state manager transforms the DTO into a `DashboardScene`, caches it, and exposes it through state.
10. `EmbeddedDashboardRenderer` activates the scene with `model.activate()`, renders `controls.Component` and `body.Component`, and returns the activation cleanup on unmount.

The resulting endpoint shape is:

`GET /apis/dashboard.grafana.app/{resolved-version}/namespaces/{namespace}/dashboards/{uid}/dto`

The pinned [Dashboard HTTP API documentation](https://github.com/grafana/grafana/blob/v13.2.3/docs/sources/developer-resources/api-reference/http-api/dashboard.md) documents the V1 form. The older `/api/dashboards/uid/{uid}` handler still exists in `pkg/api`, but its source is marked deprecated and it is not the normal V13.2.3 frontend path traced above.

### Loading-flow implications

| Finding | Classification | Implication |
| --- | --- | --- |
| The UID is the resource name used by the DTO subresource call. | Verified fact | UID selection maps directly to the new Dashboard API resource path. |
| API version discovery is a network prerequisite before client construction. | Verified fact | A standalone adapter must either reproduce discovery or deliberately pin and validate one API version. |
| DTO conversion can perform a folder lookup through `getFolderByUidFacade`. | Verified fact | Loading may involve more than one HTTP request and currently crosses into Grafana app API-client state. |
| The loader records impressions and the state manager emits analytics/navigation-related effects. | Verified fact | These are application behaviors to exclude or adapt; they are not required by the project objective. |
| A host-provided `BackendSrv` could supply authentication-aware transport for the same endpoints. | Inference | Feasibility depends on public runtime initialization and browser auth/CORS tests. |

## Dashboard model and state construction

Grafana 13.2.3 has two conversion paths.

### V1 dashboard schema

**Verified fact.** [`transformSaveModelToScene`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelToScene.ts) constructs `new DashboardModel(rsp.dashboard, rsp.meta)` specifically to run migrations. It then calls `createDashboardSceneFromDashboardModel`.

That builder creates:

- a `DashboardScene` root;
- scene time range, refresh controls, variables, annotations, and alert-state layers;
- a layout containing `DashboardGridItem` objects; and
- one Scenes `VizPanel` per panel through `buildGridItemForPanel`.

`buildGridItemForPanel` copies the panel type into `VizPanelState.pluginId`, supplies options and field configuration, and attaches a panel data provider created by `createPanelDataProvider`.

### V2 dashboard schema

**Verified fact.** [`transformSaveModelSchemaV2ToScene`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene.ts) consumes the V2 `DashboardWithAccessInfo<DashboardV2Spec>` directly rather than constructing the legacy `DashboardModel`.

It uses [`layoutDeserializerRegistry`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/layoutSerializers/layoutSerializerRegistry.ts) for `GridLayout`, `AutoGridLayout`, `RowsLayout`, and `TabsLayout`, then creates the `DashboardScene`. Layout utilities such as [`buildVizPanel`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts) turn V2 panel elements into Scenes `VizPanel` objects.

### Panel data state

**Verified fact.** [`createPanelDataProvider`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/utils/createPanelDataProvider.ts) creates a Scenes `SceneQueryRunner` from the panel's data source, queries, cache settings, interval, and panel ID. It wraps that runner in `SceneDataTransformer` using the panel's saved transformations. Panels without targets, or plugin metadata marked `skipDataQuery`, receive no query runner.

The pinned Scenes [`SceneQueryRunner`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts) resolves a data source, prepares `DataQueryRequest` objects, and calls the `getRunRequest()` function supplied through `@grafana/runtime`. It publishes `PanelData` back into the scene graph.

## Panel plugin and visualization loading

### Resolution sequence

**Verified fact.** The dashboard rendering path resolves panels as follows:

1. A `VizPanel` is activated and calls its `_loadPlugin` method in [`@grafana/scenes` `VizPanel`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx).
2. Scenes first checks its runtime panel cache. On a miss, it calls `getPluginImportUtils().importPanelPlugin(pluginId)` from `@grafana/runtime`.
3. Grafana supplies that callback from [`importPanelPlugin`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importPanelPlugin.ts). It obtains `PanelPluginMeta`, delegates to `pluginImporter.importPanel`, and caches the promise and aliases.
4. [`pluginImporter`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/pluginImporter.ts) rejects Angular plugins, imports the module, requires a `plugin` export, attaches metadata, and caches the resulting `PanelPlugin`.
5. [`importPluginModule`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/importPluginModule.ts) selects either a built-in dynamic import or an external `SystemJS.import`, with optional sandbox and integrity handling.
6. [`built_in_plugins.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/built_in_plugins.ts) maps identifiers such as `core:plugin/timeseries` to webpack dynamic imports of Grafana application modules.
7. A built-in module such as [`timeseries/module.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/module.tsx) exports a configured `PanelPlugin` whose React component is the visualization.
8. Scenes [`VizPanelRenderer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx) applies field configuration, renders `PanelChrome`, provides plugin/panel context, and renders `plugin.panel` with `PanelData`, time range, options, field configuration, dimensions, interpolation, and event bus callbacks.

Grafana also has an application-owned [`PanelRenderer`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/panel/components/PanelRenderer.tsx) that performs similar plugin resolution. The primary Scenes dashboard trace above renders through `VizPanelRenderer`, not this component. `GrafanaApp.init` nevertheless assigns `PanelRenderer` to a runtime shim for other consumers.

### Plugin metadata

**Verified fact.** [`getPanelPluginMetas`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/pluginMeta/panels.ts) is awaited during application startup. Without the multi-tenant plugin metadata feature, initial metadata comes from `config.panels`; the explicit refresh path reads `/api/frontend/settings`. With that feature enabled, metadata is obtained through the newer plugin metadata service. The Grafana application importer accesses these functions through `@grafana/runtime/internal`.

**Verified fact.** The published `@grafana/runtime@13.2.3` manifest exports `.`, `./unstable`, and `./package.json`, but not `./internal`. The source manifest's internal export exists for Grafana's source workspace and its own comment states that the pack process removes it.

**Inference.** Grafana's built-in visualization loading cannot be adopted by importing only documented npm entry points. A standalone implementation must prove another supported resolver, consume server-hosted plugin assets through a compatible mechanism, or accept an application-source dependency and its associated support/licensing costs.

## Runtime and context initialization map

[`GrafanaApp.init`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts) initializes the full Grafana application. The SDK must not call it because it also sets up the store, extensions, router-adjacent behavior, chrome, navigation, and other shell concerns. The source trace identifies the smaller rendering-related subset below, but only a POC can prove which entries are strictly necessary.

| Dependency | Upstream initialization or use | Preliminary disposition | Evidence status |
| --- | --- | --- | --- |
| Boot configuration | `@grafana/runtime` constructs `config` from `window.grafanaBootData`; converters and Scenes read themes, feature toggles, default data source, build info, and limits. | Unresolved. Define an explicit host configuration path; do not require Grafana's page boot payload without proving necessity. | Verified source dependency; standalone setup open |
| Backend transport | `setBackendSrv(backendSrv)` precedes dashboard API and plugin metadata calls. | Host-supplied adapter, including credentials, errors, and base URL. | Verified source dependency |
| Dashboard API discovery/client | `DashboardAPIVersionResolver`, `ScopedResourceClient`, V1/V2 clients. | Adaptable, but app-owned and unpublished. | Verified source dependency |
| Data-source settings and service | Grafana initializes data-source instance settings/importer, constructs `DatasourceSrv`, then calls `setDataSourceSrv`. | Host-supplied or adapted runtime service. | Verified source dependency |
| Query execution | Grafana calls `setQueryRunnerFactory` and `setRunRequest`; Scenes calls `getRunRequest`. | Required for data panels; exact minimal contract is a later workstream. | Verified source dependency |
| Panel metadata and importer | Grafana loads panel metadata, calls `setPluginImportUtils`, and owns built-in/SystemJS import paths. | Major adapter boundary and POC risk. | Verified source dependency |
| Application event bus | Grafana calls `setAppEvents`; `VizPanelRenderer` calls `getAppEvents`. | Host-supplied event bus or adapter. | Verified source dependency |
| Theme and styles | `AppWrapper` provides `ThemeContext`, `GlobalStyles`, and portal infrastructure; panels use theme-aware `@grafana/ui`. | Host-supplied provider/styles; exact CSS and portal subset unresolved. | Verified full-app setup; minimal subset open |
| Internationalization | Grafana initializes i18n and loads Scenes resources before rendering. | Adaptable, likely required for reliable component initialization and labels. | Verified full-app setup; minimal subset open |
| Location and URL state | Grafana initializes `locationService`/`locationUtil`; state managers read query parameters and can rewrite URLs. Embedded rendering additionally uses Scenes URL-state utilities without syncing to host URL automatically. | Replace shell navigation with a bounded host location/state adapter. | Verified source dependency |
| Standard transformation registry | Grafana initializes `standardTransformersRegistry`; saved transformations are executed by `SceneDataTransformer`. | Likely required when transformations are in POC scope. | Verified initialization; omission behavior open |
| Current user, locale, week start, and timezone | Grafana sets these before rendering. | Provide explicit neutral/host values; determine per-panel requirements. | Verified initialization; minimal subset open |
| Embedded component implementation | Public `@grafana/runtime` exports an alpha `EmbeddedDashboard` variable whose default throws `EmbeddedDashboard requires runtime initialization`; Grafana sets it to `EmbeddedDashboardLazy`. | Not a standalone entry point by itself. | Verified fact |
| Redux store, nav model, impressions, analytics, app chrome, extension registries | App-owned loader/bootstrap code touches several of these, but they do not define panel rendering. | Shell-only for this project; app-owned loading code must be separated from them. | Verified coupling; safe removal open |
| Router and Grafana navigation | Initialized by `AppWrapper` and the full application, not by `EmbeddedDashboardRenderer` itself. | Exclude under accepted constraints. | Verified fact |

### Singleton and lifecycle concerns

**Verified fact.** Backend, data-source, event, query, and plugin-import services are module-level singletons. `setPluginImportUtils` and `setQueryRunnerFactory` are guarded against repeated initialization. `config` is also a module-level object created during import.

**Inference.** A process-wide compatibility runtime may be necessary even if dashboard scene instances are isolated. This creates risks for multiple configurations, hot reload, tests, micro-frontends, and mounting dashboards backed by different Grafana instances in one page.

**Verified fact.** Once constructed, the embedded scene is explicitly activated and returns a cleanup function. The state manager also clears its state when the component unmounts.

**Open question.** The later Scenes investigation must verify that all query subscriptions, refresh timers, plugin state, caches, and global registrations are disposed or safely reused across repeated mount/unmount cycles.

## Published-package boundary

| Capability | Location | Published public surface? | Finding |
| --- | --- | --- | --- |
| Scene graph primitives, `VizPanel`, layouts, variables, and query runner | `@grafana/scenes` | Mostly yes; exact export status belongs to Workstream 2 | Candidate native runtime |
| Grafana-specific `DashboardScene` root and dashboard behaviors | `public/app/features/dashboard-scene` | No standalone package found | Must be adapted, replaced, or otherwise bounded |
| Data and panel contracts | `@grafana/data` | Yes, with stable/unstable surfaces | Candidate dependency |
| Theme-aware components and panel chrome | `@grafana/ui` | Yes, with stable/unstable surfaces | Candidate dependency |
| Runtime getters/setters and alpha embedded shim | `@grafana/runtime` | Partly; public and unstable surfaces exist | Candidate service boundary, not turnkey bootstrap |
| Dashboard V1/V2 schema | `@grafana/schema` | Yes | Candidate DTO/type dependency |
| Dashboard-by-UID loader and API-version orchestration | `public/app/features/dashboard` | No standalone package found | Must be adapted or replaced |
| V1/V2 dashboard-to-scene conversion | `public/app/features/dashboard-scene/serialization` | No standalone package found | Central unsupported/internal boundary |
| Grafana embedded implementation | `public/app/features/dashboard-scene/embedding` | No; runtime only exposes an injected shim | Cannot be imported as a complete npm component |
| Panel metadata access used by Grafana importer | `@grafana/runtime/internal` | No in the published `13.2.3` manifest | Cannot be a releasable deep import |
| Built-in panel import map and implementations | `public/app/features/plugins` and `public/app/plugins/panel` | No standalone packages found | Central visualization-loading risk |

## Verified facts

1. Grafana OSS `v13.2.3` exists and is the latest official Grafana 13 release at the research date; its peeled commit is pinned above.
2. Grafana 13.2.3 uses React `19.2.8`, Yarn `4.17.1`, Grafana frontend packages `13.2.3`, and Scenes `8.13.5`.
3. Grafana 13 dashboards are Scenes-powered; the normal embedded path constructs and activates a `DashboardScene` rather than rendering the full Grafana route tree.
4. Dashboard loading by UID uses API discovery plus the `dashboard.grafana.app` DTO subresource, with separate V1 and V2 transformation paths.
5. V1 conversion runs legacy `DashboardModel` migrations; V2 conversion deserializes the V2 layout and elements directly.
6. Saved panel targets become a Scenes query runner and transformation node; the resulting `PanelData` is rendered by Scenes `VizPanelRenderer`.
7. `VizPanel` depends on runtime-injected panel import utilities. Grafana's implementation combines backend-provided metadata, a built-in dynamic import map, and SystemJS for non-built-ins.
8. The complete loading, conversion, embedded-renderer, and built-in visualization path is not contained in the published public Grafana packages.
9. The public alpha `@grafana/runtime` `EmbeddedDashboard` export throws until Grafana application code injects an implementation.
10. Full Grafana startup initializes many service singletons and providers before dashboard rendering; calling that startup would violate this project's no-shell constraint.

## Assumptions and inferences to test

1. A package-only SDK may be feasible if it supplies a deliberately small runtime adapter and a maintained dashboard-to-scene conversion layer.
2. The Kubernetes-style DTO endpoint is a better V13 target than the deprecated legacy UID endpoint, but deployment compatibility across Grafana OSS configurations still needs testing.
3. Core panel fidelity may be achievable without the Grafana shell only if built-in panel modules can be resolved from a supported distribution surface or a legally and operationally acceptable alternative.
4. Theme, i18n, events, data-source access, query execution, and plugin loading appear separable from Grafana navigation, but they have not yet been initialized successfully in an independent host.
5. Shell-specific effects in the current state manager—navigation updates, impressions, analytics, folder lookups, and global cache behavior—should not be carried into a minimal SDK loader.

## Open questions

1. Does `@grafana/scenes@8.13.5` expose every primitive needed to build V1 and V2 dashboards without deep imports?
2. Is there an upstream-supported dashboard JSON-to-Scenes converter outside `public/app/features/dashboard-scene`?
3. Can V1 dashboard migrations be invoked through a public package, or must the SDK constrain accepted schema versions?
4. How should the standalone runtime discover and load Grafana's built-in panel modules when `core:plugin/*` currently maps to application-bundled imports?
5. Can third-party panel assets be loaded safely from the Grafana server without reproducing Grafana's full SystemJS/import-map environment?
6. Which public runtime setters are intended for non-Grafana consumers, and which are only exported as historical or internal bootstrap mechanisms?
7. What is the smallest boot configuration object that avoids reliance on `window.grafanaBootData`?
8. Which theme provider, global CSS, fonts, icons, portal roots, and localization resources are required for visual fidelity?
9. Can dashboard API, plugin metadata, data-source proxy, resource, and live endpoints all use one host-provided authenticated transport under realistic CORS and cookie policies?
10. Can multiple dashboards and multiple Grafana base URLs coexist despite runtime singletons and global caches?
11. Does the React 18 peer declaration in Scenes `8.13.5` create install, runtime, or support problems when the exact Grafana baseline uses React 19.2.8?
12. What application-source reuse, adaptation, and distribution choices are acceptable under the relevant package and repository licenses?

## Workstream conclusion

The source path from UID to React panel rendering is traceable without treating Grafana's route tree or navigation as part of the renderer. That is positive evidence for continuing Phase 0.

It is not yet evidence of a standalone SDK path. The current end-to-end implementation crosses several Grafana application-only boundaries: dashboard loading/version orchestration, dashboard-to-scene conversion, runtime bootstrap, panel metadata, and built-in panel module loading. The public `EmbeddedDashboard` shim does not remove those boundaries.

Proceed to Workstreams 2 through 6. The minimal POC should not start until those workstreams decide how each unpublished boundary is handled. No accepted ADR needs revision at this stage, and no SDK dependency is approved by this document.

## Upstream references

- [Grafana OSS 13.2.3 release](https://github.com/grafana/grafana/releases/tag/v13.2.3)
- [Grafana root manifest at `v13.2.3`](https://github.com/grafana/grafana/blob/v13.2.3/package.json)
- [`@grafana/data` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json)
- [`@grafana/ui` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json)
- [`@grafana/runtime` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json)
- [`@grafana/schema` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/package.json)
- [Grafana 13.0 release highlights](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v13-0/)
- [Dashboard HTTP API source documentation](https://github.com/grafana/grafana/blob/v13.2.3/docs/sources/developer-resources/api-reference/http-api/dashboard.md)
- [`@grafana/scenes` `VizPanel` at `v8.13.5`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx)
- [`@grafana/scenes` `VizPanelRenderer` at `v8.13.5`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx)
- [`@grafana/scenes` `SceneQueryRunner` at `v8.13.5`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts)
- [Grafana Scenes package overview](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/README.md)
