---
id: 051
title: Settings — Persona editor's Client checkbox left-aligned
status: testing
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
Mirrors `.calendar-event-form-row-checkbox`'s existing pattern exactly
(same modifier-class approach used for the calendar event form's All-day
checkbox): `PersonasSettings.tsx`'s Client row gained a second class,
`settings-field-row settings-field-row-checkbox`, alongside the existing
inputs/textareas' plain `settings-field-row`. New CSS in `global.css`:

```css
.settings-field-row-checkbox {
  justify-content: flex-start;
}

.settings-field-row-checkbox input[type='checkbox'] {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: none;
  cursor: pointer;
}
```

`justify-content: flex-start` stops the row's flex layout from stretching
the checkbox to fill the remaining space (the actual cause of the drift —
`.settings-field-row select, .settings-field-row input` sets
`flex: 1 1 auto` on every input, checkboxes included, so the browser
expanded/repositioned it); the checkbox's own `flex: 0 0 auto` plus a
fixed 18×18 size then keeps it pinned immediately after its label, exactly
mirroring the calendar form's fix (AC1/AC2).

Only the Client row's `<div>` gained the modifier class — every other
persona editor field (`settings-field-row` alone) is untouched, and the
base `.settings-field-row`/`.settings-field-row label`/`.settings-field-row
select, .settings-field-row input` rules weren't edited, only a new
modifier-scoped rule added (AC3). No JS logic touched —
`onChange={(event) => setForm((prev) => ({ ...prev, isClient:
event.target.checked }))}` is unchanged (AC4).

lint/typecheck/build pass; full suite unchanged at 838/838 (existing
`PersonasSettings.test.tsx` — all 33 tests, including the ones asserting
`form.isClient` toggling and persistence — pass unmodified, since they
query by label/role/checked state, not CSS classes). Rendered visual
alignment itself isn't independently verifiable here (no attached display,
jsdom doesn't load the stylesheet) — same non-blocking gap as every prior
pure-CSS feature in this project.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
