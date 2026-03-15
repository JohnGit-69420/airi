# @proj-airi/companion-backend

## What this app does

`@proj-airi/companion-backend` is the fork-specific backend foundation for AIRI's client/server split. It provides:

- health endpoints for service monitoring
- initial device-token authentication for trusted local clients
- session issuance endpoint for AIRI clients

This app is intentionally small and additive for M1, so later milestones can layer persistence, memory, integrations, reminders, and Telegram messaging without invasive rewrites.

## How to use it

1. Copy `.env.example` to `.env` and set `DEVICE_TOKENS`.
2. Run development server:

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

## When to use it

- when running AIRI clients against a self-hosted central backend
- when validating the M1 backend foundation milestone
- when testing auth/session boundaries before persistence is added

## When not to use it

- not for production-grade auth/account management yet
- not as a fully featured integration/reminder/messaging backend (those are later milestones)
