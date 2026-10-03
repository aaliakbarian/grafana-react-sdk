# Panel Rendering Dependency Analysis

Related documents:

- `docs/project/project-context.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/research/phase0-research-plan.md`
- `docs/architecture/research/grafana-source-map.md`
- `docs/architecture/research/grafana-scenes-investigation.md`
- `docs/architecture/research/grafana-data-investigation.md`
- `docs/architecture/research/grafana-ui-investigation.md`
- `docs/architecture/research/grafana-runtime-investigation.md`
- `docs/architecture/research/dashboard-json-api-investigation.md`
- `docs/architecture/decisions/`

## Document metadata

| Field | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 7: panel rendering dependency analysis |
| Status | Dependency closure completed; browser and bundler validation remains for Workstream 8 |
| Research date | 2026-10-03 |
| Grafana baseline | Grafana OSS `v13.2.3` at `6193dc03311b631b9727b560d24369e683dc396e` |
| Package baseline | `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/schema`, and `@grafana/i18n` `13.2.3`; `@grafana/scenes` `8.13.5` |
| Representative panels | Time series, Stat, Table, Text |
| Recommendation | **Revise and proceed** to a gated Workstream 8 POC |

## Scope, method, and evidence labels

This document reconciles the first six Phase 0 workstreams into the smallest dependency model that can test native rendering of the four representative Grafana panels in an independent React host. It traces read-only rendering only. Dashboard editing, Grafana navigation, alerts administration, Explore, sharing, and the Grafana application shell are outside scope.

The analysis inspected the pinned Grafana and Scenes sources, their package manifests and export maps, the published package contents, source tests, and official documentation. No SDK or POC code was created and no dependency was added.

Findings use these labels:

- **Verified fact**: directly supported by pinned source, package metadata, a pinned source test, or official documentation.
- **Inference**: a reasoned consequence of verified facts that has not been demonstrated in the independent host.
- **Open question**: requires a controlled Workstream 8 experiment.

Dependency classifications mean:

- **Required public package**: shipped from a declared npm package export and needed in the selected path. This does not imply that every symbol is stable.
- **SDK compatibility adapter**: project-owned boundary that converts, configures, or coordinates Grafana contracts and hides them from the public SDK API.
- **Host-owned dependency**: capability or policy the embedding application must supply.
- **Grafana application-only dependency**: source under `public/app` or another unpublished Grafana application surface.
- **Optional**: useful for additional fidelity but not required by the deliberately constrained POC.
- **Deferred**: deliberately excluded from the POC and revisited later.
- **Unsupported**: explicitly rejected for the initial supported subset.
- **Blocker**: no acceptable supported or experimentally bounded path is yet proven.

## Executive conclusion

**Verified fact.** The dependency chain is not closed by the published Grafana packages alone. The published packages supply the scene graph, panel host, data contracts and processing primitives, runtime service slots, UI primitives, themes, and schemas. They do not supply:

- the V1 or V2 dashboard-to-Scenes converter;
- the four built-in `PanelPlugin` modules;
- Grafana's built-in plugin importer and map;
- concrete standalone Runtime services;
- complete standard field-option and transformation registry initialization; or
- a supported standalone provider that coordinates Runtime configuration, theme, styles, assets, portals, and cleanup.

**Verified fact.** All four representative panel implementations live in Grafana application source. Time series and Table also depend materially on other unpublished application modules. Stat has the smallest application dependency graph. Legacy Text is query-free, while the feature-flagged Text v2 path supports data queries; both depend on application configuration and internal feature-flag APIs.

**Inference.** One browser realm can plausibly host multiple dashboards only when they share one pinned Grafana compatibility runtime, Grafana base URL/authentication context, registry policy, asset base, locale, and broadly compatible theme policy. Per-dashboard scene state is isolatable; Runtime service setters, configuration, registries, plugin caches, icon/public-path state, and the portal root are not.

The recommended decision is **revise and proceed**. Workstream 8 should be a sequence of kill-or-continue gates. It must first prove a legal and technically maintainable way to make the exact built-in panel modules available. It should then prove Text and Stat, followed by the higher-risk Time series and Table paths. Rendering a look-alike from low-level UI primitives does not satisfy the native built-in-panel objective.

## Fixed baseline and version lock

| Component | Exact baseline | Coupling relevant to this workstream |
| --- | --- | --- |
| Grafana OSS | `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` | Owns converters, built-in panel modules, plugin importers, registry initialization, and concrete services |
| `@grafana/data` | `13.2.3` | Shared frame, panel, field, display, link, and transformation contracts |
| `@grafana/ui` | `13.2.3` | Panel chrome, contexts, visualization primitives, Emotion styles, portals, and assets |
| `@grafana/runtime` | `13.2.3` | Process-wide configuration and service slots |
| `@grafana/schema` | `13.2.3` | V1/V2 dashboard and panel schemas and visualization option types |
| `@grafana/i18n` | `13.2.3` | Strings used by Scenes, UI, and panel modules |
| `@grafana/scenes` | `8.13.5`, commit `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` | Scene graph, lifecycle, queries, transformations, and `VizPanel` rendering |
| React / React DOM | `19.2.8` in Grafana | UI packages require React 19; Scenes publishes React 18 peer ranges despite this Grafana combination |

**Decision.** Treat this package set and the four panel modules as one compatibility cohort. Do not independently float Grafana package versions, panel application source, or dashboard schema mappings.

## End-to-end dependency graph

The following graph names every responsibility in the selected path. Boxes marked `app-only` are not supplied by the published package set.

```text
Host React application
  ├─ supplies Grafana base URL, namespace, credential-aware fetch policy,
  │  asset policy, requested dashboard UID, and mount container
  └─ calls SDK compatibility facade
       |
       v
Process/page Runtime coordinator [SDK adapter]
  ├─ establishes Runtime config compatibility before Grafana imports read it
  ├─ installs BackendSrv, DataSourceSrv, runRequest, plugin import utilities,
  │  EventBusSrv, theme/config agreement, and optional template service
  ├─ initializes field-option and transformation registries once
  ├─ coordinates one plugin catalogue/cache and one portal root per document
  └─ rejects a second incompatible Grafana identity in the same realm
       |
       v
Dashboard loader [SDK adapter + host transport]
  ├─ GET /apis/dashboard.grafana.app/
  ├─ choose stable v1 DTO first; retry stable v2 only on a classified version mismatch
  └─ GET /apis/dashboard.grafana.app/{version}/namespaces/{namespace}/
           dashboards/{metadata.name}/dto
       |
       v
DTO classifier and converter [SDK adapter; Grafana reference is app-only]
  ├─ validates requested UID == response metadata.name
  ├─ V1: applies the required classic migrations and schema normalization
  ├─ V2: deserializes layout/elements and normalizes query/transformation kinds
  ├─ rejects library panels, unsupported variables/layouts/transforms/plugins
  └─ creates a public Scenes graph
       |
       v
Scene root + SceneTimeRange + layout + variables [@grafana/scenes]
  └─ one VizPanel per dashboard panel
       ├─ pluginId, pluginVersion, options, fieldConfig, title, display mode
       ├─ no $data for metadata.skipDataQuery panels
       └─ otherwise SceneDataTransformer
              └─ SceneQueryRunner
                   ├─ resolve datasource through DataSourceSrv/runtime catalogue
                   ├─ prepare DataQueryRequest with range, interval, targets,
                   │  scoped variables, dashboard UID, and panel ID
                   ├─ call installed runRequest(DataSourceApi, request)
                   ├─ unsubscribe previous/inactive request
                   └─ normalize DataQueryResponse into PanelData
       |
       v
VizPanel activation [@grafana/scenes]
  ├─ check runtime panel cache
  ├─ call installed importPanelPlugin(pluginId) on a miss
  ├─ run panel migration/defaulting against exact plugin version
  └─ retain PanelPlugin or panel-local load error
       |
       v
Data pipeline
  ├─ SceneDataTransformer -> @grafana/data transformDataFrame
  ├─ VizPanel.applyFieldConfig -> applyFieldOverrides
  ├─ display processors -> units, thresholds, mappings, colors, links
  └─ PanelData + options + dimensions + contexts -> PanelProps
       |
       v
VizPanelRenderer [@grafana/scenes]
  ├─ @grafana/ui PanelChrome + loading/status/cancel UI
  ├─ PluginContextProvider + PanelContextProvider + ErrorBoundaryAlert
  └─ exact application-owned panel React component
       |
       v
ThemeContext + Emotion + required CSS + fonts/icons + portals
       |
       v
ReactDOM native DOM/canvas rendering in the host container
```

