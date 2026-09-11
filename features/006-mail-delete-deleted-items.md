---
id: 006
title: Mail delete & Deleted Items
status: testing
priority: medium
---

## Description
Trainee can delete messages from any folder; deleted messages move to
Deleted Items rather than being destroyed immediately.

## Acceptance Criteria
- [ ] Deleting a message from any folder moves it to Deleted Items
- [ ] Messages in Deleted Items can be permanently deleted or restored to
      their original folder
- [ ] Deleted Items contents persist across restarts

## Implementation Notes
"Delete" is a soft move to the `deleted` folder, not a DB delete — reused the
existing generic `db:messages:update` IPC path rather than adding new
channels. Added a `previousFolderId: string | null` field to `MailMessage`
(SQLite column `previous_folder_id`, nullable, with an `ALTER TABLE`
migration for pre-existing DBs alongside the existing `cc`-column migration
in `src/main/data/db.ts`) so Restore knows which folder to send a message
back to; it's set to the message's current `folderId` on delete and cleared
to `null` on restore.

`ReadingPane.tsx` now branches its action row three ways: Drafts (Edit
draft + Delete), Deleted Items (Restore + Delete permanently), everything
else (Reply/Reply All/Forward + Delete). "Delete permanently" calls the
existing `db:messages:delete` (real DB delete) — only reachable once a
message is already in Deleted Items. Handlers live in `App.tsx`
(`handleDeleteMessage`/`handleRestoreMessage`/`handlePermanentDeleteMessage`),
each clearing `selectedMessageId` afterward since the message leaves the
current folder view. No new UI in `MessageListPane` or the ribbon — kept
consistent with how Reply/Reply All/Forward only live in `ReadingPane`
today; the ribbon's "Delete" button stays a disabled placeholder like the
other ribbon actions.

Files touched: `src/shared/data-types.ts`, `src/main/data/db.ts`,
`src/renderer/src/components/ReadingPane.tsx`, `src/renderer/src/App.tsx`,
plus compile-only fixture updates (`previousFolderId` field / new mock
props) in `personaReply.test.ts`, `App.test.tsx`, `ComposeWindow.test.tsx`,
`MessageListPane.test.tsx`, `ReadingPane.test.tsx`, `composeIntent.test.ts`,
`test/mockApi.ts` — no behavioral changes in those files.

Verified the schema migration is safe against a scratch copy of the real
`~/.config/outlook-sim/outlook-sim.db` (adds the column, existing rows
intact, values default to `null`). lint/typecheck/build pass;
existing test suite still 193/193 (no new tests yet — that's `/test`).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
