---
id: 018
title: Calendar views & persistence
status: done
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
lint/typecheck/build all pass. Full test suite (276/276) re-run 3x, stable. Confirmed via
`git diff 4953571 491a7f1 --stat` that the `/test` stage touched only test files plus docs
(`STATE.md`/`BACKLOG.md`/feature file) — no implementation drift between `/implement` and `/test`.

Acceptance criteria:
- **AC1** (calendar module reachable from left navigation) — PASS. Unchanged since feature 001;
  `App.tsx` renders `CalendarView` when `activeModule === 'calendar'`, reached via the existing
  `NavSwitcher` Mail/Calendar tabs — confirmed by pre-existing `App.test.tsx` module-switch tests
  plus direct code inspection (`App.tsx:10,181`).
- **AC2** (switch between day/work-week/week/month) — PASS. `calendarDates.ts:getVisibleDays`
  verified correct for all four views via 19 direct unit tests (Mon–Fri, Sun–Sat, a 42-day
  Sunday-start month grid, DST and leap-year edge cases) and `CalendarView.test.tsx` confirms the
  tab clicks actually flip `aria-selected`/render the right body.
- **AC3** (events created in one view are visible in the others) — PASS. Verified by direct code
  read (`CalendarView.tsx` fetches the full item list once and buckets by `isSameDay` per rendered
  day/cell — no per-view filtering logic to get out of sync) plus `CalendarView.test.tsx`'s core
  test: create via the form → visible in Day view → still visible after switching to Week and Month
  with no re-fetch, and a negative case proving an out-of-range event does *not* leak into Day view.
- **AC4** (calendar data persists across restarts) — PASS. Re-verified at the DB layer with a live
  check beyond the mocked Vitest environment: bundled `db.ts` standalone with `esbuild` and ran it
  against a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db` (3 real calendar
  items already present) — created a new item using the exact shape `CalendarEventForm` sends
  (`itemType:'event'`, `allDay:false`, `reminderMinutesBefore:null`, `recurrenceRule:null`), closed
  and reopened the DB, and got back an identical item (`JSON.stringify` equality) with the total
  count correctly at 4; cleaned it up afterward (count back to 3) and confirmed the real on-disk
  file was left byte-for-byte unmodified (mtime unchanged). Combined with `CalendarView.test.tsx`'s
  proof that the UI genuinely calls `calendarItems.list()` (not local/hardcoded state), this shows
  persistence actually reaches the screen, not just the DB layer in isolation.

Non-blocking gaps, consistent with every prior feature: no live multi-window Electron GUI
click-through (no Xvfb in this sandbox) — the real `datetime-local` input widget and a genuine
app-restart round trip through the running UI are unverified, deferred to the user's own check at
`/accept`. `New Meeting` and the ribbon's `Today`/`Day`/`Work Week`/`Week`/`Month` buttons remain
disabled placeholders by design (view switching lives in `CalendarView`'s own tabs; meeting
invite workflow is an explicit spec non-goal) — confirmed these are deliberate via direct code
inspection of `RibbonBar.tsx`'s `actionHandlers` map, not an oversight.

**Accept-stage bug fixed (found by the user live in the running app, after this validation passed):**
"today" highlighting and the "Today" nav button used the real wall clock (`Date.now()`) instead of
the simulated office clock — an inconsistency the initial-load path didn't have (it correctly fetched
`clock.now()`), but two other `Date.now()` call sites did: the `today` state's initializer, and the
Today button's `onClick`. Fixed by routing both through `window.api.data.clock.now()` (`today` is now
`useState` + `setToday`, updated alongside `anchorMs` in the mount effect; the Today button calls a
new `goToToday()` that re-fetches simulated now and updates both). Added 2 regression tests in
`CalendarView.test.tsx` using a simulated date far from the real system date — confirmed both fail
against the pre-fix code (asserting on the real date instead) and pass after the fix. Re-ran
lint/typecheck/build/full suite (278/278, up from 276) — all pass; AC3/AC4 conclusions above are
unaffected (this bug was in the "today" marker and default nav target, not the event-bucketing or
persistence logic those ACs cover). Phase stays `accept`.

**Two more accept-stage UI fixes (same live-check round):**
1. The ribbon's `Today`/`Day`/`Work Week`/`Week`/`Month` buttons were a redundant duplicate of
   `CalendarView`'s own view-tab header (both existed as leftover feature-001 placeholders; only
   one — the real one — should exist). Removed them from `RibbonBar.tsx`'s `CALENDAR_ACTIONS`
   entirely rather than leaving them as disabled placeholders; `New Event`/`New Meeting` stay.
   Updated `RibbonBar.test.tsx` accordingly (one test now asserts these buttons are *absent*, not
   disabled).
2. `.calendar-view-tab`'s unselected state used `color: var(--text-muted)` — a leftover from when
   these were static, non-functional mockup text from feature 001 — which made real, clickable tabs
   read as disabled. Changed to `var(--text)` (matching the `.nav-switcher-item` convention for
   real, always-enabled tab controls) plus `cursor: pointer`; the `.active` tab's highlighted style
   is unchanged.
Re-ran lint/typecheck/build/full suite (279/279) — all pass. Phase stays `accept`.

**Third accept-stage UI fix (same round):** user asked what distinguishes a Meeting from an Event
(a Meeting adds attendees who get invited and can accept/tentative/decline — explicitly a v1
non-goal per `docs/SPEC.md`'s "Meeting invite workflow... and RSVP") and asked to hide the ribbon's
"New Meeting" button until that's actually built, rather than leave a dead button that can never be
wired. Removed it from `RibbonBar.tsx`'s `CALENDAR_ACTIONS` (now just `['New Event']`); updated the
corresponding `RibbonBar.test.tsx` test to assert it's absent rather than disabled. Re-ran
lint/typecheck/build/full suite (279/279) — all pass. Phase stays `accept`.

## Acceptance Log
2026-09-11 — User found and reported 3 live issues during this accept round before formally
accepting: (1) the calendar's "today" used the real wall-clock date instead of the simulated clock's
date; (2) the ribbon duplicated the Today/Day/Work Week/Week/Month view-switch buttons already in
CalendarView's own tab header, and those tabs' inactive styling made them look disabled; (3) the
ribbon's "New Meeting" button did nothing and should be hidden until meeting/RSVP support (an
explicit v1 spec non-goal) is actually built. All three were fixed and verified (regression tests
added for the clock bug) before this gate. User then accepted via `/accept` (AskUserQuestion:
"Accept"), no further changes requested. Decision: **accepted**.
