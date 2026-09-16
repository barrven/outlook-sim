---
id: 033
title: Ribbon — hide Send/Receive and Folder tabs
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
