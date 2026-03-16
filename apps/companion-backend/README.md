# @proj-airi/companion-backend

## What this app does

`@proj-airi/companion-backend` is the fork-specific backend foundation for AIRI's client/server split.

M1 provided:

- health endpoints for service monitoring
- initial device-token authentication for trusted local clients
- session issuance endpoint for AIRI clients

M2 adds:

- persistent session and message history stored on disk
- memory abstraction with summary compaction (local JSON or mem0 provider)
- deterministic session rollover when message threshold is reached

M4 adds:

- reminder scheduling endpoint with disk persistence
- due reminder processing endpoint for proactive delivery into chat sessions
- observable reminder delivery attempt logs with retry metadata
- Jellyfin media awareness polling with configurable interval/chance, user filtering, and same-media suppression

M5 adds:

- Telegram inbound polling path that persists messages into a configured chat session
- Telegram outbound send path for spontaneous/proactive assistant delivery
- optional Telegram voice attachment send path when enabled

## How to use it

1. Copy `.env.example` to `.env` and set `DEVICE_TOKENS`.
2. Run development server (scripts auto-load `.env` and optional `.env.local`):

```bash
pnpm -F @proj-airi/companion-backend dev
```

3. Verify health:

```bash
curl http://localhost:3100/health
```

4. Create session using a device token:

```bash
curl -X POST http://localhost:3100/api/session/create \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"desktop-main","clientType":"desktop"}'
```

5. Add chat message to a session:

```bash
curl -X POST http://localhost:3100/api/chats/<SESSION_ID>/messages \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"role":"user","content":"Remember that I prefer short reminders."}'
```

6. Inspect session history and recent memories:

```bash
curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/chats/<SESSION_ID>
curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/memory/recent

curl -X POST http://localhost:3100/api/memory/search \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"query":"work","sessionId":"<SESSION_ID>","limit":3}'

curl -X POST http://localhost:3100/api/memory/remember \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<SESSION_ID>","role":"user","content":"My favorite color is red"}'
```

### Optional mem0 memory provider

Set `MEMORY_PROVIDER=mem0` and configure `MEM0_BASE_URL` + `MEM0_API_KEY` (optionally `MEM0_ORG_ID` and `MEM0_PROJECT_ID`) to use mem0-backed compaction/retrieval instead of local JSON memory.

If your mem0 deployment rejects auth with 401, set `MEM0_AUTH_SCHEME` to one of: `bearer`, `token`, or `api-key`.

7. List available integrations and invoke the sample read-only integration:

```bash
curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/integrations
curl -X POST -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/integrations/system-info/invoke
```


8. Schedule a reminder and process due reminders:

```bash
curl -X POST http://localhost:3100/api/reminders \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<SESSION_ID>","message":"Take a short break","dueAt":"2026-01-01T00:00:00.000Z"}'

curl -X POST http://localhost:3100/api/reminders/process-due \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"limit":20}'

curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/reminders/deliveries/recent
```


9. Trigger Jellyfin awareness manually (useful for testing poll logic without waiting for timer):

```bash
curl -X POST http://localhost:3100/api/jellyfin-awareness/tick \
  -H 'Authorization: Bearer desktop-dev-token'
```

When configured, the runner also ticks automatically every `JELLYFIN_AWARENESS_INTERVAL_SECONDS`.


10. Test Telegram integration routes (manual poll + outbound send):

Requires token scopes: `telegram:read`, `telegram:poll`, `telegram:send`, `telegram:retry`, and `telegram:send:voice` (voice path only).

```bash
curl -X POST http://localhost:3100/api/telegram/poll \
  -H 'Authorization: Bearer desktop-dev-token'

curl -X POST http://localhost:3100/api/telegram/send \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from companion backend"}'

curl -X POST http://localhost:3100/api/telegram/retry-failed \
  -H 'Authorization: Bearer desktop-dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"limit":20}'

curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/telegram/deliveries/recent
curl -H 'Authorization: Bearer desktop-dev-token' http://localhost:3100/api/telegram/state
```

## When to use it

- when running AIRI clients against a self-hosted central backend
- when validating M1-M5 backend foundation milestones
- when testing auth/session, persistence, memory, integration permissions, reminder delivery flow, and Telegram channel delivery flow

## When not to use it

- not for production-grade auth/account management yet
- not as a fully featured external messaging backend (Telegram and channel adapters are later milestones)

## Client integration planning

- For concrete desktop/web wiring points and rollout phases, see `CLIENT-INTEGRATION-POINTS.md`.
