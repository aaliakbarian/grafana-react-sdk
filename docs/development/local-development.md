# Local Development

## Current state

The repository contains the private workspace foundation for the disposable native-rendering POC. It does not yet contain a runnable React host, Grafana runtime initialization, dashboard loading, panel rendering, datasource integration, or Docker configuration.

All POC packages are private research workspaces and must not be published. Passing POC code does not automatically become production SDK code.

## Prerequisites

Use:

- Git;
- Node.js `22.23.3`;
- Corepack with Yarn `4.17.1`; and
- a text editor with Markdown and TypeScript support.

Docker and a Grafana instance are not required until the dedicated environment task.

## Install

From the repository root:

```bash
corepack enable
corepack yarn install --immutable
```

The first lockfile-generation run uses `corepack yarn install`; every subsequent install must use `--immutable`.

Yarn's `node-modules` linker is intentional for the later exact-source Grafana experiment. Dependency install scripts are disabled by default.

The known `@grafana/scenes@8.13.5` React peer warning is expected: Scenes declares React 18 while the pinned Grafana 13.2.3 cohort requires React 19.2.8. Do not suppress or override this warning; retain it as POC evidence.

## Workspace commands

| Command | Current Task 1 behavior |
| --- | --- |
| `corepack yarn install:poc` | Repeats the immutable install |
| `corepack yarn typecheck` | Type-checks all three private workspaces |
| `corepack yarn test:unit` | Runs the pinned Node/Vitest toolchain test |
| `corepack yarn test:integration` | Succeeds with no integration tests until later tasks add them |
| `corepack yarn test:e2e` | Succeeds with no browser tests until Task 2 adds the host and Playwright configuration |
| `corepack yarn build:poc` | Performs the basic TypeScript project-reference build |
| `corepack yarn inspect:bundle` | Runs the basic build and rejects accidental Grafana application-shell imports; Task 4 will add module/chunk evidence |

Use `corepack yarn workspaces list --json` to inspect workspace discovery. Use `corepack yarn why react`, `corepack yarn why react-dom`, and `corepack yarn why @grafana/scenes` to inspect the pinned runtime identity and expected peer warning.

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

Later implementation tasks will add the Vite host, Playwright browser configuration, Grafana container, runtime services, bundle evidence, and gate-specific commands. Do not infer that the presence of the private workspaces authorizes those later tasks.
