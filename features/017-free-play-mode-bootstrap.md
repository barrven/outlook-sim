---
id: 017
title: Free-play mode bootstrap
status: validating
priority: medium
---

## Description
Trainee can start a free-play session: current Settings (system prompt,
personas, trainee identity) apply, and the mailbox/calendar starts empty or
lightly seeded, ready for the LLM features to drive activity.

## Acceptance Criteria
- [ ] A "start free-play" action initializes an empty or lightly seeded
      Inbox/Calendar using current Settings
- [ ] Free-play works with zero scenario pack loaded
- [ ] Starting free-play again resets to a fresh empty/lightly-seeded state
      (with confirmation if it would discard existing data)

## Implementation Notes
New `session:startFreePlay` IPC channel (`window.api.session.startFreePlay`) backed by two new
`MailDb` methods: `hasMailboxOrCalendarData()` and `resetMailboxAndCalendar()` (`DELETE FROM
messages` / `DELETE FROM calendar_items`; folders, Settings, personas, identity, and system prompt
are untouched — "current Settings apply" per the Description). A confirm/re-confirm handshake
(`StartFreePlayResult` = `{ok:true}` or `{ok:false, needsConfirmation:true}`) keeps the
discard-confirmation decision in the main process next to the data it's protecting, rather than
racing a separate renderer-side count check: the first call returns `needsConfirmation` only if the
mailbox/calendar is non-empty, the renderer shows a native `window.confirm`, and a second call with
`confirmed:true` proceeds unconditionally — so a fresh/empty mailbox (first run, or already reset)
starts free-play with no prompt at all, satisfying AC3 precisely.

UI is a new "Session" section at the bottom of `SettingsView.tsx` (after Personas) with a single
"Start Free-Play" button, matching the existing settings-section/action-row pattern; `App.tsx` gets
a new `onFreePlayStarted` callback prop on `SettingsView` that clears `selectedMessageId` (the
selected message may no longer exist after the reset) — the existing `data:messages-changed`
broadcast on success already drives the Message List/Reading Pane refresh via `messagesVersion`.

Deliberately out of scope: folder structure (custom folders survive a reset — they're mailbox
structure, not session content per the spec's scenario-pack description), the simulated clock, and
the unsolicited-mail scheduler's `nextDueSimTime` (still valid regardless of mailbox content, no
correctness reason to touch it) — this feature's Description scopes the reset to "mailbox/calendar"
specifically. Calendar UI doesn't exist yet (018/019 still backlog), so the calendar half of the
reset is exercised only at the data-layer/IPC level, same forward-looking pattern as prior features.
"Lightly seeded" was not implemented — an empty mailbox/calendar satisfies the ACs' explicit "empty
or lightly seeded" either/or, and fabricating placeholder content would bake in an implicit "default
domain" the spec explicitly says shouldn't be hardcoded.

## Test Notes
Added 15 tests on top of the coverage already written during `/implement` (230 → 244 passing plus
1 pre-existing test's expectation updated for the new channel and one assertion loosened to a
set-comparison to avoid coupling to folder sort order; re-ran the full suite 3x, stable).

- `db.test.ts`: `hasMailboxOrCalendarData()` false on a fresh DB, true after a message exists, true
  after a calendar item exists with zero messages (AC1's "or calendar" half); `resetMailboxAndCalendar()`
  clears both tables while leaving custom folders untouched (locks in the "folders aren't session
  content" scope decision from Implementation Notes); the reset survives a close/reopen cycle.
- `ipc.test.ts` (`session:startFreePlay`): an already-empty mailbox/calendar resets with no
  confirmation needed (AC3's "fresh state" exercised end-to-end via IPC, and the no-prompt case);
  a non-empty mailbox is refused (`needsConfirmation: true`) and left completely intact — same for
  calendar-only data with zero messages; a `confirmed:true` call wipes and broadcasts
  `data:messages-changed`; an unconfirmed refusal does not broadcast (proves the confirm gate, not
  just the delete, is honored before touching any window).
- `SettingsView.test.tsx` (Session section): starting free-play from empty calls the IPC exactly
  once with no `window.confirm`; a non-empty result triggers `window.confirm` and, on accept, a
  second call with `confirmed:true`, ending in the status message; declining the confirm makes no
  second call and shows no success status.
- `App.test.tsx`: starting free-play while a message is selected clears that selection so returning
  to Mail shows the empty-selection state, not a reference to a message that may no longer exist.

Deliberately not covered: AC2 ("works with zero scenario pack loaded") has no dedicated test because
no scenario-pack concept exists anywhere in the code yet (021/022 are still backlog) — the feature
simply never reads or requires one, so there is nothing to assert beyond the existing tests already
exercising free-play with no scenario-pack machinery present at all. Live Electron GUI verification
(the actual `window.confirm` native dialog, multi-window IPC round-trip) not attempted — same
sandbox limitation (no Xvfb) as every prior feature, deferred to `/validate`/`/accept`. Calendar-side
behavior is verified at the data/IPC layer only, since the Calendar UI itself doesn't consume
calendar items yet (018/019 still backlog), consistent with the scheduler's existing test coverage.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
