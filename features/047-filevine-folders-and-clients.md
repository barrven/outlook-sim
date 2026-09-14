---
id: 047
title: FileVine tab — folder structure and client association
status: backlog
priority: high
---

## Description
A new "FileVine" ribbon tab (between Home and View) opens a case-file/
matter management UI in the center/right content area, while the left-hand
folder pane keeps showing the mail folder list. The trainee can build a
folder structure (create/rename/delete, nested like a file system) and
associate any folder with a specific persona as that folder's client.

## Acceptance Criteria
- [ ] FileVine tab appears between Home and View in the ribbon
- [ ] Clicking it swaps the center/right content area to the FileVine UI;
      the left folder pane continues to show the mail folders
      underneath/alongside it
- [ ] User can create, rename, and delete folders, nested under other
      folders (a file-system-like tree, not a flat list)
- [ ] Any folder can be associated with one persona from the configured
      persona list as its "client" (and un-associated / changed later)
- [ ] Folder structure and client associations persist across restarts

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
