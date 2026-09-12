---
id: 018
title: Calendar views & persistence
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
