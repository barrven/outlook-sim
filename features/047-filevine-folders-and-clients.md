---
id: 047
title: FileVine tab — folder structure and client association
status: done
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
Added 21 tests across 4 layers (430 → 451, all passing, re-run 3x stable),
all AC-traceable by number:

- **`db.test.ts`** (+7, real `MailDb`, no mocking) — AC3: create/rename/
  delete; nesting (parent/child/grandchild); a regression test pinning the
  cascade-delete fix (`deleteFileVineFolder` on a folder with children no
  longer throws `FOREIGN KEY constraint failed`, and all descendants —
  plus only descendants, not an unrelated sibling folder — are gone
  afterward). AC4: associate → change → un-associate a client persona.
  AC5: folder structure and client association survive a close/reopen
  cycle, including a nested child's `parentId`. Plus a not-found regression
  (`getFileVineFolder`/`updateFileVineFolder` on a missing id).
- **`ipc.test.ts`** (+1) — the exhaustive channel-list test now includes
  all 5 `db:fileVineFolders:*` channels; a new test drives create (incl.
  nesting) → list → get → update (client association) → delete through the
  actual registered IPC handlers, not `MailDb` directly.
- **`FileVineView.test.tsx`** (+11, new file) — the component layer, via a
  small in-memory fake store (same pattern other panes' tests use for
  personas/messages) so create/rename/delete/associate round-trip
  realistically without a real `MailDb`. AC3: empty state; create a root
  folder (and that submitting a blank name is a no-op); create a nested
  subfolder under an existing one, asserting via `create`'s call args that
  the correct `parentId` was sent; a DOM-structure test proving a child
  folder is actually nested *inside* its parent's own subtree (a
  `.filevine-tree-children` list inside the parent's `<li>`), not just
  visually indented in a flat list; rename; delete. AC4: selecting a folder
  shows the "select a folder" empty detail state until then; associating a
  client, showing the folder's *existing* client pre-selected on load, un-
  associating (back to "No client"), and changing to a different persona —
  each asserting both the `update` call's exact patch and the resulting
  "Client: Name (Role)" summary text.
- **`App.test.tsx`** (+2, on top of the 2 `RibbonBar.test.tsx` tests added
  during `/implement` which already cover AC1 — the tab's position and
  active-state) — AC2: clicking FileVine swaps the center/right area
  (asserted by both the FileVine heading appearing and the message-list/
  reading-pane text disappearing) while the mail folder pane (`Mailbox`
  header + `Inbox` button) stays visible, and clicking Home returns to the
  normal mail view; selecting a mail folder while FileVine is open returns
  to mail view (exercises the `handleSelectFolder` reset); switching to
  the Calendar module while FileVine is open closes it (exercises the
  `handleSelectModule` reset).

Deliberately not covered: real Electron IPC/contextBridge serialization
(same non-blocking sandbox gap noted in every prior feature — no Xvfb
here); notes/files CRUD and LLM context wiring, since those are features
048/049's scope, not this one's ACs. Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 451/451, re-run 3x, stable.
`git diff 9325c91..0d239c2` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria:
- **AC1** (FileVine tab appears between Home and View) — **pass**.
  `RibbonBar.test.tsx`'s new test asserts `TABS.indexOf('FileVine')` sits
  strictly between `Home` and `View`; verified by inspection of
  `RibbonBar.tsx`'s `TABS` array (`['File', 'Home', 'Send / Receive',
  'Folder', 'FileVine', 'View']`).
- **AC2** (clicking swaps the center/right content area; left folder pane
  keeps showing mail folders) — **pass**. `App.test.tsx`'s new test clicks
  the FileVine tab and confirms the message-list/reading-pane content
  disappears while the FileVine heading appears, *and* that the mail
  folder pane (`Mailbox` header + `Inbox` button) stays visible throughout
  — the actual mechanism spec Core Requirement 15 describes. Also covers
  the reverse (Home tab returns to the mail view) and the two ways this
  should implicitly close (selecting a mail folder; switching to the
  Calendar module), both of which reuse the same reset pattern
  `showSettings`/`showNewEventForm` already use elsewhere in `App.tsx`.
- **AC3** (create/rename/delete, nested like a file system, not flat) —
  **pass**. `db.test.ts` proves real parent/child/grandchild nesting and a
  cascade-delete that removes exactly the deleted folder's descendants
  (not an unrelated sibling); `FileVineView.test.tsx` proves the UI's
  create/rename/delete round-trip through the API with the right
  arguments, plus a DOM-structure test confirming a child folder is
  actually nested inside its parent's own subtree (`<ul
  class="filevine-tree-children">` inside the parent's `<li>`), not merely
  indented in a flat list. Verified live, independently of `/test`'s
  suite: bundled `db.ts` standalone with `esbuild` and built a 3-level
  nested structure (a case matter → Discovery → IME Reports) against a
  scratch copy of the real, in-use
  `~/AppData/Roaming/outlook-sim/outlook-sim.db` — deleting the middle
  folder ("Discovery") correctly cascaded to its child ("IME Reports")
  while leaving the unrelated root folder intact. This is also where
  `/implement` caught and fixed a real bug (cascade-delete originally threw
  `FOREIGN KEY constraint failed` by deleting parents before children) —
  now covered by a dedicated regression test.
- **AC4** (associate any folder with one persona as its client, change/
  un-associate later) — **pass**. `db.test.ts` and `FileVineView.test.tsx`
  both cover associate → change → un-associate, the latter also asserting
  the UI's "Client: Name (Role)" summary text updates correctly and that
  an existing association is pre-selected in the `<select>` on load (not
  just settable). Live check above associated the matter folder with a
  real persona email (`c.torres@email.test`) from the real, in-use
  scenario data.
- **AC5** (folder structure and associations persist across restarts) —
  **pass**. `db.test.ts` covers a close/reopen cycle at the unit level;
  the live check above independently confirms the same against the real
  on-disk database file — the 3-folder nested structure and the client
  association both came back identical after a full `MailDb` close/reopen.
  Real on-disk `outlook-sim.db` confirmed byte-for-byte unchanged (md5)
  afterward — only the scratch copy was written to.

No live multi-window Electron GUI click-through attempted. Unlike prior
features' sandboxed sessions, this one runs on a real Windows machine
rather than a headless Linux sandbox, but as a background job it still has
no attached display to drive a real Electron window through — same
non-blocking gap as every prior feature, for a different underlying
reason. The standalone live-data check plus the RTL-driven `App.test.tsx`/
`FileVineView.test.tsx` coverage (which exercises the real rendered DOM,
just not a real OS window) is the strongest available substitute.

## Acceptance Log
2026-09-14 — User requested one change before accepting: the FileVine
client dropdown was listing every persona (including Grollo Law staff),
letting a folder be assigned an employee as its "client" — it should only
offer actual clients. Implemented before this gate: added a structured
`isClient` boolean to `Persona` (previously nothing distinguished
clients from staff/other contacts beyond free-text `role`), a "Client"
checkbox in Settings > Personas, and filtered `FileVineView`'s client
`<select>` to `isClient` personas (while still showing an already-assigned
persona even if later unmarked, so existing associations don't silently
vanish from the dropdown). Scenario-pack-loaded personas default to
`isClient: false` since packs don't carry that distinction. Re-verified
lint/typecheck/build and the full suite (454/454, +3 new tests) after the
change, independently of the `/test`/`/validate` stages which ran before
this request. User then reviewed the AC table and this fix and said
**Accept**.
