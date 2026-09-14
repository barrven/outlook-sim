---
id: 026
title: Fix — recurring event reminders fire per occurrence
status: backlog
priority: high
---

## Description
Closes the gap flagged during feature 020. A recurring event/deadline's
reminder now fires for each occurrence that reaches its reminder time (per
the series' Reminder setting), not only once on the series' first
occurrence.

## Acceptance Criteria
- [ ] A recurring event with a reminder fires the reminder banner for its
      2nd/3rd/etc. occurrence, not only the 1st
- [ ] A reminder does not re-fire twice for the same occurrence
- [ ] A per-occurrence exception (feature 020) is respected: a deleted
      occurrence's reminder never fires; an occurrence edited to a new start
      time fires its reminder relative to the new time
- [ ] Non-recurring items' reminder behavior (feature 019) is unaffected

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
