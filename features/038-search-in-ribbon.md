---
id: 038
title: Move mail search into the ribbon
status: testing
priority: low
---

## Description
The mail search box moves from the message-list header into the ribbon
itself, positioned between the View tab and the simulated-clock display.

## Acceptance Criteria
- [ ] Search box no longer renders in the message-list header
- [ ] Search box renders in the ribbon, positioned between the View tab and
      the clock display
- [ ] All existing search behavior (live filter, folder/all-folders scope,
      clearing) is unchanged
- [ ] Search is visible/usable regardless of which mail folder or view is
      active, same as before — just relocated

## Implementation Notes
Search state (`searchQuery`, `searchScope`) lived entirely inside
`MessageListPane` before this feature. Since the UI needs to render in
`RibbonBar` (a sibling, rendered above it) while the actual filtering
still has to happen against the message list, the state moved up to
`App.tsx`, the nearest common ancestor:

- `App.tsx`: new `searchQuery`/`searchScope` state and a
  `showMailSearch` boolean computed as `activeModule === 'mail' &&
  !showFileVine && !showSettings` — exactly the same condition that used
  to gate whether `MessageListPane` (and therefore its search box)
  rendered at all, so visibility is unchanged (AC4). Both pieces of state
  and the visibility flag are passed to `RibbonBar` (with change
  handlers) and to `MessageListPane` (read-only, for filtering).
- `RibbonBar.tsx`: renders the search `<input>`/`<select>` (identical
  markup/labels to before: `aria-label="Search mail"`/`"Search scope"`,
  same two scope options) inside `.ribbon-tabs`, between the tab strip and
  `<OfficeClock />` — `.ribbon-tabs`'s existing `justify-content:
  space-between` naturally spaces the three apart without any layout
  change to the tabs or clock themselves.
- `MessageListPane.tsx`: `searchQuery`/`searchScope` are now props, not
  local state; the search `<input>`/`<select>` JSX (and its wrapping
  `.message-list-search` div) is gone. The filtering pipeline itself
  (`query`, `matchesQuery`, `searchedMessages`, the folder-vs-all-folders
  `allMessages` fetch effect) is untouched — same logic, now reading from
  props instead of local state (AC3: unchanged behavior).
- `global.css`: removed the now-dead `.message-list-search` rules, added
  `.ribbon-search` (input/select styled to sit inline in the ribbon's tab
  row rather than the message-list header's full-width row).

**Side effect worth flagging:** search text used to live inside
`MessageListPane`, which fully unmounts (and so resets its state) when
FileVine or Settings is opened. Now that the state lives in `App.tsx`
instead, a search typed before opening FileVine/Settings will still be
there when you come back, rather than being silently cleared. No test
locked in the old reset-on-unmount behavior, and AC3 only requires
"clearing" (the manual clear action) still works, so this reads as a
minor, reasonable side effect of the relocation rather than a regression
— flagging it for `/retro`'s awareness rather than treating it as a gap.

**Pre-existing test fallout (expected, per this repo's convention):**
`MessageListPane.test.tsx`'s and `RibbonBar.test.tsx`'s shared
`defaultProps`/`tabProps` helpers needed the two new required props added
(a pure compile-shape fix, no behavior change — done here, matching
feature 040's precedent for this exact kind of touch-up) which fixed all
but 7 tests. Those remaining 7 in `MessageListPane.test.tsx` type
directly into `screen.getByLabelText('Search mail')` on a standalone
`MessageListPane` render — they test the *old* architecture (the input
living inside this component) and need a real rewrite (driving search via
props, or moving to an `App`/integration-level test) rather than a
mechanical fix, so left for `/test`. Verified live: a throwaway
full-`<App />` RTL check confirmed the search box now renders inside the
ribbon between the tab strip and the clock (DOM order), still filters
live, still supports folder/all-folders scope, survives a folder switch,
and disappears behind Settings — matching all 4 ACs end-to-end.
lint/typecheck/build pass.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
