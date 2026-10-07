# Standalone rendering POC results

This document records durable, sanitized results from the disposable POC. It is
not a production support statement and makes no legal conclusion.

## Task 8 — Text built-in panel source loading

**Result:** P1 passes for the exact legacy-v1 Text entrypoint selected by the
controlled V1 fixture. The real Grafana 13.2.3 `TextPanel` and its
`PanelPlugin` are available in the standalone browser runtime without an
iframe, `GrafanaApp.init`, Grafana routes/chrome, SystemJS, or a second React
runtime. Gate A rendering has not run and is not claimed here.

### Source identity and preflight

| Item | Verified identity |
| --- | --- |
| Source tag | `v13.2.3` |
| Clean checkout commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Source location | Ignored local checkout supplied as `GRAFANA_SOURCE_DIR` |
| Selected plugin source | `public/app/plugins/panel/text/v1/module.tsx` |
| Upstream selector inspected | `public/app/plugins/panel/text/module.tsx` |
| Plugin ID/version | `text` / `13.2.3` |

Vite runs `git rev-parse HEAD` and `git status --porcelain` before enabling the
experiment aliases. A missing path, another commit, or any unrecorded source
patch fails the build. No Grafana application-source file is copied into this
repository.

### ResizeObserver preflight

The preflight reproduced the same Playwright serialization defect previously
found in the MutationObserver wrapper:

```text
ReferenceError: _classPrivateFieldInitSpec is not defined
at new TrackedResizeObserver
```

Playwright 1.56.1's Babel transform placed `_classPrivateFieldInitSpec` calls
inside the `page.addInitScript` callback while the generated helper definition
remained at test-module scope. Playwright serializes the callback without that
outer helper. The bounded repair replaces only the serialized wrapper's private
fields with closure-local `WeakMap` state and continues to delegate observation
to Chromium's native `ResizeObserver`.

Browser tests verify construction, installed prototype/`instanceof` behavior,
native callback entries and observer identity, repeated `observe()`, multiple
targets, `unobserve()`, `disconnect()`, reuse, multiple independent observers,
and zero retained observer accounting. The Text experiment did not need a
polling workaround.

### Loading experiments

| Experiment | Outcome | Evidence and reason |
| --- | --- | --- |
| P1a — root Text selector | Bounded failure | The exact selector statically imports both v1 and v2 and imports `@grafana/runtime/internal`. Grafana's published 13.2.3 Runtime manifest deliberately omits the `./internal` export, so Vite correctly rejects it. Aliasing the complete Runtime source would risk a second Runtime singleton and was not attempted. |
| P1b — selected legacy-v1 entrypoint | **Pass** | The unmodified `v1/module.tsx` builds and loads. The graph contains six audited Grafana application files, no Grafana internal package export, no v2 module/editor, no shell/routes/chrome/dashboard editor/general plugin map, and no SystemJS module. |
| P2 — compatibility artifact | Not run | P1b passed. No L3-approved artifact or copied/adapted panel source is necessary. |
| P3 — server-distributed module | Not run | P1b passed. No L5 diagnostic or server module URL is necessary. |

Selecting the legacy-v1 module is fixture-bound: the fixture is explicitly a
legacy-v1 Markdown Text panel and Task 5 supplies no `grafana.newTextPanel`
feature flag. This selection does not change the upstream v1 source and does not
claim support for the v2 Text panel.

### Exact application-source closure

The build report contains these application files and no other `public/app`
files:

- `public/app/plugins/panel/text/v1/module.tsx`
- `public/app/plugins/panel/text/v1/TextPanel.tsx`
- `public/app/plugins/panel/text/v1/TextPanelEditor.tsx`
- `public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts`
- `public/app/plugins/panel/text/panelcfg.gen.ts`
- `public/app/core/config.ts`

The direct dependency graph is:

```text
poc-grafana-bridge fixed catalogue
  -> exact-source Text v1 module
     -> @grafana/data PanelPlugin
     -> @grafana/i18n t
     -> generated panel option schema
     -> TextPanel
        -> React + react-use
        -> @emotion/css
        -> dangerously-set-html-content 1.1.1
        -> @grafana/data markdown/sanitization contracts
        -> @grafana/ui CodeEditor, ScrollContainer, useStyles2
        -> app/core/config
           -> published @grafana/runtime config
     -> TextPanelEditor
        -> @grafana/ui CodeEditor and suggestion adapter
     -> v1 migration handler
```

