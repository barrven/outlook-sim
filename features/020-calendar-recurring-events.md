---
id: 020
title: Calendar recurring events
status: done
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
Added 33 tests (373 → 406, all passing; re-ran full suite 3x, stable).

New `recurrence.test.ts` (17 tests) covers the pure `expandOccurrences`/`upsertException` logic in
isolation: non-recurring items pass through unchanged (in/out of range); daily/weekly expansion including
the case where the range starts well after the series began (must still find the right in-range
occurrences, not just the first N from the anchor); a DST-transition regression test (daily 9am event
stays at 9am across the March 2026 spring-forward, via `Date.setDate` not fixed ms offsets); monthly
expansion including the day-of-month clamping regression itself (Jan 31 → Feb 28 → **must return to Mar
31**, not stay clamped at 28 — this is the exact bug caught and fixed during `/implement`) and that
time-of-day is preserved across the month step; exceptions (deleted occurrences are skipped, overridden
occurrences show the override fields while every other occurrence in the series stays natural, matching
is by `originalStartTime` not occurrence index/position); multiple items' occurrences merge and sort by
start time; and `upsertException` append/replace/leave-others-untouched semantics. (AC2, AC3 groundwork)

New `describe('recurring events', ...)` block in `CalendarView.test.tsx` (13 tests) covers the UI: the
Repeat select defaults to "Does not repeat" and is wired through to `recurrenceRule` on create (both the
`'daily'` and `null` cases); a daily series shows the correct occurrence count in Week view and a monthly
series shows correctly in Month view (including the fixed 42-day grid legitimately showing a *second*,
trailing-month occurrence — confirmed as correct via the `outside-month` CSS class, not a bug); the 🔁
recurring indicator renders; clicking a recurring occurrence shows the "this event / the whole series"
chooser instead of opening the edit form directly, Cancel makes no API calls, and a non-recurring item
still skips straight to editing exactly as before (AC3); "This event" hides the Repeat field and saves an
exception via `calendarItems.update(seriesId, {recurrenceExceptions: [...]})` for both edit and delete,
never calling the delete IPC; "The whole series" shows Repeat pre-filled and edits/deletes the template
row directly via the same `calendarItems.update`/`delete` calls a non-recurring item already used (AC1,
AC3).

New `db.test.ts` tests (3) cover AC4 directly: a new item defaults `recurrenceExceptions: []` and
round-trips both fields through `updateCalendarItem`; `recurrenceRule`/`recurrenceExceptions` survive a
real close/reopen `MailDb` cycle; and the `recurrence_exceptions` column migration works against a
simulated pre-existing (pre-020) database missing that column, mirroring the existing `reminder_fired`
migration test.

Not separately tested: work-week view specifically (day/week/month share the exact same occurrence
rendering code path already covered; work-week only differs in which 5 days `calendarDates.ts` returns,
which is pre-existing, unchanged logic from feature 018). The flagged reminder-scheduler gap (a
recurring event's reminder fires only once, on the template row) has no new test, matching that it's a
documented pre-existing limitation being surfaced, not new behavior added by this feature. lint/typecheck/
build all still pass; phase set to `validate`.

## Validation Notes
lint/typecheck/build all pass. Full test suite (406/406) re-run 3x, stable. Confirmed via `git diff`
(`74d73fd..b1ca480`) that `/test` touched only test files/docs plus one 7-line change in `recurrence.ts` —
diffed it directly and confirmed it's a type-signature-only fix (de-genericizing `upsertException` to work
around a TS discriminated-union inference quirk); the function body (filter + spread) is byte-identical,
no behavior change.

Acceptance criteria:
- **User can create a recurring event with a repeat pattern (daily/weekly/monthly at minimum)** — PASS.
  Verified by reading `CalendarView.tsx`'s `RECURRENCE_OPTIONS` (Does not repeat/Daily/Weekly/Monthly) and
  `CalendarItemForm`'s `handleSubmit`, which sends `recurrenceRule: recurrenceSelection || null` to
  `calendarItems.create`. Confirmed by 3 `CalendarView.test.tsx` tests (default value, Daily → `'daily'`,
  default → `null`) plus a live check (below).
