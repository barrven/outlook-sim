---
id: 003
title: Mail folders, message list & reading pane
status: backlog
priority: high
---

## Description
Wire the Mail module to real data: default folders (Inbox, Sent, Drafts,
Deleted Items) plus user-created custom folders, a message list per folder,
and a reading pane that shows the selected message.

## Acceptance Criteria
- [ ] Inbox, Sent, Drafts, and Deleted Items folders exist by default and
      appear in the folder pane
- [ ] User can create, rename, and delete custom folders
- [ ] Selecting a folder shows its messages in the message list
- [ ] Selecting a message shows its content in the reading pane
- [ ] Folder/message data is read from the SQLite layer built in 002

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
