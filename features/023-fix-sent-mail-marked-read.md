---
id: 023
title: Fix — sent mail created as read, not unread
status: validating
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
Added 2 tests (406 → 408, all passing; re-ran full suite 3x, stable) and
extended 8 existing assertions rather than duplicating coverage:
- **AC1/AC2 (Send/Reply/Reply All/Forward land read):** extended the existing
  `ComposeWindow.test.tsx` assertions for Send, Save & Close, draft→Send
  (update path), reply, reply all, and forward to assert `isRead: true` on
  the sent/updated payload (`false` for the Save & Close/drafts case) — these
  tests already drove the exact user flows, so adding the field locks in the
  new behavior without new scaffolding.
- **AC3 (incoming mail still defaults unread):** added `isRead: false` to the
  existing insert-assertions in `personaReply.test.ts`, `scheduler.test.ts`
  (unsolicited mail), and `scenarioMailScheduler.test.ts`; `scenarioPack.test.ts`
  already asserted this for scenario-pack inbox seeding, unchanged.
- **AC4 (no retroactive migration):** two new `db.test.ts` tests — one proves
  `MailDb.createMessage` doesn't infer `isRead` from `folderId` (the decision
  lives entirely in the caller, i.e. `ComposeWindow.tsx`, not the db layer),
  and one proves a sent message with `isRead: false` (simulating mail sent
  before this fix) keeps that value across a close/reopen cycle — no bulk
  `UPDATE` runs on old rows.
Deliberately not tested: a live multi-window Electron click-through (no
Xvfb, same non-blocking gap as every prior feature) — deferred to `/validate`.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
