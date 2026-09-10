---
id: 016
title: LLM unsolicited incoming mail scheduler
status: backlog
priority: high
---

## Description
Independent of trainee action, the app periodically generates unsolicited
incoming mail (status updates, demands, reminders, new requests) driven by
the system prompt, personas, current mailbox/calendar state, and simulated
time.

## Acceptance Criteria
- [ ] While the simulated clock is running, unsolicited messages arrive in
      Inbox at a reasonable interval (default interval chosen absent spec
      guidance, documented in Implementation Notes)
- [ ] Generated messages come from configured personas and reference
      current mailbox/calendar state coherently (e.g. reference an open
      deadline)
- [ ] No unsolicited mail arrives while the simulated clock is paused
- [ ] Scheduler stops cleanly when the app closes and resumes appropriately
      on relaunch

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