All React, ReactDOM, Emotion, RxJS, and `@grafana/*` package imports resolve to
the root pinned workspace cohort. The only `app` alias admitted by the audited
closure is `app/core/config`; all other application imports remain guarded.

### Build and asset evidence

The preserved-entry P1 build inspected 3,408 modules and emitted 90 chunks.
The complete build output was approximately 3,983,534 raw bytes and 1,088,610
gzip bytes. The Text source chunk was approximately 547,553 raw bytes / 167,520
gzip bytes and dynamically referenced the approximately 888,380 raw bytes /
224,300 gzip `ReactMonacoEditor` chunk.

The apparently large closure is explained by v1's static `CodeEditor` imports
in both the renderer's Code mode and its options editor. It also emits Monaco
language chunks, 74 CSS modules, two Monaco-related CSS assets, and one Codicon
TTF asset. There are no worker modules in this build report. This is bounded and
technically loadable, but bundle reduction or a different distribution shape is
a later architecture question; Task 8 does not modify or prune the exact panel.

No Text v2 source or editor chunk appears in the module report. No Grafana
application dynamic import appears; the dynamic chunks originate from the
published UI/Monaco closure.

### Runtime registration and browser evidence

The bridge exposes a closed Runtime-compatible catalogue with only plugin ID
`text`:

- first load creates and caches one `Promise<PanelPlugin>`;
- compatible repeated loads return the same promise and plugin identity;
- synchronous cache lookup returns the loaded plugin;
- unknown IDs return `panel-plugin-unsupported` and never form a URL;
- failures emit only the category `module-load-failed`, not the underlying
  error text;
- Runtime registration uses published `setPluginImportUtils` and verification
  uses published `getPluginImportUtils`.

The browser probe followed:

```text
Task 5 compatibility runtime
  -> fixed Text catalogue registered with Runtime
  -> exact v1 source module
  -> real PanelPlugin with panel component TextPanel
```

It observed plugin metadata `text` / `13.2.3`, one React and ReactDOM 19.2.8
identity, a cache miss then cache hit then success, zero Grafana network calls,
zero iframe observations, unchanged location `/`, zero portal roots, and no
instance-owned resource leak. It did not construct a Scene, activate a
dashboard, execute a query, or render the panel.

Ignored detailed evidence is generated at:

- `apps/poc-host/dist/evidence/bundle-evidence.json`
- `apps/poc-host/dist/evidence/forbidden-import-report.json`
- `artifacts/playwright/task-8-text-plugin.json`
- `artifacts/playwright/task-8-text-plugin-network.json`
- `artifacts/playwright/task-8-text-plugin-resources.json`

These artifacts contain module/request classifications and identities, not
credentials, cookies, authorization headers, response bodies, or source bodies.

### Licensing checkpoints

Checkpoint L1 is recorded for the six files above at commit
`6193dc03311b631b9727b560d24369e683dc396e`. Their repository provenance is the
Grafana OSS source tree whose root `LICENSE` is GNU AGPLv3 and whose root
`NOTICE.md` must remain part of any later review. The purpose is a local,
private, disposable source-loading experiment. No Grafana application source or
binary build output is committed or published.

L4 is also flagged because the ignored experimental build emits Codicon and
Monaco CSS/font assets through the published UI closure. Their precise
production serving, notices, and licensing obligations have not been reviewed.

This record is not legal approval. Explicit review is still required before
committing a distribution approach, sharing a built artifact, publishing a
package, or proposing production use. L3 and L5 were not triggered because P2
and P3 were not run.

### Task 8 decision

**Gate A may proceed after Task 8 review.** The required source-loading
feasibility proof passed through exact P1 v1 source, and no Task 8 stop condition
was reached. Gate A must still prove actual native Text rendering, provider and
style behavior, Scene activation/deactivation, and cleanup. The large Monaco
closure and L4 asset review remain explicit risks; neither is hidden or treated
as a production decision.

