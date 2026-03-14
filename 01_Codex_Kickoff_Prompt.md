# Codex Kickoff Prompt

I want you to help me evolve the existing `moeru-ai/airi` project into a more scalable self-hosted personal AI companion system, but **start with planning and repository analysis only**.

## Operating mode

- Work in a **new feature branch** so the main branch stays easy to sync with upstream `moeru-ai/airi`.
- Favor **open-source** libraries, services, and tools only. If a requirement would push toward closed-source software, call it out and propose the best open-source alternative.
- Preserve compatibility with the current AIRI desktop app where practical.
- Avoid broad unrelated refactors.
- Do **not** start implementing immediately. Plan first.

## Current environment

- AIRI app is already running.
- Model backend currently uses Ollama.
- TTS currently uses `chatterbox-tts-api` with OpenAI-compatible API behavior.
- Available server hardware:
  - Ryzen 5 3600
  - 16 GB RAM
  - 2x Tesla P100
  - 240 GB SSD
- The model may change later, so avoid hard-coding assumptions to one model.

## Product goal

I want AIRI to evolve from a mostly self-contained desktop app into a system with a **central backend server** that handles most non-visual logic, while AIRI acts more like a client.

## Core architectural direction

Design a separate backend service that can be deployed on my LLM server PC and is responsible for:

1. Memory and chat/session history
2. API integrations and permissions
3. Cross-device data synchronization
4. Messaging integrations such as Telegram and Signal
5. Reminder scheduling and proactive outbound messaging
6. Service health/status management for the local AI stack

## Constraints

- The backend should be a **separate application** from AIRI.
- The backend should expose a clean interface/API so multiple AIRI clients or companion endpoints could use it.
- The system should be modular and extensible.
- Sensitive integrations should support **permission scoping**, such as read-only access for Canvas-like school integrations.
- Design for self-hosting first.
- Prefer simple, reliable infrastructure over over-engineering.

## Priority order

### Phase 1 — foundation
- Backend server skeleton
- Client auth/session model
- Persistent chat history
- Memory abstraction with pluggable storage/retrieval
- Basic admin or web UI for service health and integration settings

### Phase 2 — useful integrations
- API integration framework
- Permission system for integrations
- Reminder/scheduler system
- Jellyfin awareness or similar media-aware feature

### Phase 3 — messaging
- Telegram and/or Signal integration
- Ability for AIRI to send and receive messages through external platforms
- Optional voice-message generation through current TTS pipeline

### Phase 4 — advanced/experimental
- Desktop screenshot ingestion and reaction logic
- Raspberry Pi speaker/presence endpoints
- Home Assistant integration

## Behavior expectations

- Memory should support compacting prior conversations into retrievable long-term memory.
- Session management should help determine when to start a fresh context window while preserving relevant prior memory.
- Messaging/reminders should support proactive outbound messages, including school reminders and lightweight personal check-ins.
- Vision/screenshot features should be event-driven or relevance-gated so AIRI does not react to every screenshot.
- Service management should include health checks and start/stop/restart capability for key services like Ollama and chatterbox.

## What I want from you right now

1. Inspect the repository structure and identify where a backend service can be introduced with the least disruption.
2. Produce a **milestone-based implementation plan**.
3. Propose a concrete architecture, including:
   - backend tech stack
   - data storage choices
   - memory subsystem design
   - client/server boundaries
   - integration/plugin model
   - messaging architecture
   - service-management approach
4. Identify the **highest-risk technical decisions** and alternatives.
5. Clearly separate:
   - must-have for MVP
   - should-have next
   - experimental/later
6. List any assumptions you are making.

## Required output format

Return the result in this exact order:

1. **Repository observations**
2. **Architecture summary**
3. **MVP scope**
4. **Milestone plan**
5. **Proposed file/folder layout**
6. **Key risks and tradeoffs**
7. **Acceptance criteria by milestone**
8. **Open questions / assumptions**

## Definition of done for this planning task

This planning task is complete only when you have produced:

- a scoped MVP
- a phased roadmap
- concrete architectural recommendations
- implementation milestones with validation criteria
- notes on how to keep the AIRI fork maintainable and easy to sync with upstream

## Extra instructions

- Prefer to add new functionality in isolated directories rather than deeply modifying upstream AIRI internals too early.
- When suggesting dependencies, explain why each is needed.
- If the repo already contains partial infrastructure for any of these features, reuse it instead of duplicating it.
- Call out any places where my hardware or current stack may limit the design.
