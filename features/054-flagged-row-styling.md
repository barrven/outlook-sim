---
id: 054
title: Mail message list — flagged-row styling
status: backlog
priority: low
---

## Description
Make the flag icon in the message list larger, and give a flagged
message's row a distinct background highlight — slightly different from
an unflagged row's — so flagged mail stands out at a glance, not just via
the flag icon's own red color.

## Acceptance Criteria
- [ ] The flag icon in the message list renders visibly larger than its
      current size
- [ ] A flagged message's row has a distinct background highlight
      (different from an unflagged row's default) when not selected
- [ ] Selecting a flagged row still shows the existing `.selected`
      highlight sensibly alongside/instead of the flagged highlight
      (decide and document the exact precedence in Implementation Notes)
- [ ] Flagging/unflagging a message immediately adds/removes the row
      highlight

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
