---
id: 052
title: Settings — spacing between Scenario Pack Load and Save sections
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
