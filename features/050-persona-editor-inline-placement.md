---
id: 050
title: Settings — Persona editor opens inline under the edited persona
status: validating
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
Scoped entirely to `PersonasSettings.tsx` + one small CSS addition. The
editor form's JSX was pulled out into a single `editorForm` local variable
(a plain JSX value, not a nested component function, so its inputs keep
normal DOM identity wherever it's placed) so the exact same markup can
render in two positions without duplication:
- **Editing an existing persona (AC1):** the `personas.map()` loop now
  returns a `<Fragment key={persona.id}>` containing the persona's own
  `<li>` row, immediately followed by a second `<li className=
  "persona-editor-row">{editorForm}</li>` when `editingId === persona.id`
  — directly under that row, not below the whole list.
- **Creating a new persona (AC3, unaffected):** the "below the whole list"
  slot keeps rendering `editorForm` exactly as before when `creating` is
  true — same position, same behavior, untouched logic.
- **AC2 (only one editor open at a time):** falls out of `editingId`
  already being a single value (unchanged state shape) — clicking a
  different persona's Edit just moves which `<li>` the (only) open form
  renders under; no new guard needed.
- The "below list" branch that previously matched on `isEditorOpen` (which
  covered *both* creating and editing) now checks `creating` first, then
  explicitly `editingId !== null ? null : ...` before falling through to
  the generated-personas review / +New Persona+Load Personas buttons —
  needed so those don't reappear underneath the list while an inline edit
  is in progress (matches the prior mutual-exclusion behavior, just
  re-expressed since `isEditorOpen` alone no longer picks the right
  branch on its own).
- **AC4 (Save/Cancel/Delete unchanged):** `handleSubmit`/`closeEditor`/
  `handleDelete` are untouched — this is a placement-only change.

New CSS: `.persona-editor-row` (minimal padding, matching
`.persona-list-item`'s vertical rhythm) for the `<li>` wrapping the inline
form; `.persona-editor`'s existing top border still provides the visual
divider from the row above it, wherever it's placed.

Verified live via a throwaway RTL script (not committed): with two
personas, clicking the first's Edit places `.persona-editor-row`
immediately after that persona's own `.persona-list-item` in the DOM
(confirmed by inspecting `.persona-list`'s actual child order); clicking
the second persona's Edit while the first's editor is open closes/replaces
it (exactly one `Display Name` field in the document, showing the second
persona's data); "+ New Persona" still renders its form below the whole
list, outside `.persona-list`; and Save from the inline editor calls
`personas.set` with the same payload shape as before. lint/typecheck/build
pass; full suite unchanged at 833/833 (existing `PersonasSettings.test.tsx`
suite — 28 tests — passes unmodified, since it queries by label/role, not
DOM position; new position-specific coverage is `/test`'s job).

## Test Notes
833 → 838 net (+5, all passing; re-run 3x, stable), all in the existing
`PersonasSettings.test.tsx`'s new "050" block. The pre-existing 28 tests
(querying by label/role, not DOM position) pass unmodified, confirming no
behavior regression.

New tests: AC1 — with two personas, clicking the first's Edit places the
editor's `<li>` immediately after that persona's own row and strictly
before the next persona's row (asserted on `.persona-list`'s actual DOM
child order, not just "the field exists somewhere"); a second test
confirms editing the *second* persona in the list places it under that
row specifically, not the first (guards against an off-by-one/always-
first-position bug). AC2 — opening a second persona's editor while the
first's is still open leaves exactly one `Display Name` field in the
document, showing the second persona's data (replace, not stack). AC3 —
"+ New Persona" still opens its form below the whole list, outside
`.persona-list` entirely (queried by checking the list element itself has
no `#persona-display-name` descendant). One supporting test locks in that
the create button and the inline edit form remain mutually exclusive, same
as before this feature (only one editor surface at a time, whichever form
it takes).

AC4 (Save/Cancel/Delete unchanged) has no new tests — the pre-existing
"Edit prefills..."/"Cancel closes.../"Delete removes..." tests already
cover that behavior and continue to pass unmodified against the new
placement, which is itself the evidence nothing behavioral changed there.

Deliberately uncovered: the actual rendered visual spacing/border
appearance around the inline editor row (no attached display, same
non-blocking category as every prior CSS-touching feature). lint/
typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
