# Development Workflow

## Current phase

The repository is documentation-only. Do not add source code, a package manifest, generated output, or runtime dependencies until the research and proof-of-concept scope is approved.

## Change workflow

1. Read the project context, architecture overview, and relevant ADRs.
2. Define one focused outcome and identify the evidence needed to validate it.
3. Create a short-lived branch from the current default branch.
4. Make the smallest change that achieves the outcome.
5. Update documentation and ADRs when assumptions or durable decisions change.
6. Run all checks applicable to the files changed.
7. Open a pull request with the motivation, approach, alternatives, and validation results.

Do not commit or push on behalf of a contributor unless they explicitly request it.

## Documentation conventions

- Use Markdown with descriptive headings and relative links.
- Distinguish facts, decisions, hypotheses, and open questions.
- Give research findings a Grafana version, reproduction procedure, and source.
- Keep roadmap items outcome-oriented; avoid unsupported dates or guarantees.
- Use one sentence per line only when a formatter is later adopted; do not create noisy formatting-only changes now.

## Architecture decisions

Create an ADR when a change sets or revises a durable constraint, public interface, dependency strategy, or component boundary. Use the next sequential identifier and include:

- status;
- context;
- decision;
- consequences; and
- alternatives considered.

Accepted ADRs are historical records. Supersede them with a new ADR rather than rewriting the original decision.

## Research changes

Research documents should state the question, environment, method, evidence, findings, limitations, and recommendation. A conclusion without reproducible evidence remains a hypothesis.

## Implementation workflow

Once implementation is authorized, each behavior change should include automated tests appropriate to its boundary. Tooling commands, formatting rules, supported runtimes, and release procedures will be added after the package toolchain is selected. Do not invent commands before they exist.

## Pull requests and commits

- Keep pull requests reviewable and limited to one concern.
- Use clear, imperative commit subjects.
- Link related issues or research evidence.
- Call out compatibility and security implications.
- Never include secrets, credentials, dashboard exports containing sensitive data, or local environment files.
