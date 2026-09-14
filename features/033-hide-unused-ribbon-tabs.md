---
id: 033
title: Ribbon — hide Send/Receive and Folder tabs
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