## Gate A — Native Text rendering

**Result: PASS.** The controlled dashboard selected by UID renders its real
Grafana OSS 13.2.3 Text panel through published Scenes lifecycle components in
the standalone React 19.2.8 host. The experiment uses native DOM and does not
create an iframe, call `GrafanaApp.init`, install Grafana routing, or load
Grafana navigation/chrome.

The disposable host keeps `/` as the neutral Task 4–8 probe surface. The
non-routing query switch `/?gate=a` selects the Gate A experiment without
changing pathname, installing React Router, or handing location ownership to
Grafana.

### Verified rendering path

```text
<GrafanaDashboard uid="grsdk-phase0-poc" />
  -> Task 5 runtime lease and providers
  -> Task 6 /grafana API discovery and V1 DTO retrieval
  -> Task 7 full fixture preflight and Text-only scene conversion
  -> PocDashboardSceneRoot / SceneGridLayout / SceneGridItem / VizPanel
  -> published Runtime plugin-import boundary
  -> Task 8 exact Text v1 PanelPlugin
  -> Grafana PanelChrome and TextPanel
  -> native React/DOM
```

Task 7 validates the complete schema-42 fixture before applying the Gate A
catalogue. The resulting graph contains only panel ID 1 with plugin ID `text`;
the query-backed Stat, Time series, and Table panels are neither constructed nor
activated. Browser evidence records one successful `text` conversion for each
requested fixture UID.

### Runtime and plugin evidence

The initialization sequence was:

1. validate host configuration;
2. install minimal boot data and asset policy;
3. load the pinned Grafana package cohort;
4. install only the `radio`, `select`, and `boolean` standard option descriptors
   required to evaluate the Text plugin's saved option defaults;
5. register the closed Text-only plugin importer;
6. select the shared light theme and initialize English Scenes translations;
7. register BackendSrv, application events, and the bounded location policy;
8. acquire one dashboard scope and portal reference.

The option descriptors are a view-only compatibility boundary: their editor
components render `null` and no edit UI is exposed. The plugin load records one
P1 direct-source cache miss, a compatible cache lookup, and success for
`public/app/plugins/panel/text/v1/module.tsx` at version `13.2.3`. Remount uses
the same cached plugin identity. Unknown plugin IDs and arbitrary URL/SystemJS
fallback remain rejected.

The real `TextPanel-converted-content` DOM contains the saved Markdown sentinel
`Native phase0 Text fixture for phase0.`, renders its `phase0` strong element,
and is enclosed by the real panel region named `Text — phase0`. The panel had a
measured non-zero 269 by 220 CSS-pixel box in the recorded Chromium run.

### Styles and assets

Gate A uses normal light DOM. It loads the published Grafana theme context,
Scenes/PanelChrome component styles, and the Text component's Emotion styles;
it does not import Grafana's full application stylesheet or `GlobalStyles`.
The host supplies only scoped layout, dimensions, controls, color, and font
fallbacks. The host sentinel retained color `rgb(23, 36, 62)`, its Inter stack,
and the browser's eight-pixel body margin across mount and remount. The Text
content also resolved to the Inter stack.

The development browser recorded 90 Emotion style elements after first render
and the same count after remount, with no duplicate persistent style growth.
The reference-counted portal root exists while mounted, has no children for this
view-only panel, and is removed on final lease release. No Monaco module,
Codicon font, worker, or Text v2 resource was requested during rendering. Those
assets remain part of the Task 8 build closure because the exact v1 module
statically exposes its editor paths; Gate A does not prune that source.

### Lifecycle, UID change, and isolation

Scenes' React component owns activation. The primary scene reports active while
mounted and inactive after unmount. Runtime leases, dashboard scopes, portal
references, instance-owned timers/listeners/subscriptions/observers, and active
ResizeObserver targets return to zero. Remount reproduces the same Text output,
theme, plugin identity, and style count.

