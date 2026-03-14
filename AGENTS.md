# Project AIRI Agent Guide

Concise but detailed reference for contributors working across the `moeru-ai/airi` monorepo. Improve code when you touch it; avoid one-off patterns.

## Branch / Fork / Planning Expectations

- Treat this repository as an **upstream-friendly fork** of `moeru-ai/airi`.
- Prefer additive, isolated changes over invasive rewrites.
- Keep the main branch easy to sync with upstream.
- Do work on feature branches unless explicitly told otherwise.
- For large or ambiguous tasks, **plan before implementing**.
- Break work into milestones with acceptance criteria.
- Distinguish clearly between:
  - MVP / must-have
  - next-step improvements
  - experimental or later ideas
- Before major edits, explain the intended approach briefly.
- Use `PLANS.md` for milestone plans, scope, risks, and acceptance criteria.
- Update planning docs when the architecture changes materially.

## Project Direction for This Fork

This fork is being extended from a desktop AI companion app into a self-hosted multi-component system with:

- AIRI as the client-facing desktop application
- a separate backend service for memory, integrations, messaging, reminders, and service orchestration
- future support for mobile/messaging endpoints and special hardware nodes

### Architecture guardrails for fork-specific work

- Keep the backend as a **separate application/service** from AIRI.
- Favor modular boundaries and stable interfaces between AIRI and the backend.
- Prefer self-hosted, open-source components.
- Avoid hard-coding model-specific assumptions; Ollama is current, not permanent.
- Put experimental features behind flags or separate modules.
- Reuse existing repo patterns when they are compatible with the new architecture.
- Prefer small, reviewable commits and narrowly scoped diffs.
- Do not introduce new production dependencies without explaining the tradeoff.
- Document new subsystems and public interfaces.
- Keep configuration centralized and environment-driven.

### Do-not rules for this fork

- Do not rewrite unrelated upstream AIRI features just to make the architecture feel cleaner.
- Do not merge experimental hardware logic into the MVP path.
- Do not implement broad automation or external platform messaging without a clear permission model.
- Do not silently add closed-source services when open-source alternatives exist.

### Priority order for fork-specific work

1. Backend foundation
2. Memory and persistent state
3. Integration framework and permissions
4. Reminders and proactive messaging
5. External messaging platforms
6. Advanced vision and hardware integrations

## Tech Stack (by surface)

- **Desktop (stage-tamagotchi)**: Electron, Vue, Vite, TypeScript, Pinia, VueUse, Eventa (IPC/RPC), UnoCSS, Vitest, ESLint.
- **Web (stage-web)**: Vue 3 + Vue Router, Vite, TypeScript, Pinia, VueUse, UnoCSS, Vitest, ESLint. Backend: WIP.
- **Mobile (stage-pocket)**: Vue 3 + Vue Router, Vite, TypeScript, Pinia, VueUse, UnoCSS, Vitest, ESLint, Kotlin, Swift, Capacitor.
- **UI/Shared Packages**:
  - `packages/stage-ui`: Core business components, composables, stores shared by stage-web & stage-tamagotchi (heart of stage work).
  - `packages/stage-ui-three`: Three.js bindings + Vue components.
  - `packages/stage-ui-pixi`: Planned Pixi bindings.
  - `packages/stage-shared`: Shared logic across stage-ui, stage-ui-three, stage-web, stage-tamagotchi.
  - `packages/ui`: Standardized primitives (inputs, textarea, buttons, layout) built on reka-ui; minimal business logic.
  - `packages/i18n`: Central translations.
  - Server channel: `packages/server-runtime`, `packages/server-sdk`, `packages/server-shared` (power `services/` and `plugins/`).
  - Legacy: `crates/` (old Tauri desktop; current desktop is Electron).

## Structure & Responsibilities

- **Apps**
  - `apps/stage-web`: Web app; composables/stores in `src/composables`, `src/stores`; pages in `src/pages`; devtools in `src/pages/devtools`; router config via `vite.config.ts`.
  - `apps/stage-tamagotchi`: Electron app; renderer pages in `src/renderer/pages`; devtools in `src/renderer/pages/devtools`; settings layout at `src/renderer/layouts/settings.vue`; router config via `electron.vite.config.ts`.
  - Settings/devtools routes rely on `<route lang="yaml"> meta: layout: settings </route>`; ensure routes/icons are registered accordingly (`apps/stage-tamagotchi/src/renderer/layouts/settings.vue`, `apps/stage-web/src/layouts/settings.vue`).
  - Shared page bases: `packages/stage-pages`.
  - Stage pages: `apps/stage-web/src/pages`, `apps/stage-tamagotchi/src/renderer/pages` (plus devtools folders).
