---
id: 037
title: Element-level styling pass — semantic colors, border-radius, red flags
status: validating
priority: low
---

## Description
Buttons, chips, panels, and other interactive elements get a consistent,
logical color system (e.g. primary/secondary/destructive distinctions) and
a modest border-radius for a more modern feel. The classic-Outlook
ribbon/pane layout and chrome are deliberately left alone. Flag
icons/buttons specifically render in red.

## Acceptance Criteria
- [ ] Buttons/chips/panels across the app use a defined, consistent color
      system (CSS custom properties/tokens), not ad-hoc per-component
      colors
- [ ] Interactive elements have a visible, consistent border-radius (not
      sharp 0px corners)
- [ ] Flag icon/button color is red wherever flags render (Reading Pane
      toggle, message-list row indicator)
- [ ] Overall ribbon/pane layout, sizing, and information density are
      visually unchanged — a regression check, not just a new-styles check

## Implementation Notes
Scoped this to `src/renderer/src/styles/global.css` (colors/radii only) plus
one small JSX change for the flag toggle; no component markup, layout
properties (padding/margin/width/height/flex), or ribbon/pane structure
touched anywhere, per Core Requirement 2's explicit "without restyling the
ribbon/pane structure itself."

**Color tokens (AC1):** `:root` gained `--hover-bg`, `--danger`/
`--danger-bg`/`--danger-border`, `--warning`/`--warning-bg`/
`--warning-border`, `--success`. Every previously ad-hoc hex color in the
stylesheet was replaced with the matching token — including consolidating
3 near-identical existing reds (`#a4262c`, `#d13438`, `#b3261e`, used
inconsistently for the error banner, settings test-result error, and the
calendar event-form error) down to one `--danger` value, and 2 near-
identical yellows (`#fff4ce`/`#fff9e6`) down to one `--warning-bg`. The
repeated literal `#eaeaea` hover background (7 call sites) became
`--hover-bg`. No remaining hardcoded hex color exists outside `:root`
(verified by grep).

**Border-radius (AC2):** added `--radius: 6px` (buttons/inputs/dropdown
panels/cards) and `--radius-pill: 999px` (tag/chip pills — visually
identical to the prior hardcoded `10px`, since chip height already made
`10px` a full pill; `999px` just makes that intent explicit as a token).
Every one of the 39 existing `border-radius` declarations in the file
(2px/3px/10px) was converted to one of these two tokens — a mechanical,
1:1 substitution, so this only *increases* rounding on elements that
already had some (buttons, inputs, chips, dropdown menus, calendar
event/task cards). Elements with no `border-radius` at all were left
untouched: these are exactly the ribbon tabs, nav-switcher tabs, list rows
(folder/message/persona/task/FileVine-tree items), and pane/column
containers — i.e. the ribbon/pane chrome and full-bleed list rows Core
Requirement 2 explicitly protects, plus borderless/backgroundless icon
buttons where a radius wouldn't be visible anyway.

**Flag color (AC3):** `.message-list-flag-btn.flagged` (message-list row
indicator) changed from `var(--accent)` (blue) to `var(--danger)` (red).
The Reading Pane's Flag/Unflag button had no distinct styling for its
flagged state at all before this — added a `flagToggleClassName` in
`ReadingPane.tsx` (`reading-pane-flag-toggle` + `flagged` when
`isFlagged`) and a `.reading-pane-flag-toggle.flagged` rule (`color` and
`border-color: var(--danger)`). Since `MessagePopoutWindow` renders the
same `ReadingPane` component (feature 041), this covers its pop-out flag
button too, with no separate change needed there. The Tasks panel's
"Flagged Mail" list and the context-menu's Flag/Unflag menu item render no
flag icon/glyph and aren't named in the AC, so left untouched.

**AC4 (regression check):** confirmed via `git diff` that no changed line
touches a layout-affecting property (padding, margin, width, height, flex,
gap, position, display) anywhere in the stylesheet — every changed
declaration is either a `color`/`background`/`border-color` value or a
`border-radius` value. Not independently verified via a live GUI
screenshot (no attached display, same class of gap as every prior
feature).

## Test Notes
Added 9 tests (665 → 674, all passing; re-run 3x, stable), across 2 files:

- `src/main/globalCssStyling.test.ts` (+5, AC1/AC2/AC3): reads the real
  `global.css` off disk (same static/structural pattern feature 036's
  `buildIcon.test.ts` used) rather than trying to render it, since jsdom
  in this project's test setup never loads the external stylesheet (an
  established, documented gap — see e.g. feature 046's Test Notes). Checks:
  the new semantic tokens exist in `:root`; **no hardcoded hex color
  exists anywhere outside `:root`** — a direct, mechanical encoding of AC1
  ("not ad-hoc per-component colors") that will fail the moment anyone
  reintroduces one; both radius tokens exist; **every** `border-radius`
  declaration in the file uses `var(--radius)`/`var(--radius-pill)`, never
  a raw pixel value (AC2); and the two flag rules
  (`.message-list-flag-btn.flagged`, `.reading-pane-flag-toggle.flagged`)
  both resolve to `var(--danger)` (AC3). This file lives under `src/main/`
  (not alongside the stylesheet under `src/renderer/`) because
  `tsconfig.web.json` has no Node types for `fs`/`path`/`__dirname` —
  confirmed by trying it there first and getting real typecheck errors,
  not a guess.
- `src/renderer/src/components/ReadingPane.test.tsx` (+4, AC3): the new
  `flagToggleClassName` behavior — an unflagged message renders the
  button with only `reading-pane-flag-toggle`, a flagged one adds the
  `flagged` class — verified separately for all 3 of `ReadingPane`'s
  render branches (default/Inbox-like, Drafts, Deleted Items), since the
  JSX duplicates this button across all 3 and a future edit could update
  only some of them.

Deliberately not covered: actual rendered colors/roundedness in a live
browser (jsdom doesn't load the stylesheet, so no unit test here can
assert computed style — same documented gap as every CSS-only feature in
this project) and AC4's "visually unchanged" claim, which was verified by
inspection during `/implement` (`git diff` shows zero layout-property
changes) rather than by a new test, since there's no meaningful way to
regression-test "a property I didn't touch" beyond that diff read.
lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