### Required initialization order

**Verified fact.** Ordering is observable because Runtime configuration is read during module evaluation, setters are one-shot, and panel registries are lazily captured.

The POC must name and enforce this order:

1. Validate one process-wide compatibility identity: exact versions, Grafana origin, namespace, auth mode, locale, asset base, and theme policy.
2. Establish the minimal Runtime boot/config compatibility state before importing modules that capture `config`, feature flags, public paths, or theme.
3. Install the structural `BackendSrv` adapter using host-owned transport and credentials policy.
4. Install the structural `DataSourceSrv` adapter and the POC datasource catalogue.
5. Install the cancellation-correct `runRequest` function required by `SceneQueryRunner`.
6. Install plugin import utilities whose cache and importer resolve only the four accepted panel IDs.
7. Install `EventBusSrv`; omit location/router integration and Grafana navigation.
8. Populate the standard field-config and transformation registries once, before any `PanelPlugin.fieldConfigRegistry` is read.
9. Construct a coherent `GrafanaTheme2`, set the Runtime theme view, and mount the UI theme context.
10. Establish the style, font/icon asset, public-path, and shared portal policy.
11. Discover the Dashboard API version, load and validate the DTO, then convert it to the constrained scene graph.
12. Mount the scene React component and retain its activation/deactivation cleanup.

Calling this sequence “initialize Grafana” would hide the exact singleton and ownership choices. `GrafanaApp.init`, the route tree, application chrome, and navigation are not in this sequence.

## Dashboard and scene construction dependencies

### Dashboard retrieval and classification

**Verified fact.** The selected POC request sequence is:

1. `GET /apis/dashboard.grafana.app/` through host-owned authenticated transport.
2. Select stable V1 when served.
3. `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}/dto`.
4. Validate that `metadata.name` equals the requested user-facing dashboard UID.
5. Classify the response by `apiVersion` and schema, not by guessed object shape.
6. Retry the stable V2 DTO only when the server explicitly identifies a V2 resource/version mismatch.

The SDK property `<GrafanaDashboard uid="..." />` represents the user-facing Grafana dashboard UID, which is the `/apis` resource `metadata.name` and the `{identifier}` path segment. It is not Kubernetes `metadata.uid`. Classic JSON `uid` and V1 `spec.uid` are compatibility representations of the same logical Grafana identifier, while Kubernetes `metadata.uid` is an opaque resource identity.

Authentication, cookies/tokens, CORS, SameSite, HTTPS, and CSRF deployment policy remain host-owned. Browser bundles must never contain service-account secrets.

### V1 conversion closure

**Verified fact.** Grafana's V1 reference path is app-only:

- `transformSaveModelToScene` constructs `DashboardModel` to run classic migrations;
- `createDashboardSceneFromDashboardModel` creates variables, annotation layers, time state, layout, controls, and application behaviors;
- `buildGridItemForPanel` maps each `PanelModel` to `VizPanelState`; and
- `createPanelDataProvider` creates `SceneQueryRunner`, wrapped by `SceneDataTransformer`.

**SDK compatibility adapter.** The constrained converter must reproduce only accepted read-only semantics: panel identity and grid position, title/description, transparency, options, field configuration, targets, datasource references, query timing settings, transformations, time overrides, and the supported subset of variables. Application menus, inspector hooks, profiling, analytics, annotations editing, reload behaviors, and navigation are excluded.

### V2 conversion closure

**Verified fact.** Grafana's V2 reference path is also app-only. `transformSaveModelSchemaV2ToScene` uses `layoutDeserializerRegistry`; `buildVizPanelState` maps `vizConfig`, query kinds, field mappings, time overrides, and transformations; and layout serializers construct panel containers.

**SDK compatibility adapter.** The POC may defer V2 rendering until V1 succeeds, but it must classify V2 as unsupported rather than treating V2 data as V1. If V2 is admitted, every accepted layout kind and query conversion must be versioned and tested independently.

### Minimal scene root

**Inference.** The SDK does not need Grafana's app-owned `DashboardScene`. A project-owned root or public `EmbeddedScene` can own:

- `SceneTimeRange`;
- a constrained `SceneVariableSet`;
- a public Scenes grid/flex layout;
- `VizPanel` children;
- an optional scene event bus/cursor-sync behavior; and
- an optional data-layer set only after annotations are admitted.

The root must provide dashboard UID and panel ID enrichment for query requests, interpolation, theme-consistent panel context, and a deterministic activation boundary. These are compatibility responsibilities, not reasons to run Grafana's dashboard route or shell.

## Shared panel rendering pipeline

### Plugin resolution

**Verified fact.** `VizPanel._onActivate` first checks the Scenes runtime panel cache. On a miss it calls `getPluginImportUtils().importPanelPlugin(pluginId)`. The import utility must therefore be installed even when a panel was registered through `registerRuntimePanelPlugin`, because the synchronous lookup calls Runtime's plugin utilities before checking the Scenes map.

Grafana's own importer is application-only:

1. `importPanelPlugin` obtains metadata through `@grafana/runtime/internal` and caches a promise.
2. `pluginImporter.importPanel` imports a module, validates its `plugin` export, attaches metadata, and caches it.
3. `importPluginModule` recognizes a built-in path, otherwise configures translations/sandboxing/SRI and calls SystemJS.
4. `built_in_plugins.ts` maps `core:plugin/{id}` to webpack dynamic imports such as `app/plugins/panel/stat/module`.

**Blocker.** The published packages contain neither this map nor the four panel modules. Workstream 8 must prove an explicit panel catalogue whose module ownership, license, build pipeline, chunk URLs, and metadata are acceptable. It must not deep-import files from an npm package that does not export them.

### Query execution

**Verified fact.** For panels with queries, `SceneQueryRunner`:

- waits for a usable width when `maxDataPointsFromWidth` applies;
- reacts to activation, time range, variables, refresh, and visibility;
- resolves a datasource from an inline runtime datasource or `DataSourceSrv`;
- prepares the `DataQueryRequest` including range, interval, targets, scoped variables, caching fields, and enriched context;
- calls the installed `getRunRequest()` function;
- subscribes to the result Observable and calls `preProcessPanelData`; and
- translates synchronous resolution/execution failures into `PanelData` with `LoadingState.Error`.

