---
id: 033
title: Ribbon — hide Send/Receive and Folder tabs
status: validating
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
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
