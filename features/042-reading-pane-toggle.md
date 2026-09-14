---
id: 042
title: View tab — Reading Pane Right/Off toggle
status: backlog
priority: low
---

## Description
The View ribbon tab gets a control to toggle the inline Reading Pane
between "Right" (today's default, inline pane) and "Off" (no inline pane —
messages are read via the double-click pop-out from feature 041).

## Acceptance Criteria
- [ ] View tab has a Reading Pane control with Right/Off options
- [ ] Selecting Off removes the inline Reading Pane from the layout (the
      message list uses the freed space; no dead blank panel)
- [ ] With Off selected, single-clicking a message no longer opens it
      inline; double-click still pops it out (feature 041)
- [ ] The setting persists across restarts, or at minimum for the current
      session — state which was chosen in Implementation Notes

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
