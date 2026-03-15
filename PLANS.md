# PLANS.md

## Branch planning objective
Define an upstream-friendly, phased architecture for evolving AIRI into a client + self-hosted backend system, without sweeping refactors before architecture approval.

## 1) Instruction/document sources followed
- Root `AGENTS.md` (project-wide architecture guardrails, planning format, scope buckets, milestone discipline).
- `PLANS.md` (this file as the authoritative milestone/scope/risk tracker for this branch).
- `IMPLEMENT.md` (execution-loop and scope-control rules used after plan approval).
- Repository structure and current server/runtime packages inspected in `apps/server`, `packages/server-sdk`, and `packages/server-runtime`.

## 2) Repository constraints and inferred conventions
- Keep this fork upstream-friendly: additive, isolated changes preferred over invasive rewrites.
- Keep backend as a separate app/service from AIRI clients.
- Reuse existing stack patterns where possible: TypeScript, Hono, Drizzle, Valibot, Injeca, Eventa.
- Keep config env-driven and centralized.
- Avoid model-vendor lock-in (Ollama is current default, not protocol contract).
- Keep experimental features gated and outside MVP execution paths.
- Maintain compatibility with existing desktop behavior while shifting non-visual logic server-side.

## 3) Architecture summary (proposed)
- Deploy a dedicated backend service (new app namespace, reusing current `apps/server` patterns).
- Keep AIRI desktop/web clients as thin orchestration + UX layers.
- Expose two backend interfaces:
  - REST/JSON API for CRUD/admin/integration configuration.
  - Event stream channel (WebSocket/Eventa-compatible patterns) for push notifications, reminders, and outbound messaging state.
- Use explicit module boundaries in backend:
  - `auth` / client sessions
  - `chat-history`
  - `memory`
  - `integrations`
  - `scheduler`
  - `messaging`
  - `service-control`
  - `health/telemetry`
- Keep adapters behind interfaces so local model/TTS/service providers can be swapped.

### Backend tech stack recommendation
- Runtime: Node.js + TypeScript.
- HTTP: Hono (already used in repo).
- DI/composition: Injeca.
- Validation: Valibot.
- Persistence: PostgreSQL + Drizzle ORM for durable data.
- Queue/scheduling (phase 2+): start with Postgres-backed job tables + worker loop; optionally add Redis later if throughput requires it.
- Optional vector retrieval path:
  - MVP: structured memory summaries in Postgres (no mandatory vector DB).
  - Next: pgvector (or existing repo memory package) behind memory-retrieval interface.

### Data/storage recommendation
- PostgreSQL as source of truth for:
  - users/clients/sessions
  - conversation sessions/messages
  - memory entries + summary snapshots
  - integrations + granted scopes
  - reminders/jobs/outbound deliveries
  - service status + command audit logs
- Object/file storage (optional later) for larger artifacts (voice attachments, screenshots), referenced by DB records.

### Memory subsystem recommendation
- `MemoryStore` interface with pluggable providers:
  - `appendEvent`
  - `summarizeSession`
  - `retrieveRelevantMemories`
  - `compactSessionWindow`
- Two-layer memory model:
  - Episodic: raw message history tied to session.
  - Semantic/profile: compacted facts/preferences/summaries with confidence + recency metadata.
- Session rollover policy:
  - token/time/turn thresholds trigger compaction.
  - new session starts with injected retrieved summary pack.

### Client/server boundary recommendation
- Keep in AIRI client:
  - rendering, local UX state, immediate interaction controls, local device affordances.
- Move to backend:
  - persistent history/memory, integration execution, reminders, outbound message policy, service health orchestration.
- Introduce a client API layer package shared by desktop/web to avoid direct endpoint scattering.

### Integration/plugin model recommendation
- Integration manifest-driven registry:
  - id, capabilities, required scopes, config schema, runtime status.
- Permission model:
  - per-client + per-integration scoped grants (`read`, `write`, `send`, `admin`).
- Invocation pipeline:
  - policy check -> adapter execution -> normalized result -> audit log.

### Messaging architecture recommendation
- Unified outbound/inbound message bus abstraction:
  - Telegram adapter as the only planned mobile channel for this roadmap.
- Normalize message schema internally (text, media, voice refs, metadata).
- Optional TTS path:
  - dispatch message -> optional voice render request -> attach generated media -> adapter send.

### Service-management approach recommendation
- Backend-managed service catalog for self-hosted stack entries (Ollama, chatterbox-tts-api, future engines).
- Health monitor loop + explicit command endpoints (`start/stop/restart`) with role checks and audit trail.
- Default security posture: local network + authenticated admin scope only.

## 4) Proposed folder/file layout

```txt
apps/
  companion-backend/                     # new backend app (separate from AIRI clients)
    src/
      app.ts
      libs/
        env.ts
        db.ts
        auth.ts
      modules/
        auth/
        sessions/
        chat-history/
        memory/
          stores/
          compaction/
          retrieval/
        integrations/
          registry/
          permissions/
          adapters/
        scheduler/
        messaging/
          adapters/
            telegram/
        service-control/
        health/
      routes/
        api/
        admin/
      workers/
        reminders.worker.ts
        health.worker.ts
      schemas/
      types/

packages/
  companion-api-client/                  # optional shared client boundary package
    src/
      index.ts
      http/
      realtime/
      schemas/
```

