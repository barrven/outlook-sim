---
id: 050
title: Settings — Persona editor opens inline under the edited persona
status: backlog
priority: low
---

## Description
Clicking "Edit" on a persona in Settings opens the edit form directly below
that persona's own row in the list, instead of in a single shared editor
rendered below the whole list (today's behavior forces scrolling from the
clicked row down to the editor).

## Acceptance Criteria
- [ ] Clicking "Edit" on any persona renders the edit form immediately
      below that persona's own row in the list, not below the whole list
- [ ] Only one persona's edit form is open at a time; opening a different
      persona's edit form closes/replaces the previously open one
- [ ] Creating a new persona ("+ New Persona") is unaffected by this change
- [ ] Save/Cancel/Delete from the inline editor behave exactly as today —
      this is a placement change only, no behavior change

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
