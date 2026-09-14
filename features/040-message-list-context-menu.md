---
id: 040
title: Message list right-click context menu
status: backlog
priority: medium
---

## Description
Right-clicking a message (or a multi-selection of messages, feature 039) in
the list opens a context menu with Move to folder, Mark read/unread,
Flag/Unflag, Add to category, Reply/Reply All/Forward, and Delete —
applying to the whole current selection.

## Acceptance Criteria
- [ ] Right-clicking a message shows a context menu with all listed actions
- [ ] Right-clicking within an existing multi-selection keeps that
      selection and applies chosen actions to all of it; right-clicking
      outside the current selection selects just that message first
- [ ] Move to folder shows a submenu/list of available folders and moves
      every selected message there
- [ ] Mark read/unread, Flag/Unflag, and Add to category apply to every
      selected message
- [ ] Reply/Reply All/Forward are only enabled when exactly one message is
      selected; Delete works for any selection size

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
