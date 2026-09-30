# Codex Prompts

## Purpose

This document provides guardrails and a reusable prompt structure for AI-assisted work in this repository. It is not a record of private conversations or hidden reasoning.

## Required context

Prompts should direct Codex to read, at minimum:

- `README.md`;
- `docs/project/project-context.md`;
- `docs/architecture/architecture-overview.md`;
- relevant ADRs and research notes; and
- the current working-tree status.

## Prompt template

Use this structure for a focused task:

1. **Goal:** one concrete outcome.
2. **Scope:** exact files or behavior included.
3. **Constraints:** project decisions and explicit non-goals.
4. **Evidence:** documents, versions, issues, or reproduction steps to use.
5. **Validation:** commands or observable results that prove completion.
6. **Handoff:** whether to show a diff, create commits, or stop for review.

## Repository guardrails

Include relevant guardrails explicitly:

- Do not use iframes.
- Do not run the Grafana web application shell.
- Do not reproduce Grafana navigation.
- Keep the SDK frontend-only.
- Select dashboards by UID.
- Prefer validated Grafana-native rendering packages.
- Do not present hypotheses as verified Grafana behavior.
- Do not add dependencies or package metadata before that task is approved.
- Do not commit, push, publish, or open a pull request unless explicitly authorized.

## Expected agent behavior

- Inspect existing files before changing them.
- Preserve unrelated working-tree changes.
- State assumptions and separate them from evidence.
- Keep changes within the requested scope.
- Update ADRs when a durable decision changes.
- Run fresh validation and report actual results.
- Show the resulting diff when requested.

## Example foundation prompt

> Read the project context and current repository state. Update only the named documentation files. Preserve all accepted ADR constraints, add no source code or package manifest, run documentation-focused checks, show the diff, and do not commit.

## Recording useful prompts

Add examples only when they are reusable across tasks. Remove repository-specific secrets, personal data, tokens, internal URLs, and unnecessarily long transcripts.
