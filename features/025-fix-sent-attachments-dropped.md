---
id: 025
title: Fix — attachments persist on the Sent Items copy
status: backlog
priority: high
---

## Description
Fixes `BUGS.md` B004. Composing a message with attachments and sending it
now retains those attachments on the Sent Items copy; reopening a sent
message shows the same attachments it was sent with.

## Acceptance Criteria
- [ ] Sending a message with one or more attachments results in the Sent
      Items row having the same `attachments` array as what was submitted
- [ ] Reopening that sent message in the Reading Pane shows the attachments
- [ ] Draft messages with attachments are unaffected (regression check)
- [ ] Reply/Reply All/Forward with attachments on the outgoing message also
      persist correctly to Sent Items

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