Unsubscribing the active request is the cancellation contract. The adapter must ensure that unsubscribe reaches `AbortController`, transport cancellation, or the datasource's own cancellation mechanism rather than merely suppressing UI updates.

**Open question.** A generic `/api/ds/query` adapter may execute saved backend datasource queries without loading every datasource frontend module, but it will not reproduce datasource-specific interpolation, supplementary requests, streaming, annotations, or custom frontend-only logic. That is a POC-only emulation until tested against a named supported datasource.

### Transformations and display processing

**Verified fact.** The ordered pipeline is:

1. `SceneQueryRunner.onDataReceived` normalizes response data with `preProcessPanelData`.
2. `SceneDataTransformer` calls `transformDataFrame` separately for series and annotation topics.
3. `VizPanelRenderer` calls `VizPanel.applyFieldConfig`.
4. `applyFieldOverrides` resolves field matchers and processors against the plugin field-config registry, variables, theme, timezone, and feature toggles.
5. Panel components consume processed field display functions, ranges, thresholds, mappings, links, and units through `PanelData` and `PanelProps`.

The standard transformer registry and standard field-config editor registry start empty. Grafana populates them from unpublished application files. Unknown transformation IDs are silently skipped by `transformDataFrame`; absent field registry entries can also produce plausible but incorrect rendering.

**SDK compatibility adapter.** Before constructing a plugin, validate every saved transformation ID and every required field-config property against the installed POC registry. Treat an unknown required entry as an explicit panel-local incompatibility, not as success.

Internal Explore links are outside scope. External data links may be enabled only through an explicit host mapping and safe URL policy.

### React and UI rendering

**Verified fact.** `VizPanelRenderer`:

- measures the container;
- obtains `PanelData` from the nearest scene data provider;
- applies field configuration and scene time range;
- renders `PanelChrome` with loading, streaming, cancel, error, title, and status behavior;
- wraps the panel in `ErrorBoundaryAlert`, `PluginContextProvider`, and `PanelContextProvider`; and
- supplies the panel component with dimensions, data, options, field config, time range/zone, interpolation, callbacks, and event bus.

Use one physical React and React DOM 19.2.8 runtime. Duplicate React copies are a hard startup failure risk for hooks and contexts. The Scenes React 18 peer declaration remains a POC installation and Strict Mode gate.

## Per-panel dependency graphs

### Time series

```text
UID -> V1 DTO -> constrained converter -> VizPanel(pluginId="timeseries")
  -> SceneDataTransformer -> SceneQueryRunner -> datasource/runRequest
  -> transformations -> field overrides/display processors
  -> app-owned timeseries PanelPlugin + migrations/options/config
  -> app-owned TimeSeries + GraphNG path
  -> UI uPlot helpers/plugins + PanelChrome/theme/contexts
  -> uPlot CSS + canvas + ResizeObserver + RAF + portal tooltips/icons/fonts
  -> native DOM and canvas
```

| Stage | Exact dependency and responsibility | Classification |
| --- | --- | --- |
| Plugin definition | `public/app/plugins/panel/timeseries/module.tsx`; `PanelPlugin`, `graphPanelChangedHandler`, generated panel config, presets/suggestions, annotation options | Grafana application-only dependency; **blocker** |
| Query/data | `SceneQueryRunner`, datasource, `runRequest`, `PanelData`; annotations and alert states declared as supported | Required public package + SDK adapter; annotation/alert layers deferred |
| Transform/display | Saved transforms, field overrides, `prepareGraphableFields`, time-compare alignment, units/links/thresholds | Public Data plus internal/app helpers; SDK adapter |
| React panel | `TimeSeriesPanel` | Grafana application-only dependency; **blocker** |
| Visualization | App-owned `app/core/components/TimeSeries/TimeSeries`, which uses app-owned current GraphNG path | Grafana application-only dependency; **blocker** |
| Internal imports | `@grafana/ui/internal` (`TimeRange2`, `TooltipHoverMode`, `PlotLegend`, `UPlotConfigBuilder`, `buildScaleKey`) and `@grafana/data/internal` (`convertFieldType`, sorting helpers) | Unpublished; **blocker** unless eliminated or explicitly sourced |
| Application integrations | assistant tooltip, grouped-label filters, annotations/exemplars/outside-range plugins, alert definitions, annotation API/editor in broader module closure | Optional/deferred for a reduced read-only path, but the exact module must be tree-shaken or adapted deliberately |
| UI/DOM | uPlot interaction plugins, keyboard behavior, tooltip portal, legend, canvas, `ResizeObserver`, `requestAnimationFrame` | Required public/internal UI behavior; investigate in POC |
| CSS/assets | `uplot/dist/uPlot.min.css`, Emotion, theme, font/icon paths | Required; SDK style/asset adapter |

**Verified fact.** The current panel does not use the public graveyard `TimeSeries`/`GraphNG` route. Substituting those deprecated components would not validate Grafana 13.2.3 panel fidelity.

**POC rule.** Initially disable annotation creation, assistant actions, ad hoc filtering, panel editing, and internal Explore links. The POC must still render the exact current chart, legend, tooltip, time-range interaction, and keyboard path. If the exact component cannot be built without importing unsupported application internals, Time series remains blocked.

### Stat

```text
UID -> V1 DTO -> constrained converter -> VizPanel(pluginId="stat")
  -> SceneDataTransformer -> SceneQueryRunner -> datasource/runRequest
  -> transformations -> field overrides/display processors
  -> app-owned Stat PanelPlugin + migrations/default options
  -> StatPanel -> getFieldDisplayValues/reducers/range/sparkline/data links
  -> UI VizRepeater + BigValue + DataLinksContextMenu + theme
  -> PanelChrome/contexts/Emotion/fonts/icons/portal menu
  -> native DOM and optional sparkline canvas/SVG behavior
```

| Stage | Exact dependency and responsibility | Classification |
| --- | --- | --- |
| Plugin definition | `public/app/plugins/panel/stat/module.tsx`; generated options, `StatMigrations`, shared single-stat migration, presets/suggestions | Grafana application-only dependency; **blocker** |
| Query/data | `SceneQueryRunner` and controlled datasource/runtime path | Required public package + SDK adapter |
| Transform/display | reducers, `getFieldDisplayValues`, global numeric range, mappings, thresholds, units, links, sparklines, percent change | Mostly required public Data; adapter for registry/theme/link policy |
| Internal imports | `findNumericFieldMinMax` from unpublished `@grafana/data/internal`; `DataLinksContextMenuApi` type from unpublished `@grafana/ui/internal` | Unpublished; implementation helper is a blocker, type-only import can be replaced at build boundary |
| React panel | `StatPanel` | Grafana application-only dependency; **blocker** |
| UI | root exports `BigValue`, `VizRepeater`, `DataLinksContextMenu`, `useTheme2` | Required public package; compatibility provider |
| CSS/assets | Emotion/theme/fonts; portal only when data-link menu opens | Required; adapter/provider |

**Inference.** Stat is the best first query-backed panel because most rendering behavior is already in published Data/UI primitives and it does not require the Time series or Table application integration layers. Success still requires the actual plugin module and migrations; reconstructing a Stat-like view from `BigValue` is not sufficient evidence.

