---
id: 021
title: Scenario pack load
status: validating
priority: medium
---

## Description
Trainee can load a JSON scenario pack that seeds starting inbox,
contacts/personas, calendar deadlines, and optional timed incoming
messages, replacing the current active state.

## Acceptance Criteria
- [ ] User can pick a scenario pack JSON file from the UI and load it
- [ ] Loading a pack populates Inbox, personas, and calendar deadlines from
      the pack's contents
- [ ] Optional timed incoming messages in the pack are scheduled to arrive
      at their specified simulated times
- [ ] Loading a pack replaces the current active mailbox/calendar state
      (per spec default), with confirmation if it would discard unsaved
      data
- [ ] Malformed/invalid pack JSON is rejected with a clear error, not a
      crash

## Implementation Notes
**Schema (designed here, to be reused unchanged by 022 for round-tripping):** a `ScenarioPack` is
`{ name, description, personas[], inbox[], calendarItems[], timedMessages[] }` (all in
`shared/data-types.ts`). All timing in a pack is relative — every message/calendar-item entry
carries an `offsetMinutes` (added to the simulated clock's time *at load*, not baked into the file),
since packs are meant to be reused across different sessions/dates where an absolute timestamp
wouldn't make sense. Negative offsets are already-past (starting Inbox mail); positive offsets are
future (calendar deadlines, `timedMessages`). Calendar items use `durationMinutes` (nullable) instead
of an absolute end time, for the same reason.

**Validation (AC5):** `src/main/data/scenarioPack.ts`'s `validateScenarioPack(data: unknown)` hand-
rolled type-checks (no new dependency) every field of an arbitrary JSON value, throwing an internal
`PackValidationError` with a specific path (e.g. `calendarItems[0].itemType must be "event" or
"deadline"`) on the first problem found, caught and returned as `{ok:false, error}` — never throws
out to the caller. Manually verified with a batch of malformed inputs (`null`, a string, `{}`, wrong
types, an invalid enum value) before writing automated tests.

**Load flow (AC1):** since the renderer has no filesystem access (context isolation, no node
integration), picking the file has to be a main-process concern: a new `scenario:pickPack` IPC
handler (registered in `index.ts`, not `ipc.ts`, since — like `window:openCompose` — it needs the
`mainWindow` reference for `dialog.showOpenDialog`) opens a JSON-filtered native file dialog, reads
and `JSON.parse`s the chosen file, and runs it through `validateScenarioPack`. A canceled dialog is
its own outcome (`{ok:false, canceled:true}`), distinct from a validation error, so the UI doesn't
show an error message for a plain cancel.

**Apply flow (AC2/AC3/AC4):** mirrors `session:startFreePlay`'s (017) confirm/re-confirm handshake
exactly, on a new `scenario:applyPack(pack, confirmed?)` IPC handler in `ipc.ts`: refuses with
`{needsConfirmation:true}` when `db.hasMailboxOrCalendarData()` is true and `confirmed` wasn't
passed, otherwise calls `applyScenarioPack(db, config, clock, pack)` — which resets the
mailbox/calendar (reusing 017's `resetMailboxAndCalendar()`), replaces personas
(`config.setPersonas`, generating fresh ids), creates each `inbox` message and `calendarItems` entry
at `clock.now() + offsetMinutes*60000`, and persists `timedMessages` as `ScheduledScenarioMessage[]`
via a new `ConfigStore` file (`scenario-scheduled-messages.json`) for a new
`src/main/data/scenarioMailScheduler.ts` (`ScenarioMailScheduler`) to deliver later — same
real-time-poll-but-simulated-time-check shape as the reminder/unsolicited-mail schedulers (only
checks while `clock.getState().running`), wired into `index.ts`'s start/stop lifecycle alongside
them. Manually verified the full validate → apply → paused-no-deliver → running-delivers-once →
no-redeliver chain standalone (bundled with esbuild against a fake pack and real
`MailDb`/`ConfigStore`/`SimClock`) before writing automated tests — an early version of that check
used a *future* `offsetMinutes` for the delivery test and wrongly expected it to fire immediately;
fixed the check script (not the implementation) once the math was pointed out by the near-zero real
time elapsed between `clock.start()` and the next `tick()`.

**Scope decisions:** the discard-confirmation check only looks at `hasMailboxOrCalendarData()` (mail
+ calendar), matching AC4's literal "mailbox/calendar state" wording — loading a pack always
replaces personas and any still-pending `timedMessages` from a previously-loaded pack
unconditionally, without a separate confirmation, even though those are also "unsaved" in a sense.
System prompt and trainee identity are untouched (the Description lists only "starting inbox,
contacts/personas, calendar deadlines, and optional timed incoming messages" — not those two).
UI lives in a new "Scenario Pack" section in `SettingsView.tsx`, right after the existing "Session"
(free-play) section, since both are "how the active session starts" concerns — single "Load
Scenario Pack…" button, a status line on success, and an inline error message (not a crash) on
invalid JSON.

Files touched: `shared/data-types.ts` (pack schema + result types), `main/data/config.ts`
(scheduled-scenario-messages store), `main/data/scenarioPack.ts` (new: validate + apply),
`main/data/scenarioMailScheduler.ts` (new), `main/data/ipc.ts` (`scenario:applyPack`),
`main/index.ts` (`scenario:pickPack` + scheduler lifecycle), `preload/index.ts` + `index.d.ts`
(`window.api.scenario.*`), `renderer/src/components/SettingsView.tsx` (new section),
`renderer/src/App.tsx` (`onScenarioPackLoaded` clears stale selection),
`renderer/src/test/mockApi.ts` (compile fixture touch-up), `main/data/ipc.test.ts` (exhaustive
channel-list fixture touch-up for the new `scenario:applyPack` channel).

## Test Notes
Added 42 tests on top of the manual esbuild sanity-checks done during `/implement` (305 → 347, all
passing; re-ran the full suite 3x, stable).

- `scenarioPack.test.ts` (26 tests, new): `validateScenarioPack` — accepts a fully-populated pack;
  rejects non-object/wrong-type/missing-field inputs at every level (root, persona, message,
  calendar item) with the specific field-path error documented in Implementation Notes (AC5); every
  optional field's default (persona role/bio/etc → `''`, message body/fromName/toName → `''`,
  calendar item's `itemType` → `'event'`, `allDay` → `false`, `durationMinutes`/
  `reminderMinutesBefore` → `null`, and the four top-level arrays → `[]` when the pack omits them
  entirely). `applyScenarioPack` — replaces (not appends to) existing mailbox/calendar data;
  replaces personas with fresh generated ids; each inbox message's timestamp and each calendar
  item's start/end time computed correctly from `offsetMinutes`/`durationMinutes` against a
  controlled `clock.now()` (AC2); `timedMessages` land in the pending scheduled-messages store, not
  immediately in Inbox (AC3's "scheduled to arrive," not "arrive immediately"); a previously-pending
  pack's scheduled messages are fully replaced, not merged; an all-empty pack clears personas and
  leaves the mailbox/calendar empty.
- `scenarioMailScheduler.test.ts` (7 tests, new): does nothing paused-but-nominally-due; does
  nothing running-but-not-yet-due; delivers a due message into Inbox with the right fields, removing
  it from pending; does not redeliver; delivers every due message in one tick while leaving
  not-yet-due ones pending; `start()`/`stop()` real-time polling via fake timers; a real-`SimClock`
  pause/resume integration test — this is the strongest evidence for AC3's "at their specified
  simulated times" and the paused-clock half of AC4's spirit (no wall-clock-driven delivery).
- `ipc.test.ts` (+4 tests): `scenario:applyPack`'s confirm/re-confirm handshake end-to-end against a
  real `MailDb`/`ConfigStore` — empty state applies with no confirmation and actually seeds
  inbox/calendar/personas from the pack (AC2); non-empty mailbox is refused and left completely
  intact (AC4); `confirmed:true` applies regardless and broadcasts `data:messages-changed`; an
  unconfirmed refusal broadcasts nothing and leaves personas untouched. Also updated the pre-existing
  exhaustive-channel-list test for the new channel.
- `SettingsView.test.tsx` (+5 tests): loading a pack with an empty mailbox needs no confirmation and
  shows a named success status (AC1 exercised end-to-end: pick → apply → status); a canceled file
  dialog shows neither an error nor a status; an invalid/malformed pack's error message is shown
  verbatim in the UI, and `applyPack` is never called for it (AC5 — the actual per-field error string
  reaches the screen, not just "some generic failure"); the confirm/decline branches of AC4's
  discard-confirmation, mirroring the existing Session-section coverage pattern.

Deliberately not covered: `scenario:pickPack` itself (the native file-dialog + file-read wiring,
registered directly in `index.ts`) has no unit test — same category as `window:openCompose`
(untestable without a live Electron process; both are thin wiring around Electron APIs, with all
their real logic — `validateScenarioPack` — already covered directly). No live Electron GUI
click-through (no Xvfb in this sandbox), same non-blocking gap as every prior feature, deferred to
`/validate`. The `ticking` reentrancy guard in `ScenarioMailScheduler.tick()` is untested for the
same reason as the reminder scheduler's — fully synchronous, no genuine gap for an overlapping call.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
