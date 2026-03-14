# PLANS.md

## Project

AIRI backend/server expansion for self-hosted personal companion features.

## Problem statement

The current AIRI setup works as a desktop application, but too much logic is tied to the local app runtime. The goal is to introduce a separate backend service that manages memory, integrations, reminders, external messaging, and service health while preserving compatibility with the existing AIRI experience.

## Success criteria

The project is succeeding when:

- AIRI can operate as a client of a separate backend service
- chat history and memory persist outside the desktop app
- integrations and reminders are managed centrally
- architecture remains maintainable in an upstream-friendly fork
- experimental features stay isolated from the MVP path

## Scope buckets

### MVP
- Backend service skeleton
- API boundary between AIRI and backend
- Persistent sessions/chat history
- Memory abstraction and first implementation
- Basic integration registry
- Basic admin/service-health UI or admin endpoints

### Next
- Reminder scheduler
- Permissions model for sensitive integrations
- Jellyfin or similar media-awareness integration
- Telegram integration
- Optional TTS voice-message pipeline for outbound messages

### Later / experimental
- Signal integration
- Screenshot-based context reactions
- Raspberry Pi speaker/presence endpoint
- Home Assistant integration

## Milestones

### M0 — repo discovery and design
**Goal**
Understand AIRI’s current structure and identify the lowest-risk insertion points for a separate backend.

**Deliverables**
- repository map
- current runtime/data-flow summary
- recommended integration boundary
- proposed tech stack

**Acceptance criteria**
- clear recommendation for where backend code should live
- documented assumptions about current AIRI architecture
- explicit MVP vs experimental split

### M1 — backend foundation
**Goal**
Create the standalone backend service skeleton and client-facing interface.

**Deliverables**
- backend app scaffold
- config/environment model
- health endpoint(s)
- client auth/session approach
- dev-run instructions

**Acceptance criteria**
- backend starts locally
- health check works
- configuration is documented
- AIRI-to-backend interaction path is defined

### M2 — persistence and memory
**Goal**
Move sessions/chat history and memory concerns into the backend.

**Deliverables**
- persistent conversation/session storage
- memory abstraction
- first memory retrieval/compaction implementation
- retention/session-rotation rules

**Acceptance criteria**
- sessions survive restart
- prior conversation facts can be retrieved through the backend
- session rollover behavior is documented and testable

### M3 — integrations core
**Goal**
Introduce a safe integration framework for external APIs.

**Deliverables**
- integration registry/plugin pattern
- permission-scoped integration model
- first example integration
- admin surface for integration settings

**Acceptance criteria**
- at least one integration works end-to-end
- permissions are enforceable by design
- integration boundaries are documented

### M4 — reminders and outbound messaging
**Goal**
Enable proactive reminders and controlled outbound notifications.

**Deliverables**
- scheduler/reminder subsystem
- trigger model
- message templates or dispatch abstraction
- optional TTS handoff path

**Acceptance criteria**
- reminders can be scheduled and delivered
- proactive message rules are configurable
- system behavior is logged/inspectable

### M5 — external clients and advanced endpoints
**Goal**
Support messaging platforms and future endpoint types without destabilizing the core stack.

**Deliverables**
- Telegram and/or Signal adapter
- endpoint abstraction for future hardware nodes
- feature flags for experimental modules

**Acceptance criteria**
- at least one external endpoint works reliably
- advanced features can be disabled cleanly
- experimental logic is isolated from core MVP services

## Risks and tradeoffs

- Tight coupling to AIRI internals could make upstream sync painful.
- Over-designing memory before real usage may waste time.
- Signal support may be harder to maintain than Telegram depending on library maturity.
- Screenshot-driven reactions risk noise, privacy issues, and unnecessary compute.
- Service control features need careful security boundaries.
- Hardware endpoint ideas are valuable, but should not distort MVP architecture.

## Decision log template

### Decision
- **Date:**
- **Topic:**
- **Chosen option:**
- **Alternatives considered:**
- **Reasoning:**
- **Impact on roadmap:**

## Validation checklist for Codex

Before closing any milestone, verify:

- scope stayed inside the current milestone
- tests/checks relevant to the touched code were run
- docs or planning files were updated if architecture changed
- assumptions and follow-ups were recorded
- upstream-friendliness was preserved
