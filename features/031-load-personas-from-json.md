---
id: 031
title: Settings — load personas from a JSON file
status: backlog
priority: medium
---

## Description
Settings' Personas section gains a "Load Personas…" button that imports a
persona list from a standalone JSON file (its own schema, distinct from a
full scenario pack), replacing the current persona list.

## Acceptance Criteria
- [ ] "Load Personas…" button opens a native file picker
- [ ] Selecting a valid personas JSON file replaces the current persona
      list with its contents
- [ ] Selecting an invalid/corrupted file shows a specific, readable error
      instead of crashing or silently doing nothing
- [ ] Loading personas this way does not touch mailbox, calendar, or system
      prompt — scope stays personas-only, unlike a full scenario pack load
- [ ] Imported personas persist across restarts like manually-entered ones

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
