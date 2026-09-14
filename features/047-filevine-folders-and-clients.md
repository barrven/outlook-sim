---
id: 047
title: FileVine tab — folder structure and client association
status: testing
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
Scope note up front: this feature is folders + client association +
persistence only. Notes/files CRUD (feature 048) and feeding FileVine
content into persona LLM context (feature 049) are explicitly deferred per
`docs/SPEC.md`'s own split of Core Requirement 15 into 047/048/049 — not
implemented here.

**Data layer.** New `FileVineFolder { id, name, parentId: string|null,
clientPersonaId: string|null }` (`shared/data-types.ts`) — nests via
`parentId` (a real tree, unlike the flat mail-`folders` table) and loosely
references a persona by id (`clientPersonaId`; personas live in
`ConfigStore`'s JSON, not SQLite, so this is a plain string reference, not
an FK — same pattern messages already use for persona emails). New
`filevine_folders` SQLite table (`parent_id` has an FK to its own table for
integrity) with full CRUD on `MailDb`, mirroring `calendarItems`'s
shape/conventions exactly (server-generated id via `generateId()`, same
create/update/delete method signatures). `deleteFileVineFolder` cascades to
descendants (mirrors deleting a folder in a real file system, rather than
orphaning/reparenting children to the root) — collected via a pre-order
walk, then **deleted in reverse order**; a first version deleted in
forward/insertion order and threw `FOREIGN KEY constraint failed` the
moment a folder with children was deleted (parent deleted while a child
still referenced it) — caught live via a standalone script before this ever
reached tests, not from code review.

Wired straight through the existing patterns: `db:fileVineFolders:*` IPC
channels (ipc.ts, mirroring `db:calendarItems:*`), `window.api.data.fileVineFolders`
(preload/index.ts + the `Window.api` type in preload/index.d.ts — a
separate source of truth from the runtime object, easy to miss, learned
from feature 026), and a mock in `renderer/src/test/mockApi.ts` so existing
component tests that render `<App/>`/etc. don't break on the new API
surface. No IPC broadcast needed (unlike messages' `data:messages-changed`)
since only one window ever needs this data — no FileVine pop-out windows
exist.

**UI.** New `FileVineView.tsx`, a two-pane layout (tree + detail, same
"center/right" split the message-list/reading-pane already establishes) —
always-expanded nested `<ul>`s (no collapse/expand state; ACs don't call
for it and it kept the component simpler), each row offering rename (✎),
delete (✕), and "+ subfolder" inline, following `FolderPane.tsx`'s existing
inline-form CRUD conventions closely. Selecting a folder shows its name and
a persona `<select>` in the detail pane for client association
(`clientPersonaId`, nullable via a "No client" option).

**Ribbon tab wiring** — the actual "swap center/right content" mechanism.
`RibbonBar`'s tab row (`TABS`) was, until now, an entirely static/disabled
placeholder from feature 001 (hardcoded "Home" active, everything
`disabled`). Added `FileVine` between `Home` and `View`; made exactly those
two tabs clickable (`ClickableTab = 'Home' | 'FileVine'`) via new
`showFileVine`/`onSelectHomeTab`/`onSelectFileVineTab` props — every other
tab (File/Send-Receive/Folder/View) stays a disabled placeholder, since
none of them have content to show yet (View's Tasks-panel toggle is a
separate future feature, 046). In `App.tsx`, a new `showFileVine` boolean
overlays `FileVineView` in place of `MessageListPane`+`ReadingPane` when
`activeModule === 'mail'` — chosen as a Mail-module-scoped overlay (like
`showSettings`/`showNewEventForm`) rather than a third top-level
`ModuleId`, since the spec is explicit that the mail folder pane stays
visible underneath it. Clicking either ribbon tab also forces
`activeModule` to `'mail'` (FileVine only makes sense with that pane
showing); clicking a mail folder or switching to Calendar closes FileVine,
consistent with how those actions already close Settings/the new-event
form.

Files touched: `src/shared/data-types.ts`, `src/main/data/db.ts`,
`src/main/data/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`,
`src/renderer/src/test/mockApi.ts`, `src/renderer/src/components/RibbonBar.tsx`,
`src/renderer/src/App.tsx`, `src/renderer/src/styles/global.css`; new
`src/renderer/src/components/FileVineView.tsx`.

Deliberately not wired into free-play reset (`resetMailboxAndCalendar`) or
scenario packs — FileVine folders are persistent case data akin to custom
mail folders and personas (which already survive free-play reset), not
session data. Not an AC either way; flagging the judgment call for
visibility.

Verified live end-to-end before writing tests: a standalone `esbuild`-
bundled `db.ts` script drove create/nest/rename/client-associate/un-associate/
close-reopen-persist/cascade-delete against a real `MailDb` (this is what
caught the FK-order bug above); a throwaway RTL smoke test (written,
run, and deleted — not part of the committed diff) drove the full
`FileVineView` UI flow — create root folder, create nested subfolder,
select + associate a client persona, rename, delete — confirming the
component itself works before `/test` adds permanent coverage.

lint/typecheck/build pass. Existing suite 428 → 430 (2 new RibbonBar tests
added here to cover the tab becoming interactive; `RibbonBar.test.tsx`'s
existing assertions and `ipc.test.ts`'s exhaustive-channel-list test needed
compile/content touch-ups for the new props/channels, no unrelated
behavior changes). Phase set to `test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
