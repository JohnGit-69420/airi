# IMPLEMENT.md

## How to execute work in this repository

Follow this loop for any non-trivial task:

1. Read `AGENTS.md` and `PLANS.md`.
2. Identify the active milestone.
3. Restate the exact scoped objective.
4. Inspect the relevant code paths before editing.
5. Propose the smallest viable implementation.
6. Implement in isolated, reviewable steps.
7. Run relevant checks.
8. Summarize results, assumptions, and follow-ups.

## Execution rules

- Stay inside the current milestone unless explicitly told to expand scope.
- Prefer additive changes in new directories/modules over deep rewrites.
- When uncertain, choose the lower-risk path that preserves upstream compatibility.
- Put experimental integrations behind flags or separate adapters.
- Treat security-sensitive features such as service control and outbound messaging as opt-in.

## Required output after implementation work

For each completed task, report:

- what changed
- which files were touched
- what checks were run
- what remains incomplete
- any assumptions or risks

## Escalate before proceeding when

- a change requires a major repo restructure
- a new production dependency is necessary
- AIRI core behavior must be changed in a way that may complicate upstream sync
- the task appears to blend MVP and experimental features together