Changing `grsdk-phase0-poc` to `grsdk-phase0-poc-alt` aborts/invalidates the old
generation, deactivates the old scene, and renders the alternate sentinel
`Native phase0-alt lifecycle fixture.` from a new real DTO and scene. The four
Grafana requests across initial mount, UID change, and remount are limited to
dashboard API discovery/V1 DTO requests. No datasource query, legacy dashboard
API, remote plugin-module request, or unexpected Grafana endpoint occurs.

React Strict Mode exposed two bounded compatibility issues during the gate:

- its setup/cleanup rehearsal could abort a shared discovery promise before the
  durable effect joined it; the component now yields one microtask and checks
  generation ownership before starting network work;
- `react-use` may construct and discard a ResizeObserver before `observe()`.
  Resource instrumentation now counts an observer as active only after its
  first successful `observe()`, while preserving separate construction events
  and native observer behavior.

The MutationObserver evidence contains the Gate A iframe guard plus Playwright
1.56.1's own listener-removal observer. Both identities are explicit; the Gate
A observer disconnects with zero iframe additions and zero pending records.
There are no retained panel observers after teardown.

The approved plan assigns the shared-runtime two-dashboard-instance stress test
to Gate C, so Gate A did not duplicate that later test. It did prove sequential
independent scene ownership across UID change and remount in one compatible
process-wide runtime.

### React, security, and provenance result

The known Scenes 8.13.5 React `^18` peer declaration remains visible and
unsuppressed. Despite that declaration, the actual Gate A render completed with
one physical React 19.2.8 and one ReactDOM 19.2.8 identity, with no hook,
hydration, console, or page errors. This is POC evidence, not a compatibility
guarantee for later visualization gates.

Authentication remains browser/host owned. Playwright logs into the local
fixture with process-only credentials and places temporary storage state outside
the repository. Evidence omits credential-bearing headers entirely and contains
no cookies, authorization values, response bodies, or query text.

Gate A adds no Grafana application-source file beyond Task 8's six-file audited
closure at commit `6193dc03311b631b9727b560d24369e683dc396e`. Licensing
checkpoints L1 and L4 therefore remain open with no provenance delta. This is
still disposable private research code and is not a production distribution or
legal conclusion.

The Gate A production build inspected 8,953 imports, bundled 3,720 modules into
140 chunks, and still classified exactly those six files as reviewed Grafana
application source. The forbidden-import report contains no Grafana shell,
route/chrome, internal-package, or SystemJS violation.

Ignored detailed evidence is generated at:

- `artifacts/playwright/gate-a-text.json`
- `artifacts/playwright/gate-a-text-network.json`
- `artifacts/playwright/gate-a-text-resources.json`
- `apps/poc-host/dist/evidence/bundle-evidence.json`
- `apps/poc-host/dist/evidence/forbidden-import-report.json`

Gate B may begin only after this Gate A change is reviewed and committed. No
Stat plugin, datasource frontend module, SceneQueryRunner execution, Time
series, or Table rendering is implemented by Gate A.

## Task 10 — TestData datasource and query runtime

**Result: PASS (D1).** The exact Grafana OSS 13.2.3 TestData frontend module
executes the controlled dashboard's real `predictable_pulse` target through the
standalone runtime and the host-owned `/grafana` transport. The Task 7
`SceneQueryRunner` observes `Loading` then `Done` with real `PanelData`. No Stat
panel or other query-backed visualization is loaded or rendered.

Because D1 reached the real query endpoint successfully, the conditional D2
backend-only adapter and D3 server-distributed module diagnostic were not run.

### Verified query path

```text
validated schema-42 V1 dashboard DTO
  -> Task 7 Text/Stat/Time series/Table preflight
  -> Stat-only Task 7 scene graph for panel ID 2
  -> SceneQueryRunner
  -> published Runtime getRunRequest boundary
  -> constrained POC runRequest Observable
  -> fixed-UID DataSourceSrv
  -> exact TestDataDataSource (D1 source module)
  -> published DataSourceWithBackend
  -> host-owned BackendSrv
  -> POST /grafana/api/ds/query
  -> Grafana 13.2.3 TestData backend
  -> DataQueryResponse
  -> PanelData Loading / Done
```

The success path starts with the real `grsdk-phase0-poc` DTO, uses its saved
panel ID 2 target and datasource reference, and activates its actual Task 7
scene root and query runner. It does not substitute a diagnostic runner or
fabricated `PanelData`.

