---
id: 039
title: Message list multi-select
status: backlog
priority: medium
---

## Description
The message list supports selecting multiple messages at once via
Ctrl-click (toggle an individual message in/out of selection) and
Shift-click (select a contiguous range).

## Acceptance Criteria
- [ ] Ctrl-click toggles a message's selection without clearing the rest of
      the current selection
- [ ] Shift-click selects the contiguous range between the last-clicked
      message and the shift-clicked one
- [ ] A plain click (no modifier) selects only that one message, clearing
      any prior multi-selection — matches existing single-select behavior
- [ ] The Reading Pane shows the single selected message when exactly one
      is selected, and a sensible neutral state (e.g. "N selected") when
      multiple are selected

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
