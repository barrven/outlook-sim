---
id: 023
title: Fix — sent mail created as read, not unread
status: done
priority: high
---

## Description
Fixes `BUGS.md` B002. Messages the trainee sends (via Send, Reply, Reply All,
or Forward) now land in Sent Items already marked read, since the trainee
obviously already "read" what they just wrote. "Unread" now only ever
applies to genuinely incoming mail.

## Acceptance Criteria
- [x] A message created via Send lands in Sent Items with `isRead: true`
- [x] A message created via Reply/Reply All/Forward lands in Sent Items with
      `isRead: true`
- [x] Incoming mail (persona replies, unsolicited-mail scheduler, scenario-
      pack-loaded inbox messages) still defaults to `isRead: false`
- [x] Existing already-sent messages are unaffected — no retroactive bulk
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
lint/typecheck/build all pass; full test suite (408/408) re-run 3x, stable.
Confirmed via `git diff a5751c0..7f640a7` that `/test` touched only test
files/docs plus `STATE.md`/`features/*` bookkeeping — no implementation
drift; `git diff 779c765..a5751c0` shows the entire implementation is a
2-line change in `src/renderer/src/ComposeWindow.tsx` (`isRead: folderId ===
'sent'` added to the shared `persist()` fields object). Grepped the whole
`src/` tree for `folderId: 'sent'` in production code and confirmed
`ComposeWindow.tsx` is the only place a message is created into Sent Items —
no other call site needed the fix.

All 4 ACs verified by the test suite plus a live scripted check (standalone
`tsx` run of the real, non-mocked `MailDb` against a fresh temp SQLite db,
not mocked):
- **AC1 (Send → `isRead: true`):** `ComposeWindow.test.tsx`'s Send test
  asserts it; live check confirms the raw `is_read` column is `1` for a
  message created with `folderId: 'sent', isRead: true` — pass.
- **AC2 (Reply/Reply All/Forward → `isRead: true`):** `ComposeWindow.test.tsx`
  covers all three via the same `persist('sent')` path (single call site, so
  one code change covers all four entry points) — pass.
- **AC3 (incoming mail still defaults `isRead: false`):** `personaReply.ts`,
  `scheduler.ts` (unsolicited mail), `scenarioMailScheduler.ts`, and
  `scenarioPack.ts`'s inbox seeding all create into `folderId: 'inbox'`
  without ever setting `isRead`, confirmed by inspection and now asserted in
  each corresponding test file; live check confirms an inbox message created
  with no `isRead` field defaults to `is_read: 0` — pass.
- **AC4 (no retroactive migration):** `db.ts`'s insert/update SQL and
  defaulting logic are untouched (only `ComposeWindow.tsx`'s renderer-side
  value changed) — no migration function was added, confirmed by inspection
  and by the live check: a "legacy" sent message created with `isRead: false`
  (simulating pre-fix data) still reads back `isRead: false` after a full
  `db.close()`/reopen cycle — pass.

Not attempted: a live multi-window Electron GUI click-through (no Xvfb in
this Windows sandbox; consistent, non-blocking gap noted on every prior
feature). No real `~/.config/outlook-sim` install exists in this environment
to cross-check (this session runs on a different machine than prior
sessions' Linux sandbox), so the live check used a fresh scratch db instead
— sufficient given the change is entirely renderer-side logic with no schema
or migration involved.

All 4 ACs pass. Status set to `accept`.

## Acceptance Log
2026-09-14 — presented the summary (2-line `ComposeWindow.tsx` fix, AC-by-AC
mapping, validation results) via AskUserQuestion. User selected **Accept**.
Decision: accepted, status set to `done`.