The recorded initial response contains one frame, two fields, and 3,601 points.
Its `PanelData.request` preserves dashboard UID `grsdk-phase0-poc`, panel ID 2,
request ID, browser timezone, time range, interval, maximum data points, and
target ref ID. Calling `SceneQueryRunner.runQueries()` produces a second unique
request and another `Done` result through the same cached datasource instance.

### Explicit runtime responsibilities

The query runtime is acquired lazily from an existing Task 5 runtime lease. It
performs these independently testable steps in order:

1. initialize the published Runtime unstable logger registry required by
   `DataSourceWithBackend`;
2. request `/api/frontend/settings` through the existing BackendSrv and retain
   only safe fields for datasource UID `grsdk-testdata` and type
   `grafana-testdata-datasource`;
3. install a bounded `TemplateSrv` for the controlled `environment=phase0`
   variable and Grafana scoped time/interval values;
4. install a `DataSourceSrv` that resolves only the controlled UID, name, type,
   or its one default datasource;
5. load and instantiate the exact TestData `DataSourceClass` once, then cache
   that identity;
6. register that exact instance with Runtime's published unstable datasource
   instance cache so `DataSourceWithBackend` does not fall back to Grafana
   application initialization;
7. install the POC `runRequest` implementation, which owns
   `Loading`/`Done`/`Error` projection and unsubscribe teardown;
8. expose query-runtime readiness and each registration step through sanitized
   runtime evidence.

The process-wide coordinator allows compatible repeated acquisition to return
the same query runtime. A different loader function or module identity in the
same JavaScript realm is rejected as a runtime conflict. Unknown datasource
UIDs/types, runtime datasource registration, unsupported template formats, and
unknown variables are closed rather than delegated to general Grafana plugin
discovery.

`initializeLoggersRegistry` and `registerRuntimeDataSourceInstance` are
published from `@grafana/runtime/unstable`, not from the stable community-plugin
surface. Their use is isolated in the disposable compatibility runtime and is
an explicit version-coupling risk.

### D1 source-loading result

The D1 bridge imports only the exact alias
`grafana-poc-testdata-datasource`, mapped to:

`public/app/plugins/datasource/grafana-testdata-datasource/module.tsx`

The bridge extracts the module's real `DataSourcePlugin.DataSourceClass`; it
does not reproduce TestData query behavior. The class extends the published
Runtime `DataSourceWithBackend`, so `predictable_pulse` reaches Grafana's real
`/api/ds/query` implementation.

Grafana's source-local TestData `tsconfig.json` extends the unpublished build
package `@grafana/plugin-configs/tsconfig.json`. That build-only package is not
part of the runtime closure and was not added. A POC-specific Vite plugin reads
only files below the audited TestData directory and compiles their unchanged
TypeScript/TSX with Vite's pinned Oxc transformer and an inline `react-jsx`
setting. The virtual IDs map back to exact upstream paths in bundle evidence;
relative imports cannot escape the source root.

Direct package dependencies in the D1 source graph are the pinned Grafana
package cohort, React, RxJS, `d3-random` 3.0.1, `lodash` 4.18.1, and
`react-use` 17.6.1. The exact module also statically registers query/config
editors, so its production closure includes published Grafana UI/Monaco code
even though Task 10 only instantiates `DataSourceClass` and renders no editor.

The build admits these 33 new Grafana application-source files and no other
TestData application files:

- `ConfigEditor.tsx`, `LogIpsum.ts`, `MetaDataInspector.tsx`,
  `QueryEditor.tsx`, and `TestInfoTab.tsx`;
- `components/CSVContentEditor.tsx`, `CSVFileEditor.tsx`,
  `CSVWaveEditor.tsx`, `ErrorEditor.tsx`, `ErrorWithSourceEditor.tsx`,
  `ExemplarLabelsEditor.tsx`, `ExemplarsEditor.tsx`, `FlakyQueryEditor.tsx`,
  `GrafanaLiveEditor.tsx`, `NodeGraphEditor.tsx`,
  `PredictablePulseEditor.tsx`, `RandomWalkEditor.tsx`, `RawFrameEditor.tsx`,
  `SimulationQueryEditor.tsx`, `SimulationSchemaForm.tsx`,
  `StreamingClientEditor.tsx`, and `USAQueryEditor.tsx`;
