---
id: 018
title: Calendar views & persistence
status: validating
priority: medium
---

## Description
Calendar module with day, work-week, week, and month views, backed by the
SQLite calendar-items table from 002.

## Acceptance Criteria
- [ ] Calendar module is reachable from left navigation
- [ ] User can switch between day, work-week, week, and month views
- [ ] Calendar events created in one view are visible correctly in the
      others
- [ ] Calendar data persists across restarts

## Implementation Notes
Replaced the feature-001 `CalendarView.tsx` placeholder with a real view backed by the
`db:calendarItems:*` IPC already built in 002. New pure module `calendarDates.ts` (deliberately
`.ts`, not `.tsx`, so it's trivially unit-testable) does all the view-range math: `getVisibleDays`
(day → 1 day; workWeek → Mon–Fri; week → Sun–Sat; month → a fixed 42-day/6-week Sunday-start grid,
which sidesteps DST/variable-week-count arithmetic entirely), `shiftAnchor` (prev/next; month
navigation resets to day 1 before shifting months so e.g. Jan 31 + 1 month lands on Feb 1, not an
overflowed March date), and `formatRangeLabel`. Manually sanity-checked this module standalone
(bundled with esbuild, run against a real Date across a DST boundary and a month-end edge case)
before wiring it into the component — full unit tests land in `/test`.

`CalendarView` fetches `calendarItems.list()` once on mount and re-fetches after a create; the
`view`/`anchorMs` state picks which days to render and buckets the already-fetched items into them
client-side (no new IPC needed for filtering) — this is what makes AC3 ("events created in one view
are visible in the others") true by construction rather than needing per-view logic. `anchorMs`
seeds from the simulated clock (`clock.now()`), matching the rest of the app's simulated-time
convention; "Today" and the initial load both use it. Day/Work Week/Week render as day columns;
Month renders as a grid; empty state (zero calendar items at all) still shows the pre-existing
"No calendar items to show." message so the one pre-existing test asserting that text needed no
changes.

Event creation ("New Event" in the ribbon, finally wired — it had been a disabled placeholder since
001) opens an inline form (`CalendarEventForm`, a separate component so remounting it via
conditional rendering is what resets its fields on each open — no reseed-on-open effect needed,
avoiding a `react-hooks/set-state-in-effect` lint violation the first draft hit). Fields are
Title/Description/Start/End (native `datetime-local` inputs, interpreted in the browser's local
timezone); every created item is `itemType: 'event'`, `allDay: false`, `reminderMinutesBefore: null`,
`recurrenceRule: null` — deadlines/all-day/reminders/recurrence are explicitly 019/020 scope, not
this feature's.

Files touched: `calendarDates.ts` (new), `components/CalendarView.tsx` (rewritten),
`components/RibbonBar.tsx` (`onNewEvent` prop wired to the existing `New Event` action, same pattern
as `onNewEmail`), `App.tsx` (`showNewEventForm` state, reset when switching modules), `styles/global.css`
(new calendar-view-nav/day-column/month-grid/event-form rules).

AC1 (reachable from left nav) required no work — the Mail/Calendar module switcher has existed
since 001. Ribbon's `Today`/`Day`/`Work Week`/`Week`/`Month` buttons and `New Meeting` are left as
disabled placeholders (same precedent as Reply/Reply All/Forward staying disabled in the ribbon
after 005 wired equivalent UI elsewhere): view switching lives in `CalendarView`'s own tab header
(already existed as a static mockup from 001, now wired to real state), and "Meeting invite workflow"
is an explicit spec non-goal.

## Test Notes
Added 32 tests on top of the manual esbuild sanity-check done during `/implement` (244 → 276, all
passing; re-ran the full suite 3x, stable).

- `calendarDates.test.ts` (19 tests, new): `startOfDayMs`/`addDaysMs`/`isSameDay`/`startOfWeekMs`
  directly, including a DST-spring-forward day-add and a year-rollover; `getVisibleDays` for all
  four views against known Mon–Sun dates around a fixed Wednesday anchor, plus a month-grid test
  confirming it contains both the 1st and last day of the month, starts on a Sunday, and is in
  strictly increasing order, and a leap-year February case (contains Feb 29); `shiftAnchor` for
  day/week/workWeek plus the month-view edge cases called out in Implementation Notes (Jan 31 + 1
  month lands on Feb, not an overflowed March date; both directions across a year boundary);
  `formatRangeLabel` content checks for all four views.
- `CalendarView.test.tsx` (9 tests, new): confirms the component actually calls
  `calendarItems.list()` on mount (AC4 — proves the UI reads the persisted store rather than any
  local/hardcoded data, so persistence at the DB layer — already covered by `db.test.ts`'s
  close/reopen test from feature 002 — genuinely reaches the screen); the empty state; switching
  between all four view tabs updates `aria-selected` correctly (AC2); Previous/Next change the
  displayed range; **the core AC3 test** — creating an event via the form makes it appear in Day
  view, and it's still visible after switching to Week and then Month without any extra fetch;
  Cancel makes no create call; a blank title shows the validation error and leaves the form open;
  reopening the form after a cancel starts with empty fields again (locks in the
  remount-resets-state design from Implementation Notes); an event outside the viewed day does not
  leak into Day view (the negative case for AC3's bucketing).
- `RibbonBar.test.tsx` (+3 tests): New Event stays disabled with no handler, enables and fires
  `onNewEvent` with one (mirrors the existing Delete coverage), and Today/Day/Work
  Week/Week/Month/New Meeting all stay disabled placeholders (locks in the "view-switching lives in
  CalendarView's own tabs, not the ribbon" decision from Implementation Notes).
- `App.test.tsx` (+1 test): the ribbon's New Event button actually opens `CalendarView`'s dialog
  end-to-end, and switching modules away and back closes it (via the `showNewEventForm` reset in
  `handleSelectModule`).

Deliberately not covered: AC1 (calendar reachable from left nav) has no new test — it's unchanged
since feature 001 and already covered by pre-existing `App.test.tsx` module-switch tests. AC4's
actual "survives a real app restart" is not re-tested at the UI layer (that would need a real
Electron process); it rests on the pre-existing `db.test.ts` DB-level persistence test plus this
stage's new proof that the UI genuinely reads through `window.api.data.calendarItems.list()`. No
live Electron GUI click-through attempted — no Xvfb in this sandbox, same non-blocking gap as every
prior feature, deferred to `/validate`. `datetime-local` input editing (typing a custom start/end
time) isn't exercised via `userEvent` — jsdom's handling of segmented native date/time inputs is
unreliable for scripted typing, so tests rely on the form's own sane default (anchor time) instead,
which already exercises the underlying create path fully.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
