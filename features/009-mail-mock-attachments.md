---
id: 009
title: Mail mock attachments
status: backlog
priority: low
---

## Description
Compose and received messages can carry mock attachments — a filename and
file-type icon/placeholder only, with no real file payload.

## Acceptance Criteria
- [ ] Compose window allows adding one or more mock attachments by
      entering/picking a filename
- [ ] Attachments render in the reading pane as filename + placeholder
      icon, with no real file content behind them
- [ ] Attachments persist with the message across restarts
- [ ] "Opening" a mock attachment does not attempt any real file I/O beyond
      the placeholder

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
