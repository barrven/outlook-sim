---
id: 003
title: Mail folders, message list & reading pane
status: done
priority: high
---

## Description
Wire the Mail module to real data: default folders (Inbox, Sent, Drafts,
Deleted Items) plus user-created custom folders, a message list per folder,
and a reading pane that shows the selected message.

## Acceptance Criteria
- [ ] Inbox, Sent, Drafts, and Deleted Items folders exist by default and
      appear in the folder pane
- [ ] User can create, rename, and delete custom folders
- [ ] Selecting a folder shows its messages in the message list
- [ ] Selecting a message shows its content in the reading pane
- [ ] Folder/message data is read from the SQLite layer built in 002

## Implementation Notes
Approach: wire the existing (previously static/placeholder) Mail panes to the
`window.api.data` IPC surface built in 002. No main-process/IPC changes were
needed — 002 already exposed everything this feature required.

- `src/renderer/src/App.tsx` — now owns `folders` state, fetched on mount via
  an inline `window.api.data.folders.list().then(...)` effect (a named
  `refreshFolders` `useCallback` is kept for callers to re-trigger the fetch
  after a mutation, e.g. from `FolderPane`, but the mount-time effect calls
  the API inline rather than through that callback — calling an outer
  `useCallback` synchronously from an effect trips the project's
  `react-hooks/set-state-in-effect` lint rule even though the actual
  `setState` happens after an `await`). Also owns `selectedMessageId`;
  changing folders now resets it to `null`.
