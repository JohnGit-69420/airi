# @proj-airi/companion-backend

## What this app does

`@proj-airi/companion-backend` is the fork-specific backend foundation for AIRI's client/server split.

M1 provided:

- health endpoints for service monitoring
- initial device-token authentication for trusted local clients
- session issuance endpoint for AIRI clients

M2 adds:

- persistent session and message history stored on disk
- memory abstraction with summary compaction
- deterministic session rollover when message threshold is reached

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
```

## When to use it

- when running AIRI clients against a self-hosted central backend
- when validating M1/M2 backend foundation milestones
- when testing auth/session, persistence, and memory boundaries before integrations are added

## When not to use it

- not for production-grade auth/account management yet
- not as a fully featured integration/reminder/messaging backend (those are later milestones)