### Table

```text
UID -> V1 DTO -> constrained converter -> VizPanel(pluginId="table")
  -> SceneDataTransformer -> SceneQueryRunner -> datasource/runRequest
  -> transformations -> field overrides/display-name caching
  -> app-owned Table PanelPlugin + migrations/options/field editors
  -> TablePanel + app table hooks/utilities
  -> UI unstable TableNG -> @grafana/react-data-grid
  -> data-grid CSS + canvas text measurement + ResizeObserver
     + window/document events + portals/tooltips/actions
  -> PanelChrome/theme/contexts -> native grid/treegrid DOM
```

| Stage | Exact dependency and responsibility | Classification |
| --- | --- | --- |
| Plugin definition | `public/app/plugins/panel/table/module.tsx`; migrations; generated config; table option and field-config builders | Grafana application-only dependency; **blocker** |
| Query/data | `SceneQueryRunner`, possibly multiple frames, controlled datasource/runtime path | Required public package + SDK adapter |
| Transform/display | transformations, field overrides, cached display names, field actions, links, cell types, footer reducers | Public Data plus app integration; adapter |
| React panel | `TablePanel` | Grafana application-only dependency; **blocker** |
| Application hooks | `useCacheFieldDisplayNames`, `useCellActions`, `useTableSharedCrosshair`, `useCommonTableProps`; sort/frame/resize utilities and action service | Grafana application-only dependency; **blocker** for exact behavior |
| Internal APIs | Runtime internal feature-flag hooks; UI internal sort type; application config for sanitization | Unpublished/internal; **blocker** or explicit POC replacement |
| UI | `TableNG` from `@grafana/ui/unstable`, not root legacy `Table` | Published unstable; adapter and POC gate |
| CSS/DOM | `@grafana/react-data-grid/lib/styles.css`, canvas measurement, `ResizeObserver`, document/window handlers, grid/treegrid keyboard semantics | Required and high-risk POC surface |

**POC rule.** Cell actions, shared crosshair, editing, and internal navigation can initially be disabled. Sorting, resizing, frame selection, links, HTML sanitization, keyboard navigation, and cleanup still require explicit tests because they affect read-only fidelity or safety. Replacing `TableNG` with the legacy root `Table` is not equivalent.

### Text

```text
UID -> V1 DTO -> constrained converter -> VizPanel(pluginId="text")
  -> app-owned Text module selects v1/v2 by internal feature flag
  -> v1: metadata skipDataQuery=true -> no SceneQueryRunner/transformer
  -> v2: Runtime metadata override skipDataQuery=false -> optional query pipeline
  -> interpolate variables -> Markdown/HTML sanitization or code rendering
  -> UI ScrollContainer/theme/Emotion
     [+ unstable CodeMirror/CodeEditor only for code mode]
  -> PanelChrome/contexts -> native DOM
```

| Stage | Exact dependency and responsibility | Classification |
| --- | --- | --- |
| Plugin definition | `public/app/plugins/panel/text/module.tsx`, v1/v2 modules, migrations, generated config | Grafana application-only dependency; **blocker** |
| Query/data | Shared `plugin.json` sets `skipDataQuery: true`. Runtime `setPanelsAndAliases` overrides it to `false` when `grafana.newTextPanel` selects v2, whose per-row mode consumes query data. | Query services safely omitted only for pinned v1; v2 requires the normal query path |
| Version selection | `getFeatureFlagClient()` from unpublished `@grafana/runtime/internal` chooses v1 or v2, and Runtime metadata must agree with that choice | Internal; compatibility adapter must pin one coherent implementation/metadata pair for the POC |
| Content processing | variable interpolation before Markdown/HTML conversion; `renderTextPanelMarkdown` and sanitizer; `disableSanitizeHtml` from app config | Data public primitives + application policy; SDK security adapter |
| React panel | v1 `TextPanel` or v2 `TextNGPanel` | Grafana application-only dependency; **blocker** |
| V2 application integration | data-link variable suggestions and lazy editor | Deferred in read-only mode |
| Code mode | v1 `CodeEditor` root export or v2 unstable `CodeMirrorEditor` | Deferred initially; POC Markdown first |
| CSS/DOM | Emotion, ScrollContainer, global `.markdown-html` rules; raw HTML insertion only after policy/sanitization | Required and security-sensitive |

**Decision.** Start Text with sanitized read-only Markdown, fixed to the v1 implementation and `skipDataQuery: true`. Defer v2/per-row data rendering, HTML, and code modes until their query behavior, sanitization, CSP, editor bundle, styles, and cleanup are tested. Never use `disableSanitizeHtml=true` as a compatibility shortcut.

## Consolidated provider, service, registry, style, and asset model

| Dependency | Required for POC | Owner | Scope/lifetime | Classification and rule |
| --- | --- | --- | --- | --- |
| React and React DOM 19.2.8 | Yes | Host/package peer policy | One physical copy per page | Host-owned dependency; reject duplicates |
| Grafana base URL and namespace | Yes | Host | Compatibility identity | Host-owned; namespace is not always `default` |
| Credential-aware transport | Yes | Host | Per Grafana identity | Host-owned; no SDK secrets |
| Dashboard API discovery/client | Yes | SDK adapter over host transport | Per load with cache | SDK compatibility adapter |
| DTO validator/version classifier | Yes | SDK | Per load | SDK compatibility adapter |
| V1 converter | Yes | SDK; app source is reference only | Exact baseline | Blocker until POC implementation strategy is approved |
| V2 converter | No for first gate | SDK | Exact baseline | Deferred; explicit unsupported result |
| Scene root/time/layout/variables | Yes | `@grafana/scenes` + SDK factory | Per dashboard | Required public package behind adapter |
| `VizPanel`/renderer | Yes | `@grafana/scenes` | Per panel | Required public package behind adapter |
| `BackendSrv` structural adapter | Yes | SDK over host transport | Page/runtime identity | SDK compatibility adapter |
| `DataSourceSrv` structural adapter | Query panels | SDK + host/server metadata | Page/runtime identity | SDK compatibility adapter |
| Datasource frontend module catalogue | For general datasources | SDK/host | Page/runtime identity | Blocker; constrain POC datasource |
| `runRequest` | Query panels | SDK | One-shot per Runtime module | SDK compatibility adapter; cancellation mandatory |
| Event bus | Yes | SDK using `EventBusSrv` | Shared or per compatible scene context | Required public package; no Grafana app bus |
| Location service/router | No | Host callback if later admitted | Host | Safely omitted; reject Grafana navigation |
| Template service | Only for supported variables/datasources | SDK adapter | Compatibility identity | Defer advanced variable behavior |
| Plugin metadata catalogue | Yes | SDK fixed four-panel catalogue | Page/runtime identity | SDK adapter; do not require general internal metadata service |
| Plugin import utilities | Yes | SDK | One-shot + shared cache | SDK compatibility adapter; exact-module blocker remains |
| Four `PanelPlugin` modules | Yes for full acceptance | Unresolved source/distribution strategy | Shared immutable catalogue | Grafana application-only; blocker |
| Standard field-config registry | Yes | SDK bootstrap | Process/module singleton | SDK adapter; initialize once before plugins |
| Standard transformation registry | When saved transforms exist | SDK bootstrap | Process/module singleton | SDK adapter; whitelist and prevalidate |
| Theme object and Runtime theme agreement | Yes | SDK provider with host selection | Subtree + shared Runtime policy | SDK compatibility adapter/provider |
| `ThemeContext.Provider` | Yes | SDK | Per mount | Required public UI behavior |
| `PanelChrome`/panel contexts | Yes through Scenes | Scenes/UI | Per panel | Published but internal/alpha; hide behind adapter |
| Emotion component styles | Yes | UI | Document stylesheet/cache | Required; coexistence POC |
| Full `GlobalStyles` | No decision yet | SDK provider experiment | Document-wide | Investigate full versus scoped/minimal in POC |
| uPlot CSS | Time series | Bundler/SDK | Document stylesheet | Required direct CSS side effect |
| React data-grid CSS | Table | Bundler/SDK | Document stylesheet | Required direct CSS side effect |
| Inter and Roboto Mono fonts | Fidelity | Host/SDK asset policy | Document/network cache | POC asset decision; package does not include files |
| Icons | Chrome/interactions | SDK asset policy | Module/window cache | Required; explicit asset base and CSP test |
| Portal root | Menus/tooltips/links | SDK coordinator | One per document, reference-counted | SDK adapter; do not create duplicate IDs |
| Browser APIs | Yes | Browser/host polyfill policy | Window/document | `ResizeObserver`, canvas, RAF, `matchMedia`, portals |
| Error view | Yes | Runtime default or SDK-provided view | Page/runtime | Default is low fidelity; app replacement is unpublished |
| i18n resources | Yes for correct labels | SDK | Compatibility identity | Required package; exact locale policy |
| URL synchronization | No | — | — | Deferred |
| Library panel loader | No | — | — | Unsupported in POC |
| Annotations/alert state/live data | No initially | — | — | Deferred and explicitly reported |

