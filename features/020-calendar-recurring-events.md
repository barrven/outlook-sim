---
id: 020
title: Calendar recurring events
status: testing
priority: low
---

## Description
Trainee can create recurring calendar events (e.g. daily/weekly/monthly
patterns).

## Acceptance Criteria
- [ ] User can create a recurring event with a repeat pattern
      (daily/weekly/monthly at minimum)
- [ ] Recurring instances appear correctly across day/work-week/week/month
      views
- [ ] Editing or deleting a single instance vs. the whole series is
      unambiguous to the user
- [ ] Recurrence persists across restarts

## Implementation Notes
**Data model:** a recurring series is still exactly one `CalendarItem` row — its own
title/description/startTime/endTime/allDay/reminderMinutesBefore/itemType act as the *template* every
occurrence inherits. `recurrenceRule` narrowed from `string | null` to `RecurrenceFrequency | null`
(`'daily' | 'weekly' | 'monthly'`, per AC1's "at minimum" — no end-date/count field, since no AC asks for
one; a series repeats indefinitely). New `recurrenceExceptions: CalendarRecurrenceException[]` field
(discriminated union: `{originalStartTime, deleted: true}` or a full field-snapshot with `deleted: false`)
holds per-occurrence edits/deletes, keyed by that occurrence's *natural* (un-excepted) start time so
repeated edits to the same occurrence keep matching correctly even after its displayed time has itself
been overridden. New `recurrence_exceptions TEXT NOT NULL DEFAULT '[]'` column + migration in `db.ts`,
mirroring the existing `cc`/`attachments` JSON-column pattern.

**Occurrence expansion (AC2):** new pure module `src/renderer/src/recurrence.ts` — `expandOccurrences(items,
rangeStartMs, rangeEndExclusiveMs)` walks each recurring item forward from its own startTime (daily/weekly
via `Date.setDate`, matching `calendarDates.ts`'s existing DST-safe convention; monthly via a dedicated
`monthlyOccurrenceAt(anchor, monthsAhead)` that always clamps from the *original* anchor day-of-month, not
the previous month's clamped result — an early draft got this wrong, permanently downgrading Jan 31 →
Feb 28 → **Mar 28** instead of back to Mar 31; caught via a standalone script before wiring into the UI),
applies exceptions (skip if deleted, override fields if edited), and returns a flat, sorted
`CalendarOccurrence[]`. `CalendarView.tsx` now computes this once per render from the visible day range and
feeds it to all three of day/week/month rendering (previously each just filtered raw `items`) — a
non-recurring item is unaffected (`expandOccurrences` returns it unchanged, once, if its own startTime is
in range).

**Instance vs. series (AC3):** `CalendarItemForm` gained a "Repeat" select, hidden via a new
`hideRecurrenceField` prop when editing a single occurrence (recurrence pattern belongs to the series, not
one instance). Clicking a non-recurring occurrence behaves exactly as before (no ambiguity to resolve).
Clicking a recurring occurrence first shows a small "This event / The whole series / Cancel" chooser;
"the whole series" edits/deletes the actual template row exactly like today; "this event" builds a
`CalendarRecurrenceException` from the form's fields (keyed by the occurrence's `originalStartTime`,
tracked separately from its possibly-already-overridden displayed `startTime`) and merges it into the
series' `recurrenceExceptions` via a new pure `upsertException` helper — the template row itself is never
touched. Occurrences that are part of a series (including edited ones) show a small 🔁 marker so it's
visually unambiguous before clicking, too.

**Deliberately out of scope (flagged, not silently ignored):** `ReminderScheduler` (feature 019) still
fires reminders once per DB row (`reminderFired` is a single boolean on the template), so a recurring
event's reminder only ever fires for its first occurrence, never for later ones — the same category of
cross-feature gap as the attachments/persona-reply issue found and fixed on feature 009. None of 020's ACs
mention reminders, so this wasn't fixed here; flagging for a future feature/bug rather than silently
leaving it undiscovered. Scenario packs (021/022) still don't support recurrence (`ScenarioPackCalendarItem`
has no recurrence fields) — unchanged, pre-existing scope boundary from 021, not expanded here.

**Files touched:** `shared/data-types.ts`, `main/data/db.ts` (+migration), new `renderer/src/recurrence.ts`,
`renderer/src/components/CalendarView.tsx`, `renderer/src/styles/global.css`; compile-only fixture
touch-ups (new required `recurrenceExceptions` field / narrowed `recurrenceRule` type) in `db.test.ts`,
`ipc.test.ts`, `App.test.tsx`, `CalendarView.test.tsx` — no behavior changes there. Verified the full
create → multi-view display → edit-one-instance-without-affecting-others → delete-whole-series flow with a
throwaway RTL script (mounted the real `CalendarView`, mocked only `window.api`) before considering this
done; deleted afterward, not part of the real suite. lint/typecheck/build pass; existing suite still
373/373 unchanged; phase set to `test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