- `constants.ts`, `dataquery.ts`, `datasource.ts`, `metricTree.ts`,
  `module.tsx`, `nodeGraphUtils.ts`, `runStreams.ts`, and `variables.ts`;
- `testData/flameGraphResponse.ts`, `serviceMapResponse.ts`, and
  `serviceMapResponseMedium.ts`.

Together with Gate A's six reviewed files, the production report classifies
exactly 39 Grafana application-source files, zero Grafana internal-package
modules, and zero SystemJS modules. It inspected 9,104 imports and bundled
3,791 modules into 145 chunks. The exact TestData source chunk was about
127,200 raw bytes / 31,750 gzip bytes. The closure also emits Monaco/Codicon
assets because of the module's static editor registrations; this is evidence,
not a production-size acceptance decision.

The forbidden-import guard admits the source alias only from
`poc-grafana-bridge`, maps virtual modules back to an exact 33-file reviewed
list, and the post-build inspector rejects both missing required files and any
additional application source. No direct `public/app` import enters
`poc-host` or `poc-compat`.

### Request, cancellation, and failure evidence

The authenticated Chromium run observed this sanitized network sequence:

- `GET /grafana/api/frontend/settings` -> 200;
- dashboard API discovery and V1 DTO retrieval -> 200;
- initial `POST /grafana/api/ds/query` -> 200;
- refresh `POST /grafana/api/ds/query` -> 200;
- controlled five-second `slow_query` request -> browser cancellation;
- new-generation `predictable_pulse` request -> 200.

The controlled slow request remained in `Loading`, was allowed to reach the
real HTTP transport, then scene deactivation unsubscribed the observable. The
unsubscribe propagated to the BackendSrv fetch `AbortSignal`; transport and
query evidence both classify cancellation, no `Done` was published for the old
generation, and the next real generation reached `Done`. Runtime leases and
instance-owned resources returned to baseline.

The request adapter also mirrors Grafana's header encoding for non-Latin-1
panel titles; Chromium otherwise rejects such a `Headers` value before the
request can start. Focused tests cover datasource-not-found, unsupported type,
module-load failure, query 401 and 403 classification, datasource/server
failure projection, malformed response projection, cancellation, and late
publication suppression. Mocks are limited to those deterministic failure
branches; all success, refresh, cancellation, and new-generation browser
paths use the live Grafana fixture.

Instrumentation stores datasource UID/type, D1/module identity, cache
hit/miss, request ID, dashboard UID, panel ID, state/result category, endpoint
classification, status, and duration. It omits headers with credential-bearing
names, cookies, authorization values, response bodies, and target/query text.
Ignored detailed evidence is generated at:

- `artifacts/playwright/task-10-testdata-query.json`;
- `apps/poc-host/dist/evidence/bundle-evidence.json`;
- `apps/poc-host/dist/evidence/forbidden-import-report.json`.

### Licensing checkpoints and Task 10 decision

Checkpoints L1 and L3 now include the 33 exact TestData application-source
files above at commit `6193dc03311b631b9727b560d24369e683dc396e`, the
POC-only source transformer, and the generated source-built bundle. L4 also
remains open for the published UI/Monaco/Codicon asset closure. The source tree
root identifies GNU AGPLv3 and contains `NOTICE.md`; this document records
provenance only and makes no legal conclusion. No Grafana application source,
source-built output, credentials, or browser session state is committed.

**Gate B may proceed after Task 10 review.** D1 is the approved preferred path
and proves a credible real query-backed rendering dependency chain without
Grafana application startup, an SDK backend, iframe, or a second React runtime.
Task 10 does not prove Stat plugin loading, display processing, panel failure
isolation, or native Stat rendering; those remain Gate B responsibilities.

The source-built TestData distribution, large editor closure, unstable Runtime
registrations, and version coupling remain unresolved production risks. POC
success does not authorize distributing this bridge or adopting it as the
production SDK architecture.
