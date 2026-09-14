---
id: 023
title: Fix — sent mail created as read, not unread
status: backlog
priority: high
---

## Description
Fixes `BUGS.md` B002. Messages the trainee sends (via Send, Reply, Reply All,
or Forward) now land in Sent Items already marked read, since the trainee
obviously already "read" what they just wrote. "Unread" now only ever
applies to genuinely incoming mail.

## Acceptance Criteria
- [ ] A message created via Send lands in Sent Items with `isRead: true`
- [ ] A message created via Reply/Reply All/Forward lands in Sent Items with
      `isRead: true`
- [ ] Incoming mail (persona replies, unsolicited-mail scheduler, scenario-
      pack-loaded inbox messages) still defaults to `isRead: false`
- [ ] Existing already-sent messages are unaffected — no retroactive bulk
      update/migration of historical data

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
