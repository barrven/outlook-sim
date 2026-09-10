---
id: 004
title: Mail compose, mock-send & drafts
status: done
priority: high
---

## Description
Trainee can compose a new message (To, Subject, Body) addressed to a
persona, mock-send it into the Sent folder, and save in-progress messages to
Drafts.

## Acceptance Criteria
- [ ] Compose window supports To, Subject, and Body fields
- [ ] "To" can be set to any configured persona's email address
- [ ] Sending a message stores it in the Sent folder with a timestamp
- [ ] Saving an unsent compose window stores it in Drafts and can be
      reopened for editing
- [ ] No real network mail transport occurs — sending is purely local
      persistence

## Implementation Notes
Design decisions (confirmed with the user before building, since the AC
left the UI shape open): compose opens in a **real separate Electron
window** (matching actual Outlook), not an in-app overlay. Reopening a
draft is via an explicit "Edit draft" button in the reading pane (shown
only when the displayed message's `folderId === 'drafts'`) — clicking a
draft message still shows it read-only in the reading pane first, unchanged
from feature 003's already-accepted click behavior.

This needed real main-process work, unlike 002/003:

- `src/main/windows.ts` (new) — extracted the main-window creation logic
  from `index.ts` into `createMainWindow()`, plus a new `createComposeWindow
  (parent, draftId?)` that opens a child `BrowserWindow` loading the same
  `index.html` with a `?compose=1[&draftId=...]` query string (via a shared
  `loadRenderer()` helper handling both the dev-server and packaged-file
  load paths). No new preload/data surface needed for the draft's *content*
  — the compose window fetches it itself via the existing
  `window.api.data.messages.get(draftId)`, same as any other window.
- `src/main/index.ts` — now just wires `app.whenReady`, registers a new
  `window:openCompose` IPC handler that calls `createComposeWindow`, and
  calls `createMainWindow`/`createComposeWindow` from `windows.ts`.
- `src/main/data/ipc.ts` — `db:messages:create/update/delete` now each call
  a new `broadcastMessagesChanged()` that sends a `data:messages-changed`
  event to every open `BrowserWindow`. This is how the main window's
  message list/reading pane learn that the *compose* window (a different
  renderer process) just sent or saved something — there's no other channel
  between sibling windows. Delete (feature 006) gets this refresh
  mechanism for free as a side effect of putting the broadcast at the data
  layer rather than per-feature.
- `src/preload/index.ts` / `index.d.ts` — added `window.api.compose.open
  (draftId?)` (invokes `window:openCompose`) and `window.api.
  onMessagesChanged(callback)` (subscribes to the broadcast, returns an
  unsubscribe function).
- `src/renderer/src/main.tsx` — now branches on `?compose=1` in
  `window.location.search` to mount `<ComposeWindow>` instead of `<App>`.
  Both windows load the same bundle/stylesheet; this is the only routing
  the app has, so no router library was added.
- `src/renderer/src/ComposeWindow.tsx` (new) — the compose UI: To (a
  `<select>` sourced from `window.api.data.personas.get()`, satisfying "To
  can be set to any configured persona's email address"; if editing a draft
  whose stored recipient isn't in the current persona list, that
  email/name is still shown as a synthetic extra option so no data is lost
  on prefill), Subject (text input), Body (textarea). Send is disabled
  until a recipient is chosen. Send/Save both fetch
  `window.api.data.identity.get()` for the from-fields, then either
  `messages.create` (new compose) or `messages.update` (editing an existing
  draft, keyed by `draftId` from the URL) with `folderId: 'sent'` or
  `'drafts'` respectively and a fresh `timestamp` — so sending an
  in-progress draft **moves** that same row to Sent rather than leaving a
  duplicate behind. Both close the window (`window.close()`) on success.
  Discard just closes without persisting anything, including for an
  existing draft (cancels the edit, doesn't delete/revert it).
- `src/renderer/src/components/RibbonBar.tsx` — "New Email" is now a real
  enabled button (`onClick={onNewEmail}`) when the new optional
  `onNewEmail` prop is passed; unaffected otherwise, so the existing
  "buttons are disabled" test for cases that don't pass it still holds.
- `src/renderer/src/components/ReadingPane.tsx` — new `onEditDraft` prop
  and an "Edit draft" button next to the subject, shown only for
  `folderId === 'drafts'`; also takes the new `messagesVersion` prop (see
  below) in its fetch effect's deps.
- `src/renderer/src/components/MessageListPane.tsx` — same
  `messagesVersion` prop, included in its fetch effect's deps, so an
  external mutation (from the compose window) triggers a refetch of
  whatever folder is currently showing.
- `src/renderer/src/App.tsx` — wires `window.api.compose.open()` to
  RibbonBar's New Email, `window.api.compose.open(message.id)` to
  ReadingPane's Edit draft, subscribes to `onMessagesChanged` on mount to
  bump a `messagesVersion` counter threaded into both list/pane components.
  No compose-related state lives in `App` itself — the separate-window
  architecture means there's nothing to coordinate locally.
- `src/renderer/src/styles/global.css` — new `.compose-*` rules for the
  compose window's own layout, plus `.reading-pane-subject-row`/
  `.reading-pane-edit-draft` for the new button.

Kept existing tests/infra compiling since prop contracts changed (mechanical
sync, not new test authorship — left for `/test`):
- `src/renderer/src/test/mockApi.ts` — added `compose.open` and
  `onMessagesChanged` mocks (every `<App>`-rendering test would otherwise
  crash immediately on mount).
- `src/renderer/src/components/MessageListPane.test.tsx` /
  `ReadingPane.test.tsx` (from feature 003) — added the new required
  `messagesVersion`/`onEditDraft` props to existing render calls so the
  suite still compiles (`npm run build` type-checks test files too, so this
  wasn't optional the way it was for feature 003's async-behavior gap).
- `src/main/data/ipc.test.ts` — its `vi.mock('electron', ...)` factory
  didn't export `BrowserWindow`, so the create/update/delete tests crashed
  on `broadcastMessagesChanged()`; added `BrowserWindow: { getAllWindows:
  () => [] }` to the mock.

Not yet covered by any automated test (this feature has **zero** dedicated
test coverage right now — `/test` needs to add it): `ComposeWindow.tsx`
itself (persona-population, prefill-from-draftId, send/save/discard
branches, the not-in-persona-list synthetic option), the new `RibbonBar`
"New Email" enabled/onClick path, `ReadingPane`'s "Edit draft" button, and
`broadcastMessagesChanged`'s actual fan-out behavior.

Live-verified instead (multi-window IPC can't be exercised by Vitest, which
never spawns a real `BrowserWindow`): ran the real packaged app via a
scripted Playwright `_electron` session against a seeded persona — New
Email opened a real second window with the persona in the To dropdown;
Save & Close created a draft and the *main window's* Drafts list
auto-refreshed via the broadcast with zero manual reload; clicking the
draft showed "Edit draft"; reopening prefilled subject/body correctly;
selecting the persona and Send moved that same row to Sent (confirmed it
disappeared from Drafts, not duplicated) with a fresh timestamp. Screenshots
captured, then all seed data/scripts/temp `playwright-core` install cleaned
up.

Deliberate scope boundaries:
- No confirmation dialog on Discard, matching feature 003's precedent.
- Sent/moved messages keep whatever `isRead`/`isFlagged` state they had as
  a draft (observed: shows bold/"unread" in Sent Items) — read-state
  semantics are feature 007's scope, not touched here.
- No validation beyond "Send requires a recipient" — Subject/Body can be
  empty for both Send and Save, matching how real mail clients behave.

## Test Notes
Added the coverage the Implementation Notes flagged as missing. 61/61 tests
pass (up from 48/48 — 13 new tests across 3 files, 0 regressions).

- `src/renderer/src/ComposeWindow.test.tsx` (new, 7 tests) — renders To/
  Subject/Body with Send disabled until a recipient is chosen; To dropdown
  populated from `window.api.data.personas.get()`; choosing a persona +
  filling fields + Send calls `messages.create` with `folderId: 'sent'`
  and the identity-sourced from-fields, then closes the window; Save &
  Close calls `messages.create` with `folderId: 'drafts'` without requiring
  a recipient; opening with a `draftId` prefills Subject/Body from
  `messages.get` and Send on that draft calls `messages.update` (not
  `create`) with the same id, moving it to Sent; a draft whose stored
  recipient isn't in the current persona list still shows that email as a
  synthetic extra `<option>` so editing an old draft never loses data;
  Discard calls neither `create` nor `update` and still closes the window.
  (AC1, AC2, AC3, AC4, AC5)
- `src/renderer/src/components/RibbonBar.test.tsx` (+1 test) — New Email is
  enabled and calls the provided `onNewEmail` handler on click; the
  existing "disabled" test (no handler passed) still passes unchanged,
  confirming the opt-in gating works both ways.
- `src/renderer/src/components/ReadingPane.test.tsx` (+3 tests) — the "Edit
  draft" button appears only for a message with `folderId: 'drafts'` and
  calls `onEditDraft` with the full message object; it's absent for any
  other folder; changing `messagesVersion` (the cross-window refresh
  signal) triggers a refetch of the currently-displayed message. (AC4)
- `src/renderer/src/components/MessageListPane.test.tsx` (+1 test) — same
  `messagesVersion`-triggers-refetch coverage for the message list.
- `src/main/data/ipc.ts` — made `BrowserWindow.getAllWindows` a
  reassignable `vi.fn()` in the existing mock (was a fixed `() => []`) so a
  new test can inject a fake window and assert `broadcastMessagesChanged`
  actually fires `webContents.send('data:messages-changed')` on message
  create, update, *and* delete — the exact mechanism the compose window
  relies on to make the main window notice a send/save.

Deliberately not covered:
- No test drives the real cross-*process* IPC round trip (a real second
  `BrowserWindow` actually receiving the broadcast) — Vitest can't spawn
  real Electron windows. That path was verified live during `/implement`
  (scripted Playwright `_electron` run against the real packaged app):
  New Email → real second window → persona in dropdown → Save & Close →
  main window's Drafts list auto-refreshed with no manual reload → Edit
  draft → reopened prefilled → Send → moved to Sent, confirmed gone from
  Drafts (not duplicated). Screenshots were captured then discarded along
  with the seed data.
- No test drives `window.api.compose.open` itself (the `App.tsx` call
  sites for New Email / Edit draft, or the `window:openCompose` IPC
  handler / `createComposeWindow` in `windows.ts`) — these are one-line
  wiring or Electron-API-only code with no branching logic to unit test in
  isolation; also covered by the same live run above.
- Read-state (`isRead`/`isFlagged`) of a sent/saved message is untested
  here since it's explicitly out of scope (feature 007), and observed
  behavior (keeps whatever it had) was already noted as a known gap in
  Implementation Notes, not a bug to test against.

## Validation Notes
**Checks run:**
- Lint (`npm run lint`): pass, no errors.
- Typecheck (`npm run typecheck`): pass, no errors.
- Build (`npm run build`): pass, emits `out/main` (15.04 kB, up from 13.65 kB
  — the new `windows.ts`/compose-window IPC), `out/preload`, `out/renderer`
  cleanly.
- Full test suite (`npm test`): pass — 10 files, 61/61 tests.

**Acceptance criteria:**
- [x] Compose window supports To, Subject, and Body fields —
      `ComposeWindow.test.tsx` asserts all three render; live-verified via
      screenshots during `/implement`.
- [x] "To" can be set to any configured persona's email address — the `<select>`
      is populated from `window.api.data.personas.get()`
      (`ComposeWindow.test.tsx` "populates the To dropdown..."); live-verified
      with a real seeded persona showing up correctly in the dropdown and
      being selectable.
- [x] Sending a message stores it in the Sent folder with a timestamp —
      `persist('sent')` calls `messages.create`/`messages.update` with
      `folderId: 'sent'` and `timestamp: Date.now()`, tested in both the
      new-compose and edit-existing-draft cases; live-verified (message
      moved into Sent Items, visible with correct subject).
- [x] Saving an unsent compose window stores it in Drafts and can be
      reopened for editing — `persist('drafts')` tested; the reading pane's
      "Edit draft" button (shown only for `folderId: 'drafts'`) reopens the
      compose window pre-filled via `draftId`, tested end-to-end in
      `ComposeWindow.test.tsx`'s prefill case and live-verified. Bonus real-world
      corroboration: the on-disk DB already has one message the user
      created themselves by using the running app between sessions — a
      draft titled "testing" sitting in the Drafts folder — independent
      evidence the flow works outside of my own test runs.
- [x] No real network mail transport occurs — sending is purely local
      persistence — true by construction: `ComposeWindow.tsx` only calls
      `window.api.data.messages.*`/`identity.get`/`personas.get`, the same
      IPC surface whose no-network guarantee `no-network.test.ts` (feature
      002) already covers at the data layer; no new network-capable code
      path was introduced by this feature.

All five acceptance criteria pass. No changes needed.

## Acceptance Log
2026-09-10 — User asked to run `/accept`. Presented the AC-by-AC validation
summary (all 5 pass, both by automated tests and the live `/implement` run
against the real app, plus incidental corroboration from a real draft the
user had already created in the running app), checks (lint/typecheck/
build/61 tests all pass), and the compose-opens-in-a-real-window design
decision that was confirmed with the user up front. Decision: **Accepted**.
