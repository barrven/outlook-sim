---
id: 055
title: Mail message list — show each message's timestamp
status: backlog
priority: low
---

## Description
Show each message's timestamp in the message list row. Today
`.message-list-item` shows only from/subject/categories — no time/date at
all, unlike the Reading Pane header which already shows it.

## Acceptance Criteria
- [ ] Each message row displays its timestamp (date and/or time),
      formatted consistently with how the Reading Pane already displays it
- [ ] Existing row content (subject, from, categories, flag button) remains
      visible and functional alongside the new timestamp
- [ ] No change to sorting, filtering, or search behavior — this is a
      display-only addition

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
