---
id: 041
title: Double-click message opens a pop-out reading window
status: backlog
priority: medium
---

## Description
Double-clicking a message in the list opens it in its own separate
Electron window (mirroring the existing compose pop-out pattern from
feature 004), showing the same content as the inline Reading Pane.

## Acceptance Criteria
- [ ] Double-clicking a message opens a new window showing that message's
      full content
- [ ] The pop-out window reflects live state (e.g. read/flag/category
      changes made elsewhere), consistent with the app's existing
      cross-window refresh pattern
- [ ] Closing the pop-out window doesn't affect the main window's
      selection/state
- [ ] Works whether the inline Reading Pane is currently "Right" or "Off"
      (feature 042)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
