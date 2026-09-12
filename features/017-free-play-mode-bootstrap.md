---
id: 017
title: Free-play mode bootstrap
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
