# Grafana UI Investigation

Related documents:

- `docs/project/project-context.md`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/research/phase0-research-plan.md`
- `docs/architecture/research/grafana-source-map.md`
- `docs/architecture/research/grafana-scenes-investigation.md`
- `docs/architecture/research/grafana-data-investigation.md`
- `docs/architecture/decisions/`

## Document metadata

| Field | Value |
| --- | --- |
| Workstream | Phase 0, Workstream 4: `@grafana/ui` investigation |
| Status | Completed static source and published-package investigation; browser POC validation remains required |
| Research date | 2026-10-03 |
| Grafana baseline | Grafana OSS `v13.2.3` at `6193dc03311b631b9727b560d24369e683dc396e` |
| Package baseline | `@grafana/ui@13.2.3` |
| Companion packages | `@grafana/data@13.2.3`, `@grafana/runtime@13.2.3`, `@grafana/schema@13.2.3`, `@grafana/scenes@8.13.5` |
| Overall decision | Adopt selected `@grafana/ui` primitives behind an SDK-owned provider and compatibility boundary; do not treat the package as a complete standalone panel runtime |

## Scope and evidence method

This investigation determines the minimum Grafana UI, visualization, theme, style, asset, provider, DOM, and accessibility surface needed to render Grafana panels in an external React application without the Grafana application shell. It is a static investigation only. No dependency was installed into this repository, no SDK code was implemented, and no browser POC was run.

Evidence was collected from:

- the official `@grafana/ui@13.2.3` npm registry metadata and published tarball;
- Grafana source at the pinned `v13.2.3` tag;
- `@grafana/scenes` source at the pinned `v8.13.5` tag;
- current built-in Time series, Stat, Table, and Text panel source at the pinned Grafana tag;
- package manifests and generated declarations; and
- official Grafana plugin-development documentation.

The published tarball was inspected separately from the monorepo source. This is necessary because the source manifest exposes `@grafana/ui/internal` only through Grafana's `@grafana-app/source` condition, while the npm packaging step removes that subpath.

Findings use these labels:

- **Verified fact**: directly supported by pinned source, the published artifact, tests, package metadata, or official documentation.
- **Inference**: a consequence of verified facts that has not yet been demonstrated in an independent host.
- **Open question**: requires a browser POC or a later runtime/panel-dependency workstream.

## Executive finding

`@grafana/ui@13.2.3` is necessary for high-fidelity native panel rendering, but it is not a standalone Grafana dashboard renderer and it is not a self-contained design-system bundle.

The package provides the panel frame, loading and error primitives, visual building blocks, tooltips, menus, icons, theme hooks, Emotion-generated styles, uPlot integration, and both legacy and next-generation Table components. Scenes' `VizPanelRenderer` composes several of these pieces around a loaded `PanelPlugin`.

The package also carries material external-host assumptions:

- it expects a `GrafanaTheme2` in the shared `ThemeContext`;
- `PanelChrome` and `GlobalStyles` are published from the root but explicitly marked `@internal`;
- `GlobalStyles` changes `html`, `body`, `:root`, headings, links, controls, and all elements document-wide;
- icons and fonts resolve through Grafana-style public URLs and a window global;
- overlays default to a document-wide portal container or `document.body`;
- component styles use both `@emotion/css` and `@emotion/react`, not one SDK-scoped cache path;
- representative visualization paths use browser globals, observers, canvas, and document listeners; and
- current built-in panels are Grafana application modules, not exports of `@grafana/ui`.

The current Time series panel is especially important: Grafana 13.2.3 no longer builds it from the public `TimeSeries` export. It uses application-owned `TimeSeries` and `GraphNG` modules plus unpublished `@grafana/ui/internal` symbols. The current Table panel uses `TableNG` from the explicitly unstable entry point plus application-owned table hooks. Text selects its implementation through `@grafana/runtime/internal` and uses application configuration. Stat is closest to the public package surface, but its panel module still uses internal Data/UI symbols and is not published.

The initial SDK should therefore use `@grafana/ui` only as an exact-version implementation dependency behind a provider/compatibility layer. The POC must prove a constrained style and asset bootstrap, portal ownership, React 19 singleton behavior, multi-instance cleanup, and a viable source for the actual built-in panel modules.

## Exact package baseline

### Published artifact

**Verified fact.** The consumer artifact is the published [`@grafana/ui@13.2.3` package](https://registry.npmjs.org/%40grafana%2Fui/13.2.3), not a floating version.

| Item | Exact value |
| --- | --- |
| Package | `@grafana/ui@13.2.3` |
| npm integrity | `sha512-hs7y5Hk1n962kZQR9rtZvjOiMW+RsIUcb70F8JTQhFaDz17Sw4aJGjHVnnp0cBnluG6UTMcDC3+/rLeXJAEIgw==` |
| npm tarball SHA-1 | `f96be15a71a7e68f4c7030bbf8932b9d843ff2ca` |
| Published file count | 2,953 |
| License | Apache-2.0 |
| ESM entry | `./dist/esm/index.mjs` |
| CommonJS entry | `./dist/cjs/index.cjs` |
| Declaration entry | `./dist/types/index.d.ts` |
| Tree-shaking declaration | `"sideEffects": false` |
| React peers | `react >=19`, `react-dom >=19` |

The exact Grafana package dependencies are `@grafana/data`, `@grafana/e2e-selectors`, `@grafana/i18n`, and `@grafana/schema`, all at `13.2.3`. The manifest does not depend on `@grafana/runtime` or `@grafana/scenes`; those packages compose UI behavior from outside `@grafana/ui`.

Relevant third-party dependencies include:

| Concern | Dependency at this package version |
| --- | --- |
| Component-generated styles | `@emotion/css ^11.13.5`, `@emotion/react ^11.14.0`, `@emotion/serialize ^1.3.3` |
| Floating overlays | `@floating-ui/react ^0.27.19` |
| React-ARIA overlays | `@react-aria/overlays ^3.30.0`, `@react-aria/focus ^3.21.2`, `@react-aria/dialog ^3.5.31` |
| Icons | `react-inlinesvg ^4.5.0` |
| Charts | `uplot ^1.6.32` |
| Current table primitive | `@grafana/react-data-grid 7.0.0-beta.57` |
| Transitions | `react-transition-group ^4.4.5` |

### Source and publication provenance

**Verified fact.** Grafana OSS `v13.2.3` resolves to commit `6193dc03311b631b9727b560d24369e683dc396e`. The npm tarball records `gitHead` `8ea0d7e31a25f84c2b5a1c173070d8cde8740924`, the direct parent used by the release pipeline before the version-bump/security-release commit. The manifest, declarations, compiled modules, and required static assets were checked in the tarball as well as at the release tag.

**Inference.** The differing source and artifact commits are release-pipeline provenance, not a reason to select another package. Compatibility records should retain the Grafana release commit, package version, and npm integrity together.

### React baseline

**Verified fact.** Grafana 13.2.3 pins React and React DOM `19.2.8`; `@grafana/ui@13.2.3` was developed against those versions and declares both as `>=19` peers. Grafana's official 13.1-to-13.2 migration guide states that Grafana core moved to React 19 in 13.2.0 and that matching `@grafana/*` packages require React and React DOM 19 peers.

This differs from `@grafana/scenes@8.13.5`, whose published peer range still declares React and React DOM `^18.0.0` even though Grafana 13.2.3 resolves Scenes with React 19. That peer mismatch remains a POC gate from Workstream 2.

## Public package exports and boundary

### Export map

**Verified fact.** The npm manifest exposes only:

| Subpath | Published contents | SDK rule |
| --- | --- | --- |
| `@grafana/ui` | Root ESM/CJS implementation and declarations | Allow only selected, pinned symbols |
| `@grafana/ui/unstable` | Explicitly unstable components and types | POC-only where the current built-in panel requires it |
| `@grafana/ui/package.json` | Package metadata | Diagnostic/build-time use only |

The monorepo source manifest also declares `@grafana/ui/internal`, but only for the `@grafana-app/source` condition. The package preparation step removes that entry from the published manifest. The source file itself says these exports must not be used externally or in plugins.

**Verified fact.** The unstable entry point also says its components must not be used externally or in plugins, may break at any point, and are intended for Grafana core until promoted. `TableNG` and `CodeMirrorEditor` are relevant exports from that subpath.

### Relevant public surface

The root barrel is very broad. The standalone rendering path touches these groups:

| Group | Representative root exports | Rendering role |
| --- | --- | --- |
| Panel host | `PanelChrome`, `PanelChromeLoadingIndicator`, `PanelContextProvider`, `usePanelContext` | Frame, title, dimensions, loading/status, menu, panel interaction context |
| Error/loading | `ErrorBoundary`, `ErrorBoundaryAlert`, `Alert`, `LoadingBar`, `LoadingPlaceholder`, `Spinner` | Render failures and loading feedback |
| Theme/style | `ThemeContext`, `useTheme2`, `useStyles2`, `withTheme2`, `GlobalStyles` | Theme consumption and style generation |
| Overlays | `Portal`, `PortalContainer`, `Tooltip`, `Popover`, `Dropdown`, `Menu`, `ContextMenu`, `DataLinksContextMenu` | Tooltips, menus, links, and floating interaction |
| Visualization | `BigValue`, `VizRepeater`, `UPlotChart`, `GraphNG`, `TimeSeries`, `Table`, tooltip/legend and uPlot plugin exports | Low-level visualization construction |
| Layout/content | `VizLayout`, `VizLegend`, `ScrollContainer`, layout primitives, `RenderUserContentAsHTML` | Panel-local composition |
| Assets | `Icon`, `IconButton`, icon type/helpers | Panel status, menus, legends, and controls |

`TableNG` is exported only from `@grafana/ui/unstable`. The current Time series app module additionally imports `TimeRange2`, `TooltipHoverMode`, `PlotLegend`, `UPlotConfigBuilder`, and `buildScaleKey` from the unpublished internal path.

## API stability classification

This document uses source TSDoc and export-path intent rather than assuming every root export is stable.

| API or group | Classification | Evidence and implication |
| --- | --- | --- |
| `useTheme2`, `useStyles2`, `withTheme2` | Public/stable | Root exports marked `@public`; official plugin guidance uses them |
| `ErrorBoundaryAlert`, `withErrorBoundary` | Public/stable | Root exports with `@public` declarations |
| `Icon`, `Tooltip`, `Menu`, `DataLinksContextMenu`, `BigValue`, legacy `Table` | Public/stable for the pinned version | Root exports with public component documentation or official plugin examples; still pin exact Grafana versions |
| `PanelContext`, `PanelContextProvider`, `usePanelContext` | Public/unstable | Root-exported but explicitly marked `@alpha` |
| `TableNG`, `CodeMirrorEditor` | Public/unstable | Published through `/unstable`; entry-point policy says not for external use |
| `PanelChrome`, `PanelChromeProps`, `PanelChromeType` | Internal | Root-exported but explicitly marked `@internal`; Scenes depends on it |
| `GlobalStyles` | Internal | Root-exported but explicitly marked `@internal` |
| `PortalContainer` | Internal | Root-exported component marked `@internal`; uses a fixed document ID |
| `UPlotChart` | Internal | Root-exported implementation explicitly marked `@internal` |
| `@grafana/ui/internal` symbols | Internal/unpublished | Available only to Grafana source builds; absent from npm export map |
| `GraphNG` | Deprecated/internal | Located under `graveyard`, marked both deprecated and internal |
| Public `TimeSeries` | Deprecated by dependency | Located under `graveyard` and implemented through deprecated `GraphNG`; not the component used by the current built-in panel |
| `withTheme`, `useTheme`, `useStyles` | Deprecated | Source directs consumers to the v2 theme APIs |
| `VizRepeater` and several low-level viz helpers | Unresolved | Root-exported but without a clear stability annotation; current core use is not a compatibility guarantee |
| External provider contract for full `GlobalStyles` fidelity | Unresolved | No published standalone provider composes theme, global styles, assets, and portals |

**Inference.** A symbol's presence in the root declaration file proves package resolution, not support for an external dashboard SDK. Internal annotations on `PanelChrome` and `GlobalStyles` make a compatibility adapter mandatory even though Scenes imports them from the root.

## Verified rendering flow through Scenes

The pinned Scenes renderer demonstrates the minimum UI composition around a panel.

**Verified fact.** `VizPanelRenderer`:

1. measures its container with `react-use`;
2. resolves a `PanelPlugin` and a temporary loading plugin;
3. applies field configuration before rendering;
4. wraps content in `PanelChrome`;
5. passes `PanelData.state`, errors, and notices to PanelChrome's loading/status UI;
6. wraps the plugin in `ErrorBoundaryAlert`;
7. supplies `PluginContextProvider` from Data and `PanelContextProvider` from UI; and
8. invokes the panel component with processed `PanelProps` and inner dimensions.

Representative source: [`VizPanelRenderer.tsx`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx).

This establishes that the minimum UI layer is not just the visualization component. It includes chrome, theme consumption, measurement, error containment, panel/plugin contexts, status UI, portals for interactive content, and the visualization-specific style/asset surface.

## Panel rendering UI dependencies

### `PanelChrome`

**Verified fact.** [`PanelChrome.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx) provides:

- fixed-dimension and auto-size modes;
- inner width/height calculation after border, header, and padding;
- panel title, description, subtitle, title items, actions, and menu;
- loading and streaming states;
- query cancellation affordances;
- error/notice status buttons and popovers;
- transparent and normal display modes;
- collapsible and hover-header variants; and
- selection/drag interaction hooks used by dashboard editing.

It uses `useTheme2`, `useStyles2`, Emotion class generation, `useMeasure`, `Tooltip`, `Dropdown`, icons, translated strings, and a document-wide portal convention. Its dimensions are therefore part of visual and layout fidelity, not optional decoration.

**Verified fact.** `PanelChrome` is marked `@internal`. Its props also include dashboard-editor concerns that the initial read-only SDK should not expose.

**Inference.** Scenes should continue to own the direct call in the POC. The SDK compatibility layer should adapt the surrounding provider and hide `PanelChrome` props rather than wrapping or reproducing its layout before the POC shows a failure.

### Loading and error states

**Verified fact.** `PanelChrome` maps `LoadingState.Loading` to an animated `LoadingBar` with `role="status"`, and shows streaming/cancel affordances through tooltip-wrapped icons. Scenes supplies plugin-load and query errors as chrome status content and wraps the panel component in `ErrorBoundaryAlert`.

**Verified fact.** Data-shape errors inside current Time series and Table panels do not come from UI. Those panels render `PanelDataErrorView` from `@grafana/runtime`. Runtime's default implementation is a minimal text fallback; Grafana application startup replaces it through unpublished `setPanelDataErrorView` with `public/app/features/panel/components/PanelDataErrorView.tsx`.

**Inference.** Rendering a panel outside the shell without equivalent Runtime initialization will produce a lower-fidelity error state even if `@grafana/ui` is fully available. Workstream 5 must decide whether the SDK supplies a project-owned renderer or can reuse a published alternative.

### Tooltips, menus, and overlays

**Verified fact.** UI tooltips use Floating UI for positioning, add focus and hover interactions, render `role="tooltip"`, and portal through UI's `Portal`. Dropdowns also portal, apply a focus manager, set `aria-expanded` on their trigger, and dismiss on outside interaction. Menus use `role="menu"`, roving focus, arrow/Home/End key navigation, Escape/Tab dismissal, and `menuitem` semantics.

`PanelChrome` uses these components for descriptions, status, query cancellation, and panel menus. Stat and Table also use data-link or cell-action overlays. They are therefore part of the representative-panel path, not optional application navigation.

## Theme requirements

### Theme contract and creation

**Verified fact.** UI's `ThemeContext`, re-exported from `@grafana/data`, is a React context of `GrafanaTheme2`. Its default value is created with Data's `createTheme()`. UI's `useTheme2` reads this context, and nearly every relevant component obtains styles through `useStyles2`.

`GrafanaTheme2` supplies colors, typography, spacing, shapes, shadows, transitions, visualization palettes, z-index values, component tokens, and compatibility access to the v1 theme.

The older `GrafanaTheme` contract remains reachable through `theme.v1`, `useTheme`, and `withTheme`. UI marks the v1 hooks/HOC deprecated in favor of `GrafanaTheme2`, `useTheme2`, and `withTheme2`. The standalone path should not introduce new v1 theme dependencies; it may need the embedded `v1` compatibility object only where a pinned native component still reads it.

**Verified fact.** Data root-exports `createTheme` and `getThemeById`, but both source declarations are marked `@internal`. UI's public `getTheme` returns the legacy v1 theme and is not the required provider value.

**Inference.** The SDK needs an explicit theme factory/provider adapter even though a default context exists. Relying on the default would make theme mode implicit, would not support per-instance light/dark selection, and would couple behavior to an internally created default theme.

### No published all-in-one UI provider

**Verified fact.** `@grafana/ui` does not export a `GrafanaThemeProvider` or a standalone provider that composes theme, global styles, portals, icon caching, and system-theme changes.

Grafana's application-owned `ThemeProvider` in `public/app/core/utils/ConfigProvider.tsx`:

- writes the selected theme to Runtime's global `config.theme2`;
- subscribes to the app event bus for theme changes;
- reads the authenticated user's system-theme preference;
- listens to `window.matchMedia('(prefers-color-scheme: dark)')`;
- conditionally remaps classic themes to visual-refresh themes through feature flags; and
- adds `react-loading-skeleton`'s provider.

This provider depends on application services and `@grafana/runtime/internal`; it is not a candidate for reuse outside the shell.

### Required provider hierarchy for the POC

The smallest evidence-based hierarchy is:

1. an SDK-owned provider that produces a concrete `GrafanaTheme2` and renders `ThemeContext.Provider`;
2. the selected style bootstrap under investigation;
3. a coordinated portal destination strategy;
4. Scenes' own `PluginContextProvider` and `PanelContextProvider` around each panel; and
5. the scene/panel component.

An SVG cache provider is an optional performance layer, not a verified correctness requirement. Grafana's `CacheProvider` in `AppWrapper` comes from `react-inlinesvg/provider`; it is not an Emotion cache provider.

### Light, dark, and system behavior

**Verified fact.** `createTheme` can construct light or dark color modes, and all relevant UI styles derive colors from the theme. Grafana's application provider owns system-preference observation and the visual-refresh feature-flag mapping.

**Inference.** The standalone SDK should make light/dark selection explicit at its boundary and update the provider value when the host changes it. System-mode observation, if supported, belongs to the SDK provider rather than to Grafana application code.

**Open question.** The POC must determine whether the exact server-selected theme definition and `visualDesignRefresh` flag are required for 13.2.3 screenshot parity, and whether two instances with different themes can coexist without global-style conflicts.

## Styling requirements and side effects

### Component styles

**Verified fact.** The representative UI path primarily builds component class names with `@emotion/css`. `GlobalStyles` separately uses `@emotion/react`'s `Global` component. There is no `@emotion/cache` dependency or Emotion `CacheProvider` in `@grafana/ui` source.

This creates two styling channels:

- generated component classes inserted by the default `@emotion/css` instance; and
- optional global rules inserted by `@emotion/react`.

**Inference.** Wrapping the SDK in an `@emotion/react` cache provider would not, by itself, prove containment for classes emitted by `@emotion/css`. Shadow-root insertion, cache ownership, rule deduplication, and style cleanup require browser evidence.

### `GlobalStyles`

**Verified fact.** `GlobalStyles` aggregates 21 style modules for accessibility, alerts, code, dashboard grid, page layout, elements, forms, fonts, Markdown, uPlot, legacy selects, utilities, and application-specific fixes.

Its element rules include:

- universal `box-sizing` behavior;
- `html` height, font size, family, line height, and box sizing;
- `:root` `color-scheme`;
- `body` size, color, background, typography, scrollbar behavior, print rules, and `overflow-y: auto !important`;
- heading, paragraph, link, image, table, form-control, and button normalization; and
- focus behavior for interactive elements.

**Verified fact.** This is not panel-scoped CSS. Mounting it inside a React subtree still inserts document-global selectors.

**Inference.** Directly rendering `GlobalStyles` in an arbitrary host would create material design-system collisions. Omitting it may remove typography, resets, Markdown, uPlot, focus, and utility rules needed for fidelity. The correct subset cannot be selected safely by static inspection alone.

### Third-party CSS

**Verified fact.** The compiled package retains bare CSS imports for:

- `uplot/dist/uPlot.min.css` in `UPlotChart`;
- `@grafana/react-data-grid/lib/styles.css` in `TableNG`; and
- `@rc-component/slider/assets/index.css` in slider styles.

The UI tarball contains no standalone `.css` files of its own. The consumer bundler must resolve these dependency CSS imports. This must be tested in every supported build setup; CommonJS test environments may also need CSS-module handling.

### Typography and fonts

**Verified fact.** Grafana's theme defaults use Inter for UI typography and Roboto Mono for monospace content. `GlobalStyles` emits `@font-face` rules whose URLs resolve from:

- `${window.__grafana_public_path__}fonts/` when that global exists; or
- `public/fonts/` otherwise.

The `@grafana/ui@13.2.3` tarball does not include the referenced font files.

**Inference.** High-fidelity typography requires an explicit, documented asset source or a host-approved fallback policy. Setting Grafana's process-wide public-path global solely for fonts would also affect icons and potentially other Grafana packages.

### Icons and static assets

**Verified fact.** `Icon` renders SVG files through `react-inlinesvg`. `getIconRoot()` resolves once per module instance from:

- `${window.__grafana_public_path__}build/img/icons/`; or
- `public/build/img/icons/` by default.

The computed root is cached in a module-level variable. The published tarball contains 211 selected SVG files under `dist/public/img/icons/{unicons,custom,mono,solid}`. The package does not automatically serve or copy them into the runtime URL it constructs.

**Inference.** The SDK build or host integration must copy or expose the icon set at a compatible URL before the first icon renders. A single memoized window-global base URL cannot vary safely by SDK instance.

**Open question.** The POC must record all icon and font network requests, verify cache behavior, test Content Security Policy constraints, and decide whether assets can be repackaged without relying on `window.__grafana_public_path__`.

## DOM infrastructure and browser assumptions

### Portal behavior

**Verified fact.** UI's `Portal` renders with `ReactDOM.createPortal`. Unless a caller passes an explicit `root` or the portal is nested in another UI portal, it calls `getPortalContainer()`, which returns the document element with ID `grafana-portal-container` or falls back to `document.body`.

`PortalContainer` creates that fixed ID and is marked internal. Tooltips do not expose a root prop. Dropdown does expose one, but `PanelChrome` does not pass it. `TooltipPlugin2` resolves and caches the shared portal container for each mounted plugin instance.

**Verified fact.** Grafana's app mounts one `PortalContainer` and also wraps the application in React ARIA's `UNSAFE_PortalProvider` so React-ARIA `OverlayContainer` content, including modals, is routed into the same destination. That React-ARIA provider is not re-exported by UI.

**Inference.** The SDK should coordinate one portal root per document, with ownership/reference counting across SDK instances. Mounting one fixed-ID container per SDK instance would create duplicate IDs and ambiguous lookup. Falling back to `document.body` may be acceptable for the POC but weakens style containment and z-index ownership.

### Window, document, observer, and canvas requirements

The representative rendering path assumes a real browser DOM:

| Capability | Verified use |
| --- | --- |
| `window`/`document` | Portals, outside-click handling, resize/scroll handling, pointer/keyboard listeners, link navigation |
| `navigator` | Mobile detection in `TooltipPlugin2`; clipboard capability checks in visualization tooltip code |
| `ResizeObserver` | uPlot tooltip sizing and TableNG layout |
| Canvas | uPlot visualization and text/column measurement |
| `requestAnimationFrame` | Time-series keyboard cursor movement |
| `matchMedia` | Reduced-motion behavior and application-owned system-theme behavior |
| `performance.now` | Tooltip event handling and Scenes render profiling |

**Verified fact.** `TooltipPlugin2` reads `navigator.userAgent` at module evaluation time. The root ESM barrel re-exports that module. Importing the complete root package is therefore not proven safe in a server environment without browser globals.

**Inference.** Browser-only rendering is consistent with this project's frontend objective, but React SSR/build pipelines may still evaluate package modules on the server. The POC should include an import/build smoke test in any framework the project intends to support and document client-only loading if necessary.

### Cleanup behavior

**Verified fact.** Inspected UI effects remove their window/document event listeners, disconnect `ResizeObserver`, and rely on React portal unmounting for overlay descendants. uPlot's keyboard plugin installs a destroy hook that removes key/focus listeners.

**Open question.** Static cleanup code does not establish leak-free behavior under React 19 Strict Mode, plugin reloads, pinned tooltips, table popovers, or repeated scene activation. The POC must count listeners, portal children, observers, and retained panel instances across mount/unmount cycles.

## Host application compatibility

### Global CSS and design-system coexistence

**Verified fact.** Component-local Emotion classes reduce ordinary selector collisions, but `GlobalStyles` intentionally targets global elements and common class names. Host CSS can also override Grafana class output through specificity, cascade order, `!important`, inherited typography, or global canvas/table/control rules.

Likely collision scenarios include:

- host resets versus PanelChrome section/header/button layout;
- host table and button rules versus TableNG and panel menus;
- host `box-sizing` or typography versus chart measurement;
- host body overflow versus overlays and focus management;
- host z-index scales versus Grafana tooltip/dropdown/modal values; and
- simultaneous Grafana light and dark global rules.

### Multiple SDK instances

The static evidence yields this risk map:

| State | Scope | Multi-instance implication |
| --- | --- | --- |
| `ThemeContext.Provider` | React subtree | Instances can receive different themes in principle; portal context remains attached through React portals |
| `@emotion/css` generated sheet/cache | Module/document | Rules are shared per resolved package instance and are not owned by one SDK mount |
| `GlobalStyles` | Document | Different themes compete for the same global selectors; mount order can change host and sibling appearance |
| `grafana-portal-container` ID | Document | Must be shared; one-per-instance is invalid |
| `window.__grafana_public_path__` and cached icon root | Window/module | One asset base effectively applies to all instances of that module |
| React, Data `ThemeContext`, and Grafana packages | Module graph | Duplicate physical copies can split contexts, registries, and hook runtimes |
| Panel/UI event listeners | Window/document/component | Cleanup must be verified across concurrent activation and unmount |

**Inference.** Multiple same-theme instances are more plausible than concurrent light and dark instances if full `GlobalStyles` is used. Per-instance generated classes may coexist, but global resets, assets, portals, registries, and runtime services remain shared.

## React and ReactDOM compatibility

### React 19

**Verified fact.** UI 13.2.3 requires React and React DOM `>=19` as peer dependencies and uses React DOM portals. Grafana's official migration guide says Grafana 13.2 and its matching packages run on React 19 and recommends React/React DOM 19.2 in plugin development.

**Verified fact.** Grafana's documented plugin runtime deliberately shares one React instance with all plugins and warns plugin authors not to bundle another React version. An independent React host does not receive that SystemJS sharing behavior automatically.

### SDK packaging implication

**Inference.** The future SDK must treat React and React DOM as host peers and externalize them from its distribution. It should also force or verify one compatible physical copy of the pinned Grafana package family so UI components consume the same Data `ThemeContext` and mutable registries as Scenes and Runtime.

Risks to validate include:

- invalid-hook-call failures from duplicate React;
- a provider from one `@grafana/data` copy being invisible to UI from another copy;
- duplicate Emotion instances and style insertion order;
- package-manager failure or warnings from Scenes' React 18 peer range; and
- React 19 Strict Mode cleanup and legacy third-party dependency behavior.

The POC should record the resolved dependency graph and compare runtime React/ThemeContext identity, not rely only on semver ranges.

## Representative panel dependency analysis

### Summary

| Panel | UI/visual core in Grafana 13.2.3 | Published status | Application-owned requirements | Standalone implication |
| --- | --- | --- | --- | --- |
| Time series | uPlot plugins and helpers from UI; current app-owned `TimeSeries`/`GraphNG` | Several required helpers are internal; public `TimeSeries`/`GraphNG` is graveyard/deprecated | Panel component, current TimeSeries/GraphNG wrapper, annotations, exemplars, tooltip content, filter logic, assistant integration | `@grafana/ui` alone cannot supply the current panel |
| Stat | `BigValue`, `VizRepeater`, `DataLinksContextMenu`, theme | Mostly root exports; `DataLinksContextMenuApi` is internal and a Data calculation helper is internal | Panel component, plugin registration/options/migrations | Closest candidate for public-primitives POC, but not a published built-in plugin |
| Table | `TableNG`, fields/layout, theme and panel context | `TableNG` is `/unstable`; data-grid CSS is external | Panel component, table hooks/utilities, field config/options, Runtime error view | Current table fidelity requires unstable and application-owned code |
| Text | Scroll/layout/theme; unstable CodeMirror for code mode | Mixed root and `/unstable` | Runtime feature-flag selection, app config, variable suggestions, panel component/options | Plain rendered content may be narrow, but current plugin is not package-owned UI |

### Time series

**Verified fact.** The current [`TimeSeriesPanel.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx) imports:

- `PanelDataErrorView` from Runtime;
- uPlot interaction plugins from the UI root;
- `TimeRange2` and `TooltipHoverMode` from `@grafana/ui/internal`;
- application-owned `TimeSeries`;
- application-owned filtering and assistant integrations; and
- panel-local annotation, exemplar, outside-range, tooltip, and data-preparation modules.

The application-owned [`TimeSeries.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/TimeSeries/TimeSeries.tsx) imports `PlotLegend` and `UPlotConfigBuilder` from `@grafana/ui/internal` and uses application-owned `GraphNG`.

The public UI `TimeSeries` and `GraphNG` remain under `src/graveyard`; `GraphNG` is explicitly deprecated/internal. They are not the implementation used by the built-in Grafana 13.2.3 panel.

**Conclusion.** Reject the graveyard public components as the route to Grafana 13 visual fidelity. The POC needs a separately justified panel-module loading strategy or must report Time series as blocked.

### Stat

**Verified fact.** The current [`StatPanel.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/stat/StatPanel.tsx) uses UI's `BigValue`, `VizRepeater`, `DataLinksContextMenu`, and `useTheme2`. It uses Data to calculate display values, reduction, sparklines, ranges, links, and mappings.

It also imports `findNumericFieldMinMax` from `@grafana/data/internal` and a context-menu API type from `@grafana/ui/internal`. Its `PanelPlugin` definition, option defaults, migrations, and generated option types remain under `public/app/plugins/panel/stat`.

**Conclusion.** The visual primitive surface is promising and mostly published, but reusing the actual Stat panel is a panel-loading problem, not solved by adopting `BigValue` directly. Use Stat as the first visual/provider POC because it has the smallest application dependency graph.

### Table

**Verified fact.** The current [`TablePanel.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/table/TablePanel.tsx) uses `TableNG` from `@grafana/ui/unstable`, not the root `Table`. It also uses application-owned hooks for field-display caching, cell actions, shared crosshair behavior, common props, sorting, frame selection, and column resizing.

`TableNG` depends on the beta `@grafana/react-data-grid` package, retains a bare CSS import, uses grid/treegrid semantics, observes layout, measures text with canvas, and attaches document/window handlers for filter and cell interactions.

**Conclusion.** The public legacy `Table` is not evidence of current panel fidelity. Keep TableNG behind the compatibility layer and make it a POC-only dependency until its style, keyboard, cleanup, and unstable-API risks are measured.

### Text

**Verified fact.** The `text` module chooses v1 or v2 with `getFeatureFlagClient` from `@grafana/runtime/internal`. V2 rendering uses Data's Markdown/sanitization functions and public UI layout/theme components, but also imports application `config` for `disableSanitizeHtml` and application data-link variable suggestions. Code mode uses `CodeMirrorEditor` from UI's unstable entry point.

**Conclusion.** A read-only Markdown/HTML subset may be technically narrower than the other panels, but the actual Grafana Text plugin still requires feature-flag/configuration and application-owned code. Security-sensitive sanitization policy must remain explicit; the SDK must never infer that arbitrary HTML is safe.

## Visual behavior ownership

| Behavior | Primary owner at the pinned baseline | Notes |
| --- | --- | --- |
| Theme tokens and display color contracts | `@grafana/data` | UI consumes `GrafanaTheme2`; theme creation APIs are marked internal |
| Reusable controls, chrome, overlays, icons, layout, chart/table primitives | `@grafana/ui` | Mix of public, alpha, unstable, internal, and deprecated surfaces |
| Scene layout, panel measurement/composition, loading/error handoff, context wiring | `@grafana/scenes` | `VizPanelRenderer` composes PanelChrome and loaded plugin component |
| Processed frames, field display values, thresholds, mappings, links | `@grafana/data` | Must occur before or inside panel-specific rendering |
| Query execution and replaceable data-error view | `@grafana/runtime` | Full error renderer is installed by Grafana application startup |
| Time series, Stat, Table, Text `PanelPlugin` modules and options/migrations | Grafana application | Under `public/app/plugins/panel`; not published through UI |
| Current Time series wrapper/GraphNG and Table integration hooks | Grafana application | Under `public/app/core` and `public/app/features` |
| Full global provider tree and feature-flag theme behavior | Grafana application | `AppWrapper` and `ConfigProvider`; must not be imported as the shell |

**Inference.** UI adoption is necessary but cannot close the built-in-panel gap. Workstream 7 must treat the actual panel module and its transitive application dependencies as a separate feasibility boundary.

## Accessibility behavior

### Verified built-in behavior

- `PanelChrome` renders a focusable `section` labelled by an `h2`, with collapse state expressed through `aria-expanded` and `aria-controls`.
- `LoadingBar` uses `role="status"` with an accessible label.
- `Tooltip` makes its trigger keyboard-focusable and connects visible tooltip content with `aria-describedby`; tooltip content uses `role="tooltip"`.
- Panel menu buttons have panel-specific accessible labels; `Menu` and `MenuItem` implement menu roles and keyboard navigation.
- `Icon` is hidden from assistive technology by default unless a semantic title or ARIA labelling property is supplied.
- `TableNG` uses `grid` or `treegrid`, row/column roles, expansion state, labelled filtering/actions, and explicit keyboard handlers.
- the Time series keyboard plugin makes the uPlot root focusable and supports arrow-key cursor movement and keyboard range selection;
- `TooltipPlugin2` uses a polite live region for updated tooltip content; and
- Text code view supplies an accessible label to its read-only editor.

### Required POC validation

**Inference.** Source-level ARIA behavior is valuable but does not establish an accessible composed dashboard. The POC must test:

- logical tab order across multiple panels and portaled controls;
- focus restoration and Escape behavior for menus, tooltips, and any modal;
- screen-reader naming for titled and untitled panels;
- announcement frequency for loading, streaming, errors, and changing chart tooltips;
- keyboard access to time-series points, zoom, legends, links, and table actions;
- whether canvas-based chart information has an adequate nonvisual representation;
- light/dark contrast and focus visibility under host CSS;
- reduced-motion behavior; and
- sanitized Text content semantics.

Use automated axe checks as a floor, plus manual keyboard and screen-reader checks. Screenshot parity alone is insufficient.

## Initial style-containment strategy for the POC

This is an experiment design, not a final production decision.

### Baseline candidate

Start with a light-DOM SDK root that:

1. provides an explicit pinned `GrafanaTheme2` through `ThemeContext.Provider`;
2. keeps all Grafana package and provider details behind an SDK-owned adapter;
3. owns or coordinates one document-level portal destination;
4. serves the exact required icon/font assets from an explicit SDK asset base;
5. allows the dependency CSS imports required by uPlot and TableNG; and
6. does not install the complete UI `GlobalStyles` into the host document by default.

This baseline minimizes irreversible host-wide effects while exposing which global rules are actually required.

### POC comparison variants

Compare the same representative dashboard under:

| Variant | Purpose | Known risk |
| --- | --- | --- |
| Full `GlobalStyles` in an isolated reference page | Establish closest package-native visual reference | Not safe evidence for host coexistence |
| Light DOM plus a root-scoped/minimal compatibility style set | Candidate integration path | Required subset and cascade fidelity are unknown |
| Shadow DOM plus targeted Emotion/asset/portal handling | Test strongest style isolation | UI portals escape the shadow root; `@emotion/css` insertion target is not controlled by React CacheProvider |
| No additional global styles | Identify hard dependencies versus cosmetic differences | Expected typography, reset, Markdown, focus, and uPlot differences |

The host test fixture should include an intentionally opinionated second design system with global button, table, heading, link, form, canvas, and box-sizing rules. Test one instance, two same-theme instances, and simultaneous light/dark instances.

### POC acceptance evidence

Capture:

- screenshots for Time series, Stat, Table, and Text in light and dark modes;
- loading, empty-data, malformed-data, query-error, plugin-error, menu, tooltip, and data-link states;
- computed-style diffs for panel chrome, typography, chart, table, tooltip, and menu;
- all emitted style elements and their insertion destinations;
- icon/font/CSS network requests and failures;
- portal destinations and z-index behavior;
- resolved React and Grafana package identities;
- event listener, observer, portal-child, and retained-object counts after repeated mount/unmount; and
- automated and manual accessibility results.

Do not select Shadow DOM, full global styles, or a scoped-style extraction as the production strategy until this comparison is complete.

## Inferences

The following conclusions are reasoned from verified source facts but remain unproven in an external host:

1. A constrained UI subset can render panel chrome and at least a Stat-like visualization without the Grafana shell when supplied a concrete theme, processed data, dimensions, contexts, assets, and portal root.
2. Full `GlobalStyles` is too invasive as an unconditional SDK default because it modifies host-global elements and body behavior.
3. An Emotion React cache alone cannot contain all UI styles because relevant components use the separate `@emotion/css` API.
4. Two differently themed instances can generate distinct component classes, but cannot safely use independently themed full global styles in one document.
5. A single shared portal root and asset base are more compatible with UI internals than per-instance portal containers or public paths.
6. Browser-only lazy loading may be needed in SSR-capable hosts because root exports include modules with import-time browser-global reads.
7. Current Grafana built-in panels cannot be recovered from `@grafana/ui` alone; loading or adapting the application-owned panel modules is a separate critical path.
8. Exact Grafana package alignment and one React runtime are necessary to prevent context and singleton splits.

## Open questions

1. Can the exact package set install cleanly with React 19 despite Scenes 8.13.5's React 18 peer range?
2. Which global style rules are strictly required for each representative panel, and can they be scoped without visual or accessibility regressions?
3. Can Emotion insertion be directed into a shadow root for both `@emotion/react` and `@emotion/css`, or would that require unsupported package internals?
4. How should Tooltip, TooltipPlugin2, PanelChrome menus, React-ARIA overlays, and future modals share a host-safe portal target?
5. Can multiple light/dark instances coexist without global rule, z-index, or asset conflicts?
6. What supported mechanism can supply the current built-in Time series, Stat, Table, and Text `PanelPlugin` modules outside Grafana core?
7. Is use of `TableNG`'s unstable entry acceptable for the POC, and what fallback is honest if it changes?
8. Can the SDK avoid every `@grafana/ui/internal` dependency while matching current Time series fidelity?
9. Does UI root import work in intended SSR-capable toolchains, or must the SDK enforce client-only module evaluation?
10. Which icon/font packaging strategy works across base paths, CSP policies, code splitting, and multiple SDK instances?
11. Does `@grafana/i18n` require explicit initialization for correct locale behavior and translated UI strings outside the shell?
12. What Runtime initialization is needed to replace the minimal `PanelDataErrorView` fallback?
13. Does React 19 Strict Mode reveal listener, observer, portal, uPlot, or transition cleanup problems?
14. Are the chart canvas, dynamic tooltip, table grid, and rendered Text output accessible as a complete experience under real assistive technology?
15. Which visual-refresh theme variant represents the expected Grafana 13.2.3 reference for a given server configuration?

## Capability classification

| Required capability | Classification | Rationale |
| --- | --- | --- |
| React 19 and ReactDOM portal runtime | **Adopt directly** | Explicit UI peer requirement and Grafana 13.2 baseline; keep as host peers and one physical runtime |
| Public theme consumption (`ThemeContext`, `useTheme2`, `useStyles2`) | **Adopt behind compatibility adapter/provider** | Essential public APIs, but the SDK must own creation, switching, package identity, and lifecycle |
| Theme creation/lookup (`createTheme`, `getThemeById`) | **Adopt behind compatibility adapter/provider** | Required practical source of `GrafanaTheme2`, but Data marks these APIs internal |
| `PanelChrome` and panel dimension/status behavior | **Adopt behind compatibility adapter/provider** | Scenes requires it and fidelity depends on it; the component is explicitly internal |
| `PanelContextProvider` and panel interaction context | **Adopt behind compatibility adapter/provider** | Required by Scenes and visualizations; contract is alpha and must not escape the SDK API |
| `ErrorBoundaryAlert`, `LoadingBar`, core alert/loading primitives | **Adopt directly** | Published UI behavior used by Scenes; Runtime's full data-error view remains separate |
| Tooltips, menus, dropdowns, data-link context menus | **Adopt behind compatibility adapter/provider** | Published behavior is valuable, but portal root, navigation policy, focus, and z-index require coordination |
| Shared `PortalContainer` strategy | **Adopt behind compatibility adapter/provider** | Required for predictable overlays; internal fixed-ID component needs document-level ownership |
| Icons | **Adopt behind compatibility adapter/provider** | Native UI dependency; asset URL and module-level cache must be controlled centrally |
| Inter/Roboto Mono font assets | **Investigate in POC** | Needed for fidelity, absent from package artifact, and subject to host asset/policy decisions |
| Full `GlobalStyles` | **Investigate in POC** | Provides needed reset/fidelity rules but has unacceptable unmeasured global effects |
| Scoped light-DOM style bootstrap | **Investigate in POC** | Leading containment candidate; required style subset is unknown |
| Shadow DOM containment | **Investigate in POC** | Strong isolation, but conflicts with portal and Emotion insertion assumptions |
| uPlot dependency CSS and UI uPlot interaction plugins | **Adopt behind compatibility adapter/provider** | Required for Time series; browser listeners, portal behavior, and current panel assembly need validation |
| `BigValue` and supporting Stat primitives | **Investigate in POC** | Mostly published and best first visualization candidate; actual Stat plugin remains app-owned |
| `TableNG` | **Investigate in POC** | Current built-in table primitive, but explicitly unstable and dependent on external CSS/DOM infrastructure |
| Public legacy `Table` | **Defer** | Published and potentially useful, but not the current Grafana 13.2.3 Table panel path |
| Public graveyard `TimeSeries` and `GraphNG` | **Reject** | Deprecated/internal implementation and not used by the current built-in Time series panel |
| `@grafana/ui/internal` | **Reject** | Removed from the published npm export map and explicitly prohibited for external use |
| Grafana application `ThemeProvider` and `AppWrapper` | **Reject** | Unpublished and coupled to shell services, navigation providers, runtime globals, and application state |
| React-ARIA modal provider and modal surface | **Defer** | Not required for the initial representative read-only path; revisit if inspector/modal interactions enter scope |
| Panel editors and unstable CodeMirror editing UI | **Defer** | Initial SDK is rendering-focused; Text code display may be tested separately |
| Host-global installation of Grafana navigation/page/dashboard-grid styles | **Reject** | Reproduces shell concerns and increases collisions without being required for panel rendering |
| Current built-in panel modules from `public/app/plugins/panel` | **Defer** | Essential overall, but availability/loading/licensing belongs to panel dependency analysis rather than UI package adoption |
| Grafana UI types in the public SDK API | **Reject** | Keeps internal, alpha, unstable, and version-coupled contracts behind the compatibility boundary |

## Workstream conclusion

Adopt `@grafana/ui@13.2.3` as a required, exact-version internal dependency, but only as a constrained component and visualization layer behind an SDK-owned provider and compatibility boundary.

The package is credible for native panel chrome, theme-driven styles, common overlays, error containment, icons, and selected visualization primitives. It does not provide a supported standalone provider, scoped style bundle, self-serving asset bundle, or the current Grafana built-in panel modules. Several surfaces required by current Grafana core are internal, unstable, or application-owned.

This conclusion reinforces the Workstream 2 recommendation to use a constrained Scenes subset and the Workstream 3 decision to hide Grafana processing contracts. It does not yet prove standalone dashboard rendering. The POC must validate styling containment, assets, portals, multi-instance behavior, React/package identity, accessibility, and actual panel-module availability before a production UI strategy is selected.

## Upstream references

- [`@grafana/ui@13.2.3` npm metadata](https://registry.npmjs.org/%40grafana%2Fui/13.2.3)
- [`@grafana/ui` source manifest at `v13.2.3`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json)
- [`@grafana/ui` public root exports](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/index.ts)
- [`@grafana/ui` unstable entry point](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/unstable.ts)
- [`@grafana/ui` unpublished internal entry point](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/internal/index.ts)
- [UI package Rollup configuration and icon copying](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/rollup.config.ts)
- [UI theme hooks](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/ThemeContext.tsx)
- [Data `ThemeContext`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/themes/context.tsx)
- [Data theme creation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/themes/createTheme.ts)
- [Data built-in theme registry](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/themes/registry.ts)
- [Grafana application theme provider](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/utils/ConfigProvider.tsx)
- [Grafana application provider hierarchy](https://github.com/grafana/grafana/blob/v13.2.3/public/app/AppWrapper.tsx)
- [UI `GlobalStyles`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/GlobalStyles/GlobalStyles.tsx)
- [Global element/reset styles](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/GlobalStyles/elements.ts)
- [Global font declarations](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/GlobalStyles/fonts.ts)
- [Global uPlot styles](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/themes/GlobalStyles/uPlot.ts)
- [`PanelChrome`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/PanelChrome/PanelChrome.tsx)
- [Panel context](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/PanelChrome/PanelContext.ts)
- [UI portal implementation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Portal/Portal.tsx)
- [UI tooltip implementation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Tooltip/Tooltip.tsx)
- [UI dropdown implementation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Dropdown/Dropdown.tsx)
- [UI menu keyboard behavior](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Menu/hooks.ts)
- [UI icon implementation](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Icon/Icon.tsx)
- [UI icon path resolution](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Icon/utils.ts)
- [UI uPlot wrapper](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/uPlot/Plot.tsx)
- [UI uPlot tooltip plugin](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx)
- [UI uPlot keyboard plugin](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/uPlot/plugins/KeyboardPlugin.tsx)
- [UI `BigValue`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/BigValue/BigValue.tsx)
- [UI `TableNG`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/src/components/Table/TableNG/TableNG.tsx)
- [Scenes `VizPanelRenderer`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/VizPanelRenderer.tsx)
- [Runtime `PanelDataErrorView`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/components/PanelDataErrorView.tsx)
- [Grafana application data-error view](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/panel/components/PanelDataErrorView.tsx)
- [Current built-in Time series panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx)
- [Current application Time series wrapper](https://github.com/grafana/grafana/blob/v13.2.3/public/app/core/components/TimeSeries/TimeSeries.tsx)
- [Current built-in Stat panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/stat/StatPanel.tsx)
- [Current built-in Table panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/table/TablePanel.tsx)
- [Current built-in Text module](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/module.tsx)
- [Current built-in Text v2 panel](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/panel/text/v2/TextNGPanel.tsx)
- [Grafana Plugin Tools: migrate 13.1.x to 13.2.x](https://grafana.com/developers/plugin-tools/migration-guides/update-from-grafana-versions/migrate-13_1_x-to-13_2_x)
- [Grafana Plugin Tools: frontend npm dependencies](https://grafana.com/developers/plugin-tools/key-concepts/npm-dependencies)
- [Grafana Plugin Tools: data-link UI example](https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-datalinks-support)