Notes:
- Keep existing `apps/server` intact while evaluating whether it should be evolved into `apps/companion-backend` or kept separately for compatibility.
- Avoid moving legacy files until architecture is approved.


## Milestone status
- Current active milestone: **M1 — backend foundation**.
- M1 implementation focus: standalone companion backend scaffold, device-token auth bootstrap, and health/session endpoints.

## 5) MVP scope (must-have)
- Separate backend service skeleton with documented env/config.
- Client auth/session model suitable for multiple AIRI clients.
- Persistent chat/session history.
- Memory abstraction + first compaction/retrieval implementation.
- Basic integration registry with one safe sample integration.
- Admin/service-health surface (endpoints first; UI optional in MVP).

## 6) Milestone roadmap
- **M0 Design lock**: confirm architecture, boundaries, data model, and migration strategy.
- **M1 Backend foundation**: runnable backend skeleton, auth/session baseline, health endpoints.
- **M2 Persistence + memory**: durable chats/sessions, memory compaction + retrieval, session rollover.
- **M3 Integrations + permissions**: registry, scoped grants, one integration path (e.g., Jellyfin read-only awareness).
- **M4 Reminders + proactive delivery**: scheduler/reminder engine + outbound policy.
- **M5 Messaging channels**: Telegram adapter + optional TTS voice-message flow (Telegram-only mobile path).
- **M6 Experimental extensions**: screenshot relevance-gated reactions, Pi nodes, Home Assistant.

## 7) Acceptance criteria per milestone

### M0
- Approved architecture document and boundaries.
- MVP/next/experimental split agreed.
- Fork-maintainability strategy documented (minimal core rewrites).

### M1
- Backend boots with env config and health check.
- Client authentication and session issuance works for at least one AIRI client.
- API contract documented and versioned.

### M2
- Conversation/session data survives restart.
- Session rollover rules execute deterministically.
- Memory retrieval returns relevant compacted records for new sessions.

### M3
- Integration registry loads at least one adapter.
- Permission scopes enforced at invocation time.
- Integration actions are auditable.

### M4
- Reminders can be created, persisted, triggered, and delivered.
- Proactive message rules are configurable and observable.
- Failure/retry behavior is logged.

### M5
- Telegram send/receive path works end-to-end.
- Optional TTS attachment path works when enabled.
- Experimental adapters can be disabled without affecting core backend.

### M6
- Experimental modules are feature-flagged and isolated.
- Event-driven gating prevents noisy always-on screenshot reactions.

## 8) Highest-risk decisions and alternatives
- **Decision: whether to evolve `apps/server` vs create `apps/companion-backend`.**
  - Alt A: evolve `apps/server` in place (faster, less duplication).
  - Alt B: new app, keep old server stable (cleaner boundary, easier rollback).
- **Decision: memory retrieval strategy.**
  - Alt A: summary-first Postgres-only MVP (simpler).
  - Alt B: early vector retrieval (better recall, more ops complexity).
- **Decision: scheduler architecture.**
  - Alt A: DB-backed worker loop (simple self-host).
  - Alt B: Redis/queue system (scale-ready but more moving parts).
- **Decision: messaging platform scope.**
  - Chosen: Telegram-only mobile communications for now (simpler operations and maintenance).
  - Alternative (deferred): add Signal later only if requirements change.
- **Decision: service control depth.**
  - Alt A: health checks + command wrappers only.
  - Alt B: full process supervision/orchestration (more power, more security risk).

## 9) Assumptions
- PostgreSQL is acceptable for always-on self-hosted persistence.
- Existing AIRI clients can incrementally adopt backend APIs without full rewrite.
- Ollama and chatterbox remain default providers in early phases, but interfaces remain provider-agnostic.
- Initial deployment target is a trusted LAN/self-hosted environment.
- Admin endpoints are acceptable before building a full admin GUI.
- Mobile communications are Telegram-only for the current roadmap unless requirements change.

## 10) Open questions / tradeoffs
Resolved for this branch plan:
- Backend boundary: use a fork-specific backend app (`apps/companion-backend`) rather than expanding `apps/server` directly.
- Auth UX: device-token-first for trusted local clients; evaluate OAuth/account flows later.
- Vector retrieval: defer pgvector to phase 2 after MVP memory baseline is stable.
- Reminder reliability: design for at-least-once delivery with idempotency semantics from the start.
- Service control safety: require explicit per-service allowlists/sandboxing in MVP.
- Admin surface order: API-first, then minimal web admin, then optional AIRI settings integration.

Remaining tradeoffs to revisit after M1:
- When to promote from device-token auth to fuller account/OAuth flows.
- Whether reminder throughput requires queue infrastructure beyond DB-backed workers.
- Whether admin web UI should remain separate from AIRI client settings long-term.

## Maintainability notes for upstream sync
- Keep fork-specific backend additions additive and isolated to a dedicated app/package area.
- Avoid changing core AIRI runtime behavior until backend contracts stabilize.
- Use compatibility adapters at boundaries instead of rewriting upstream modules.
- Land changes milestone-by-milestone with narrow, reviewable commits.
