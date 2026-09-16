---
id: 042
title: View tab — Reading Pane Right/Off toggle
status: testing
priority: low
---

## Description
The View ribbon tab gets a control to toggle the inline Reading Pane
between "Right" (today's default, inline pane) and "Off" (no inline pane —
messages are read via the double-click pop-out from feature 041).

## Acceptance Criteria
- [ ] View tab has a Reading Pane control with Right/Off options
- [ ] Selecting Off removes the inline Reading Pane from the layout (the
      message list uses the freed space; no dead blank panel)
- [ ] With Off selected, single-clicking a message no longer opens it
      inline; double-click still pops it out (feature 041)
- [ ] The setting persists across restarts, or at minimum for the current
      session — state which was chosen in Implementation Notes

## Implementation Notes
**Persistence (AC4): session-only.** New `readingPaneMode: 'right' | 'off'`
state lives as plain `useState` in `App.tsx`, default `'right'`. AC4
explicitly permits "at minimum for the current session" — adding a new
persisted config file/IPC channel/preload API for a single cosmetic
layout toggle felt disproportionate for a `low`-priority feature, so this
resets to `'right'` on app restart, same as `viewTabActive`/`showFileVine`
and most other UI-only state in this component.

**Control (AC1):** a labelled `<select aria-label="Reading Pane">`
(options "Right"/"Off") added to `RibbonBar`'s View-tab action row,
alongside the existing Tasks toggle — a 2-option choice rather than a
fire/toggle button, so it's rendered separately from the generic
`actions.map()` loop rather than shoehorned into it. New
`readingPaneMode`/`onReadingPaneModeChange` props flow from `App.tsx`.

**Layout (AC2):** in `App.tsx`, `<ReadingPane>` is now only rendered when
`readingPaneMode === 'right'`; `<MessageListPane>` gets a new `fullWidth`
prop (`readingPaneMode === 'off'`) that adds a `.full-width` class. New
CSS: `.message-list-pane.full-width { flex: 1 1 auto; border-right: none;
}` — overrides the pane's normal fixed `320px` width to fill the freed
space, and drops the divider line that would otherwise dangle with
nothing to its right (AC2's "no dead blank panel").

**AC3 fell out for free:** `MessageListPane`'s click handler still
updates `selectedMessageIds` when Off (needed for bulk actions/the
right-click context menu), but with no `<ReadingPane>` mounted there's
nothing for that selection to open inline — no extra gating code needed.
Double-click's `window.api.messagePopout.open(...)` call lives directly
on the message row, entirely independent of `ReadingPane`/selection, so
it's unaffected either way.

Verified live: a throwaway RTL script against the full `<App/>` drove the
whole flow — default Right shows inline content on click; switching to
Off removes it with no blank placeholder, single-click stops opening it,
double-click still calls `messagePopout.open`, and the message-list pane
picks up the `full-width` class; switching back to Right restores
everything. lint/typecheck/build pass; full suite unchanged at 681/681
(no existing test exercised this new control). `MessageListPane.test.tsx`
and `RibbonBar.test.tsx`'s shared prop-default helpers were updated for
the two new required props (compile-shape only, per established
convention) — no pre-existing test genuinely broke, since nothing before
this feature depended on Reading Pane visibility.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
