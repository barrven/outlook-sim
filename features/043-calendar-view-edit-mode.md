---
id: 043
title: Calendar item view-mode and single-open swap
status: backlog
priority: medium
---

## Description
Clicking a calendar item now opens the existing item form in a new
read-only "view" mode rather than straight into edit; an explicit action
switches it to edit mode. Clicking a different calendar item while one is
open closes the current one and opens the newly clicked item instead (never
two open at once).

## Acceptance Criteria
- [ ] Clicking a calendar item opens it in a read-only view (fields visible
      but not editable, no accidental edits from a stray click)
- [ ] An explicit "Edit" action switches that same panel into the existing
      editable form
- [ ] While one item's view/edit panel is open, clicking a different
      calendar item closes the first and opens the second in its place
      (view mode)
- [ ] The create-new-item flow is unaffected — it still opens directly in
      an editable, empty form as before

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
