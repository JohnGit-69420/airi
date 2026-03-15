# Companion Backend mem0 Spike Plan

## Goal
Validate a minimal, reversible mem0 integration behind a provider contract without changing public API routes.

## Scope
- Keep existing `chat` and `memory` routes unchanged.
- Keep local JSON memory as default provider.
- Add mem0 as optional adapter behind environment flags.

## Proposed adapter contract
Use `src/modules/memory/provider-contract.ts` as the stable memory boundary.

Required methods:
- `compactSessionToMemory({ sessionId, messages })`
- `getRecentMemories({ limit })`

## Minimal spike milestones

### S1 — contract wiring (no behavioral change)
- Update chat runtime to depend on `MemoryProviderContract` instead of direct local store methods.
- Keep current local store via `createLocalMemoryProviderAdapter`.
- Acceptance: existing M2 curl smoke tests still pass.

### S2 — mem0 adapter prototype (feature-flagged)
- Add `MEMORY_PROVIDER=local|mem0` env switch.
- Add mem0 adapter module implementing `MemoryProviderContract`.
- Map mem0 output into current `MemoryEntry` shape (`id`, `sourceSessionId`, `summary`, `createdAt`).
- Acceptance: with `MEMORY_PROVIDER=mem0`, compaction and retrieval run without route changes.

### S3 — evaluation pass
- Run side-by-side sample sessions for `local` vs `mem0`.
- Compare:
  - summary quality
  - retrieval relevance
  - latency
  - operational complexity
- Capture decision log in `PLANS.md` (keep/defer/replace).

## Risk controls
- Keep mem0 optional and off by default.
- Do not migrate existing persistence formats in spike scope.
- Avoid coupling auth/session logic to memory provider implementation.

## Rollback plan
- Set `MEMORY_PROVIDER=local`.
- Remove mem0 adapter module if spike is rejected.
- No API contract changes required for rollback.

## Exit criteria for accepting mem0
- Better retrieval quality than local summaries in test transcripts.
- Acceptable latency for session rollover workflow.
- Clear operational story for self-hosted deployment.
- No regressions in existing M2 routes.
