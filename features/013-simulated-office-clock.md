---
id: 013
title: Simulated office clock
status: backlog
priority: high
---

## Description
A simulated clock with start/pause/speed controls drives message timestamps
and reminder firing, decoupled from wall-clock time, so multi-day scenarios
can run in one sitting.

## Acceptance Criteria
- [ ] UI exposes clock controls: start, pause, and a speed multiplier
- [ ] Current simulated time is visible somewhere in the shell
- [ ] New message timestamps and reminder firing use simulated time, not
      system wall-clock time
- [ ] Pausing the clock freezes simulated time; resuming continues from
      where it left off
- [ ] Simulated time persists across restarts (does not reset to
      wall-clock time on relaunch)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
