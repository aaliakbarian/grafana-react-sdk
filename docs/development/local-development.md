# Local Development

## Current state

The repository contains a runnable private React host and a containerized development environment for the disposable native-rendering POC. It does not yet contain the Grafana fixture, Grafana runtime initialization, dashboard loading, panel rendering, or datasource integration.

All POC packages are private research workspaces and must not be published. Passing POC code does not automatically become production SDK code.

## Prerequisites

The default workflow requires only:

- Git;
- Docker with Docker Compose;
- VS Code or Codex; and
- a repository checkout on the WSL Linux filesystem.

Node.js, npm, Yarn, TypeScript, Vite, Vitest, Playwright, Chromium, and native browser dependencies are supplied by the development image. They are not required on the WSL host. A Grafana service is intentionally absent until Task 3.

## Container-first setup

From the repository root:

```bash
docker compose build dev
docker compose run --rm dev yarn install --immutable
```

The image is based on `node:22.23.3-bookworm`, prepares Yarn `4.17.1` through Corepack, and installs the Chromium build required by Playwright `1.56.1`. Application dependencies are never installed globally in the image; the repository's `yarn.lock` remains authoritative.

The repository's `nodeLinker: node-modules` setting is authoritative. Compose therefore mounts named volumes at `/workspace/node_modules` and `/var/cache/yarn`, keeping dependency and Yarn cache contents outside the bind-mounted checkout. Source files and `yarn.lock` remain bind-mounted from WSL.

The container entrypoint reads the bind-mounted checkout's numeric UID/GID and runs the requested development command with that identity. This prevents generated files in the repository from becoming root-owned.

The known `@grafana/scenes@8.13.5` React peer warning is expected: Scenes declares React 18 while the pinned Grafana 13.2.3 cohort requires React 19.2.8. Do not suppress or override this warning; retain it as POC evidence.

## Workspace commands

| Operation | Container-first command |
| --- | --- |
| Immutable install | `docker compose run --rm dev yarn install --immutable` |
| Type check | `docker compose run --rm dev yarn typecheck` |
| Unit tests | `docker compose run --rm dev yarn test:unit` |
| Integration tests | `docker compose run --rm dev yarn test:integration` |
| Browser/E2E tests | `docker compose run --rm dev yarn test:e2e` |
| Production build | `docker compose run --rm dev yarn build:poc` |
| Forbidden-import inspection | `docker compose run --rm dev yarn inspect:bundle` |
| In-container verification suite | `docker compose run --rm dev sh dev/container/verify-environment.sh` |
| Complete container/host contract | `bash tests/container/dev-environment-contract.sh` |

Use `docker compose run --rm dev yarn workspaces list --json` to inspect workspace discovery. Use the same prefix with `yarn why react`, `yarn why react-dom`, and `yarn why @grafana/scenes` to inspect the pinned runtime identity and expected peer warning.

The complete contract builds the image by default. If upstream registries are temporarily unavailable and the exact image has already been built, `POC_SKIP_IMAGE_BUILD=true bash tests/container/dev-environment-contract.sh` reuses it while retaining every runtime, browser, port, and ownership assertion.

## Run the development host

Start the host with:

```bash
docker compose up dev
```

Open `http://localhost:5173/`. Vite listens on the container interface, while Compose publishes it only on host loopback through `127.0.0.1:5173:5173`.

Stop the host with:

```bash
docker compose down
```

The `/grafana` development proxy remains configured, but no service is listening at its target until Task 3 adds the Grafana fixture.

## Optional direct WSL tooling

Direct WSL execution is optional. If a contributor intentionally chooses it, they must install Node.js `22.23.3`, enable Corepack, and use Yarn `4.17.1`. The equivalent direct install remains:

```bash
corepack yarn install --immutable
```

The container workflow is the supported default and is used for POC verification.

## Working with the repository

1. Create a focused branch from the current default branch.
2. Read the project context, architecture overview, and relevant ADRs.
3. Edit only the files required for the change.
4. Review `git status` and `git diff` before requesting review.
5. Check Markdown links and inspect rendered formatting where practical.

## Documentation validation

Until automated tooling is selected, validate documentation manually:

- confirm requested files and directories exist;
- confirm relative links resolve;
- scan for trailing whitespace and accidental secrets;
- verify terminology and constraints are consistent; and
- review the complete diff for unrelated changes.

## Future setup

Later implementation tasks will add the Grafana container, runtime services, bundle evidence, and gate-specific commands. Do not infer that the development container authorizes those later tasks.