- **Recurring instances appear correctly across day/work-week/week/month views** — PASS. Verified by
  code inspection that all four views share one `expandOccurrences(items, rangeStartMs, rangeEndExclusiveMs)`
  call computed once from `getVisibleDays(view, anchorMs)` — the view only changes which days are asked
  for, not how occurrences are computed or rendered. The Test Notes flagged work-week as *not* separately
  unit-tested (reasoning: shared code path) — treated that as a claim to verify, not take on faith: ran a
  live check (below) that specifically exercises `getVisibleDays('workWeek', ...)` alongside the other
  three, confirming a weekly-recurring item correctly shows only its one weekday occurrence in that view.
  Also directly confirmed the previously-fixed monthly day-of-month clamping bug (Jan 31 → Feb 28 → Mar
  31, not permanently stuck at 28) via the dedicated regression test in `recurrence.test.ts`, which is
  exactly the kind of subtle date-math bug that would otherwise slip through.
- **Editing or deleting a single instance vs. the whole series is unambiguous to the user** — PASS.
  Directly read `handleSaveInstance`/`handleDeleteInstance` (`CalendarView.tsx:341-373`): both only ever
  call `calendarItems.update(series.id, {recurrenceExceptions: upsertException(...)})`, never touching the
  series' own template fields and never calling `calendarItems.delete` — so "this event" structurally
  cannot affect the rest of the series or remove it. `handleUpdateSeries`/`handleDeleteSeries` are the same
  calls a plain non-recurring item already used before this feature, unchanged. The scope-chooser dialog
  (`role="dialog" aria-label="Edit Recurring Item"`) only appears when `occurrence.isRecurring`, confirmed
  live end-to-end (below): editing occurrence 2 of a series left occurrences 1/3/4 completely untouched,
  and deleting the whole series via a *different*, unaffected occurrence removed everything.
- **Recurrence persists across restarts** — PASS. New `recurrence_exceptions` column + migration
  confirmed via 3 `db.test.ts` tests, plus a live check against a scratch copy of the real, in-use
  `~/.config/outlook-sim/outlook-sim.db` (5 pre-existing real calendar items): opened it (exercising the
  real migration path against a real production-shaped file), created a weekly recurring item, added an
  exception, closed and reopened `MailDb` against the same file (simulating an app restart) — both
  `recurrenceRule` and `recurrenceExceptions` came back byte-for-byte identical. Real on-disk file
  confirmed unchanged (md5) afterward; all work happened against the scratch copy, and the test item was
  deleted from the copy before comparing.

**Live end-to-end check performed:** ran a standalone script (`tsx`, not part of the real suite) against
the scratch copy above exercising `expandOccurrences` across all four `getVisibleDays` view types for a
weekly-recurring "Weekly status report" series with one moved/renamed occurrence — work-week and week
each showed exactly the one in-range Monday occurrence, month showed all four September occurrences with
the excepted one correctly replaced (not duplicated) by its override, and the surrounding untouched
occurrences stayed natural. This closes the one specific gap the Test Notes themselves flagged (work-week
view, untested at the unit level) with real evidence rather than leaving it purely on trust.

Non-blocking gaps, consistent with every prior feature: no live multi-window Electron GUI click-through
(no Xvfb in this sandbox). Also re-confirming the two deliberate, already-flagged out-of-scope items from
Implementation Notes are genuinely out of scope, not silently-missed ACs: none of the 4 ACs above mention
reminders or scenario-pack support, so the `ReminderScheduler`'s once-per-template-row firing and scenario
packs' lack of recurrence support are correctly left untouched. No issues found; phase set to `accept`.

## Acceptance Log
2026-09-12 — user reviewed the summary (feature description, all 4 ACs mapped to PASS, the monthly-
clamping bug fix, and the flagged reminder-scheduler limitation) and selected "Accept" via the accept-
stage question, noting this was the last feature in the backlog. Decision: **accepted**. Logged to
`docs/CHANGELOG.md`; status set to `done`.
