---
id: 002
title: Local data layer (SQLite + JSON config store)
status: accept
priority: high
---

## Description
Introduce the persistence layer the rest of the app builds on: a SQLite
database for runtime mail/calendar data (folders, messages, calendar items,
flags, read state) and a JSON file store for configuration (settings, system
prompt, trainee identity, personas, scenario packs). No UI yet — just the
schema/store and read/write APIs.

## Acceptance Criteria
- [ ] SQLite database file is created locally on first run with tables for
      folders, messages, and calendar items (including flag/read-state
      columns)
- [ ] JSON config files are created locally on first run for settings,
      system prompt, trainee identity, and personas
- [ ] App exposes internal read/write APIs for both stores that other
      features can call
- [ ] Data persists across app restarts
- [ ] No network calls are made by this layer

## Implementation Notes
Approach: main-process-only data layer with two stores, both taking an
injectable `baseDir` (wired to `app.getPath('userData')` at startup) so they
don't depend on Electron being ready and can be exercised in plain Node.

- `src/shared/data-types.ts` — types shared across main/preload/renderer:
  `Folder`, `MailMessage`, `CalendarItem`, `Settings`, `SystemPromptConfig`,
  `TraineeIdentity`, `Persona`, plus `New*`/`*Patch` variants for
  create/update calls.
