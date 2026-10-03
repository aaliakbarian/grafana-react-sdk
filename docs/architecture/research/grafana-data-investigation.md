# Grafana Data Investigation

Related documents:

- `docs/project/project-context.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/research/phase0-research-plan.md`
- `docs/architecture/research/grafana-source-map.md`
- `docs/architecture/research/grafana-scenes-investigation.md`
- `docs/architecture/decisions/`

## Document metadata

| Field | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 3: `@grafana/data` investigation |
| Status | Completed static source and published-package investigation; POC validation remains required |
| Research date | 2026-10-03 |
| Grafana baseline | Grafana OSS `v13.2.3` at `6193dc03311b631b9727b560d24369e683dc396e` |
| Package baseline | `@grafana/data@13.2.3` |
| Companion packages | `@grafana/ui@13.2.3`, `@grafana/runtime@13.2.3`, `@grafana/schema@13.2.3`, `@grafana/scenes@8.13.5` |
| Overall decision | Adopt core data contracts directly inside the compatibility layer; adapt rendering semantics and mutable registries; expose none of these Grafana contracts in the initial public SDK API |

## Scope and evidence method

This investigation determines which `@grafana/data` capabilities are necessary for native dashboard rendering, which published APIs are credible dependencies, and which must remain behind the SDK's versioned compatibility boundary. It is a static investigation only. No dependency was installed into this repository, no SDK code was implemented, and no browser POC was run.

Evidence was collected from:

- the official `@grafana/data@13.2.3` npm registry metadata and published tarball;
- Grafana source at the pinned `v13.2.3` tag;
- `@grafana/scenes` source at the pinned `v8.13.5` tag;
- package manifests for the five pinned Grafana packages; and
- official Grafana plugin-development documentation.

The published tarball was inspected separately from the monorepo source because the source workspace contains conditional `./internal` and `./test` exports that the packaging step removes.

Findings use these labels:

- **Verified fact**: directly supported by pinned source, published declarations, package metadata, tests, or official documentation.
- **Inference**: a consequence of verified facts that has not yet been demonstrated in an independent host.
- **Open question**: requires a later package investigation or browser POC.

## Executive finding

`@grafana/data@13.2.3` is required by the native rendering path and is suitable as a pinned internal dependency. Its data-frame, query, panel, field-configuration, event, time, display, and transformation contracts are the vocabulary shared by Scenes, Runtime, UI, data sources, and panel plugins.

It is not a self-initializing rendering data layer. The package contains pure or mostly pure primitives, but also exports mutable module singletons. Grafana's application shell populates the standard field-config and transformation registries with unpublished `public/app` code. Without equivalent initialization, panel field defaults and overrides can be silently dropped, and saved transformations whose IDs are absent from the registry become no-ops.

The initial SDK should therefore:

1. import required symbols only from the published `@grafana/data` root;
2. use core data contracts directly only inside the SDK implementation;
3. centralize display processing, field overrides, links, transformations, themes, locale, and registry initialization behind a Grafana-13.2.3 compatibility adapter;
4. reject deep, `internal`, `unstable`, and deprecated dependencies where a supported alternative exists; and
5. avoid exposing `DataFrame`, `PanelData`, `PanelProps`, query request types, field configuration, or registry objects from the initial public SDK API.

## Exact package baseline

### Published artifact