## Public package versus unpublished/internal closure

### Usable published building blocks

| Surface | Required symbols/behavior | Stability treatment |
| --- | --- | --- |
| `@grafana/scenes` | scene objects, layouts, `SceneTimeRange`, variables, `VizPanel`, `SceneQueryRunner`, `SceneDataTransformer`, activation | Public export, but exact-version implementation detail |
| `@grafana/data` | frames, fields, panel contracts, loading/query contracts, overrides, processors, display values, units, mappings, thresholds, links, transformations, event bus contracts | Mostly public plugin contracts; hide mutable/internal-marked pieces |
| `@grafana/ui` | theme context/hooks, `PanelChrome`, contexts, error boundary, overlays, BigValue, VizRepeater, uPlot pieces | Mixed public, alpha, and internal annotations; always behind provider |
| `@grafana/ui/unstable` | `TableNG`; CodeMirror only if Text code mode admitted | Published but explicitly unstable; POC-only |
| `@grafana/runtime` | public service getters, config view, event service, panel error component indirection | Public package with internal/one-shot initialization seams |
| `@grafana/schema` | versioned dashboard/panel types and option enums | Public generated contracts; pin exactly |
| `@grafana/i18n` | translated strings/resources used by panel/UI code | Public package; pin exactly |

### Unpublished or internal dependencies

Every dependency in this table must be removed, replaced behind the compatibility boundary, or explicitly accepted as a POC blocker. None may leak into the future public SDK API.

| Dependency | Why the selected path reaches it | Required disposition |
| --- | --- | --- |
| `DashboardModel` and V1 migrations | Grafana's V1 converter constructs it before building scenes | Reproduce constrained semantics or accept an application-source dependency after licensing/maintenance review |
| `transformSaveModelToScene`, `createDashboardSceneFromDashboardModel`, `buildGridItemForPanel`, V1 `createPanelDataProvider` | V1 DTO-to-scenes reference implementation | SDK-owned versioned converter; do not import in production by accident |
| `transformSaveModelSchemaV2ToScene`, `layoutDeserializerRegistry`, layout serializers and `buildVizPanelState` | V2 DTO-to-scenes reference implementation | Deferred SDK converter; unsupported until complete |
| `DashboardScene` and dashboard-specific behaviors/chrome | Grafana converter adds root, menus, profiling, annotations, reload, links, and panel context | Do not adopt wholesale; replace with constrained root/context |
| `DashboardDatasourceBehaviour`, mixed/dashboard datasource modules | Converter and query runner support dashboard/mixed query semantics | Unsupported initially or explicit adapter per datasource |
| `public/app/features/plugins/importPanelPlugin.ts` and importer tree | Grafana resolves plugin metadata/modules with app caches and internal APIs | Replace with fixed SDK catalogue/importer |
| `built_in_plugins.ts` | Only built-in map for the four IDs; imports via `app/...` aliases and webpack chunks | Blocker; prove an explicit build/distribution strategy |
| General panel metadata service through `@grafana/runtime/internal` | Grafana importer maps server metadata to modules | Replace with fixed POC metadata; defer arbitrary plugins |
| All four `public/app/plugins/panel/*` modules/components/config/migrations | Exact built-in panel implementation | Blocker; not published in Data/UI/Scenes |
| Time series current `TimeSeries`/GraphNG and helpers | Exact Time series panel delegates to app-owned visualization wrapper | Blocker |
| Time series assistant, filters, annotation/exemplar, alert helpers | Exact component imports application integrations | Disable only through a deliberate build seam; otherwise blocker |
| Table hooks/utilities, actions service, table option builders | Exact Table component and plugin definition import them | Blocker or constrained replacements validated for fidelity |
| Text app config and data-link suggestion helper | Text reads sanitization config and editor suggestions | Replace with explicit safe policy; omit editor suggestions |
| `@grafana/data/internal` imports in Time series/Stat/Table | Current panel code uses conversion, numeric-range, sorting, and transform types | Not available from published export map; eliminate/replace or remain blocked |
| `@grafana/ui/internal` imports in Time series/Stat/Table | Current panels use current plot/tooltip/legend/build helpers and types | Not available from published export map; eliminate/replace or remain blocked |
| `@grafana/runtime/internal` feature flags/metadata hooks | Text selection, Table behavior, plugin metadata and converter paths | Replace with explicit POC policy; production deep import rejected |
| Runtime `setRunRequest`, plugin utility setter, and related one-shot seams | Scenes public behavior requires services that Grafana initializes internally | SDK compatibility adapter for POC; upstream support or stable seam remains a production concern |
| Runtime import-time boot/config behavior | Scenes and panels read theme, build info, feature toggles, datasource defaults, limits | POC-only controlled initialization; production blocker if no supported setup path emerges |
| OptionsUI registry initialization | Panel defaults/overrides need standard field metadata | Build a headless exact registry or accept app source after review |
| Standard transformer initializer | Saved transformations need registered operators | Build a whitelisted execution registry; editor metadata is not needed |
| Application `PanelDataErrorView` | High-fidelity data-shape errors replace Runtime's basic fallback | Optional for POC; SDK-owned accessible error UI later |
| Grafana application theme/global-style provider | Shell coordinates global CSS, system theme, config, and assets | Replace with SDK provider; do not run app provider/shell |

**Verified fact.** `@grafana/data/internal` and `@grafana/ui/internal` exist only for Grafana's source-workspace condition and are absent from published npm export maps. `@grafana/runtime/internal` is likewise removed from the published manifest. A bundler alias to monorepo source is therefore a source-build experiment, not normal npm consumption.

