# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 1
- **Phase:** implement
- **Active feature:** 004 — Mail compose, mock-send & drafts
- **Last updated:** 2026-09-10

## Phases

`spec -> features -> [implement -> test -> validate -> accept]* -> retro -> (back to spec)`

Valid values for **Phase**: `spec`, `features`, `implement`, `test`, `validate`,
`accept`, `retro`.

## History

<!-- Append a one-line entry here every time the phase changes, oldest last is fine, newest-first preferred. -->
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) accepted by user; logged to CHANGELOG; active feature set to 004 (mail compose, mock-send & drafts), phase set to `implement`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated (round 2): lint/typecheck/build/tests (48/48) all pass; all 5 ACs verified both by the new automated suite and by the round-1 live `/verify` run against the real app and real SQLite DB; phase set to `accept`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) tested: added `src/renderer/src/test/mockApi.ts` (shared `window.api` mock) plus new test files for `FolderPane`/`MessageListPane`/`ReadingPane` and a rewritten async-aware `App.test.tsx`; 48/48 tests pass (was 23/28); lint/typecheck/build all still pass; phase set to `validate`
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) validated: lint/typecheck/build pass; full test suite **fails** (23/28 — `App.test.tsx`'s 5 tests throw on the new `window.api` calls with no mock in place, and `FolderPane`/`MessageListPane`/`ReadingPane` have zero dedicated tests); all 5 ACs independently confirmed working via a live scripted run of the real Electron app against the real `~/.config/outlook-sim` SQLite DB (screenshots captured during `/verify`) — so this is a test-coverage gap, not a broken feature. Deviating from the standard "failure → back to implement" routing since there's no implementation defect to fix: status set to `testing`, phase set back to `test` directly, with the required test work spelled out in the feature file's Validation Notes.
- 2026-09-10 — feature 003 (mail folders, message list & reading pane) implemented: wired FolderPane/MessageListPane/ReadingPane to the `window.api.data` IPC surface from 002 (folders now real, dynamic, with custom-folder create/rename/delete UI; message list and reading pane fetch live data); no main-process changes needed; typecheck/lint/build all pass; phase set to `test`
- 2026-09-10 — feature 002 (local data layer) accepted by user after confirming the DB/config files exist at `~/.config/outlook-sim/` and cleaning up a stray `~/.config/Electron/outlook-sim.db`+`config/` from an earlier dev run; logged to CHANGELOG; active feature set to 003 (mail folders, message list & reading pane), phase set to `implement`
- 2026-09-10 — feature 002 (local data layer) validated: typecheck/build/tests (28) all pass, all 5 ACs verified against the real `MailDb`/`ConfigStore` classes; full-app launch unverified (same sandbox display limitation as feature 001, not a regression); no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 002 (local data layer) tested: 20 new Vitest tests (db, config, IPC bridge, no-network check) against real temp-dir-backed stores, 28/28 total passing; switched test env default to `node` for `node:sqlite` support; phase set to `validate`
- 2026-09-09 — feature 002 (local data layer) implemented: SQLite (`node:sqlite`) store for folders/messages/calendar items + JSON config store (settings/system prompt/identity/personas), exposed via IPC (`window.api.data.*`); no UI, per scope; phase set to `test`
- 2026-09-09 — feature 001 (app shell) accepted by user after manual launch check; logged to CHANGELOG; active feature set to 002 (local data layer), phase set to `implement`
- 2026-09-09 — feature 001 (app shell) validated: typecheck/build/tests all pass, manual offscreen-Electron launch confirmed all 5 ACs; no lint tooling exists yet (flagged, not blocking); phase set to `accept`
- 2026-09-09 — feature 001 (app shell) tested: set up Vitest + React Testing Library, 7 passing tests covering all shell ACs except Windows-launch and pixel styling; phase set to `validate`
- 2026-09-09 — feature 001 (app shell) implemented: Electron+Vite+React+TS scaffold, classic Outlook 3-pane/ribbon layout with Mail/Calendar switcher; phase set to `test`
- 2026-09-09 — backlog of 22 features created from spec, phase set to `implement`, active feature set to 001
- 2026-09-09 — spec drafted from docs/outlook-trainer-spec-prompt.md, phase set to `features`
- 2026-08-31 — scaffold created, phase set to `spec`
