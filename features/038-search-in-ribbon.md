---
id: 038
title: Move mail search into the ribbon
status: validating
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
674 → 681 net (+7, all passing; re-run 3x, stable), across 3 files:

- `MessageListPane.test.tsx`: the 7 pre-existing search tests
  `/implement` left genuinely failing (they typed into an input that no
  longer lives here) were rewritten to drive `searchQuery`/`searchScope`
  as props and `rerender` instead of typing — same behaviors covered
  (case-insensitive subject/body/sender match, folder-vs-all-folders
  scope including the "only fetches all-folders once selected" IPC-call
  assertion, live updates on query change, clearing, the no-results vs.
  empty-folder distinction, combining with the category filter), just
  driven the way the component is actually invoked now (AC3, no
  behavioral fallout — same filtering logic, only the trigger mechanism
  changed). Added one new test (+1): AC1, `MessageListPane` renders no
  `Search mail`/`Search scope` controls of its own.
- `RibbonBar.test.tsx` (+2, AC1/AC2/AC3): the search box only renders
  when `showMailSearch` is true; when it does, it sits between the tab
  strip (`role="tablist"`) and `OfficeClock` in DOM order within
  `.ribbon-tabs` (checked via child-index comparison, not just "both are
  present"); reflects the current `searchQuery`/`searchScope` prop values
  and reports changes via the two callbacks.
- `App.test.tsx` (+4, AC1/AC2/AC4): this is where the real regression
  risk lives — `showMailSearch`'s formula in `App.tsx` — so these are
  full-`<App/>` integration tests: no search input inside the
  message-list header's own DOM subtree (AC1); present for the default
  Inbox view and survives a real folder switch to Drafts (AC2/AC4);
  hidden behind Settings and while FileVine is open, reappearing on
  return to Home — matching exactly where the search box used to
  disappear before this feature (AC4); and unaffected by the View
  tab/Tasks panel toggle, confirming the visibility formula is
  independent of that orthogonal state (AC4).

Deliberately not covered: the flagged side effect from Implementation
Notes (search text persisting across FileVine/Settings toggles instead of
resetting) — not a regression against any AC, and pinning today's
incidental behavior in a test would make a future intentional change to
it look like a broken test. lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
