---
id: 053
title: Ribbon — Home tab: remove dead placeholder buttons
status: backlog
priority: low
---

## Description
Remove the Home tab's always-disabled placeholder action buttons ("New
Items", "Reply", "Reply All", "Forward" — none have a wired handler) so
only "New Email" and "Delete" remain. Same treatment as feature 033's
removal of the Send/Receive and Folder ribbon tabs: hide dead UI entirely
rather than show it permanently disabled.

## Acceptance Criteria
- [ ] The Home tab's action row no longer renders "New Items", "Reply",
      "Reply All", or "Forward" buttons
- [ ] "New Email" and "Delete" remain, wired exactly as before
- [ ] Calendar module's ribbon actions ("New Event") and the View tab's
      actions (Tasks, Reading Pane) are unaffected

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
