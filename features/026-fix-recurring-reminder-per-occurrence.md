---
id: 026
title: Fix — recurring event reminders fire per occurrence
status: accept
priority: high
---

## Description
Closes the gap flagged during feature 020. A recurring event/deadline's
reminder now fires for each occurrence that reaches its reminder time (per
the series' Reminder setting), not only once on the series' first
occurrence.

## Acceptance Criteria
- [ ] A recurring event with a reminder fires the reminder banner for its
      2nd/3rd/etc. occurrence, not only the 1st
- [ ] A reminder does not re-fire twice for the same occurrence
- [ ] A per-occurrence exception (feature 020) is respected: a deleted
      occurrence's reminder never fires; an occurrence edited to a new start
      time fires its reminder relative to the new time
- [ ] Non-recurring items' reminder behavior (feature 019) is unaffected

## Implementation Notes
Root cause: `CalendarItem.reminderFired` was a single boolean on the series'
own template row. `ReminderScheduler` only ever checked/set that one flag
against the template's own `startTime`, so a recurring series' reminder
could fire at most once, ever — for whichever occurrence happened to be due
first.

Fix: replaced `reminderFired: boolean` with `remindersFired: number[]` — the
`originalStartTime` (feature 020's stable per-occurrence key) of every
occurrence whose reminder has already fired. A non-recurring item just has
at most its own `startTime` in that array, so its observable behavior is
unchanged (AC4).

- Moved `src/renderer/src/recurrence.ts` (+ its test) to `src/shared/`
  (was already pure/React-free) so both the renderer's `CalendarView` and
  the main-process `ReminderScheduler` share the exact same occurrence
  expansion — including exception handling — rather than the scheduler
  reimplementing it main-side and risking drift (same rationale as 024's
  `quoteBody` extraction).
- `ReminderScheduler.tick()` now calls `expandOccurrences([item], item.startTime, now + REMINDER_LOOKAHEAD_MS + 1)`
  per item (range starts at the series' own startTime so an occurrence that
  became due while the app was closed/paused still gets caught; extends
  `REMINDER_LOOKAHEAD_MS` — 2 days, double the longest reminder-lead UI
  option of 1 day — past `now` since a reminder can be due before its
  occurrence starts), filters to occurrences not already in
  `remindersFired` whose due time has passed, marks all of them fired in
  one `updateCalendarItem` call, and fires the callback once per occurrence.
  A deleted exception is already skipped by `expandOccurrences` itself
  (AC3); an edited occurrence's overridden `startTime`/`reminderMinutesBefore`
  flow through automatically, so its reminder is computed relative to the
  new time, not the natural one (AC3).
- New `FiredReminder` type (`shared/data-types.ts`) replaces `CalendarItem`
  as the `calendar:reminder-fired` broadcast payload: `id` is
  `${seriesId}:${originalStartTime}`, unique per *occurrence* firing (not
  per series), so two occurrences of the same series firing in one tick get
  independently-dismissible banners in `App.tsx` instead of colliding on a
  shared React key/dismiss id. Threaded through `ipc.ts`, `index.ts`,
  `preload/index.ts` (both the runtime object and the `window.api` type
  declaration in `preload/index.d.ts` — a separate source of truth from the
  object literal, easy to miss), and `App.tsx`.
- `db.ts`: schema column renamed `reminder_fired` (INTEGER) →
  `reminders_fired` (JSON TEXT). Migration adds the new column and, if the
  old one is still present (pre-026 database), back-fills it — a
  previously-fired item's only fireable occurrence was its own template
  `start_time`, so that's the correct single value to carry forward. The
  old column is left in place, unused, same convention as every other
  additive-only migration in this file.

Known, accepted tradeoff (not an AC, flagging for visibility): `tick()`
expands occurrences from a series' own `startTime` forward on every
10-second poll, forever — for a long-running daily/weekly series this
means re-walking an ever-growing list of already-fired (and thus
filtered-out) past occurrences each tick. Bounded by the existing
`MAX_OCCURRENCE_ITERATIONS` cap (~270 years of daily occurrences) so it
can't run away, and matches this scheduler's existing full-table-poll
pragmatism (same class of tradeoff as `listCalendarItems()` already being
unbounded in item count) — not worth a bigger rework for a training-sim
app's realistic session lengths.

Files touched: `src/shared/data-types.ts`, `src/shared/recurrence.ts` (moved
from `src/renderer/src/recurrence.ts`, import path only — logic unchanged),
`src/main/data/db.ts`, `src/main/data/reminderScheduler.ts`,
`src/main/data/ipc.ts`, `src/main/index.ts`, `src/preload/index.ts`,
`src/preload/index.d.ts`, `src/renderer/src/App.tsx`,
`src/renderer/src/components/CalendarView.tsx`. Existing test files needed
compile/assertion touch-ups for the type rename (`db.test.ts`,
`ipc.test.ts`, `reminderScheduler.test.ts`, `scenarioPack.test.ts`,
`App.test.tsx`, `CalendarView.test.tsx`, `recurrence.test.ts` moved
alongside its source) — same rename, no unrelated behavior changes; also
added one new `db.test.ts` test directly verifying the
reminder_fired→reminders_fired backfill migration, since that's new logic
this stage wrote, not just a rename.

Live-verified all 4 ACs with a standalone script (bundled
`db.ts`/`clock.ts`/`reminderScheduler.ts` with `esbuild`, real non-mocked
`MailDb`/`SimClock`) driving a daily recurring event across 4 simulated
days: day 1 and day 2 each fired their own distinct reminder (the actual
bug — previously only day 1 ever would have), re-ticking the same moment
didn't double-fire, a day-3 occurrence deleted via exception never fired,
and a day-4 occurrence edited to a new (later) start time correctly did
NOT fire at its old natural due time but DID fire at the new due time with
the exception's overridden title. lint/typecheck/build pass; existing
suite still 422/422 (421 baseline + 1 migration test added here, rest are
touch-ups, no count regression). phase set to `test`.

## Test Notes
Added a new `describe('026: recurring reminders fire per occurrence', ...)`
block in `reminderScheduler.test.ts` (6 tests) plus one `App.test.tsx` test
for the UI-facing consequence — 428 total (422 → 428), all AC-traceable by
name:

- **AC1** — a daily recurring item's 1st, 2nd, and 3rd occurrence each fire
  their own reminder across three separate ticks, with three distinct
  `FiredReminder.id`s (`${seriesId}:${originalStartTime}`) and
  `remindersFired` ending up length 3 on the series row.
- **AC2** — ticking repeatedly at the same due moment never refires that
  occurrence (3 ticks → still 1 call), while a later occurrence firing
  independently still works (moving to occurrence 2's due time correctly
  adds exactly one more call, not zero and not a re-fire of occurrence 1).
- **AC3** (two tests) — a occurrence deleted via `recurrenceExceptions`
  never fires even once its natural due time has fully passed (occurrence 1
  and 3 around it still fire normally, proving the skip is scoped to just
  that occurrence); an occurrence edited to a new (later, same-day) start
  time does NOT fire at its old natural due time but DOES fire at the new
  due time, reporting the exception's overridden title. Deliberately moved
  the edited occurrence only 3 hours later (not to another day) so no
  other daily occurrence's own due time could fall in the test's window and
  produce an ambiguous multi-fire result — caught this exact ambiguity via
  a first draft of the test failing with 6 calls instead of 1, which
  turned out to be correct scheduler behavior (multiple long-overdue
  occurrences all becoming due in one big time jump) rather than a bug,
  just not what that specific test was trying to isolate.
- **AC4** (regression) — a plain non-recurring item still fires at most
  once, `remindersFired` ending up exactly `[startTime]`; the full
  pre-existing suite (paused-no-fire, due-boundary, no-reminder-configured,
  multi-item-single-tick, start/stop polling, real-`SimClock`
  pause/resume integration) is unchanged and still passes, since none of it
  used `recurrenceRule` — same execution path as before this feature.
- `App.test.tsx` — a dedicated test fires two occurrences of the *same*
  `seriesId` (not two different series, which the pre-existing multi-banner
  test already covered) and confirms both render as independent alerts and
  dismissing one leaves the other, proving `FiredReminder.id` (not
  `seriesId`) is what the banner keys off — the actual UI bug the old
  `CalendarItem`-as-broadcast-payload shape would have hit.

Deliberately not covered: the `REMINDER_LOOKAHEAD_MS` window's edge (an
occurrence whose reminder becomes due more than 2 days before its own
start) — no reminder-lead UI option gets anywhere close to that, and the
constant is directly visible/reviewable in `reminderScheduler.ts` rather
than needing a test to pin its exact value. Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 428/428, re-run 3x, stable.
`git diff c5e851f..67e0cd6` (the `/test` stage's commit) confirms it
touched only `reminderScheduler.test.ts`, `App.test.tsx`, `STATE.md`, and
the feature/backlog docs — no implementation drift.

Acceptance criteria:
- **AC1** (2nd/3rd/etc. occurrence fires, not only the 1st) — **pass**.
  `reminderScheduler.test.ts`'s new test drives a daily series through
  three separate due-times and confirms three distinct `FiredReminder.id`s
  and `remindersFired` ending up length 3. Verified live, independently of
  `/test`'s suite: bundled `db.ts`/`reminderScheduler.ts` standalone with
  `esbuild` and ran a real (non-mocked) `MailDb` + a fake but faithful
  clock against a scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db` — a daily recurring
  "Client status call" fired on day 1 AND day 2 (two distinct, correctly-
  titled/timed reminders) — the actual behavior the old single-boolean
  scheme could never produce.
- **AC2** (no double-fire for the same occurrence) — **pass**. Covered by
  both the pre-existing non-recurring "does not refire" test (unchanged)
  and the new recurring-specific test (3 ticks at the same due moment →
  still 1 call, then a later occurrence's own due time correctly adds
  exactly one more). The live check above re-ticked day 2's due moment a
  second time with no additional fire.
- **AC3** (exceptions respected: deleted occurrence never fires; edited
  occurrence fires relative to its new time) — **pass**. Two dedicated
  tests: a deleted occurrence's natural due time passing produces no fire
  (occurrences before/after it are unaffected), and an occurrence edited to
  a later same-day time does not fire at the old natural due time but does
  fire at the new one, reporting the exception's overridden title. This
  relies on `expandOccurrences` (shared with the calendar view, feature
  020) already handling exceptions correctly — confirmed by inspection
  that the scheduler filters/computes off the *occurrence's* (possibly
  overridden) `startTime`/`reminderMinutesBefore`, never the series
  template's raw values.
- **AC4** (non-recurring items' reminder behavior unaffected) — **pass**.
  The entire pre-existing `reminderScheduler.test.ts` suite (paused-no-fire,
  not-yet-due, fires-once, due-boundary, no-reminder-configured,
  multi-item-single-tick, start/stop real-time polling, real-`SimClock`
  pause/resume integration) passes unchanged — none of those tests set
  `recurrenceRule`, so they exercise the exact same code path
  (`expandOccurrences` degenerates to `[item.startTime]` for a non-recurring
  item) as before this feature, just now going through the shared
  occurrence-expansion function instead of a direct field check. A new
  explicit "AC4 (regression)" test locks in `remindersFired` ending up
  exactly `[startTime]` for such an item.

Also spot-checked the one design tradeoff flagged in Implementation Notes
(unbounded past-occurrence re-walking per tick for a long-running series):
not a correctness issue, `MAX_OCCURRENCE_ITERATIONS` bounds it, and it's
consistent with this scheduler's pre-existing full-table-poll pragmatism —
not a blocker for this fix's scope.

Real on-disk `outlook-sim.db`/config confirmed byte-for-byte unchanged
(md5) after the live check. No live multi-window Electron GUI click-through
attempted (no Xvfb, same non-blocking gap as every prior feature).

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
