# Superpowers Workflow

## Purpose

Superpowers provides a structured workflow for turning an idea into an approved design, an executable plan, a verified change, and a clear handoff. Use the workflow in proportion to the risk and scope of the task while respecting explicit repository and contributor instructions.

## Typical sequence

1. Inspect the repository and applicable guidance.
2. Classify the task as a feasibility spike, bounded change, or architectural change.
3. Establish shared understanding of the goal, constraints, and success criteria.
4. Compare viable approaches and obtain design approval before implementation.
5. For architectural work, record the approved design and prepare an implementation plan.
6. Implement in reviewable increments using tests where executable behavior is involved.
7. Run fresh verification against the requirements.
8. Review the complete diff and report decisions, limitations, and follow-up work.

## Project-specific application

- Treat the accepted ADRs as binding unless a new decision supersedes them.
- Treat Grafana package behavior as research until exact-version evidence is recorded.
- Use proof-of-concept work to retire architecture risks before designing a broad API.
- Do not use code-oriented test rituals for prose-only changes; validate structure, links, formatting, terminology, and diff scope instead.
- Do not create source code or package metadata during the documentation-only phase.
- Never commit, push, publish, merge, or create remote resources unless the current request explicitly authorizes that action.

## Documentation gates

Before a documentation change is complete, verify:

- all requested files exist;
- relative links resolve;
- constraints are stated consistently;
- facts and hypotheses are distinguishable;
- no placeholder remains except one explicitly requested;
- no unrelated file changed; and
- the full diff has been reviewed.

## Handoff

The final response should lead with the outcome, list verification performed, summarize files by purpose, disclose any unresolved decisions, and state clearly that changes remain uncommitted when applicable.
