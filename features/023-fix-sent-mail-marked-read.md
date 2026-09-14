---
id: 023
title: Fix — sent mail created as read, not unread
status: testing
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
Single call site drives all of Send/Reply/Reply All/Forward: `ComposeWindow.tsx`'s
`persist()` already receives the destination `folderId` ('sent' | 'drafts') and
was the only place building the fields object passed to `messages.create`/
`messages.update` for trainee-authored mail. Added `isRead: folderId === 'sent'`
to that object — Send lands read, Save & Close (drafts) stays unread as before
(unaffected, not in scope). `MailDb.createMessage` already defaulted `isRead:
false` when the field is omitted, and every incoming-mail creation path
(`personaReply.ts`, `scheduler.ts`'s unsolicited mail, `scenarioMailScheduler.ts`,
`scenarioPack.ts`'s inbox seeding) never sets `isRead`, so all of those are
untouched and still default to unread — verified by inspection, no code changes
needed there. No retroactive migration: existing rows are untouched since the
insert/update SQL and defaulting logic in `db.ts` were not changed, only the
value the renderer sends. Files touched: `src/renderer/src/ComposeWindow.tsx`.
lint/typecheck/build pass; existing suite still 406/406 unchanged.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
