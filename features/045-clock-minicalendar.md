---
id: 045
title: Simulated clock — black text and dropdown mini-calendar
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
