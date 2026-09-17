---
id: 051
title: Settings — Persona editor's Client checkbox left-aligned
status: backlog
priority: low
---

## Description
The persona editor's "Client" (`isClient`) checkbox is visually misaligned —
it inherits the same `flex: 1 1 auto` sizing `.settings-field-row` applies
to text inputs, so it drifts instead of sitting immediately left-aligned
after its label. Left-align it, mirroring the fix already applied to the
calendar event form's own All-day checkbox.

## Acceptance Criteria
- [ ] The Client checkbox row uses a fixed, left-aligned layout (the
      checkbox sits immediately after its label, not stretched/drifted)
- [ ] The fix mirrors `.calendar-event-form-row-checkbox`'s existing
      pattern: `justify-content: flex-start` on the row, explicit
      `flex: 0 0 auto` and a fixed width/height on the checkbox itself
- [ ] No other persona editor field's layout changes
- [ ] Checking/unchecking still updates `form.isClient` exactly as before

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
