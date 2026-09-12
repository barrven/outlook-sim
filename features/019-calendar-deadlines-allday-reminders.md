---
id: 019
title: Calendar deadlines, all-day items & reminders
status: accept
priority: medium
---

## Description
Trainee can create deadline events, all-day items, and reminders on the
calendar; reminders fire based on simulated time.

## Acceptance Criteria
- [ ] User can create/edit/delete a deadline event with a specific
      date/time
- [ ] User can create/edit/delete an all-day item
- [ ] User can attach a reminder to an event; the reminder fires (visible
      notification within the app) when simulated time reaches it
- [ ] No reminder fires based on wall-clock time while the simulated clock
      is paused

## Implementation Notes
**Data model:** added `reminderFired: boolean` to `CalendarItem` (new `reminder_fired` SQLite column
+ `ALTER TABLE` migration for pre-existing DBs, same pattern as the `cc`/`previous_folder_id`
migrations) so a reminder fires exactly once, including across app restarts. No other schema
changes needed — `itemType`, `allDay`, and `reminderMinutesBefore` already existed from feature 002
but 018 only ever wrote `itemType:'event', allDay:false, reminderMinutesBefore:null`.

**Create/edit/delete UI:** generalized 018's create-only `CalendarEventForm` into `CalendarItemForm`,
used for both creating (`initialItem` omitted) and editing (`initialItem` provided, adds a Delete
button). Every rendered event/deadline in Day/Work Week/Week (`calendar-day-event`) and Month
(`calendar-month-event`) is now a clickable `<button>` (was a plain `<div>`) that opens this form
pre-filled via a new `editingItem` state in `CalendarView`; the ribbon's "New Event" create-form
prop takes precedence if both would somehow be open at once (opening it also explicitly closes any
in-progress edit). New form fields: a Type select (Event/Deadline — covers AC1), an All-day checkbox
that swaps the Start input between `datetime-local` and native `date` (covers AC2; date-only values
are parsed manually via `new Date(year, month-1, day)` rather than handed to `new Date(string)`,
since bare ISO date strings parse as UTC midnight while `datetime-local` strings parse as local time
— using the wrong one would silently shift the day in most timezones), and a Reminder select
(None/at-time/5/15/30/60/1440 minutes before — covers AC3's "attach a reminder"). Deadline items are
visually distinguished with a subtle amber border/background in both views.

**Reminder firing (AC3/AC4):** new `src/main/data/reminderScheduler.ts` (`ReminderScheduler`, not
under `llm/` since no LLM call is involved) — a real-time 10s poller matching the existing
unsolicited-mail scheduler's shape: only checks while `clock.getState().running` is true, computes
`clock.now()`, and fires (marks `reminderFired: true`, then calls back) every calendar item where
`startTime - reminderMinutesBefore*60000 <= now` and not already fired. Wired into `index.ts`
alongside the existing scheduler's start/stop lifecycle. New `calendar:reminder-fired` broadcast
(`broadcastReminderFired` in `ipc.ts`, `window.api.onReminderFired` in preload) — `App.tsx` collects
fired items into a list rendered as dismissible amber banners (new `.reminder-banner` style,
distinct from the existing red `.llm-error-banner`), visible regardless of which module is active,
since a reminder is relevant even if you're in Mail when it fires.

AC4 ("no reminder fires on wall-clock time while paused") holds two ways at once: `SimClock.now()`
already returns a frozen `anchorSimTime` while paused (unaffected by real elapsed time), so the due-time
comparison itself can't drift; the scheduler's explicit `running` guard is redundant with that but kept
anyway, matching the mail scheduler's convention and making the intent independently verifiable.
Manually verified both the scheduler's fire-once/no-refire/paused-blocks-firing logic (bundled
standalone with esbuild against a fake db/clock) and the DB migration (against a scratch copy of the
real `~/.config/outlook-sim/outlook-sim.db`) before writing automated tests in `/test`.

