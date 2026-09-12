---
id: 019
title: Calendar deadlines, all-day items & reminders
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
