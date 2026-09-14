---
id: 028
title: Trainee identity & personas — org-structure fields
status: backlog
priority: medium
---

## Description
Trainee Identity in Settings gains "Reports to" and "Department" fields;
the Persona create/edit form gains a "Reports to" field. Together these let
the configured cast express a real corporate reporting structure, not just
a flat contact list.

## Acceptance Criteria
- [ ] Trainee Identity form has Reports To and Department fields, saved and
      loaded alongside the existing identity fields
- [ ] Persona create/edit form has a Reports To field (free text, since a
      persona may report to someone outside the configured persona list),
      saved and loaded alongside existing persona fields
- [ ] Both new fields are optional (empty is valid) and persist across
      restarts
- [ ] Existing trainee identity / persona data saved before this feature
      (missing these fields) loads without error, defaulting them to empty

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