**Verified fact.** The selected consumer artifact is the published [`@grafana/data@13.2.3` package](https://registry.npmjs.org/%40grafana%2Fdata/13.2.3), not a floating tag.

| Item | Exact value |
| --- | --- |
| Package | `@grafana/data@13.2.3` |
| npm integrity | `sha512-EClmL+1ri5uQi0oTbXQCvNvRQ8a+mHbzX+CUlWvu+N4gVLRD0Zfa3k/POfJyxArdlpH3j3mN/3hmfnuogm63Nw==` |
| npm tarball SHA-1 | `b114ffbadbd81d79e191cfb86702ea448a05d446` |
| License | Apache-2.0 |
| ESM entry | `./dist/esm/index.mjs` |
| CommonJS entry | `./dist/cjs/index.cjs` |
| Declaration entry | `./dist/types/index.d.ts` |
| Tree-shaking declaration | `"sideEffects": false` |
| React peers | `react >=19`, `react-dom >=19` |
| Exact Grafana dependencies | `@grafana/i18n 13.2.3`, `@grafana/schema 13.2.3` |

The package README explicitly says that `@grafana/data` is in beta. Root export status is therefore necessary but not sufficient evidence of long-term API stability.

### Source and publication provenance

**Verified fact.** Grafana OSS `v13.2.3` resolves to commit `6193dc03311b631b9727b560d24369e683dc396e`. The package tarball records `gitHead` `8ea0d7e31a25f84c2b5a1c173070d8cde8740924`, which is the direct parent of the release commit. The release commit performs the 13.2.3 version bump and security-release changes. The investigated package manifest, declarations, and key implementation symbols were checked in the published tarball as well as at the release tag.

**Inference.** The differing `gitHead` is release-pipeline provenance, not evidence that a different package version should be selected. Compatibility claims should nevertheless identify both the Grafana tag commit and the npm artifact integrity rather than treating a version string as complete provenance.

## Published package boundary

### Export map

**Verified fact.** The published manifest exposes only these supported subpaths:

| Subpath | Contents | SDK rule |
| --- | --- | --- |
| `@grafana/data` | Root ESM/CJS implementation and declarations | Allowed, pinned imports only |
| `@grafana/data/unstable` | Explicitly unstable APIs | Reject for the initial SDK |
| `@grafana/data/package.json` | Package metadata | Diagnostic or build-time use only |
| `@grafana/data/themes/schema.generated.json` | Theme schema JSON | Defer to UI/theme workstream |
| `@grafana/data/themes/definitions/*.json` | Theme definition JSON | Defer to UI/theme workstream |

The source-workspace manifest also contains `./internal` and `./test` entries conditioned only on `@grafana-app/source`. Those entries are absent from the published manifest. The tarball contains no corresponding runtime JavaScript export, and normal package resolution blocks arbitrary deep imports even though compiled implementation files exist under `dist`.

The [`unstable.ts` entry point](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/unstable.ts) says those APIs must not be used by community plugins and may break at any point. None of its current exports is required for the dashboard-rendering path.

### Required root-export groups

The root barrel is broad. The standalone rendering path needs only a subset:

| Group | Representative exported symbols | Role |
| --- | --- | --- |
| Frame creation and normalization | `DataFrame`, `Field`, `FieldType`, `DataFrameDTO`, `toDataFrame`, `createDataFrame`, `preProcessPanelData` | Normalize query results into panel-consumable frames |
| Query and panel state | `DataQueryRequest`, `DataQueryResponse`, `PanelData`, `LoadingState`, `TimeRange` | Contract between query execution, Scenes, and panel rendering |
| Panel plugin contract | `PanelPlugin`, `PanelProps`, `PanelPluginMeta`, `PluginMeta` | Loaded visualization module and its React input |
| Field configuration | `FieldConfig`, `FieldConfigSource`, `FieldConfigOptionsRegistry`, `FieldConfigProperty` | Saved defaults, matchers, and per-field overrides |
| Display processing | `applyFieldOverrides`, `getDisplayProcessor`, value formatters, thresholds, mappings, link types | Produce display values, colors, ranges, and links |
| Transformations | `transformDataFrame`, `DataTransformerInfo`, `DataTransformerConfig`, `DataTransformerID`, `standardTransformersRegistry` | Execute saved panel transformations |
| Shared runtime vocabulary | `EventBus`, `ScopedVars`, `InterpolateFunction`, `GrafanaTheme2` | Inputs required by panels and field processing |

**Inference.** Root imports plus `sideEffects: false` give bundlers an opportunity to tree-shake unused modules, but the actual bundle cost and side-effect behavior must be measured in the POC. Deep imports are not an acceptable bundle-size workaround.

## Role in the standalone rendering path

### Type and data flow

The verified flow across the pinned packages is:

1. Runtime query execution uses `DataQueryRequest` and emits `DataQueryResponse` or `PanelData`-equivalent state.
2. Scenes `SceneQueryRunner.onDataReceived` calls `preProcessPanelData` to normalize legacy results and DTOs into `DataFrame[]`, preserve prior data during an empty loading state, and attach processing timing.
3. Scenes `SceneDataTransformer` calls `transformDataFrame` for series and annotation transformations.
4. Scenes `VizPanel.applyFieldConfig` obtains `plugin.fieldConfigRegistry` and calls `applyFieldOverrides` with the active theme, time zone, interpolation function, and panel field configuration.
5. `applyFieldOverrides` clones frames and field configuration, applies defaults and matching rules, computes field ranges, assigns each field's `display` processor, and assigns `getLinks`.
6. Scenes renders the loaded `PanelPlugin.panel` React component with `PanelProps`, including processed `PanelData`, `TimeRange`, dimensions, options, `FieldConfigSource`, event bus, and callbacks.

Representative sources:

- [`processDataFrame.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/dataframe/processDataFrame.ts)
- [`SceneQueryRunner.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts)
- [`SceneDataTransformer.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneDataTransformer.ts)
- [`VizPanel.tsx`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanel.tsx)
- [`fieldOverrides.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/field/fieldOverrides.ts)

### Essential versus incidental capabilities

| Capability | Requirement for rendering existing dashboards |
| --- | --- |
| Frame, field, query, panel, time, and loading contracts | Essential |
| Query-result normalization | Essential while Runtime/Scenes can emit DTO or legacy forms |
| Saved transformations | Essential for dashboards that configure transformations |
| Field defaults, overrides, display processors, and links | Essential for visual fidelity |
| Panel option and field-config editor components | Incidental to read-only rendering |
| Transformer editor metadata and images | Incidental to read-only rendering, except the current registry shape combines them with execution metadata |
| Theme-definition picker and extra theme registry | Incidental; a concrete active theme is still essential |
| Monaco, local-storage, CSV, and general utilities | Not part of the minimal rendering path |

## Data model contracts

### Contract inventory

| Contract | Source | Verified behavior | Boundary decision |
| --- | --- | --- | --- |
| `DataFrame<V, C>` | `src/types/dataFrame.ts` | Columnar frame with equal-length `fields` and `length`; extends query-result metadata | Use internally as the canonical panel data shape |
| `Field<T, C>` | `src/types/dataFrame.ts` | Values, type, labels, config, optional mutable `state`, display processor, and link supplier | Use internally; do not expose mutable processing state |
| `FieldType` | `src/types/dataFrame.ts` | Public enum including `time`, `number`, `string`, `boolean`, `trace`, `geo`, `enum`, `frame`, and `nestedFrames` | Use directly internally |
| `PanelData` | `src/types/panel.ts` | Loading state, processed series, annotations, request, errors, time range, timing, and structure revision | Keep behind adapter because it contains internal and deprecated members |
| `LoadingState` | `src/types/data.ts` | Public enum: `NotStarted`, `Loading`, `Streaming`, `Done`, `Error` | Use directly internally |
| `TimeRange` | `src/types/time.ts` | Absolute `DateTime` values plus raw relative or absolute input | Keep behind adapter; it exposes Grafana's Moment-compatible `DateTime` model |
| `DataQueryRequest<TQuery>` | `src/types/datasource.ts` | Request ID, range, interval, scoped variables, targets, time zone, cache settings, panel/dashboard identity, timing, and query context | Keep behind query adapter |
| `DataQueryResponse` | `src/types/datasource.ts` | Data frames, DTOs, or legacy results plus state, errors, stream key, and trace IDs | Normalize at query boundary |

Official Grafana documentation describes a data frame as the unified, columnar query-result model and requires all fields in a frame to have the same length and values in a field to share a type. It also documents `toDataFrame` as the normal frontend construction helper.

### Processing-owned state

**Verified fact.** `Field.state` is typed as `FieldState`, marked `@alpha`, and used as a mutable cache for display names, calculations, ranges, scoped variables, series indexes, origin, alignment, and hide state. `applyFieldOverrides` clones this state and repopulates several fields.

**Inference.** Treating `Field` objects as immutable host-domain values would be incorrect after they enter Grafana's processing pipeline. The compatibility layer should own them, and the eventual public SDK API should not promise referential identity or expose `FieldState`.

### Normalization

**Verified fact.** `toDataFrame` and `preProcessPanelData` accept modern frames/DTOs and several legacy response forms. `preProcessPanelData` also reuses the last result while a new request is loading with no series, preventing panel flicker.

**Inference.** Even if the first POC uses only modern backend data frames, retaining Grafana's own normalization is lower risk than creating a project-specific frame converter. Support for legacy response shapes can later be constrained explicitly.

## Panel-related contracts

### `PanelPlugin` lifecycle and metadata

**Verified fact.** [`PanelPlugin`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/panel/PanelPlugin.ts) extends `GrafanaPlugin<PanelPluginMeta>` and carries:

- the React `panel` component;
- lazily derived panel option defaults;
- lazily constructed field-config registry and defaults;
- migration and panel-type-change handlers;
- data-support flags; and
- editor, suggestion, preset, screenshot, padding, and view-option metadata.

`GrafanaPlugin.meta` starts as an empty object. Grafana's application plugin importer attaches the server-provided `PanelPluginMeta` after loading the module. Instantiating a plugin module is therefore not enough to reproduce Grafana's loaded-plugin state.

### `PanelProps`

**Verified fact.** A panel component receives `PanelProps<TOptions>` with the panel ID, processed data, time range and zone, options, dimensions, field configuration, title, event bus, interpolation, and change callbacks. `renderCounter` is explicitly internal.

**Inference.** The SDK should let Scenes or a compatibility-owned renderer construct `PanelProps`; host applications should not construct or depend on them. Exposing `PanelProps` would couple the SDK's public API to Grafana's event, time, field, and callback semantics.

### Field configuration and standard options

`FieldConfig` contains display name, unit, decimals, min/max, mappings, thresholds, color, null handling, links, actions, no-value text, and panel-specific `custom` options. `FieldConfigSource` adds dashboard-saved defaults and matcher-based overrides.

**Verified fact.** A plugin's `useFieldConfig` does not immediately build its registry. Accessing `plugin.fieldConfigRegistry` lazily calls `createFieldConfigRegistry`, which reads the process-wide `standardFieldConfigEditorRegistry`.

**Verified fact.** That standard registry is empty when `@grafana/data` is imported. Grafana initializes it in [`public/app/app.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts) with `getAllStandardFieldConfigs` from unpublished [`public/app/core/components/OptionsUI/registry.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/OptionsUI/registry.tsx). The initializer couples processing metadata to React editor components from the application/UI layer.

**Verified fact.** `getPanelOptionsWithDefaults` is exported from the package root, but its declaration says it is internal and not intended for external use. It filters defaults and overrides against the plugin registry.

**Inference.** If the SDK loads a normal panel plugin without first providing compatible standard field-config registry entries, standard defaults and overrides can be missing or filtered out. The panel may still render, making this a silent fidelity failure rather than a clean startup error.

## Display processing

### Processing sequence

**Verified fact.** The primary rendering operation is `applyFieldOverrides(options)`:

1. clone each frame, field, config, and field state;
2. resolve override matchers from the lazy built-in `fieldMatchers` registry;
3. apply data-source config, panel defaults, and matching override properties through the supplied field-config registry;
4. infer unresolved field types;
5. compute local or global numeric ranges;
6. assign series indexes and cache state;
7. create a display processor using the concrete theme and time zone; and
8. attach a data-link supplier using variable interpolation and an optional post-processor.

The package therefore distinguishes saved configuration (`FieldConfigSource`) from processed runtime fields (`Field.config`, `Field.state`, `Field.display`, and `Field.getLinks`).

### Units

**Verified fact.** `getValueFormat` lazily builds a module-level index of standard units. It also supports parameterized `prefix:`, `suffix:`, `time:`, `si:`, `count:`, `currency:`, and `bool:` formats without external registration.

**Inference.** Unit formatting itself is a viable package dependency. Locale- and time-dependent output still inherits module-wide Moment locale/week-start configuration and the passed time zone.

### Thresholds, colors, and mappings

**Verified fact.** `getDisplayProcessor` applies value mappings before ordinary numeric formatting, uses `getScaleCalculator` for threshold or palette color and percentage, and obtains named colors from the supplied `GrafanaTheme2`. Threshold helpers and mapping evaluation are package-local and do not call Runtime.

The implementation's comment says a missing theme will default to dark, but its type requires `theme` and the function immediately reads `options.theme.visualization`. A concrete theme is therefore required in practice.

`MappingType` is marked `@alpha`. Threshold and mapping configuration is persisted dashboard data, so the compatibility layer must accept the exact pinned schema even if the eventual SDK API does not expose these types.

### Field overrides

**Verified fact.** Override matcher registries are lazily populated with built-ins from `@grafana/data`, but property application depends on a `FieldConfigOptionsRegistry`. The default used by `applyFieldOverrides` is the initially empty `standardFieldConfigEditorRegistry`; Scenes normally passes `plugin.fieldConfigRegistry` instead.

**Inference.** Matcher availability alone is insufficient. A headless renderer still needs compatible property definitions and processors for unit, min/max, decimals, display name, no-value text, thresholds, mappings, links, actions, color, and custom plugin properties.

### Data links

**Verified fact.** `getLinksSupplier` interpolates link title/URL variables, sanitizes URLs through `locationUtil`, and defaults internal links to Grafana Explore URLs through `mapInternalLinkToExplore`. `locationUtil` is a mutable singleton with default `appSubUrl: ''`; Grafana application startup replaces its configuration and supplies current time-range and variable URL functions.

**Inference.** External links can be supported behind a host-aware post-processor. The default internal-link behavior would introduce Grafana `/explore` navigation into the host and conflicts with the project's no-Grafana-navigation boundary. The SDK should reject, disable, or explicitly adapt internal Explore links rather than silently emit them.

## Transformations

### Contracts and executor

The package root exports:

- `DataTransformerInfo`, `SynchronousDataTransformerInfo`, and `CustomTransformOperator`;
- `DataTransformContext` with an interpolation function;
- `DataTransformerID`;
- `transformDataFrame`;
- `standardTransformersRegistry`; and
- the deprecated `standardTransformers` implementation map.

`DataTransformerConfig` is re-exported from `@grafana/data`, but that re-export is deprecated in favor of the `@grafana/schema` definition.

**Verified fact.** `transformDataFrame` constructs an RxJS pipeline, looks up each saved configuration ID in `standardTransformersRegistry`, resolves its operator asynchronously, interpolates string options, and executes it. An unknown ID is silently skipped by returning the source stream unchanged.

**Verified fact.** The module caches resolved transformation promises by transformation ID for the process lifetime. The only reset function is test-only and is not exported from the package root.

### Standard registry initialization

**Verified fact.** `standardTransformersRegistry` is created as an empty mutable `Registry`; `@grafana/data` does not populate it. Grafana startup calls:

`standardTransformersRegistry.setInit(getStandardTransformers)`

The initializer is unpublished application code in [`public/app/features/transformers/standardTransformers.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/transformers/standardTransformers.tsx). Its registry entries include React editor components, translated labels, image assets, feature-toggle checks, and operator resolvers.

The application initializer combines two operator sources:

- package operators from the deprecated `standardTransformers` map, including reduce, filtering, organize, join, concatenate, calculations, labels, grouping, sorting, merge, histogram, type conversion, matrix, limit, nested table, and transpose; and
- application-only lazy operators, including rows-to-fields, config-from-query-results, prepare-time-series, spatial, field lookup, extract-fields, heatmap, join-by-labels, regression, partition-by-values, smoothing, and time-series-table.

**Verified fact.** The `standardTransformers` declaration says it will stop being exported. It is not an acceptable durable basis for reconstructing the missing registry.

### Scenes-specific global behavior

**Verified fact.** Before interpolating transform options, `transformDataFrame` reads `window.__grafanaSceneContext`. If any scene context exists, it skips its own interpolation because Scenes is expected to have interpolated options upstream. This is an unguarded browser-global read.

**Inference.** Browser-only use satisfies the presence of `window`, but the behavior is process-wide rather than instance-scoped. It reinforces the Workstream 2 requirement to test concurrent dashboards and overlapping activation/deactivation. It also makes server-side rendering unsupported unless guarded outside this path.

### Transformation conclusion

Published `@grafana/data` provides the executor and a useful subset of operators, but not a complete initialized catalog matching Grafana 13.2.3 dashboards. Full transformation fidelity currently depends on unpublished Grafana application code. This capability must stay behind an adapter and must be scoped by a support matrix before the POC claims compatibility.

## Registries and global state

### Registry behavior

**Verified fact.** `Registry<T>` stores mutable ordered and ID maps. It initializes lazily on the first lookup/list operation. `setInit` throws after initialization, `register` throws for duplicate IDs, and there is no public reset or unregister operation.

| Singleton or cache | Initial state | Required initialization | Multi-instance implication |
| --- | --- | --- | --- |
| `standardFieldConfigEditorRegistry` | Empty | Grafana app supplies standard property metadata/processors | Must be initialized once before any panel accesses its lazy registry |
| `standardEditorsRegistry` | Empty | Grafana app supplies React option editors | Not needed for read-only UI directly, but app-owned standard field-config construction reads it |
| `standardTransformersRegistry` | Empty | Grafana app supplies complete transformation catalog | Must be initialized once before any transform lookup |
| `fieldMatchers`, `frameMatchers`, `valueMatchers` | Lazy built-in suppliers | Self-initializing | Shared and mutable through public `register` |
| `fieldReducers` | Lazy built-in supplier | Self-initializing | Shared and mutable |
| `fieldColorModeRegistry` | Lazy built-in supplier; symbol marked internal | Self-initializing | Shared and mutable; used by display processing |
| Unit-format index | Empty lazy cache | Self-initializing | Shared read-mostly cache |
| Transformation promise cache | Empty module map | Filled on execution | Shared by ID across all dashboards; no production reset |
| Locale and week start | Moment defaults | Grafana app calls `setLocale` and `setWeekStart` | Process-wide host impact |
| Default time-zone resolver | Grafana default | Grafana app calls internal `setTimeZoneResolver` | Process-wide host impact |
| `locationUtil` | Empty app-sub-URL and absent URL suppliers | Grafana app calls `locationUtil.initialize` | Process-wide URL policy |
| Theme registry | Lazy built-ins plus registered JSON themes | Self-initializing | `system` theme reads `window.matchMedia` |

### Package behavior versus Grafana application initialization

| Behavior | Provided by importing `@grafana/data` | Added by Grafana application startup |
| --- | --- | --- |
| Frame/query/panel/type contracts | Yes | No additional initialization |
| Frame normalization | Yes | No |
| Unit format catalog | Yes, lazy | Locale/week-start selection only |
| Threshold and mapping evaluation | Yes | Concrete active theme still comes from host/runtime |
| Matcher and reducer built-ins | Yes, lazy | No |
| Standard field property registry | No; registry starts empty | `getAllStandardFieldConfigs` from `public/app` |
| Standard option editor registry | No; registry starts empty | `getAllOptionEditors` from `public/app` |
| Transformation executor | Yes | No |
| Complete standard transformer registry | No; registry starts empty | `getStandardTransformers` from `public/app` |
| Complete transformation implementations | No | Several operators are application-only |
| Theme object | Theme types and internal factory are exported | Runtime config/UI select and provide the active theme |
| Data-link URL policy | Default singleton behavior | Boot config, time-range, and variable URL suppliers |
| User locale, week start, and time zone | Setters/defaults exist | Values are taken from the Grafana user context |

**Verified fact.** `@grafana/data` does not import `@grafana/runtime`, `@grafana/ui`, or `@grafana/scenes`, and its manifest does not depend on them. Its own core helpers do not require `window.grafanaBootData`. Grafana boot dependence enters through explicit arguments, shared globals, and application-owned initialization rather than a direct package dependency.

**Inference.** A small explicit initializer is architecturally possible, but it must be owned by the compatibility layer, called once before panel module use, and designed for multiple SDK mounts. Per-dashboard registry configuration is not supported by these package singletons.

## Cross-package dependencies

### Dependency direction

| Package | Relationship to `@grafana/data@13.2.3` |
| --- | --- |
| `@grafana/schema@13.2.3` | Exact dependency of Data; owns persisted `DataTransformerConfig`, schema field-config shapes, matcher configuration, and several enums |
| `@grafana/ui@13.2.3` | Declares exact dependencies on Data and Schema; consumes Data types/utilities throughout visualization and editor components |
| `@grafana/runtime@13.2.3` | Declares exact dependencies on Data, UI, and Schema; supplies query, datasource, configuration, and plugin services using Data contracts |
| `@grafana/scenes@8.13.5` | Declares `@grafana/data >=11.6` as a peer; imports frame, query, panel, field, event, time, and transformation contracts directly |

### Schema overlap

**Verified fact.** Data imports Schema directly. Schema defines persisted `FieldConfig`, `FieldConfigSource`, `MatcherConfig`, and `DataTransformerConfig` veneers. Data defines its richer runtime field and panel types, and several Data re-exports of schema types are deprecated in favor of importing Schema directly. Conversely, Schema's `LoadingState` is deprecated in favor of Data's `LoadingState`.

**Inference.** The compatibility adapter should use Schema types at the dashboard persistence boundary and Data types after normalization. Conflating them in a public API would make migrations and version skew harder to contain.

### Scenes coupling

**Verified fact.** Scenes uses Data pervasively. Representative direct dependencies include `DataFrame`, `PanelData`, `DataQueryRequest`, `LoadingState`, `TimeRange`, `PanelPlugin`, `PanelProps`, `preProcessPanelData`, `transformDataFrame`, and `applyFieldOverrides`.

The pinned Scenes source contains compatibility comments and TypeScript suppressions around Data 13 changes, including the field-override call's feature-toggle argument. Its published peer range is broad, but that range is not proof that every Data patch has identical behavior.

## API stability classification

### Classification rules

- **Public/stable**: published from the root, not marked alpha/beta/internal/deprecated, and documented or established as a plugin contract. “Stable” here means acceptable at the exact pinned baseline; the package as a whole is still labeled beta.
- **Public/unstable**: published but explicitly alpha/beta, available only from `/unstable`, or a mutable/global surface whose compatibility is not documented.
- **Internal**: marked internal, intended for Grafana application use, or unavailable through the published export map.
- **Deprecated**: explicitly marked deprecated in source/declarations.
- **Unresolved**: root-exported without a clear stability promise and still requiring POC evidence.

### Required API classification

| API or contract | Classification | Reason and SDK treatment |
| --- | --- | --- |
| `DataFrame`, `DataFrameDTO`, `Field`, `FieldType` | Public/stable | Root contracts documented for plugin data; use internally |
| `FieldConfig` | Public/stable | Marked public and central to plugin data; keep internal to SDK |
| `FieldState` | Public/unstable | Marked `@alpha`; processing cache only |
| `LoadingState` | Public/stable | Marked public; Schema duplicate is deprecated |
| `PanelData`, `PanelProps`, `PanelPlugin` | Public/stable | Root panel-plugin contracts documented by Grafana; internal/deprecated members must not be used |
| `PanelPluginMeta`, `PluginMeta` | Public/stable | Required loaded-plugin metadata contract; constructed by importer, not host API |
| `TimeRange` | Public/stable | Root shared contract; adapter hides Moment-compatible `DateTime` details |
| Data's `TimeZone` aliases | Deprecated | Import time-zone types from Schema instead |
| `DataQueryRequest`, `DataQueryResponse` | Public/stable | Established datasource/query contracts; adapter-owned |
| `FieldConfigSource` | Public/stable | Root saved-config contract, also mirrored by Schema |
| `MappingType` | Public/unstable | Root exported but marked `@alpha` |
| Threshold/mapping/link structures | Unresolved | Root persisted/runtime contracts, but annotations are inconsistent and internal-link members are internal |
| `toDataFrame`, `createDataFrame` | Public/stable | Root construction helpers documented for plugin data |
| `preProcessPanelData` | Unresolved | Root helper used by Scenes, but not explicitly documented or annotated public |
| `getDisplayProcessor` | Unresolved | Root export with required theme and no explicit public annotation |
| `applyFieldOverrides` | Unresolved | Root export but correct behavior depends on initialized property registries and host inputs |
| `FieldConfigOptionsRegistry`, `Registry` | Public/unstable | Root mutable infrastructure with one-shot initialization semantics |
| `standardFieldConfigEditorRegistry`, `standardEditorsRegistry` | Public/unstable | Root exports but empty globals normally initialized by Grafana app code |
| `fieldColorModeRegistry` | Internal | Root export is explicitly annotated internal |
| `transformDataFrame` | Unresolved | Root executor is usable, but global Scene detection and empty registry affect behavior |
| `standardTransformersRegistry` | Public/unstable | Root mutable global; package does not initialize it |
| `standardTransformers` | Deprecated | Declaration says export will be removed |
| Data re-export of `DataTransformerConfig` | Deprecated | Use `@grafana/schema` |
| `getPanelOptionsWithDefaults` | Internal | Root-exported declaration explicitly says internal/not intended externally |
| `createTheme`, `NewThemeOptions` | Internal | Root-exported declarations are marked internal |
| `GrafanaTheme2` | Public/unstable | Marked beta; required across Data/UI rendering |
| `setTimeZoneResolver`, `locationUtil` initialization | Internal | Internal global bootstrap mechanisms |
| `@grafana/data/unstable` exports | Public/unstable | Entry point explicitly forbids community-plugin use |
| `@grafana/data/internal`, deep `dist` paths | Internal | Not in the published runtime export map |

## SDK boundary

### Keep inside the compatibility layer

The initial public SDK should not expose these Grafana-specific types:

- `DataFrame`, `Field`, `FieldState`, or `FieldType`;
- `PanelData`, `PanelProps`, `PanelPlugin`, or plugin metadata;
- `DataQueryRequest`, `DataQueryResponse`, `ScopedVars`, or `InterpolateFunction`;
- `FieldConfig`, `FieldConfigSource`, matcher, threshold, mapping, or link types;
- `TimeRange`, `DateTime`, or Grafana time-zone aliases;
- `GrafanaTheme2`;
- transformation configuration or registry types; and
- any mutable registry or bootstrap setter.

These types should be allowed to flow between the pinned Grafana packages inside a single compatibility module, avoiding unnecessary project-owned copies at internal boundaries.

### Public API shape implication

**Inference.** The eventual host-facing API can remain project-owned and small: dashboard UID, Grafana/request configuration, lifecycle and error callbacks, container/style hooks, and a deliberately narrow theme or behavior configuration. If a future advanced API returns frames or accepts custom Grafana plugins, that should be a separately versioned escape hatch with explicit Grafana-version coupling.

### Why not expose DataFrame now

`DataFrame` is the strongest candidate for future exposure because it is documented and broadly used. It is still not justified for the first public API:

- fields acquire mutable display and cache state during rendering;
- frame metadata is versioned with datasource and data-plane contracts;
- exposing it would force hosts to align Grafana package versions; and
- the initial objective is dashboard-by-UID rendering, not a generic data API.

## Version coupling

**Verified fact.** Data 13.2.3 pins Schema and i18n 13.2.3. UI 13.2.3 pins Data and Schema 13.2.3. Runtime 13.2.3 pins Data, UI, and Schema 13.2.3. All four Grafana packages declare React and React DOM `>=19`. Scenes 8.13.5 accepts Grafana package versions `>=11.6` but declares React 18 peers, while Grafana 13.2.3 itself resolves React 19.2.8.

**Verified fact.** Grafana's plugin documentation explains that Grafana normally shares its own `@grafana/*` dependency instances with plugins through SystemJS. A standalone SDK does not inherit that alignment mechanism; it bundles or resolves the packages itself.

**Inference.** The SDK must treat the Grafana client packages as one tested set, not independently upgradeable libraries. The initial support matrix should pin:

- server: Grafana OSS `13.2.3`;
- Data/UI/Runtime/Schema/i18n/e2e-selectors: `13.2.3` where required;
- Scenes: `8.13.5`; and
- React/React DOM: `19.2.8` for the baseline POC, while explicitly recording the Scenes peer mismatch.

The server coupling is not caused by `DataFrame` alone. It comes from the combined dashboard schema, datasource query semantics, plugin metadata/assets, panel option migrations, transformation IDs, and client package implementations. Patch drift must be tested rather than assumed compatible.

## Verified facts

1. The published Data 13.2.3 artifact exposes the root, unstable entry, package metadata, and theme JSON paths; it does not expose runtime internal/test subpaths.
2. The package is marked beta, Apache-2.0, `sideEffects: false`, and requires React 19 or newer.
3. Data depends exactly on Schema and i18n 13.2.3 and does not depend on Runtime, UI, or Scenes.
4. Data frames are the canonical query-result structure shared by Scenes, Runtime, UI, data sources, and panels.
5. Scenes normalizes results with `preProcessPanelData`, executes transformations with `transformDataFrame`, and applies field configuration with `applyFieldOverrides` before panel rendering.
6. Panel components consume `PanelProps`, while plugin metadata is attached by the plugin loading system after module construction.
7. Display processing requires a concrete theme and combines units, mappings, thresholds, colors, ranges, overrides, interpolation, and links.
8. Standard field-config and option-editor registries start empty and are populated by unpublished Grafana application code.
9. The standard transformation registry starts empty and is populated by unpublished Grafana application code.
10. Several transformation implementations required by Grafana dashboards live under `public/app`, not in the published Data package.
11. Unknown transformation IDs are silently skipped.
12. Registries, locale, week start, default time-zone resolution, location policy, transform caches, and Scene detection involve module- or window-global state.
13. Internal data links default to Grafana Explore URLs unless a post-processor changes the behavior.
14. The package root exports some symbols that are nevertheless marked internal, alpha, beta, or deprecated; root export presence alone is not a stability guarantee.

## Inferences

1. Data 13.2.3 is necessary and technically reusable outside the Grafana shell, but only as part of an explicitly initialized compatibility runtime.
2. Direct use is lowest-risk for frame and shared state contracts; semantic processing should be adapter-owned because it combines several global and app-initialized facilities.
3. Missing field-registry initialization can produce plausible but incorrect panels, so the POC needs visual and data assertions rather than mount-only success.
4. Complete transformation parity cannot be claimed using published Data exports alone.
5. Multiple SDK dashboard instances can share the read-mostly built-in registries, but they cannot safely request different registry, locale, time-zone, location, or transform policies in the same JavaScript realm without additional coordination.
6. The project's public API can avoid Grafana type leakage without duplicating Grafana models internally.
7. A future Grafana package patch can change behavior without a TypeScript error; exact-version integration tests are required.

## Open questions

1. Which standard field-config entries are minimally required to render the first supported built-in panels, and can they be supplied through published Data/UI contracts without copying unpublished application code?
2. Do the panel modules selected for the POC initialize any registries themselves or assume Grafana startup has already run?
3. Which saved transformation IDs appear in the fixture dashboard, and which are package-backed versus application-only?
4. Can a headless execution registry be built from supported published APIs without depending on deprecated `standardTransformers`?
5. Should dashboards containing unsupported transformation IDs fail the affected panel, render untransformed data with a diagnostic, or fail dashboard validation?
6. Can internal data links be mapped to host callbacks without importing Grafana navigation or Explore state?
7. What locale, week-start, and time-zone ownership policy is acceptable when the host application already uses different settings?
8. Does a second dashboard instance expose cross-instance transform interpolation or Scene-global context errors under overlapping activation?
9. What is the production bundle impact of the required root imports after tree shaking?
10. Are all query responses used by the first supported datasources normalized correctly without Grafana application's additional response processing?
11. What patch-level server/client skew, if any, can be supported after testing 13.2.x combinations?

## Capability decisions

The categories below are decisions for the initial standalone-rendering path, not general judgments about the usefulness of the package.

| Capability | Decision | Rationale |
| --- | --- | --- |
| `DataFrame`, `Field`, `FieldType`, frame DTOs | **Adopt directly** | Canonical, documented cross-package contracts; keep internal to SDK |
| `LoadingState` and basic `PanelData` transport | **Adopt directly** | Native state vocabulary required by Scenes and panels; do not expose publicly |
| `toDataFrame`, `createDataFrame` | **Adopt directly** | Preserve Grafana's documented frame construction behavior |
| `preProcessPanelData` | **Adopt behind compatibility adapter** | Scenes requires its normalization/loading behavior, but upstream stability is not explicit |
| `TimeRange`, `DataQueryRequest`, `DataQueryResponse` | **Adopt behind compatibility adapter** | Required but coupled to Grafana time, datasource, scoped-variable, and request semantics |
| `PanelPlugin`, `PanelProps`, plugin metadata | **Adopt behind compatibility adapter** | Native panel contract, but plugin loading and metadata attachment are external responsibilities |
| `FieldConfig` and `FieldConfigSource` | **Adopt behind compatibility adapter** | Essential persisted/runtime contract with Schema overlap and version coupling |
| Panel editor and option-editor APIs | **Defer** | Read-only dashboard rendering does not require editing UI |
| Unit catalog and basic formatters | **Adopt directly** | Self-contained package behavior; configure locale/time zone centrally |
| Threshold and value-mapping evaluation | **Adopt behind compatibility adapter** | Essential display semantics with alpha/inconsistently annotated config types and theme dependency |
| `getDisplayProcessor` and `applyFieldOverrides` | **Adopt behind compatibility adapter** | Essential but require theme, interpolation, field registry, location/link policy, and mutable field state |
| External data links | **Adopt behind compatibility adapter** | Preserve variable interpolation and sanitization while making host policy explicit |
| Default internal Explore links | **Reject** | Would reproduce Grafana navigation assumptions; require an explicit host mapping instead |
| Transformation contracts and `transformDataFrame` | **Adopt behind compatibility adapter** | Executor is published, but registry and interpolation behavior are global/version-sensitive |
| Complete Grafana standard transformation catalog | **Defer** | Published packages do not contain the complete initialized catalog; define supported IDs after POC evidence |
| Deprecated `standardTransformers` map | **Reject** | Upstream says the export will be removed |
| Mutable global registries | **Adopt behind compatibility adapter** | Some are unavoidable; initialize once, validate contents, and never expose publicly |
| Theme creation/registry from Data | **Defer** | Factory is marked internal; select the supported provider path in the UI workstream |
| Locale, week-start, time-zone, and location setters | **Adopt behind compatibility adapter** | Global bootstrap state must be coordinated with the host and all SDK instances |
| `@grafana/data/unstable` | **Reject** | Explicitly not for external/community use; no required capability identified |
| `@grafana/data/internal`, test, or deep `dist` imports | **Reject** | Not part of the published runtime export map |
| Deprecated aliases and legacy error/type members | **Reject** | Use current Schema/Data contracts and `errors` arrays |
| Grafana data types in the SDK's initial public API | **Reject** | Prevent package-version coupling and mutable internals from escaping the compatibility layer |

## Workstream conclusion

Adopt `@grafana/data@13.2.3` as a required, exact-version implementation dependency, but divide its use by risk:

- adopt canonical data contracts and normalization helpers directly inside the SDK;
- place panel contracts, field processing, links, transformations, time, theme inputs, and all global initialization behind the compatibility adapter;
- defer editor facilities and complete transformation support; and
- reject unstable, internal, deprecated, and deep-import paths.

This conclusion is compatible with the Workstream 2 recommendation to use a constrained Scenes subset behind adapters. It does not establish standalone rendering feasibility by itself. The POC must prove registry initialization, transformation coverage, visual field-config fidelity, package resolution, and concurrent lifecycle behavior before these research decisions become implementation commitments.

## Upstream references

- [`@grafana/data@13.2.3` npm metadata](https://registry.npmjs.org/%40grafana%2Fdata/13.2.3)
- [`@grafana/data` source manifest at `v13.2.3`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json)
- [`@grafana/data` public root exports](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/index.ts)
- [`@grafana/data` unstable entry point](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/unstable.ts)
- [Data-frame contracts](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/types/dataFrame.ts)
- [Panel contracts](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/types/panel.ts)
- [Datasource query contracts](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/types/datasource.ts)
- [Field-override contracts](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/types/fieldOverrides.ts)
- [Panel plugin implementation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/panel/PanelPlugin.ts)
- [Field-config registry factory](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/panel/registryFactories.ts)
- [Field override and link processing](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/field/fieldOverrides.ts)
- [Display processor](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/field/displayProcessor.ts)
- [Value format catalog](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/valueFormats/valueFormats.ts)
- [Transformation executor](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformDataFrame.ts)
- [Standard transformation registry](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/standardTransformersRegistry.ts)
- [Deprecated package transformation map](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformers.ts)
- [Grafana application transformer initializer](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/transformers/standardTransformers.tsx)
- [Grafana application options/field-config initializer](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/OptionsUI/registry.tsx)
- [Grafana application startup](https://github.com/grafana/grafana/blob/v13.2.3/public/app/app.ts)
- [`@grafana/schema` dashboard veneers](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/src/veneer/dashboard.types.ts)
- [`@grafana/ui@13.2.3` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json)
- [`@grafana/runtime@13.2.3` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json)
- [`@grafana/scenes@8.13.5` manifest](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/package.json)
- [Grafana Plugin Tools: data frames](https://grafana.com/developers/plugin-tools/key-concepts/data-frames)
- [Grafana Plugin Tools: create data frames](https://grafana.com/developers/plugin-tools/how-to-guides/data-source-plugins/create-data-frames)
- [Grafana Plugin Tools: frontend npm dependencies](https://grafana.com/developers/plugin-tools/key-concepts/npm-dependencies)
- [Grafana Plugin Tools: build a panel plugin](https://grafana.com/developers/plugin-tools/tutorials/build-a-panel-plugin)
