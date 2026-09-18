---
id: 052
title: Settings — spacing between Scenario Pack Load and Save sections
status: accept
priority: low
---

## Description
Add visual spacing between the Load and Save subsections of Settings'
Scenario Pack section. Today they sit back-to-back inside the same
`.settings-section-body` with no separator, so the two distinct actions
(and their own status/error messages) read as one block.

## Acceptance Criteria
- [ ] Visible spacing/separation exists between the Load subsection and the
      Save subsection within the Scenario Pack settings section
- [ ] Load and Save actions, status messages, and error messages still
      function identically to today
- [ ] No other Settings section's spacing changes

## Implementation Notes
Scoped to `SettingsView.tsx`'s "Scenario Pack" section + one small CSS
addition. The Save subsection's note/actions/error block (previously three
sibling elements sitting directly after the Load subsection's own error
paragraph, inside the same `.settings-section-body`) is now wrapped in a
`<div className="scenario-pack-save-section">`. New CSS gives that
wrapper `margin-top: 16px; padding-top: 16px; border-top: 1px solid
var(--border);` — a visible divider line plus spacing above it, the same
divider convention `.persona-editor` already uses elsewhere in this file
(AC1).

The Load subsection's own markup (note, "Load Scenario Pack…" button,
status, error) is completely untouched — only wrapped-around, nothing
inside it moved or changed. `handleLoadScenarioPack`/
`handleSaveScenarioPack` and every state variable they touch
(`scenarioStatus`/`scenarioError`/`savePackStatus`/`savePackError`) are
unchanged — this is a markup/CSS-only change (AC2). The new
`.scenario-pack-save-section` class and rule are scoped to this one
wrapper; no other Settings section's JSX or CSS was touched (AC3).

Verified live via a throwaway RTL script (not committed): the Save
subsection's note is found inside a `.scenario-pack-save-section`
descendant of the "Scenario Pack" region, while the Load subsection's note
is confirmed NOT inside that wrapper; exactly one
`.scenario-pack-save-section` element exists in the whole rendered
Settings view (no other section picked it up). lint/typecheck/build pass;
full suite unchanged at 841/841 (existing `SettingsView.test.tsx`'s 48
Scenario Pack/other-section tests pass unmodified — they query by
label/role/text within `scenarioPackSection()`, not DOM structure; new
structural coverage is `/test`'s job).

## Test Notes
841 → 846 net (+5, all passing; re-run 3x, stable), all in the existing
`SettingsView.test.tsx`'s "Scenario Pack" describe block. Pre-existing 48
tests (unmodified) confirm no regression.

New tests: AC1 — the Save subsection's note is found inside a
`.scenario-pack-save-section` element that's a descendant of the
"Scenario Pack" region, while the Load subsection's note is confirmed NOT
inside that wrapper (proves it's a genuine sub-boundary, not just a class
on an unrelated ancestor); a second test confirms the Save button itself
is inside the wrapper too. AC2 — both Load and Save exercised end-to-end
through the new markup: Load still applies a pack with no confirmation
and shows its "...loaded" status; Save still calls the save IPC and shows
both its success status (with the real file path interpolated) and, on a
second click with a failing mock, its error message — the exact same
`handleLoadScenarioPack`/`handleSaveScenarioPack` flows as before, now
just rendered inside the new wrapper. AC3 — exactly one
`.scenario-pack-save-section` element exists anywhere in the rendered
Settings view (no other section picked up the new class).

Deliberately uncovered: the actual rendered visual spacing/divider
appearance (no attached display — same non-blocking gap as every prior
CSS-touching feature). lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build pass; full suite (846/846) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (2e33bfe..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files; no new dependency
added.

All 3 ACs re-verified directly against current source:

- **AC1** (visible spacing/separation): `.scenario-pack-save-section`
  gives the Save subsection a 16px top margin/padding plus a 1px
  `border-top` divider, mirroring `.persona-editor`'s existing divider
  convention elsewhere in the same stylesheet.
- **AC2** (Load/Save behavior unchanged): `git diff` on
  `SettingsView.tsx` shows the entire change is a wrap — the Save
  subsection's three existing elements (note, actions, error) moved
  inside a new `<div>`, with zero lines touched inside
  `handleLoadScenarioPack`/`handleSaveScenarioPack` or any state variable
  they use.
- **AC3** (no other section's spacing changes): grepped for
  `scenario-pack-save-section` across both `SettingsView.tsx` and
  `global.css` — exactly one JSX usage and one CSS rule, both scoped to
  this subsection; every other `.settings-field-row`/`.settings-view-*`
  rule is untouched.

Not independently re-verified: the actual rendered visual spacing/divider
appearance (no attached display — same non-blocking gap as every prior
CSS-touching feature). All checks pass, no blocking gaps found.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
