---
id: 042
title: View tab — Reading Pane Right/Off toggle
status: done
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
681 → 688 net (+7, all passing; re-run 3x, stable), across 3 files:

- `RibbonBar.test.tsx` (+2, AC1): the Reading Pane `<select>` only renders
  when the View tab is active (same scoping as the Tasks toggle), with
  exactly the two "Right"/"Off" options; it reflects the current
  `readingPaneMode` prop and reports a change via
  `onReadingPaneModeChange`.
- `MessageListPane.test.tsx` (+1, AC2 structural): `.message-list-pane`
  carries the `full-width` class only when `fullWidth` is true.
- `App.test.tsx` (+4, AC1-AC4 end to end — this is where the real
  functional coverage lives, since the ribbon control, the layout CSS
  class, and the click-handling interaction all have to line up
  together): the View tab's control defaults to Right; switching to Off
  removes the inline pane with no "Select an item to read." placeholder
  left behind (AC2's "no dead blank panel"), a subsequent single click no
  longer opens the message inline while a double-click still calls
  `messagePopout.open` (AC3, feature 041 unaffected); the message-list
  pane picks up the `full-width` class when Off (AC2); and switching back
  to Right restores both the inline pane and the normal-width list.

Deliberately not covered: the session-only persistence choice (AC4) isn't
itself something to unit-test — it's the *absence* of a restart-survival
mechanism, which is what Implementation Notes documents as the
deliberate, AC-permitted choice, not a gap. No live GUI screenshot (no
attached display), same non-blocking category as every prior feature.
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite (688/688) re-run 3x,
stable. `git diff --stat` (3cbecaa..83802d5) confirms `/test` touched
only `STATE.md`/feature/backlog docs plus the three test files — no
implementation drift.

All 4 ACs re-verified directly against current source (not just trusting
prior notes):
- AC1 (View tab has a Reading Pane control with Right/Off): read
  `RibbonBar.tsx` directly — the `<select aria-label="Reading Pane">` is
  gated on `viewTabActive` (same scoping as the Tasks toggle) with
  exactly the two `Right`/`Off` `<option>`s.
- AC2 (Off removes the inline pane, message list uses the freed space, no
  dead panel): `App.tsx` only renders `<ReadingPane>` when
  `readingPaneMode === 'right'`; `<MessageListPane fullWidth={readingPaneMode
  === 'off'}>` applies `.full-width`, which in `global.css` sets `flex: 1
  1 auto` (fills the space) and `border-right: none` (no leftover divider
  line dangling with nothing beside it).
- AC3 (Off: single-click no longer opens inline, double-click still pops
  out): structural by construction — with no `<ReadingPane>` mounted
  there is nothing for a click-driven selection to render into;
  `MessageListPane`'s `onDoubleClick={() =>
  window.api.messagePopout.open(message.id)}` is untouched and has no
  dependency on `readingPaneMode` at all.
- AC4 (persists at minimum for the session): `readingPaneMode` is a plain
  `useState` in `App.tsx`, defaulting to `'right'` — a deliberate,
  AC-permitted choice documented in Implementation Notes rather than a
  gap (a persisted config file was judged disproportionate for a
  low-priority cosmetic toggle).

Not independently re-verified: actual rendered appearance in a live
browser/Electron window (no attached display) and restart-survival
(moot, since AC4's chosen scope is explicitly session-only) — same class
of gap as every prior feature. All checks pass, no gaps found. Phase set
to `accept`.

## Acceptance Log
2026-09-16 — Presented the implementation (Right/Off select in the View
tab, session-only `readingPaneMode` state, `<ReadingPane>` conditionally
rendered, `.full-width` CSS fallback for the message list, double-click
pop-out unaffected), the AC-by-AC mapping, and the validation result (all
checks pass). User selected "Accept (Recommended)", no changes requested.
Decision: accepted.