- **Stage UI internals** (`packages/stage-ui/src`)
  - Providers: `stores/providers.ts` and `stores/providers/` (standardized provider definitions).
  - Modules: `stores/modules/` (AIRI orchestration building blocks).
  - Composables: `composables/` (business-oriented Vue helpers).
  - Components: `components/`; scenarios in `components/scenarios/` for page/use-case-specific pieces.
  - Stories: `packages/stage-ui/stories`, `packages/stage-ui/histoire.config.ts` (e.g. `components/misc/Button.story.vue`).
- **IPC/Eventa**: Always use `@moeru/eventa` for type-safe, framework/runtime-agnostic IPC/RPC. Define contracts centrally (e.g., `apps/stage-tamagotchi/src/shared`) and follow usage patterns in `apps/stage-tamagotchi/src/main/services/electron` for main/renderer integration.
- **Dependency Injection**: Use `injeca` for services/electron modules/plugins/frontend; see `apps/stage-tamagotchi/src/main/index.ts` for composition patterns.
- **Build/CI/Lint**: `.github/workflows` for pipelines; `eslint.config.js` for lint rules.
- **Bundling libs**: Use `tsdown` for new modules (see `packages/vite-plugin-warpdrive`).
- **Styles**: UnoCSS config at `uno.config.ts`; check `apps/stage-web/src/styles` for existing animations; prefer UnoCSS over Tailwind.

## Key Path Index (what lives where)

- `packages/stage-ui`: Core stage business components/composables/stores.
  - `src/stores/providers.ts` and `src/stores/providers/`: provider definitions (standardized).
  - `src/stores/modules/`: AIRI orchestration modules.
  - `src/composables/`: reusable Vue composables (business-oriented).
  - `src/components/`: business components; `src/components/scenarios/` for page/use-case-specific pieces.
  - Stories: `packages/stage-ui/stories`, `packages/stage-ui/histoire.config.ts` (e.g. `components/misc/Button.story.vue`).
- `packages/stage-ui-three`: Three.js bindings + Vue components.
- `packages/stage-ui-pixi`: Planned Pixi bindings.
- `packages/stage-shared`: Shared logic across stage-ui, stage-ui-three, stage-web, stage-tamagotchi.
- `packages/ui`: Standardized primitives (inputs/textarea/buttons/layout) built on reka-ui.
- `packages/i18n`: All translations.
- Server channel: `packages/server-runtime`, `packages/server-sdk`, `packages/server-shared` (power `services/` and `plugins/`).
- Legacy desktop: `crates/` (old Tauri; Electron is current).
- Pages: `packages/stage-pages` (shared bases); `apps/stage-web/src/pages` and `apps/stage-tamagotchi/src/renderer/pages` for app-specific pages; devtools live in each app’s `.../pages/devtools`.
- Router configs: `apps/stage-web/vite.config.ts`, `apps/stage-tamagotchi/electron.vite.config.ts`.
- Devtools/layouts: `apps/stage-tamagotchi/src/renderer/layouts/settings.vue`, `apps/stage-web/src/layouts/settings.vue`.
- IPC/Eventa contracts/examples: `apps/stage-tamagotchi/src/shared`, `apps/stage-tamagotchi/src/main/services/electron`.
- DI examples: `apps/stage-tamagotchi/src/main/index.ts` (injeca).
- Styles: `uno.config.ts` (UnoCSS), `apps/stage-web/src/styles` (animations/reference).
- Build pipeline refs: `.github/workflows`; lint rules in `eslint.config.js`.
- Tailwind/UnoCSS: prefer UnoCSS; if standardizing styles, add shortcuts/rules/plugins in `uno.config.ts`.
- Bundling pattern: `packages/vite-plugin-warpdrive` (tsdown example).

## Commands (pnpm with filters)

> Use pnpm workspace filters to scope tasks. Examples below are generic; replace the filter with the target workspace name (e.g. `@proj-airi/stage-tamagotchi`, `@proj-airi/stage-web`, `@proj-airi/stage-ui`, etc.).

- **Typecheck**
  - `pnpm -F <package.json name> typecheck`
  - Example: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (runs `tsc` + `vue-tsc`).
- **Unit tests (Vitest)**
  - Targeted: `pnpm exec vitest run <path/to/file>`
    e.g. `pnpm exec vitest run apps/stage-tamagotchi/src/renderer/stores/tools/builtin/widgets.test.ts`
  - Workspace: `pnpm -F <package.json name> exec vitest run`
    e.g. `pnpm -F @proj-airi/stage-tamagotchi exec vitest run`
  - Root `pnpm test:run`: runs all tests across registered projects. If no tests are found, check `vitest.config.ts` include patterns.
  - Root `vitest.config.ts` includes `apps/stage-tamagotchi` and other projects; each app/package can have its own `vitest.config`.
- **Lint**
  - `pnpm lint` and `pnpm lint:fix`
  - Formatting is handled via ESLint; `pnpm lint:fix` applies formatting.
- **Build**
  - `pnpm -F <package.json name> build`
  - Example: `pnpm -F @proj-airi/stage-tamagotchi build` (typecheck + electron-vite build).

## Development Practices