## Bundler and asset behavior

| Concern | Verified behavior | POC requirement |
| --- | --- | --- |
| Built-in panel chunks | Grafana's map uses webpack `import()` comments and `app/...` aliases | Use an SDK-owned explicit catalogue; record emitted chunks and URLs |
| External plugins | Grafana importer uses SystemJS, import maps, optional SRI, sandboxing, translations, and public module paths | Defer/reject arbitrary external plugins; do not initialize SystemJS for the four fixed panels |
| Panel lazy chunks | Text v2 lazy-loads its editor; other transitive modules may split | Read-only Text must avoid editor chunk; verify no unexpected network requests |
| CSS | uPlot and React data-grid use bare package CSS imports | Confirm host bundler emits/deduplicates these styles and preserves ordering |
| Public path | UI fonts/icons consult `window.__grafana_public_path__`; icon lookup is cached | Set once only if the asset strategy requires it; changing per instance is unsupported |
| Fonts | UI references Inter and Roboto Mono but does not ship those files | Serve approved assets or document fallback; record requests/CSP |
| Icons | Some SVG data is packaged; URL resolution still uses shared public-path logic | Exercise every chrome/panel icon used by the POC |
| Workers | No direct worker construction was found in the traced four panel/component paths | Record this as a bounded source result; inspect emitted graph in POC before claiming none |
| Browser globals | `window`, `document`, canvas, `ResizeObserver`, RAF, `matchMedia`, and portals are used | Browser-only renderer; SSR/hydration unsupported initially |

**Inference.** Vite, webpack, and other host bundlers will not resolve Grafana's `app/...` source aliases or reproduce its webpack chunk/public-path behavior automatically. A successful Grafana monorepo build is not evidence that an npm consumer can bundle the panel modules.

## Failure-isolation matrix

| Failure | Detection boundary | Required user-visible result | Isolation/cleanup rule |
| --- | --- | --- | --- |
| API discovery/network failure | Dashboard loader | Dashboard-level transport error with retry classification | Abort outstanding fetch; do not construct a scene |
| 401 unauthenticated | Dashboard loader | Authentication-required error; no credential guessing | Host handles sign-in; no automatic secret fallback |
| 403 forbidden | Dashboard loader | Permission-denied error | Do not retry as another API version |
| 404 dashboard not found | Dashboard loader | UID/namespace not-found error | Do not use legacy endpoint silently |
| Unsupported DTO/API/schema | Classifier | Explicit unsupported-version error | Do not partially convert guessed fields |
| Malformed DTO | Validator/converter | Dashboard-level invalid-response error with safe diagnostics | Never activate a partial graph |
| Unsupported layout/variable/library panel | Preflight dependency inventory | Explicit feature and panel identifiers | POC may reject whole dashboard; later policy may preserve supported panels |
| Unsupported panel ID | Converter/catalogue | Panel-local unsupported placeholder where layout can continue | No importer call outside allowlist |
| Missing built-in module | Plugin importer | Panel-local plugin-load error in chrome/placeholder | Clear failed promise cache; keep sibling panels active |
| Late plugin resolution after UID change/unmount | Mount generation guard | No visible stale update | Ignore stale completion; Scenes itself has no abort/generation check |
| Panel migration/default failure | Import/migration boundary | Panel-local incompatible-options error | Do not substitute defaults silently |
| Datasource metadata/resolution failure | `DataSourceSrv` adapter/runner | Panel-local query error | No request; sibling panels continue |
| Query request failure | `runRequest`/runner | `PanelData` error shown by panel chrome/error view | Unsubscribe transport on replacement/unmount |
| Query cancellation | Runner + transport | Loading ends without stale response replacing new data | Abort/unsubscribe and generation-check results |
| Streaming/live unsupported | Preflight/runtime | Explicit unsupported capability | Never leave an untracked stream open |
| Unknown transformation ID | Preflight registry check | Panel-local unsupported-transformation error | Do not allow upstream silent skip |
| Transformation throws | `SceneDataTransformer` | `LoadingState.Error` with transformation error | Transformer unsubscribes old pipeline; sibling panels continue |
| Missing field-config processor | Preflight/visual assertion | Panel-local incompatibility, not plausible degraded success | Fail closed for required properties |
| Unsupported saved panel options | Versioned panel validation/migration | Panel-local incompatible-options error | Never drop security- or meaning-bearing options silently |
| Panel React render exception | `ErrorBoundaryAlert` | Panel-local accessible error | Scene and sibling panels remain mounted |
| Theme/style/asset bootstrap failure | Runtime/provider bootstrap | Dashboard-level initialization error or explicit degraded-asset result | Do not mount panels under incoherent theme/config |
| Duplicate React | Startup self-check/package resolution | Hard initialization error | Avoid undefined hooks/context behavior |
| Incompatible second runtime identity | Runtime coordinator | Deterministic conflict error | Do not overwrite one-shot/global services |

**Inference.** The initial POC should reject the entire dashboard during preflight when it contains unsupported global semantics such as an unknown schema or layout. Once a graph is valid, plugin, datasource, query, transformation, option, and React render failures should be panel-local wherever upstream state permits.

## Lifecycle and cleanup model

### Runtime lifetime

The compatibility runtime is page/module-graph scoped, not dashboard scoped:

- Runtime service setters, config, registries, plugin caches, public-path/icon state, and locale are initialized once.
- A reference-counted coordinator records compatible dashboard consumers.
- Releasing the last dashboard may remove SDK-owned DOM artifacts and listeners, but cannot safely “reset” Grafana module singletons because production reset APIs do not exist.
- Reinitialization with a different Grafana URL, auth identity, registry set, locale, or incompatible theme/global-style policy is rejected in the same realm.

### Dashboard instance lifetime

| Transition | Required responsibilities |
| --- | --- |
| Mount | Acquire runtime identity; create an `AbortController`; discover/load DTO; validate/preflight; build scene; mount providers; activate the scene exactly once per active owner |
| Activate | Start variables/time subscriptions, panel plugin resolution, visible panel queries, transforms, measurements, and UI effects |
| Refresh | Reuse the same scene where safe; increment request IDs; unsubscribe/abort replaced queries; preserve panel/plugin caches |
| UID change | Start a new generation; abort old DTO/follow-ups; deactivate and detach the old scene before activating the accepted new graph; ignore all old async completions |
| Panel visibility change | Propagate in-view state so lazy `SceneQueryRunner` work pauses/resumes without losing explicit refresh semantics |
| Unmount | Unmount React; call scene deactivation; unsubscribe queries/transforms/time/data layers; abort fetches; remove instance observers/listeners/portals; release runtime and portal references |

**Verified fact.** `SceneQueryRunner._onDeactivate` unsubscribes its active query, data-layer stream, and time-range subscription; clears unfinished data; and cleans drilldown dependencies. `SceneDataTransformer` unsubscribes its transform stream. Scene objects use reference-counted activation.

**Verified fact.** `VizPanel` plugin loading has no abort signal or activation-generation check. Width-triggered and time-range-triggered query runs use queued timers, although the width timer checks `isActive`.