Deliberately out of scope: recurring events (020), and multi-day all-day spans (an all-day item is a
single day — `endTime` is always `null` when `allDay` is true, matching the simplest reading of "an
all-day item" in the Description). No confirmation dialog on Delete, matching the existing
FolderPane/PersonasSettings precedent for single-object CRUD (unlike free-play's mailbox-wide reset,
this is a small, easily-recreated action).

Files touched: `shared/data-types.ts`, `main/data/db.ts`, `main/data/ipc.ts` (new broadcast),
`main/data/reminderScheduler.ts` (new), `main/index.ts` (scheduler lifecycle), `preload/index.ts` +
`index.d.ts` (`onReminderFired`), `renderer/src/components/CalendarView.tsx` (rewritten form +
edit/delete wiring), `renderer/src/App.tsx` (reminder banners), `renderer/src/styles/global.css`,
`renderer/src/test/mockApi.ts` (compile fixture touch-up).

## Test Notes
Added 26 tests on top of the manual esbuild sanity-checks done during `/implement` (279 → 305, all
passing; re-ran the full suite 3x, stable).

- `reminderScheduler.test.ts` (9 tests, new): does nothing paused-but-nominally-due; does nothing
  running-but-not-yet-due; fires exactly once when due, marking `reminderFired` and calling back
  with the updated item; does not refire on a later tick; fires exactly at the due boundary
  (`reminderMinutesBefore: 0`); never fires an item with no reminder configured; fires every due
  item in one tick while leaving not-yet-due items alone; `start()`/`stop()` real-time polling via
  fake timers; a real-`SimClock` integration test firing while running, not while paused, across a
  pause/resume cycle (mirrors the equivalent unsolicited-mail-scheduler test) — this is the
  strongest AC4 evidence, since it exercises the real clock's frozen-while-paused `now()` rather
  than a mocked one.
- `db.test.ts` (+4 tests): `reminderFired` defaults to `false` on create and round-trips through
  update; survives a close/reopen cycle; the `reminder_fired` column migration path for a pre-existing
  DB created before reminders existed (mirrors the existing `cc`/`previous_folder_id` migration tests).
- `ipc.test.ts` (+2 tests): `broadcastReminderFired` sends the fired item on the
  `calendar:reminder-fired` channel, to every open window (not just the first).
- `CalendarView.test.tsx` (+13 tests): creating a Deadline sends `itemType:'deadline'` (AC1);
  checking "All day" swaps the Start field to a date picker and hides End, and submitting sends
  `allDay:true, endTime:null` with a start time at exact local midnight of the anchor date — computed
  independently in the test via `new Date(y,m,d).getTime()`, not by re-deriving the implementation's
  own conversion (AC2); selecting a reminder option sends the right `reminderMinutesBefore`, and
  leaving it at "None" sends `null` (AC3's "attach a reminder" half); an all-day item shows "All day"
  instead of a time in Day view; a new `describe('editing and deleting an existing item')` block
  covers clicking an existing item to open it pre-filled with its current Title/Type/All-day/Reminder,
  saving an edit calling `update` with the item id and reflecting the change, clicking Delete calling
  the delete IPC and removing it from view, and opening "New Event" while mid-edit closing the edit
  form in favor of the create form (locks in the precedence rule from Implementation Notes).
- `App.test.tsx` (+2 tests): a fired reminder shows a dismissible banner with the item's title
  (AC3's "visible notification within the app"); multiple fired reminders show independent banners,
  each dismissible without affecting the others.

One test-authoring bug caught along the way (not a product bug): an early draft of the all-day
submit test rendered `<CalendarView showCreateForm .../>` with the create form already open on the
very first render, before the mount effect's `clock.now()` promise resolves — so the form's lazy
`useState` initializer for `Start` captured the pre-correction `Date.now()` fallback instead of the
simulated anchor time, and the test failed on the exact `startTime` assertion. Fixed by switching
that test (and the sibling Deadline/reminder tests, which had the same latent race but happened not
to assert on anything anchor-dependent) to open the form via a button click after the initial render
settles, matching the pattern the earlier 018 tests already used. Not a real-world bug: `showCreateForm`
only ever flips true well after mount in the actual app (a human clicking "New Event" always comes
long after the `clock.now()` IPC round trip resolves).

Deliberately not covered: the `ticking` reentrancy guard in `ReminderScheduler.tick()` (mirrors the
mail scheduler's guard) isn't exercised — `tick()` is fully synchronous with no `await` inside it, so
there's no real gap for a genuine overlapping call to land in, unlike the mail scheduler's
network-call-based tick. No confirmation-dialog test for Delete, since none exists (documented,
deliberate, in Implementation Notes). No live Electron GUI click-through — no Xvfb in this sandbox,
same non-blocking gap as every prior feature, deferred to `/validate`.

## Validation Notes
lint/typecheck/build all pass. Full test suite (305/305) re-run 3x, stable. Confirmed via
`git diff 9ac6cf4 256f879 --stat` that the `/test` stage touched only test files plus docs
(`STATE.md`/`BACKLOG.md`/feature file) — no implementation drift between `/implement` and `/test`.

Acceptance criteria:
- **AC1** (create/edit/delete a deadline with a specific date/time) — PASS. Verified by code
  inspection (`CalendarItemForm`'s Type select, `CalendarView.tsx`'s `handleCreate`/`handleUpdate`/
  `handleDelete`) plus a live check against a scratch copy of the real, in-use
  `~/.config/outlook-sim/outlook-sim.db`: created a `deadline` item, edited its title, both
  persisted correctly.
- **AC2** (create/edit/delete an all-day item) — PASS. Same live check: created an `allDay:true`
  item with `endTime: null`, then deleted it, both round-tripping through the real DB correctly.
  The All-day → date-only-input conversion and its exact-local-midnight math are additionally
  covered by `CalendarView.test.tsx` (computed independently of the implementation's own helper, so
  it isn't just re-testing itself).
- **AC3** (attach a reminder; it fires as a visible in-app notification when simulated time reaches
  it) — PASS. Live check: an item due in 5 simulated minutes did not fire while the clock was
  paused, fired exactly once immediately after `clock.start()`, persisted `reminderFired: true`, and
  did not refire on a later tick — all against the real DB/clock code paths (not mocks). The
  in-app-visible half (dismissible banner, multiple independent banners) is covered by
  `App.test.tsx`; end-to-end IPC wiring (`calendar:reminder-fired` → `onReminderFired`) is covered by
  `ipc.test.ts`.
- **AC4** (no reminder fires on wall-clock time while paused) — PASS. The live check's second phase
  is direct evidence: a fresh item due right at `clock.now()` was added while paused and did not
  fire; this holds structurally for two independent reasons documented in Implementation Notes
  (`SimClock.now()` itself doesn't advance while paused, and the scheduler separately checks
  `running`), both exercised by `reminderScheduler.test.ts`'s real-`SimClock` pause/resume
  integration test.

Confirmed the real on-disk `outlook-sim.db` was left byte-for-byte unmodified by this validation run
(mtime checked before and after; the live check ran only against a scratch copy, then deleted).

Non-blocking gaps, consistent with every prior feature: no live multi-window Electron GUI
click-through (no Xvfb in this sandbox) — the real native `date`/`datetime-local` input widgets and
a genuine wall-clock-time-passing-while-paused scenario (leaving the real app open, paused, for
real elapsed time) are unverified through the actual UI, deferred to the user's own check at
`/accept`. The `ticking` reentrancy guard remains untested, as documented in Test Notes (no genuine
async gap exists in the current synchronous `tick()` to exercise it against).

**Accept-stage UI fixes (found by the user live in the running app, after this validation passed):**
1. The All-day checkbox looked small and not flush-left against its label. Root cause: it was
   matched by the shared `.calendar-event-form-row input, select, textarea` rule meant for text
   inputs, which gave it `padding: 5px 6px; border: 1px solid var(--border); border-radius: 2px` —
   a native checkbox rendered inside that padded/bordered box looks tiny and is pushed inward by the
   left padding rather than sitting flush against the label. Fixed with a higher-specificity
   `.calendar-event-form-row-checkbox input[type='checkbox']` rule that strips the inherited
   padding/border and sets an explicit `18px × 18px` size with `margin: 0`.
2. Checking "All day" (which hides the End field) visually shifted the All-day checkbox itself, even
   though the End row sits *below* it in the DOM. Root cause: `.calendar-view` is a column flex
   container with the day/month grid as its only `flex: 1 1 auto` item and the event form sized to
   its own content below that — so when the form got shorter (End row unmounted), the grid above it
   grew to fill the freed space, pushing the *entire form's top edge* (and everything near the top of
   it, including the All-day row) down the screen. Fixed by keeping the End row mounted at all times
   and hiding it with a new `.calendar-event-form-row-hidden { visibility: hidden }` class instead of
   conditionally unmounting it — the row still reserves its layout space, so the form's height (and
   therefore every other row's position) stays constant regardless of the All-day toggle. Updated the
   one test that asserted the End field was removed from the DOM to instead assert the hidden class.
Re-ran lint/typecheck/build/full suite (305/305) — all pass. Phase stays `accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
