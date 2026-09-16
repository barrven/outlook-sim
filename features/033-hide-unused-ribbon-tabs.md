---
id: 033
title: Ribbon — hide Send/Receive and Folder tabs
status: accept
priority: low
---

## Description
The ribbon's Send/Receive and Folder tabs (placeholders since feature 001,
never wired to any functionality) are now hidden entirely rather than shown
as permanently-disabled/empty tabs.

## Acceptance Criteria
- [ ] Send/Receive tab is not rendered anywhere in the ribbon
- [ ] Folder tab is not rendered anywhere in the ribbon
- [ ] Home and View tabs (and the FileVine tab, once feature 047 lands) are
      unaffected
- [ ] No leftover dead code references the removed tabs' now-nonexistent
      content

## Implementation Notes
`RibbonBar.tsx`: `TABS` shrunk from `['File', 'Home', 'Send / Receive',
'Folder', 'FileVine', 'View']` to `['File', 'Home', 'FileVine', 'View']`.
Send/Receive and Folder had no entry in `ClickableTab`/`tabHandlers`
already — they were purely decorative disabled buttons — so removing them
from `TABS` is the entire change; no other logic (active-tab detection,
action sets, handlers) referenced them. File remains as the one disabled
placeholder tab, matching the AC (only Send/Receive and Folder are hidden).
No other file referenced these tabs by name outside `RibbonBar.test.tsx`,
which still asserts on them and is expected to fail until `/test` updates
it (this repo's established convention per feature 046).

## Test Notes
648 → 649 net (+1, all passing; full suite re-run once, stable), in
`RibbonBar.test.tsx`:
- Existing "renders ribbon tabs" test (genuinely failing after
  `/implement`, since it asserted Send/Receive and Folder were rendered-
  but-disabled) rewritten to only assert `File` is the remaining disabled
  placeholder.
- New test: Send/Receive and Folder are not in the document at all (AC1,
  AC2).
- FileVine-ordering test's tab-name regex updated to drop Send/Receive and
  Folder from the expected set (it enumerated all tab labels to check
  relative order).
- Home/View/FileVine enabled-and-interactive assertions (AC3) were already
  covered by existing tests and untouched.
- AC4 ("no leftover dead code") isn't unit-testable — confirmed instead by
  `grep`ing the codebase for the removed tabs' labels during `/implement`:
  the only reference outside `RibbonBar.tsx`'s `TABS` array was this test
  file, now updated. Not re-verified here since it's a static-code check,
  not runtime behavior.

## Validation Notes
- `npm run lint` — clean, no errors/warnings.
- `npm run typecheck` — clean.
- `npm run build` — succeeds (main/preload/renderer all bundle).
- `npx vitest run` (full suite) — 649/649 passing, re-run 3x, stable.

Acceptance criteria, checked against current source
(`src/renderer/src/components/RibbonBar.tsx`):
- **AC1 (Send/Receive not rendered anywhere)** — `TABS` (line 5) no longer
  contains `'Send / Receive'`; confirmed by test
  `does not render the Send/Receive or Folder tabs`. `RibbonBar` is the
  only component that ever rendered ribbon tabs, so there's no other
  render path to check. Pass.
- **AC2 (Folder not rendered anywhere)** — same `TABS` change, same test.
  Pass.
- **AC3 (Home/View/FileVine unaffected)** — all three remain in `TABS`,
  still wired via `tabHandlers`/`ClickableTab` (lines 10, 61-65),
  unchanged by this diff. Covered by the pre-existing enabled/interactive/
  active-tab tests, all still passing. Pass.
- **AC4 (no dead code referencing removed tabs)** — `grep -rn "Send /
  Receive|Send/Receive|'Folder'|\"Folder\""` across `src/` returns only
  the explanatory code comment in `RibbonBar.tsx` and the new test's
  name/assertions in `RibbonBar.test.tsx` — no leftover logic, styles, or
  handlers reference the removed tabs. Pass.

All 4 acceptance criteria pass. No regressions found elsewhere (full suite
green, `App.test.tsx` untouched and still passing).

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