**SDK compatibility adapter.** UID changes and unmounts require an outer generation guard around dashboard fetch, conversion, and mount ownership. The POC must observe late plugin completion, queued query work, transport aborts, retained scenes, document/window listeners, `ResizeObserver`s, RAF callbacks, and portal children under React 19 Strict Mode.

### Multiple dashboards

Multiple instances may share:

- exact package modules;
- immutable panel metadata and loaded `PanelPlugin` promises;
- field/transformation registry contents;
- one datasource/runtime service identity;
- one event service where events are correctly scoped;
- one asset/public-path policy; and
- one document portal container.

Each instance must retain its own scene root, time range, variables, layout, panel state, query subscriptions, fetch abort controller, and mount generation.

Concurrent dashboards with different Grafana base URLs, credentials/organizations, incompatible feature toggles, registries, locale, or Runtime theme cannot be claimed safe in one JavaScript realm at this baseline.

## POC-minimum dependency set

### Minimum packages and host capabilities

The first POC design may use only:

- the exact published package cohort listed in the baseline;
- one physical React/React DOM 19.2.8 installation;
- a browser host with `ResizeObserver`, canvas, RAF, `matchMedia`, and native fetch/abort support;
- one Grafana OSS 13.2.3 server origin and namespace;
- host-owned authenticated transport;
- a single controlled datasource/query path for Stat, Table, and Time series;
- one fixed light theme first, then dark theme as a required second pass;
- the fixed allowlist `text`, `stat`, `timeseries`, and `table`; and
- explicit style, asset, portal, and sanitization policies.

### Sequential acceptance gates

1. **Panel-source gate.** Demonstrate how the exact four application-owned `PanelPlugin` modules are obtained and bundled, with their license, source revision, imports, chunks, and update mechanism recorded. Stop if this requires unsupported runtime deep imports with no maintainable replacement.
2. **Runtime/provider gate.** Initialize one compatibility runtime without `GrafanaApp.init`, router, navigation, or app chrome. Prove one React copy, one theme, one portal root, and deterministic repeated initialization behavior.
3. **Text gate.** Load a real V1 dashboard DTO and render sanitized read-only Markdown from the exact Text plugin with no query runner and no unexpected editor chunk.
4. **Stat gate.** Use one controlled query-backed dashboard to prove datasource resolution, `runRequest`, cancellation, transformations, field overrides, reductions, mappings, thresholds, units, sparkline, and external data links.
5. **Time series gate.** Prove the current app-owned Time series/GraphNG path, uPlot CSS, tooltip portal, legend, time interaction, keyboard behavior, resize, and cleanup. Do not substitute graveyard UI components.
6. **Table gate.** Prove `TableNG`, data-grid CSS, sorting, resizing, multiple frames, links, keyboard accessibility, sanitization, observers/listeners, and cleanup.
7. **Lifecycle gate.** Exercise refresh, rapid UID changes, failed/late plugin loads, query aborts, repeated mount/unmount, Strict Mode, and two compatible simultaneous dashboards.
8. **Containment gate.** Compare full Grafana global styles with a scoped/minimal strategy in a host that has another design system; capture visual diffs, CSS collisions, portals, fonts/icons, and CSP/network behavior.

Passing Text or a synthetic runtime-registered panel proves only a narrow layer. Workstream 8 succeeds only when all four exact representative panels pass or when each failure is converted into a documented architectural stop/revision decision.

## Blocker list

| ID | Blocker | Evidence status | Workstream 8 exit condition |
| --- | --- | --- | --- |
| B1 | Exact built-in panel modules are not published by Data/UI/Runtime/Scenes | Verified fact | Reproducible, reviewable source/distribution strategy for all four modules |
| B2 | Current panel modules import unpublished `@grafana/*/internal` and Grafana `public/app` modules | Verified fact | Eliminate or deliberately package every required import without accidental deep imports |
| B3 | Dashboard V1/V2 converters and migrations are application-only | Verified fact | A constrained, versioned converter passes pinned DTO fixtures and rejects unsupported semantics |
| B4 | Runtime standalone initialization relies on internal/one-shot seams and import-time config | Verified fact | One explicit initializer works without shell and has deterministic conflict behavior |
| B5 | Complete field-config and transformation registries come from unpublished app initializers | Verified fact | Headless required registries pass transform and visual-field assertions; unknown IDs fail closed |
| B6 | Arbitrary datasource frontend modules and importer are application-owned | Verified fact | Name the supported POC datasource path; prove one real saved-query flow and cancellation |
| B7 | React 19 is outside Scenes 8.13.5's declared React 18 peer range | Verified fact | Cleanly resolved exact install plus Strict Mode lifecycle evidence |
| B8 | Time series current visualization closure is application-owned and uses unpublished UI/Data internals | Verified fact | Exact current chart renders without the Grafana shell or is declared infeasible |
| B9 | Table depends on unstable `TableNG`, app hooks, internal flags, and external grid CSS | Verified fact | Exact Table renders with acceptable style, behavior, accessibility, and cleanup |
| B10 | Global config, services, registries, assets, cache, and portal state constrain multi-instance isolation | Verified fact + inference | Two compatible dashboards pass; incompatible identities fail deterministically |
| B11 | Application-source reuse has unresolved license and maintenance implications | Open question | Project review records what can be copied, adapted, built, or redistributed |
| B12 | Style containment and asset fidelity are not decided | Open question | Full-versus-scoped experiment selects a documented POC outcome, not yet a production promise |

No individual blocker requires running the Grafana application shell. Several do require a project-owned compatibility layer or an upstream-supported packaging/initialization seam.

## Recommended compatibility-boundary architecture

```text
Public SDK API
  GrafanaDashboard({ uid, grafanaUrl?, namespace?, theme?, onError? })
       |
       v
Host boundary
  auth-aware request | deployment/CORS policy | asset policy | host link callbacks
       |
       v
Grafana 13 compatibility module (no Grafana types escape)
  ├─ RuntimeCoordinator
  │    identity lock, service setters, config/theme agreement, event bus,
  │    registry bootstrap, portal/assets, ref counting
  ├─ DashboardRepository
  │    discovery, DTO request, abort, cache/revision, classified errors
  ├─ DashboardConverterV1 / DashboardConverterV2
  │    validation, migration/normalization, feature inventory, scene factory
  ├─ PanelCatalog
  │    allowlisted metadata, exact module promises, version/migration checks
  ├─ DataRuntime
  │    datasource catalogue, runRequest, cancellation, variable interpolation
  ├─ ProcessingRuntime
  │    transformation allowlist, field registry, link policy, display/theme inputs
  └─ RenderProvider
       ThemeContext, style strategy, assets, portal, error boundaries, lifecycle guard
       |
       v
Pinned Grafana package cohort + exact built-in panel modules
       |
       v
Native React DOM/canvas
```

Architectural rules:

1. The public API exposes project-owned configuration and error types only. `DashboardDTO`, `PanelData`, `PanelPlugin`, `DataFrame`, Scene objects, registries, and Runtime services remain internal.
2. `RuntimeCoordinator` is the only module allowed to call Grafana singleton setters, mutate compatibility boot state, initialize registries, or coordinate document globals.
3. Dashboard retrieval and conversion remain separate so HTTP compatibility, DTO validation, and scene construction can be tested independently.
4. The converter produces only public Scenes primitives and project-owned root/context objects. It does not import Grafana's route tree or app chrome.
5. `PanelCatalog` is allowlist-based. An unknown plugin never falls through to arbitrary SystemJS loading in the initial SDK.
6. Data and display adapters preflight saved features before activation to prevent silent transformation/field-option loss.
7. Style, asset, portal, and sanitization policy are explicit provider inputs or documented single-runtime defaults.
8. Scene/query/plugin cleanup is owned at the dashboard mount boundary, while page-lifetime singletons are never pretended to be per-dashboard.

