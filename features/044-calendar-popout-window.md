---
id: 044
title: Double-click calendar item opens a pop-out window
status: backlog
priority: low
---

## Description
Double-clicking a calendar item opens it in its own separate Electron
window (same pop-out pattern as compose/mail), instead of the inline
view/edit panel from feature 043.

## Acceptance Criteria
- [ ] Double-clicking a calendar item opens a new window showing that item
      (view mode by default, with the same edit affordance as the inline
      panel)
- [ ] Editing/deleting from the pop-out window updates the main window's
      calendar view live, consistent with the app's existing cross-window
      refresh pattern
- [ ] Closing the pop-out doesn't affect the main window's calendar state
- [ ] Single-click inline behavior (feature 043) is unaffected —
      double-click is purely additive

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
