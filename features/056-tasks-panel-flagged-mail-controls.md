---
id: 056
title: Tasks panel — unflag and pop-out controls on Flagged Mail rows
status: backlog
priority: low
---

## Description
Each row in the Tasks panel's Flagged Mail list is currently just static
subject text with no controls at all. Add an unflag control per row, and a
double-click handler that opens the message in its pop-out reading window
— the same as double-clicking it in the main message list.

## Acceptance Criteria
- [ ] Each Flagged Mail row has a control to unflag that message directly,
      without navigating to the message list or Reading Pane
- [ ] Unflagging from this list updates the message's `isFlagged` state via
      the real data API, and the row disappears from the list (no longer
      flagged)
- [ ] Double-clicking a Flagged Mail row opens that message in its own
      pop-out reading window (`window.api.messagePopout.open`), the same
      as double-clicking it in the message list
- [ ] The unflag control and the double-click handler don't interfere with
      each other (clicking the unflag control doesn't also trigger the
      pop-out)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