## Verified facts, inferences, and open questions

### Verified facts

1. Dashboard DTO retrieval, conversion, plugin loading, query execution, transforms, field processing, component rendering, and styles/assets are distinct initialization layers.
2. Published Scenes can host panels and manage query/transform/lifecycle state but cannot load or convert a Grafana dashboard by UID.
3. Grafana's V1 and V2 converters, built-in importer, four representative panel modules, concrete services, and registry initializers are application-owned.
4. Text's shared manifest declares `skipDataQuery`; Runtime overrides that metadata when Text v2 is selected. The other three representative panels require the data path when saved targets exist.
5. Scenes renders all four through the same `VizPanelRenderer`, `PanelChrome`, contexts, error boundary, and field-processing path.
6. The standard field-config and transformation registries are not fully initialized by importing `@grafana/data`.
7. Time series requires app-owned current visualization code; Table requires unstable `TableNG` and app hooks; Stat is closest to published primitives; pinned Text v1 is the narrowest query-free path.
8. Runtime setters/configuration, registries, plugin caches, asset/public-path logic, and portals include process- or document-wide state.
9. Scene query and transformation subscriptions have cleanup paths; plugin loading has no abort/generation guard.
10. The traced direct panel paths use CSS, canvas, observers, timers/RAF, portals, and document/window APIs, but no direct worker construction was found.

### Inferences

1. A single, exact-version, one-Grafana-identity compatibility runtime is feasible enough to test without `GrafanaApp.init`.
2. Stat and sanitized Markdown Text should expose runtime/provider failures before the denser Time series and Table graphs.
3. Same-identity dashboard instances can share caches and registries while retaining separate scene/query lifecycles.
4. Arbitrary datasources and plugins are a materially larger product scope than the four-panel POC and should not be implied by early success.
5. Silent registry misses and visual degradation are more dangerous than explicit errors; acceptance needs data and screenshot assertions, not mount success alone.

### Open questions

1. What approved mechanism supplies and updates the exact application-owned panel modules?
2. Can required internal imports be eliminated without changing panel behavior, or must Grafana source be built as part of the compatibility artifact?
3. Which V1 migrations and V2 layouts are the minimum accepted dashboard contract, and how will unsupported semantics be reported?
4. Can Runtime configuration and internal one-shot setters be reached through a supportable consumer seam, or is upstream work required?
5. Which datasource can prove a real saved-query round trip without importing Grafana's general datasource loader?
6. What is the smallest headless registry set that preserves all options/transforms present in the representative fixture dashboard?
7. Does the exact package cohort behave correctly under React 19 Strict Mode despite Scenes' React 18 peer declaration?
8. Which style containment strategy preserves Grafana fidelity while coexisting with a host design system?
9. How will required fonts/icons be distributed under project licensing, CSP, and cache constraints?
10. Do repeated UID changes leave late plugin promises, observers, events, portal nodes, or scene objects retained?

## Workstream 8 recommendation

**Recommendation: revise and proceed.**

Proceed to a minimal POC, but revise it into the sequential gates defined above. The first gate is panel-source and bundler feasibility, not UI polish. Use sanitized Markdown Text to prove the query-free chain and Stat to prove the complete query/transformation/display chain. Time series and Table remain mandatory feasibility gates because they reveal the strongest application-source, internal-API, CSS, DOM, and cleanup coupling.

Stop or revise the product architecture before broader implementation if any of these conditions holds:

- the exact panel modules cannot be consumed or distributed on acceptable legal and maintenance terms;
- the POC requires production imports from unpublished package subpaths with no controlled compatibility artifact;
- Runtime cannot be initialized deterministically without the Grafana shell;
- saved transforms or field options cannot be reproduced without silent loss;
- query cancellation or unmount cleanup is unreliable;
- React 19 or host-style coexistence produces uncontainable correctness failures; or
- multiple compatible dashboards cannot share one runtime safely.

Do not interpret success with only Text, only Stat-like primitives, static `PanelData`, or a synthetic runtime plugin as closure for the project goal.

## Upstream references

### Grafana dashboard and conversion

- [Grafana OSS 13.2.3 root manifest](https://github.com/grafana/grafana/blob/v13.2.3/package.json)
- [Dashboard API resolver](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/DashboardAPIVersionResolver.ts)
- [Dashboard V1 API client](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v1.ts)
- [Dashboard V2 API client](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard/api/v2.ts)
- [V1 dashboard-to-Scenes conversion](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelToScene.ts)
- [V1 panel data-provider construction](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/utils/createPanelDataProvider.ts)
- [V2 dashboard-to-Scenes conversion](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene.ts)
- [V2 panel/layout conversion utilities](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts)
- [Official Dashboard HTTP API documentation at the pinned tag](https://github.com/grafana/grafana/blob/v13.2.3/docs/sources/developer-resources/api-reference/http-api/dashboard.md)

### Scenes rendering and lifecycle

- [`VizPanel`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx)
- [`VizPanelRenderer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx)
- [`SceneQueryRunner`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts)
- [`SceneDataTransformer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneDataTransformer.ts)
- [Runtime panel registration](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/registerRuntimePanelPlugin.ts)

### Plugin loading and representative panels

- [Grafana built-in plugin map](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/built_in_plugins.ts)
- [Panel plugin importer entry](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importPanelPlugin.ts)
- [Plugin module loader](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/importPluginModule.ts)
- [Time series plugin module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/module.tsx)
- [Time series panel component](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx)
- [Current app-owned Time series wrapper](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/TimeSeries/TimeSeries.tsx)
- [Stat plugin module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/stat/module.tsx)
- [Stat panel component](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/stat/StatPanel.tsx)
- [Table plugin module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/table/module.tsx)
- [Table panel component](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/table/TablePanel.tsx)
- [Application table hooks](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/table/hooks.ts)
- [Text plugin selector](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/module.tsx)
- [Text v1 panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/v1/TextPanel.tsx)
- [Text v2 panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/v2/TextNGPanel.tsx)

### Data, UI, and Runtime

- [Data field-override processing](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/field/fieldOverrides.ts)
- [Data transformation executor](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformDataFrame.ts)
- [Standard transformation registry](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/standardTransformersRegistry.ts)
- [Application field/options registry initializer](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/OptionsUI/registry.tsx)
- [Application standard transformer initializer](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/transformers/standardTransformers.tsx)
- [`PanelChrome`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx)
- [`TableNG`](https://github.com/grafana/grafana/tree/v13.2.3/packages/grafana-ui/src/components/Table/TableNG)
- [UI uPlot CSS import](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/uPlot/Plot.tsx)
- [Runtime service exports](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/index.ts)
- [Runtime internal initialization surface](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/internal/index.ts)
- [Runtime configuration singleton](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/config.ts)
- [Runtime panel metadata and Text v2 override](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/pluginMeta/panels.ts)
- [Grafana application bootstrap reference](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts)
