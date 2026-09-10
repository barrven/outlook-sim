---
id: 021
title: Scenario pack load
status: backlog
priority: medium
---

## Description
Trainee can load a JSON scenario pack that seeds starting inbox,
contacts/personas, calendar deadlines, and optional timed incoming
messages, replacing the current active state.

## Acceptance Criteria
- [ ] User can pick a scenario pack JSON file from the UI and load it
- [ ] Loading a pack populates Inbox, personas, and calendar deadlines from
      the pack's contents
- [ ] Optional timed incoming messages in the pack are scheduled to arrive
      at their specified simulated times
- [ ] Loading a pack replaces the current active mailbox/calendar state
      (per spec default), with confirmation if it would discard unsaved
      data
- [ ] Malformed/invalid pack JSON is rejected with a clear error, not a
      crash

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
