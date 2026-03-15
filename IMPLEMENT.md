# IMPLEMENT.md

## Branch execution mode
This branch is currently in **architecture-first execution**. Implement only after the plan in `PLANS.md` is approved.

## Planning-first loop (mandatory)
1. Read `AGENTS.md`, `PLANS.md`, and this file.
2. Identify the active milestone and confirm scope boundaries.
3. Restate objective, assumptions, and non-goals.
4. Inspect only relevant code paths (avoid unrelated edits).
5. Propose minimal additive changes that preserve upstream syncability.
6. Implement in small reviewable commits after approval.
7. Run relevant checks (`typecheck`, `lint:fix`, milestone-specific tests).
8. Report outputs, risks, and follow-ups.

## Milestone guardrails
- Stay inside one milestone unless explicitly expanded.
- Keep backend as a separate service/application boundary.
- Prioritize self-hostable, open-source, low-ops components first.
- Preserve existing AIRI desktop compatibility where practical.
- Gate experimental modules (screenshot reactions, hardware nodes) behind flags/adapters.

## Implementation priorities by phase
- **MVP (must-have):** backend skeleton, auth/session baseline, persistent chat history, memory abstraction, basic integration registry, service health/admin endpoints.
- **Should-have next:** scheduler/reminders, scoped integration permissions, Jellyfin awareness, Telegram adapter, optional TTS outbound voice.
- **Experimental/later:** screenshot ingestion/relevance gating, Raspberry Pi nodes, Home Assistant.

## Dependency and refactor policy
- Avoid introducing new production dependencies unless tradeoffs are documented.
- Prefer existing repo patterns/libs (Hono, Drizzle, Valibot, Injeca, Eventa).
- Avoid sweeping refactors before architecture lock.
- If a core behavior must change, document migration path and compatibility strategy first.

## Required report after each implementation task
- scoped objective completed
- files changed
- checks run and outcomes
- assumptions made
- risks/follow-ups
- whether scope remained within active milestone

## Escalate before proceeding when
- proposed changes require major repository reshaping
- security model for outbound messaging/service-control is unclear
- new infra dependency is required for MVP
- task mixes MVP and experimental scope without explicit approval
