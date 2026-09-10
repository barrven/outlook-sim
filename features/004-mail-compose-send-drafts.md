---
id: 004
title: Mail compose, mock-send & drafts
status: backlog
priority: high
---

## Description
Trainee can compose a new message (To, Subject, Body) addressed to a
persona, mock-send it into the Sent folder, and save in-progress messages to
Drafts.

## Acceptance Criteria
- [ ] Compose window supports To, Subject, and Body fields
- [ ] "To" can be set to any configured persona's email address
- [ ] Sending a message stores it in the Sent folder with a timestamp
- [ ] Saving an unsent compose window stores it in Drafts and can be
      reopened for editing
- [ ] No real network mail transport occurs — sending is purely local
      persistence

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
