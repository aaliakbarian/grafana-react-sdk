# Grafana React SDK

> Early-stage project: the SDK has not been implemented or published yet.

Render existing Grafana OSS dashboards as native React components.

No iframe.  
No Grafana application shell.  
Just Grafana dashboards rendered directly inside your React application.

## Overview

`grafana-react-sdk` is intended to become an open-source project for rendering existing Grafana OSS 13 dashboards natively inside React and TypeScript applications. Applications will select a dashboard by UID and render it as part of their own interface.

## Project boundaries

The SDK is intended to:

- run entirely in the browser;
- expose a React-oriented integration surface;
- load an existing dashboard by Grafana UID;
- reuse supported Grafana rendering packages where technically viable; and
- leave application navigation, layout, authentication, and product chrome to the host application.

The SDK will not:

- embed dashboards with an iframe;
- start or reproduce the Grafana web application shell;
- reproduce Grafana navigation; or
- ship a backend service.

These boundaries are project decisions. The exact package integrations and public API remain subjects of research and proof-of-concept work.

## Status

The repository is in its foundation and research phase. It currently contains project documentation only: no source code, package manifest, installable artifact, or supported API exists yet.

The first technical milestone is a rendering proof of concept against Grafana OSS 13. See the [roadmap](docs/project/roadmap.md) and [POC plan](docs/architecture/research/grafana-rendering-poc.md).

## Documentation

- [Project context](docs/project/project-context.md)
- [Vision](docs/project/vision.md)
- [Roadmap](docs/project/roadmap.md)
- [Development workflow](docs/project/development-workflow.md)
- [Architecture overview](docs/architecture/architecture-overview.md)
- [Architecture decisions](docs/architecture/decisions/)
- [Research notes](docs/architecture/research/)
- [Local development](docs/development/local-development.md)

## Contributing

The project is not ready for implementation contributions yet, but research, use cases, and corrections to the documentation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

No open-source license has been selected yet. The current [LICENSE](LICENSE) file is a placeholder; until it is replaced, no license permission is granted.

Grafana is a trademark of Grafana Labs. This project is independent and is not endorsed by or affiliated with Grafana Labs.
