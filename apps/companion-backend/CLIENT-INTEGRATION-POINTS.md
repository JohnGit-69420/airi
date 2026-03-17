# Client-side integration points for `@proj-airi/companion-backend`

This document maps where AIRI clients should integrate with companion-backend APIs without tightly coupling UI code to endpoint details.

## Integration goals

- keep AIRI clients (`stage-web`, `stage-tamagotchi`) focused on UX/orchestration
- keep persistence, reminders, integrations, and external messaging in companion-backend
- make client migration incremental and reversible by introducing thin adapters first

## Current client surfaces to plug into

### 1) Shared stage API/composable layer (`packages/stage-ui`)

Primary existing entrypoint for HTTP requests:

- `packages/stage-ui/src/composables/api.ts`

Auth/session base URL utility currently used by the UI stack:

- `packages/stage-ui/src/libs/auth.ts`

**Integration point:**

- introduce a companion-backend API client wrapper in `packages/stage-ui/src/composables/` (or a dedicated package later)
- keep route paths and auth headers out of view/store components

### 2) Chat orchestration and session state (`packages/stage-ui`)

Primary send/stream orchestration:

- `packages/stage-ui/src/stores/chat.ts`
- `packages/stage-ui/src/stores/chat/session-store.ts`
- `packages/stage-ui/src/stores/chat/data-store.ts`

**Integration point:**

- on session bootstrap, obtain companion session (`POST /api/session/create`)
- mirror user/assistant turns to companion chat history (`POST /api/chats/:sessionId/messages`)
- pull history when switching/recovering sessions (`GET /api/chats/:sessionId`)

### 3) Desktop-specific runtime bridge (`apps/stage-tamagotchi`)

Desktop has an IPC/Eventa bridge and local settings store patterns:

- `apps/stage-tamagotchi/src/shared/eventa.ts`
- `apps/stage-tamagotchi/src/renderer/stores/settings/server-channel.ts`

**Integration point:**

- add companion-backend base URL + device token settings (desktop-only secure storage path)
- expose typed renderer-safe RPC helpers for companion requests if direct renderer fetch is not desired

### 4) Web-specific runtime setup (`apps/stage-web`)

Web currently relies on stage-ui stores/composables and app-level env values.

**Integration point:**

- add web env values for companion backend URL and optional demo token
- keep all companion request logic in shared stage-ui composables/stores to avoid divergence from desktop

## API-to-client integration map

## Auth/session bootstrap

Companion endpoints:

- `POST /api/session/create`

Client wiring:

- create `useCompanionSession()` composable
- inputs: `clientId`, `clientType`
- output: companion `sessionId` cached in chat/session store metadata

## Chat persistence bridge

Companion endpoints:

- `POST /api/chats/:sessionId/messages`
- `GET /api/chats/:sessionId`

Client wiring:

- hook after local message append in chat orchestration pipeline
- background sync queue for transient failures (do not block token streaming UX)
- on startup/session restore, reconcile local transcript with server transcript

## Memory visibility (read-first)

Companion endpoints:

- `GET /api/memory/recent`

Client wiring:

- optional devtools/settings panel section first
- later feed memory highlights into chat context modules as non-blocking context providers

## Reminders

Companion endpoints:

- `POST /api/reminders`
- `POST /api/reminders/process-due`
- `GET /api/reminders/deliveries/recent`

Client wiring:

- create reminder actions in tool/module layer (not directly in view components)
- trigger `process-due` from backend runner/admin workflows, not from high-frequency UI loops
- show reminder delivery status in diagnostics/devtools before end-user UI

## Integrations registry/actions

Companion endpoints:

- `GET /api/integrations`
- `POST /api/integrations/:id/invoke`

Client wiring:

- map to existing modules/tools discovery surface
- add scope-aware UX affordances (disabled states + reason text) based on 403 responses

## Telegram operational controls (admin/devtools)

Companion endpoints:

- `POST /api/telegram/poll`
- `POST /api/telegram/send`
- `POST /api/telegram/retry-failed`
- `GET /api/telegram/state`
- `GET /api/telegram/deliveries/recent`

Client wiring:

- keep in admin/devtools pages first
- avoid exposing raw Telegram operations in normal chat UI until permission model and UX copy are finalized

## Jellyfin awareness controls (admin/devtools)

Companion endpoints:

- `POST /api/jellyfin-awareness/tick`

Client wiring:

- devtools button for manual tick + result visualization
- no always-on polling from client; rely on backend runner interval

## Recommended implementation shape

### Phase A (safe foundation)

1. add `companion-api.ts` wrapper (typed request helpers + auth header handling)
2. add feature flag/settings guard for companion integration
3. add session bootstrap + chat write-through only

Acceptance criteria:

- companion can receive new chat turns from at least one client (desktop or web)
- UI remains functional when companion is unavailable

### Phase B (observability + tooling)

1. add devtools pages/sections for memory/reminders/integrations/telegram state
2. add explicit error surfaces for scope/auth failures

Acceptance criteria:

- developers can verify end-to-end companion flows without curl

### Phase C (behavioral adoption)

1. integrate reminder creation flows into tool/module UX
2. integrate memory read models into context pipeline
3. gate external messaging controls behind explicit permissions

Acceptance criteria:

- companion features are accessible from client UX with clear permission boundaries

## Client ownership boundaries

Client should own:

- rendering and local interaction latency
- optimistic UI behavior and temporary local buffering
- endpoint-agnostic view model composition

Companion backend should own:

- durable persistence and retrieval
- scheduling/retry loops
- external integration invocation and audits
- external messaging delivery state

## Risk checklist before wiring

- do not hard-code tokens in renderer/browser bundles
- do not let chat streaming path hard-fail on companion write failures
- do not duplicate endpoint contracts across web and desktop; share wrappers
- keep all new integrations behind explicit config/scope gates
