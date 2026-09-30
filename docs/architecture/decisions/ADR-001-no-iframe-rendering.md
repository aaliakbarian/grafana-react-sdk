# ADR-001: No iframe Rendering

- **Status:** Accepted
- **Date:** 2026-09-30

## Context

The project exists to integrate Grafana dashboards into a host React application's component tree and user experience. An iframe would isolate Grafana but would also preserve a separate document, styling boundary, lifecycle, and interaction model. It would not establish whether Grafana dashboards can be rendered natively in React.

## Decision

The SDK will not use an iframe to render dashboards. This prohibition includes primary rendering, compatibility fallback, and error recovery paths.

## Consequences

- Dashboard content must be represented and rendered inside the host document.
- The project must address Grafana runtime dependencies, styling, lifecycle, and compatibility directly.
- Host applications can compose the dashboard within their own layout and React lifecycle.
- Some deployment patterns that work with iframe embedding may not be supported.
- If native rendering proves infeasible, the project must revise its goal explicitly rather than add an iframe fallback silently.

## Alternatives considered

### Grafana iframe embedding

Rejected because it conflicts with the project's defining integration goal.

### Offer both iframe and native modes

Rejected for the initial scope because it would create two materially different products and allow native compatibility gaps to remain hidden.
