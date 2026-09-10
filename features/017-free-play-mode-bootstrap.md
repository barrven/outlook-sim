---
id: 017
title: Free-play mode bootstrap
status: backlog
priority: medium
---

## Description
Trainee can start a free-play session: current Settings (system prompt,
personas, trainee identity) apply, and the mailbox/calendar starts empty or
lightly seeded, ready for the LLM features to drive activity.

## Acceptance Criteria
- [ ] A "start free-play" action initializes an empty or lightly seeded
      Inbox/Calendar using current Settings
- [ ] Free-play works with zero scenario pack loaded
- [ ] Starting free-play again resets to a fresh empty/lightly-seeded state
      (with confirmation if it would discard existing data)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
