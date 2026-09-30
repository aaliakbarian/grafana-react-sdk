# Local Development

## Current state

There is no application, package manifest, dependency installation, build, test, lint, or development-server command yet. The repository currently contains documentation only.

Do not add placeholder tooling commands: they would imply a development contract that has not been selected.

## Prerequisites

For documentation work, use:

- Git; and
- a text editor with Markdown support.

Node.js, a package manager, React tooling, Docker, and a Grafana instance will become relevant only after the corresponding research or implementation task defines exact versions and setup.

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

When package tooling is approved, this document should be updated with exact supported versions and copyable commands for:

- dependency installation;
- development and POC environments;
- formatting and linting;
- unit, integration, and browser tests;
- type checking and production builds; and
- any optional local Grafana or Docker setup.

Those decisions must be based on the selected toolchain and POC needs, not filled in speculatively.
