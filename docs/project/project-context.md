# Project Context

## Problem

Teams often want an existing Grafana dashboard inside a React product without presenting a second application's frame, navigation, or user experience. An iframe keeps Grafana isolated but limits integration with the host application's layout, styling, lifecycle, and interaction model. Running the Grafana web application shell carries substantially more behavior than an embedded dashboard needs.

## Objective

Create a React and TypeScript SDK that renders an existing Grafana OSS 13 dashboard natively in a React application. The host selects the dashboard by UID and remains responsible for its own application shell.

## Intended users

- React application teams that already operate Grafana OSS 13.
- Platform teams that want a reusable embedding boundary across products.
- Maintainers evaluating whether Grafana's frontend packages can support a smaller, application-neutral runtime.

## Fixed constraints

- No iframe rendering.
- No Grafana web application shell.
- No reproduction of Grafana navigation.
- A frontend-only SDK; the project will not ship a backend.
- Dashboard selection by UID.
- Prefer Grafana's native rendering packages where technically possible.

## Working assumptions

These assumptions require proof before becoming commitments:

- A host application can provide connectivity and authorization to the necessary Grafana HTTP APIs.
- Required Grafana packages can run outside the Grafana application shell with an acceptable compatibility layer.
- Dashboard definitions can be loaded and adapted without rebuilding Grafana's full frontend runtime.
- CSS, themes, global services, and package versions can be isolated well enough for normal React applications.

## Open questions

- Which Grafana OSS 13 frontend packages are supported for external consumption?
- Can Grafana Scenes represent and render all dashboard features needed for the first release?
- Which Grafana runtime services must be supplied or replaced?
- How will data-source proxy calls, authentication, CORS, and request cancellation work in each deployment model?
- What subset of panels, variables, transformations, annotations, and time controls defines initial compatibility?
- What versioning policy can accurately communicate compatibility with Grafana releases and plugins?

## Definition of success

The project succeeds when a React application can render a supported existing dashboard by UID, with documented compatibility and predictable lifecycle behavior, while the host retains control of navigation and product chrome. The proof of concept must establish that this is feasible before the public SDK API is designed.
