---
id: 005
title: Mail reply, reply all & forward
status: backlog
priority: high
---

## Description
From the reading pane, trainee can reply, reply all, or forward the selected
message, with the compose window pre-filled accordingly (recipients,
subject prefix, quoted body).

## Acceptance Criteria
- [ ] Reply pre-fills To with the original sender and quotes the original
      body
- [ ] Reply All pre-fills To with sender + all original recipients
- [ ] Forward clears To, keeps quoted body, and allows picking new
      recipients
- [ ] All three mock-send into Sent the same way as a new compose
- [ ] Subject is prefixed appropriately (Re:/Fwd:) without duplicating
      prefixes on repeated replies

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
