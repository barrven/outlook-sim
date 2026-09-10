---
id: 022
title: Scenario pack save
status: backlog
priority: medium
---

## Description
Trainee can save the current mailbox/calendar/persona state out to a JSON
scenario pack file for reuse or sharing.

## Acceptance Criteria
- [ ] User can trigger "save scenario pack" and choose a destination
      filename
- [ ] Saved pack includes current inbox contents, personas/contacts, and
      calendar deadlines in the same schema 021 can load
- [ ] A saved-then-reloaded pack round-trips without data loss
- [ ] Save action does not include any API keys or other Settings secrets
      in the pack file

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