- Favor clear module boundaries; shared logic goes in `packages/`.
- Keep runtime entrypoints lean; move heavy logic into services/modules.
- Prefer functional patterns + DI (`injeca`) for testability.
- Use Valibot for schema validation; keep schemas close to their consumers.
- Use Eventa (`@moeru/eventa`) for structured IPC/RPC contracts where needed.
- Do not add backward-compatibility guards. If extended support is required, write refactor docs and spin up another Codex or Claude Code instance via shell command to complete the implementation with clear instructions and the expected post-refactor shape.
- If the refactor scope is small, do a progressive refactor step by step.
- When modifying code, always check for opportunities to do small, minimal progressive refactors alongside the change.

## Styling & Components

- Prefer Vue v-bind class arrays for readability when working with UnoCSS & tailwindcss: do `:class="['px-2 py-1','flex items-center','bg-white/50 dark:bg-black/50']"`, don't do `class="px-2 py-1 flex items-center bg-white/50 dark:bg-black/50"`, don't do `px="2" py="1" flex="~ items-center" bg="white/50 dark:black/50"`; avoid long inline `class=""`. Refactor legacy when you touch it.
- Use/extend UnoCSS shortcuts/rules in `uno.config.ts`; add new shortcuts/rules/plugins there when standardizing styles. Prefer UnoCSS over Tailwind.
- Check `apps/stage-web/src/styles` for existing animations; reuse or extend before adding new ones. If you need config references, see `apps/stage-web/tsconfig.json` and `uno.config.ts`.
- Build primitives on `@proj-airi/ui` (reka-ui) instead of raw DOM; see `packages/ui/src/components/Form` for patterns.
- Use Iconify icon sets; avoid bespoke SVGs.
- Animations: keep intuitive, lively, and readable.
- `useDark` (VueUse): set `disableTransition: false` or use existing composables in `packages/ui`.

## Testing Practices

- Vitest per project; keep runs targeted for speed.
- Mock IPC/services with `vi.fn`/`vi.mock`; do not rely on real Electron runtime.
- For external providers/services, add both mock-based tests and integration-style tests (with env guards) when feasible. You can mock imports with Vitest.
- Grow component/e2e coverage progressively (Vitest browser env where possible). Use `expect` and assert mock calls/params.

## TypeScript / IPC / Tools

- Keep JSON Schemas provider-compliant (explicit `type: object`, required fields; avoid unbounded records).
- Favor functional patterns + DI (`injeca`); avoid new class hierarchies unless extending browser APIs (classes are harder to mock/test).
- Centralize Eventa contracts; use `@moeru/eventa` for all events.
- When a user asks to use a specific tool or dependency, first check Context7 docs with the search tool, then inspect actual usage of the dependency in this repo.
- If multiple names are returned from Context7 without a clear distinction, ask the user to choose or confirm the desired one.
- If docs conflict with typecheck results, inspect the dependency source under `node_modules` to diagnose root cause and fix types/bugs.

## i18n

- Add/modify translations in `packages/i18n`; avoid scattering i18n across apps/packages.

## CSS/UNO

- Use/extend UnoCSS shortcuts in `uno.config.ts`.
- Prefer grouped class arrays for readability; refactor legacy inline strings when possible.

## Naming & Comments

- File names: kebab-case.
- Avoid classes unless extending runtime/browser APIs; FP + DI is easier to test/mock.
- Add clear, concise comments for utils, math, OS-interaction, algorithm, shared, and architectural functions that explain what the function does.
- When using a workaround, add a `// NOTICE:` comment explaining why, the root cause, and any source context. If validated via `node_modules` inspection or external sources (e.g., GitHub), include relevant line references and links in code-formatted text.
- When moving/refactoring/fixing/updating code, keep existing comments intact and move them with the code. If a comment is truly unnecessary, replace it with a comment stating it previously described X and why it was removed.
- Avoid stubby/hacky scaffolding; prefer small refactors that leave code cleaner.
- Use markers:
  - `// TODO:` follow-ups
  - `// REVIEW:` concerns/needs another eye
  - `// NOTICE:` magic numbers, hacks, important context, external references/links

## PR / Workflow Tips

- Rebase pulls; branch naming `username/feat/short-name`; clear commit messages (gitmoji optional).
- Summarize changes, how tested (commands), and follow-ups.
- Improve legacy you touch; avoid one-off patterns.
- Keep changes scoped; use workspace filters (`pnpm -F <workspace> <script>`).
- Maintain structured `README.md` documentation for each `packages/` and `apps/` entry, covering what it does, how to use it, when to use it, and when not to use it.
- Always run `pnpm typecheck` and `pnpm lint:fix` after finishing a task.
- Use Conventional Commits for commit messages (e.g., `feat: add runner reconnect backoff`).

## Definition of Done for Fork-Specific Tasks

Before considering a fork-specific task done:

- run the relevant tests, lint, and type checks if available
- summarize what changed
- list any follow-up work or limitations
- note any assumptions that affected the implementation