- `src/renderer/src/components/FolderPane.tsx` — folders are now a prop
  (`folders: Folder[]`) instead of the removed static `MAIL_FOLDERS`
  constant. Added create/rename/delete UI: a "+ New folder" button that
  turns into a text input (Enter submits, Escape cancels), and per-folder
  rename/delete icon buttons shown only for `type: 'custom'` folders (the
  four seeded system folders can't be renamed or deleted, matching the "user
  can create, rename, delete custom folders" wording of the AC). All three
  actions call the corresponding `window.api.data.folders.*` method, then
  call the new `onFoldersChanged` prop (passed down from `App`) to refetch;
  deleting the currently-selected folder falls back to selecting Inbox.
- `src/renderer/src/components/MessageListPane.tsx` — fetches
  `window.api.data.messages.list(selectedFolderId)` on folder change (with a
  `cancelled` flag to avoid a race if the folder changes again before the
  fetch resolves) and renders a simple list (from/subject, unread messages
  bolded via a `.unread` class — no read-state *mutation* here, that's
  feature 007's scope). Takes `selectedFolderName` as a prop (from `App`,
  which already loaded `folders`) rather than re-fetching folders itself.
- `src/renderer/src/components/ReadingPane.tsx` — fetches
  `window.api.data.messages.get(selectedMessageId)` when the id changes
  (same cancellation-guard pattern); derives the empty/placeholder state as
  `selectedMessageId ? message : null` at render time instead of calling
  `setMessage(null)` synchronously inside the effect, for the same lint
  reason as above.
- `src/renderer/src/types.ts` — removed the now-dead static `MailFolder`
  type and `MAIL_FOLDERS` constant (folders are real `Folder` data from 002
  now).
- `src/renderer/src/styles/global.css` — added styles for the new
  folder-action buttons/inline forms, the message list items, and the
  reading pane's populated (non-empty) layout.

Tradeoff: no confirmation prompt before deleting a custom folder (or its
messages) — kept the interaction simple per the feature's scope; nothing in
the AC calls for it, and native `confirm()` dialogs are awkward in this
Electron/test setup. A future feature could add one.

Verified: `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
`npm test` was not re-run at this stage since the existing `App.test.tsx`
suite predates real data-fetching (no `window.api` mock) and is expected to
be rewritten in `/test`.

## Test Notes
Added the `window.api` mock the previous validation round flagged as
missing, plus dedicated test files for the three components this feature
gave real logic to. 48/48 tests pass (up from 23/28 with 5 failures).

- `src/renderer/src/test/mockApi.ts` — new shared factory
  (`createMockApi()`) building a fully-`vi.fn()`-mocked `Window['api']`
  matching the whole `DataApi` surface (not just folders/messages — also
  calendarItems/settings/systemPrompt/identity/personas, so later features
  reusing this mock don't have to build it themselves). `folders.list()`
  defaults to the four seeded system folders; everything else defaults to an
  empty/blank response, matching a fresh install.
- `src/renderer/src/test/setup.ts` — installs a fresh mock via
  `window.api = createMockApi()` in a `beforeEach`, guarded by
  `typeof window !== 'undefined'` since this setup file also runs for the
  main-process (`node` environment) test files in `src/main/data/`, which
  have no `window` global at all.
- `src/renderer/src/App.test.tsx` (rewritten) — the 5 existing cases updated
  to `findBy*`/await the now-async folder load instead of asserting
  synchronously; added one new integration test: selecting a message
  renders it in the reading pane, and switching folders clears that
  selection back to the empty placeholder (AC3, AC4).
- `src/renderer/src/components/FolderPane.test.tsx` (new, 10 tests) —
  renders system + custom folders with the selected one marked; rename/
  delete controls appear only on custom folders; folder click calls
  `onSelectFolder`; create/rename/delete each call the right
  `window.api.data.folders.*` method with the right arguments and then
  `onFoldersChanged`; whitespace-only create is a no-op; Escape cancels both
  create and rename without calling the API; deleting the *currently
  selected* folder falls back to selecting Inbox, deleting a
  non-selected one doesn't touch the selection. (AC1, AC2)
- `src/renderer/src/components/MessageListPane.test.tsx` (new, 5 tests) —
  empty-folder state; renders from/subject per message with unread ones
  bolded (`.unread`); click calls `onSelectMessage`; selected message is
  marked; changing `selectedFolderId` re-calls `messages.list` with the new
  folder id. (AC3)
- `src/renderer/src/components/ReadingPane.test.tsx` (new, 4 tests) —
  placeholder with no selection; fetches and renders subject/body/from/to
  once a message is selected; going back to no selection returns to the
  placeholder (the exact render-time-derived-null path added to satisfy the
  `react-hooks/set-state-in-effect` rule); a `get()` that resolves `null`
  (message not found) also shows the placeholder rather than crashing.
  (AC4)

Deliberately not covered:
- No test drives the real IPC bridge/`contextBridge` end-to-end — same
  rationale as feature 002: Vitest runs in Node, not a real Electron
  renderer, and every test here goes through the same `window.api.data.*`
  surface the real preload script implements 1:1 against, so the IPC
  plumbing itself is covered by 002's `ipc.test.ts`, not re-tested here.
- No test exercises the real SQLite-backed round trip through the UI (mocks
  stand in for `window.api`) — that path was instead verified once, live,
  against the real Electron app and the real on-disk DB during `/verify`
  (screenshots captured); mocking is the right call for the fast/repeatable
  regression suite, the live run is the right call for proving the real
  stack wires together.

## Validation Notes
**Round 2 (current) — Checks run:**
- Lint (`npm run lint`): pass, no errors.
- Typecheck (`npm run typecheck`): pass, no errors.
- Build (`npm run build`): pass, emits `out/main`, `out/preload`,
  `out/renderer` cleanly.
- Full test suite (`npm test`): **pass** — 9 files, 48/48 tests (was 23/28
  with 5 failures in round 1; the `/test` pass in between added the missing
  `window.api` mock and dedicated coverage for `FolderPane`,
  `MessageListPane`, and `ReadingPane` — see Test Notes).

**Acceptance criteria — now double-covered: by the automated suite added in
`/test`, and by the live manual/scripted run against the real Electron app
and the real `~/.config/outlook-sim` SQLite DB captured during `/verify`
(round 1, still valid — no app behavior changed since, only tests were
added):**
- [x] Inbox, Sent, Drafts, Deleted Items exist by default and appear in the
      folder pane — `App.test.tsx` asserts the Inbox folder button renders;
      `FolderPane.test.tsx` asserts all seeded folders render with the
      selected one marked; live screenshot from `/verify` shows all four
      plus a custom folder.
- [x] User can create, rename, and delete custom folders — `FolderPane.test.tsx`
      covers create (with correct `id`/`type`/`sortOrder` shape),
      whitespace-only create no-op, Escape-cancels-create, rename,
      Escape-cancels-rename, delete-resets-selection-when-selected,
      delete-leaves-selection-when-not-selected, and that system folders
      show zero rename/delete controls; `/verify` additionally proved this
      round-trips through the real IPC bridge into the real on-disk SQLite
      file (checked directly with a SQL query before/after each mutation).
- [x] Selecting a folder shows its messages in the message list —
      `MessageListPane.test.tsx` covers the empty state, rendering
      messages with unread ones bolded, and re-fetching when the folder id
      prop changes; `/verify` showed Inbox with 2 seeded messages and
      Drafts with 1, live.
- [x] Selecting a message shows its content in the reading pane —
      `ReadingPane.test.tsx` covers the placeholder state, the populated
      state (subject/from/to/timestamp/body), reverting to the placeholder
      when the selection clears, and a not-found id also showing the
      placeholder rather than crashing; `App.test.tsx`'s new integration
      test confirms the same flow end-to-end (select message → reading pane
      populates → switch folder → selection clears) through the real
      component tree; `/verify` confirmed it live.
- [x] Folder/message data is read from the SQLite layer built in 002 —
      true by construction (`window.api.data.folders/messages.*` is the
      only data source touched anywhere in the new code), and `/verify`
      observed the live app read pre-seeded rows and reflect mutations back
      into the same on-disk `outlook-sim.db`.

All five acceptance criteria pass, all checks pass. No changes needed.

---

**Round 1 (superseded) — Checks run:**
- Lint, typecheck, build: pass.
- Full test suite: **FAIL** — 23/28 pass, 5 fail. All 5 failures were in
  `App.test.tsx`: `window.api` was `undefined` in the Vitest/jsdom
  environment (no mock existed yet), so the mount-time
  `window.api.data.folders.list()`/`messages.list()` effects threw
  `TypeError: Cannot read properties of undefined (reading 'data')`.
  `FolderPane.tsx`, `MessageListPane.tsx`, and `ReadingPane.tsx` had zero
  dedicated test files. Root cause: `/test` had been skipped for this
  feature (implement → verify → validate). All 5 ACs were confirmed
  functionally correct via the live `/verify` run regardless. Routed back to
  `status: testing` / phase `test` (not `implement` — there was no
  implementation defect) with the required test work spelled out; `/test`
  addressed all of it (see Test Notes and the round-2 results above).

## Acceptance Log
2026-09-10 — User asked to run `/accept`. Presented the AC-by-AC validation
summary (all 5 pass, both by automated tests and the live `/verify` run
against the real app/DB), checks (lint/typecheck/build/48 tests all pass),
and the round-1→round-2 story (test-coverage gap found and closed via
`/test` before re-validating). Decision: **Accepted**.
