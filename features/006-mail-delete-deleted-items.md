---
id: 006
title: Mail delete & Deleted Items
status: accept
priority: medium
---

## Description
Trainee can delete messages from any folder; deleted messages move to
Deleted Items rather than being destroyed immediately.

## Acceptance Criteria
- [x] Deleting a message from any folder moves it to Deleted Items
- [x] Messages in Deleted Items can be permanently deleted or restored to
      their original folder
- [x] Deleted Items contents persist across restarts

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
Added 11 tests on top of the coverage written during `/implement` (193 → 204,
all passing; re-ran full suite 3x, stable):

- `db.test.ts` (5 new): a fresh message defaults `previousFolderId` to
  `null`; `updateMessage` moves a message into `deleted` while stamping
  `previousFolderId` with its old folder, and a follow-up `updateMessage`
  restores it back out (covers AC1 + the restore half of AC2); a message
  already in Deleted Items can still be permanently removed via the
  existing `deleteMessage` (the delete half of AC2); a message moved to
  Deleted Items survives a close/reopen cycle of `MailDb` (AC3); opening a
  pre-existing DB from before this feature (no `previous_folder_id` column)
  auto-migrates and behaves identically going forward, mirroring the
  existing `cc`-column migration test.
- `ReadingPane.test.tsx` (3 new): Delete shows and fires for a message
  outside Drafts/Deleted Items; Delete also shows and fires alongside Edit
  draft for a Drafts message (AC1 covers "any folder"); a Deleted Items
  message shows only Restore + Delete permanently (no Reply/Reply
  All/Forward/Delete/Edit draft) and each button calls the right handler
  with the message.
- `App.test.tsx` (3 new): clicking Delete calls
  `window.api.data.messages.update(id, { folderId: 'deleted',
  previousFolderId: <original folder> })` and clears the selection;
  clicking Restore on a Deleted Items message calls `update` with
  `folderId` set back to the stored `previousFolderId` and
  `previousFolderId: null`, and clears the selection; clicking Delete
  permanently calls the real `messages.delete(id)` and clears the
  selection.

Deliberately not covered: persistence of the *restored* state and of a
*permanently-deleted* absence across a real Electron restart specifically
through the UI layer — the DB-level persistence test (AC3) plus the
existing close/reopen coverage for `updateMessage`/`deleteMessage` already
establish this at the layer that actually persists data, and no
Playwright/xvfb driver exists in this repo to drive a real multi-process
restart (same known gap as every prior feature). Restoring into a custom
folder that was itself deleted while the message sat in Deleted Items is
an edge case the acceptance criteria don't mention and isn't tested.

## Validation Notes
lint: pass. typecheck: pass (both `tsconfig.node.json` and
`tsconfig.web.json`). build (`electron-vite build`): pass. Full test suite:
204/204, re-run 3x back-to-back, stable.

Per-AC check:

- **AC1 (delete from any folder moves to Deleted Items):** PASS. Confirmed
  by the `db.test.ts`/`ReadingPane.test.tsx`/`App.test.tsx` coverage from
  `/test`, by code inspection (`ReadingPane.tsx` shows a Delete button for
  every folder except `deleted` itself, including Drafts;
  `App.tsx#handleDeleteMessage` sets `folderId: 'deleted',
  previousFolderId: <original>`), and additionally by a live check: bundled
  `db.ts` standalone with `esbuild` and drove a real `MailDb` (temp-dir
  SQLite, not mocked) through creating messages in `inbox`, `sent`, and
  `drafts` and deleting each — all three left their origin folder's list
  and appeared in `deleted` with the correct `previousFolderId` stamped.
- **AC2 (restore or permanently delete from Deleted Items):** PASS. Same
  live check continued: restoring a Deleted-Items message returned it to
  its stored `previousFolderId` with that field cleared back to `null`;
  permanently deleting a different Deleted-Items message via the existing
  `deleteMessage` made `getMessage` return `null`. Matches
  `ReadingPane.tsx`'s Deleted-Items branch (Restore / Delete permanently)
  and `App.tsx`'s `handleRestoreMessage`/`handlePermanentDeleteMessage`.
- **AC3 (Deleted Items persists across restarts):** PASS. `db.test.ts`
  covers a close/reopen cycle at the `MailDb` level (the only place
  persistence actually happens — SQLite on disk). Additionally cross-checked
  against the user's real `~/.config/outlook-sim/outlook-sim.db`: it had
  already picked up the `previous_folder_id` column (the app was launched
  for real since `/implement`, running the migration for real, not just in
  a test), all 8 pre-existing real messages were intact with
  `previous_folder_id` correctly defaulted to `null`, and the column
  migration didn't disturb `folder_id`/subjects/etc. — strong non-scripted
  evidence the migration is safe in production, not just in a scratch copy.

Non-blocking gap, consistent with every prior feature in this project: no
live multi-window Electron GUI click-through was performed here (no
Xvfb/Playwright driver in this sandbox) — the real end-to-end behavior was
instead verified against the real `MailDb` class and the real on-disk
database rather than through mocks, which is the strongest check available
in this environment.

All three acceptance criteria verified. No regressions found.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