- `src/main/data/db.ts` — `MailDb` class wrapping Node's built-in
  `node:sqlite` (`DatabaseSync`; confirmed present in Electron 44's bundled
  Node 24, so no native module / rebuild step needed). Creates
  `outlook-sim.db` with `folders`, `messages` (read/flag columns,
  `categories`/`attachments` as JSON-text columns for 007/009 to build on),
  and `calendar_items` (all-day/reminder/recurrence columns for 019/020)
  tables via `CREATE TABLE IF NOT EXISTS`, and seeds the four default
  folders (Inbox/Drafts/Sent Items/Deleted Items, ids matching
  `renderer/src/types.ts`'s `MAIL_FOLDERS`) on first run only. Exposes
  generic list/get/create/update/delete methods per table — no
  feature-specific business logic (move-to-Deleted-Items, flag toggling,
  etc. are for later features to call this with).
- `src/main/data/config.ts` — `ConfigStore` class: four JSON files under
  `<userData>/config/` (`settings.json`, `system-prompt.json`,
  `identity.json`, `personas.json`), each created with sane empty defaults
  on first run if missing, with get/set per file.
- `src/main/data/ipc.ts` — `registerDataIpcHandlers()` wires both stores to
  `ipcMain.handle` channels (`db:*`, `config:*`) so renderer code (future
  features) can call them.
- `src/main/index.ts` — constructs `MailDb`/`ConfigStore` on
  `app.whenReady()` and registers the IPC handlers before creating the
  window.
- `src/preload/index.ts` / `index.d.ts` — expose `window.api.data.*`
  (folders/messages/calendarItems/settings/systemPrompt/identity/personas),
  each method a thin `ipcRenderer.invoke` wrapper, typed via `DataApi`.
- `tsconfig.node.json`/`tsconfig.web.json` — added `src/shared/**/*` to
  `include` so shared types resolve from all three processes.

No UI was added — per the feature's scope, this is schema + read/write APIs
only.

Verified: `npm run typecheck`, `npm run build`, and the existing `npm test`
suite (7 tests, unaffected) all pass. Additionally ran a standalone Node
smoke test (compiling `db.ts`/`config.ts` outside Electron, since neither
class touches Electron APIs) that created folders/messages/calendar
items/config, closed and reopened both stores against the same directory,
and confirmed every value round-tripped — covering all five acceptance
criteria functionally ahead of the `/test` stage.

Tradeoff: used `node:sqlite` instead of `better-sqlite3` to avoid a native
addon + Electron rebuild step; it's still an experimental Node API, so if a
future Electron/Node bump drops or changes it, this is the one place that
would need to change.

## Test Notes
Extended the existing Vitest setup to cover the main process: switched the
project default to `environment: 'node'` (needed for `node:sqlite`, which
Vite's default "client" test environment refuses to bundle) and pinned the
two existing renderer test files to `// @vitest-environment jsdom` via
per-file pragma, since the removed-in-v5 `environmentMatchGlobs` option is
no longer available. Added `src/main/**/*.test.ts` to `include`.

New suites, all against real `MailDb`/`ConfigStore` instances backed by a
fresh `mkdtempSync` directory per test (no mocking of SQLite or the
filesystem):

- `src/main/data/db.test.ts` (10 tests) — default folders seeded once and
  not duplicated on reopen; custom folder create/rename/delete; message
  create defaults (unread/unflagged/empty categories+attachments) and
  per-folder listing; message update of read/flag/categories and
  get-returns-null-if-missing; message delete; calendar item
  create/update/delete; and a close-then-reopen cycle asserting folders,
  a message, and a calendar item all round-trip byte-for-byte (AC1, AC3,
  AC4).
- `src/main/data/config.test.ts` (6 tests) — all four JSON files exist with
  the documented empty defaults on first run (AC2); a write actually lands
  on disk as parseable JSON, not just in memory; settings/identity/personas
  round-trip; and a close-then-reopen cycle across all four stores (AC4).
- `src/main/data/ipc.test.ts` (5 tests) — mocks `electron`'s `ipcMain` to
  capture registered handlers, then asserts the full set of 22 documented
  channel names is registered and exercises folders/messages/calendar
  items/settings end-to-end through the captured handler functions, so the
  actual IPC surface (not just the underlying classes) is covered (AC3).
- `src/main/data/no-network.test.ts` (1 test) — spies on `http.request`,
  `https.request`, and `fetch`, then exercises every read/write method
  across both stores and asserts none of the three were ever called (AC5).

Total: 28 tests (20 new + existing 7 renderer + this file's own count),
all passing.

Deliberately not covered:
- IPC handlers aren't tested from the renderer/preload side (i.e. no test
  drives `window.api.data.*` through a real `contextBridge`) — Vitest runs
  in Node, not a real Electron renderer with context isolation, so this is
  covered analytically by the 1:1 mapping between `preload/index.ts`'s
  wrapper methods and `ipc.ts`'s channel names, both typechecked against
  the same `DataApi`/shared types. A future feature that actually calls
  `window.api.data.*` from a component will exercise this path for real.
- No SQL-injection-style adversarial input tests — all values are bound via
  parameterized `?` placeholders (never string-interpolated into SQL), so
  there's no code path where that class of bug could occur.
- Windows-specific `userData` path behavior is unverified (same sandbox
  limitation as feature 001); `MailDb`/`ConfigStore` only take a `baseDir`
  string and don't touch `app.getPath` themselves, so this risk is
  isolated to the one `app.getPath('userData')` call in `main/index.ts`.

## Validation Notes
**Checks run (clean, from a fresh `tsbuildinfo`):**
- Lint: still no lint tooling in the project (no ESLint config/`lint`
  script) — same gap flagged in feature 001, not new to this feature, not
  blocking.
- Typecheck (`npm run typecheck`): pass, no errors.
- Build (`npm run build`): pass, emits `out/main` (13.65 kB), `out/preload`
  (2.13 kB), `out/renderer` cleanly.
- Full test suite (`npm test`): 6 files, 28 tests, all pass.
- Manual full-app launch: attempted (as done for feature 001) but the
  sandbox's X server isn't actually reachable in this session (`DISPLAY=:0`
  is set but connecting hangs; a headless-ozone launch instead segfaults in
  the screen module) — same environment limitation feature 001 already
  hit and accepted, not a regression. Fell back to exercising the real
  `MailDb`/`ConfigStore` classes directly: compiled `db.ts`/`config.ts`
  standalone (outside Electron, since neither touches Electron APIs) and
  ran a script that created folders/messages/calendar items/settings,
  closed both stores, reopened them against the same directory, and
  confirmed every value round-tripped — this plus the 28-test Vitest suite
  covers the data-layer contract; only the ~3 lines of glue in
  `main/index.ts` that call `app.getPath('userData')` and wire the stores
  to IPC remain unverified against a real running app window.

**Acceptance criteria:**
- [x] SQLite database file created on first run with folders/messages/
      calendar_items tables, messages carrying `is_read`/`is_flagged`
      columns — `db.test.ts` "creates the default folders on first run"
      and the message create/update tests exercise these columns directly.
- [x] JSON config files created on first run for settings, system prompt,
      trainee identity, and personas — `config.test.ts` "creates all four
      config files with empty defaults on first run" checks each file
      exists on disk with the documented default shape.
- [x] Read/write APIs exposed for both stores for other features to call —
      `ipc.test.ts` asserts all 22 documented `db:*`/`config:*` channels
      are registered and exercises them end-to-end; `preload/index.ts`
      wraps every channel as `window.api.data.*`, typed via `DataApi` in
      `preload/index.d.ts` and checked against the same shared types as
      `ipc.ts`, so a mismatch between the two would fail typecheck.
- [x] Data persists across app restarts — `db.test.ts` and `config.test.ts`
      each have a close-then-reopen test against the same temp directory
      confirming every value round-trips; the implement-stage smoke test
      confirmed the same behavior end-to-end outside the test harness too.
- [x] No network calls made by this layer — `no-network.test.ts` spies on
      `http.request`, `https.request`, and `fetch` across a full exercise
      of every read/write method and asserts none were called; also true
      by inspection (`db.ts`/`config.ts`/`ipc.ts` import only `node:sqlite`,
      `fs`, `path`, and `electron`'s `ipcMain`).

All five acceptance criteria pass. No changes needed.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
