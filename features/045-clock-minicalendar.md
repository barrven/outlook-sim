---
id: 045
title: Simulated clock — black text and dropdown mini-calendar
status: validating
priority: low
---

## Description
The ribbon's simulated-clock display text renders in black; clicking it
opens a dropdown month-view mini-calendar with the current simulated day
highlighted, Previous/Next-month navigation, and clicking any other day
shows how much simulated time remains until that day.

## Acceptance Criteria
- [ ] Clock display text is black (not its previous color)
- [ ] Clicking the clock display opens a dropdown month calendar
- [ ] The current simulated day is visually highlighted in that
      mini-calendar
- [ ] Previous/Next controls navigate the mini-calendar by month without
      affecting the actual simulated clock
- [ ] Clicking a day other than today shows a readout of how much simulated
      time remains until that day (e.g. "in 3 days, 4 hours"), computed
      from the simulated clock's current time, not wall-clock time

## Implementation Notes
Scoped entirely to `OfficeClock.tsx` plus its CSS — no other component
touched.

**AC1 (black text):** `.office-clock-time` previously had no color of its
own, inheriting `.office-clock`'s muted `var(--text-muted)`. Gave it an
explicit `color: var(--text)` (this codebase's near-black), leaving the
container's muted color untouched for anything else in the row.

**AC2 (click opens a dropdown):** the clock display became a `<button>`
(was a `<span>`) styled to look identical to the old plain text (no
button chrome) — semantically correct for something now clickable, and
`screen.findByText(...)` in existing tests matches by content regardless
of element type, so nothing broke. Clicking toggles a
`miniCalendarAnchorMs` state (`null` = closed); mirrors `RibbonBar`'s
file-menu click-outside/Escape-to-close pattern exactly.

**AC3 (today highlighted) / AC4 (Previous/Next don't touch the real
clock):** the mini-calendar reuses `calendarDates.ts`'s existing
`getVisibleDays('month', ...)`/`shiftAnchor('month', ...)`/
`formatRangeLabel('month', ...)` — the same month-grid math
`CalendarView`'s own Month view already uses — rather than writing new
date logic. `miniCalendarAnchorMs` (which month is displayed) is
completely separate state from the real clock; Previous/Next only ever
call `setMiniCalendarAnchorMs`, never any `window.api.data.clock.*`
method. "Today" is highlighted by comparing each grid day against the
*live* simulated time (`computeDisplayTime(state)`, recomputed every
render/tick), not a value frozen at open time.

**AC5 (time-remaining readout):** clicking a day sets `selectedDayMs`;
`formatTimeUntil` diffs that day's start against the live simulated time
and renders `"in N days, M hours"` (or `"... ago"` for a day already
past — not required by the AC's literal example, but a reasonable
extension so a past-day click doesn't show a nonsensical negative
value). No readout renders for today itself (nothing to count down to).

Verified live: a throwaway RTL script confirmed opening the dropdown
shows the correct month with today's cell distinctly classed, navigating
by month changes only the dropdown's own label (the real clock's
displayed time was asserted unchanged, and `clock.pause`/`start`/
`setSpeed` were asserted never called), clicking a future day produces
the correct "in N days, M hours" text via manual date-math cross-check,
and clicking outside closes the dropdown. lint/typecheck/build pass;
full suite unchanged at 705/705 (no existing test asserted on
`.office-clock-time`'s element type or color, so nothing needed
updating).

## Test Notes
705 → 713 net (+8, all passing; re-run 3x, stable), across 2 files:

- `src/main/globalCssStyling.test.ts` (+1, AC1): a static/structural check
  (same pattern feature 037 established) confirming `.office-clock-time`
  sets `color: var(--text)`, since jsdom in this project's test setup
  never loads the external stylesheet, so computed style can't be
  asserted directly.
- `src/renderer/src/components/OfficeClock.test.tsx` (+7, AC2-AC5): opens/
  closes on a repeat click, and via Escape/outside-click (mirroring
  `RibbonBar`'s file-menu test conventions); today's cell carries the
  `today` class; Previous/Next change only the dropdown's own month label
  — explicitly asserting `clock.pause`/`start`/`setSpeed` are never
  called and the real clock's displayed time is unchanged (AC4's
  strongest guarantee); a future-day click shows the exact "in 4 days, 14
  hours" text (hand-verified date math, not just a loose regex); a
  past-day click shows "... ago" instead of a nonsensical negative
  duration; clicking today itself shows no readout at all.

Deliberately not covered: the mini-calendar's own live re-render while
the clock is *running* (i.e. "today" or the readout updating mid-tick) —
not required by any AC, which only specifies static per-click behavior;
and a live GUI screenshot of the black text/dropdown appearance (no
attached display), same non-blocking gap as every prior feature.
lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
