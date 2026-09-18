---
id: 051
title: Settings — Persona editor's Client checkbox left-aligned
status: done
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
838 → 841 net (+3, all passing; re-run 3x, stable), all in the existing
`PersonasSettings.test.tsx`'s new "051" block. Pre-existing 33 tests
(unmodified) confirm no regression.

New tests: AC1/AC2 — the Client row (found by walking up from the
checkbox's own label to its `.settings-field-row` ancestor) carries both
`settings-field-row` and the new `settings-field-row-checkbox` modifier
class. AC3 — every other persona editor field's row (all 7: Display Name,
Email, Role, Reports To, Bio, Writing Style, Extra Prompt) does *not*
carry the modifier class, confirming the fix is scoped to Client alone.
AC4 — checking the box, saving, and confirming `personas.set` is called
with `isClient: true` in the persisted payload (the same
Edit→toggle→Save flow the pre-existing "creates a persona marked as a
client" and "Edit prefills..." tests already exercise from other angles,
now asserted directly against the toggle-and-persist path specifically).

Deliberately uncovered: the actual rendered visual alignment (no attached
display, jsdom doesn't load the stylesheet — same non-blocking gap as
every prior pure-CSS feature, including the calendar form's own All-day
checkbox fix this one mirrors, which likewise has no dedicated test).
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build pass; full suite (841/841) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (87c9cfb..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files; no new dependency
added.

All 4 ACs re-verified directly against current source:

- **AC1** (fixed, left-aligned layout): `.settings-field-row-checkbox`
  sets `justify-content: flex-start` on the row and `flex: 0 0 auto` +
  fixed `18px × 18px` on the checkbox itself, overriding the
  `flex: 1 1 auto` every other `.settings-field-row input` gets — the
  documented root cause of the drift.
- **AC2** (mirrors the calendar form's exact pattern): diffed
  `.calendar-event-form-row-checkbox` and its new
  `.settings-field-row-checkbox` counterpart directly in `global.css` —
  the rule bodies are byte-for-byte identical (same properties, same
  values, same selector shape), only the class name differs.
- **AC3** (no other field's layout changes): grepped every
  `settings-field-row` usage in `PersonasSettings.tsx` — only the Client
  row carries the new modifier class; the base `.settings-field-row`/
  `.settings-field-row label`/`.settings-field-row select, .settings-
  field-row input` rules in `global.css` are untouched by this diff.
- **AC4** (behavior unchanged): the Client `<input>`'s `onChange` handler
  is unchanged from before this feature (`git diff` shows only the
  `className` attribute on its wrapping `<div>` changed); the new AC4 test
  confirms toggling and Save still persists `isClient: true`.

Not independently re-verified: the actual rendered visual alignment (no
attached display, jsdom doesn't load the stylesheet) — same non-blocking
gap as every prior pure-CSS feature in this project, including the
calendar form's own All-day fix this one mirrors. All checks pass, no
blocking gaps found.

## Acceptance Log
2026-09-18 — user selected "Accept (Recommended)" against the validation
summary and AC-by-AC mapping, no changes requested. Decision: accepted.
