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
