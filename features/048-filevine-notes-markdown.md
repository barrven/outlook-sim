---
id: 048
title: FileVine notes/files CRUD with Markdown content
status: testing
priority: high
---

## Description
Within a FileVine folder (feature 047), the trainee has full CRUD over
notes/files — each entry has a name and full text content stored as
Markdown, with a formatted (rendered, not raw) Markdown view.

## Acceptance Criteria
- [ ] User can create, edit, and delete a note/file entry within a folder,
      with a name and Markdown body
- [ ] The viewing UI renders the Markdown formatted (headings, lists,
      bold/italic, links, etc.), not as raw text
- [ ] An edit mode exposes the raw Markdown source for editing, distinct
      from the rendered view
- [ ] Notes/files persist across restarts, associated with their folder
- [ ] Deleting a folder also removes its contained notes/files (an
      explicit, deliberate behavior, not silently undefined)

## Implementation Notes

**Data layer.** New `FileVineNote { id, folderId, name, content }` (Markdown
source; `shared/data-types.ts`) plus a `filevine_notes` SQLite table
(`folder_id` FK to `filevine_folders`, indexed) and full CRUD on `MailDb`,
mirroring `filevine_folders`'/`calendarItems`'s conventions exactly
(server-generated id, same method signatures). `deleteFileVineFolder`
(047) now also deletes every to-be-deleted folder's notes before deleting
the folders themselves — same FK-ordering reason as 047's own
folder-cascade fix (a folder can't be deleted while a note still
references it) — so AC5 (deleting a folder removes its notes) is a natural
extension of the existing cascade-delete, not a new mechanism. Wired
straight through the existing patterns: `db:fileVineNotes:*` IPC channels
(`ipc.ts`), `window.api.data.fileVineNotes` (`preload/index.ts` +
`preload/index.d.ts`), and a mock in `renderer/src/test/mockApi.ts`.
`list` takes a required `folderId` (notes are always fetched scoped to the
folder currently open in the UI, unlike `fileVineFolders.list()` which has
no natural scope). No IPC broadcast, matching 047's no-broadcast
rationale (single window).

**Markdown rendering.** No Markdown library existed in the repo yet.
Added `marked` (parsing) + `dompurify` (sanitizing before
`dangerouslySetInnerHTML` — this is the app's first use of raw HTML
injection, so sanitizing is done on principle even though note content is
trainee-authored/single-user) via a small `renderer/src/markdown.ts`
wrapper (`renderMarkdown(source): string`, GFM + line-break-as-`<br>`
options).

**UI.** Extended `FileVineView.tsx`'s existing detail pane (below the 047
client-association field) with a "Notes" section, following the same
create/edit-inline-form conventions the folder tree already established:
a flat list of notes per folder (no nesting — not called for by the ACs),
"+ New note" opens an inline Name + Markdown-source `<textarea>` form: AC1.
Selecting a note renders its content via `renderMarkdown` below the list:
AC2. Clicking a note's "✎" swaps that list row into the same
Name+textarea form pre-filled with its current name/content — a
structurally distinct UI from the read-only rendered view (which hides
itself while that note is mid-edit): AC3. "✕" deletes a note directly (no
confirm dialog, matching folder delete's existing convention). Switching
folders resets note selection/create/edit state via an explicit
`selectFolder()` wrapper (used everywhere `selectedFolderId` changes,
including on folder delete) rather than in a `useEffect` — a first attempt
using an effect to reset state on `selectedFolderId` change tripped the
existing `react-hooks/set-state-in-effect` lint rule (synchronous
`setState` in an effect body); moving the reset into the same event
handlers that already change `selectedFolderId` avoided it entirely, and a
separate effect now only *fetches* notes for the newly selected folder,
matching the existing folders/personas effect's `.then()`-callback shape.

**Verified live before finishing:** a standalone `esbuild`-bundled `db.ts`
script drove full note CRUD, close/reopen persistence, and cascade-delete
(both a folder's own notes and a nested descendant folder's notes) against
a real `MailDb` in a scratch temp dir — all correct. A throwaway RTL smoke
test (written, run, deleted — not part of this diff) drove the full UI
flow: create a note, select it and confirm the rendered `<h1>`/`<strong>`
actually appear (not the literal `# `/`**` source), edit it via the
distinct edit form, save, and delete it, ending back at the empty state.

Files touched: `src/shared/data-types.ts`, `src/main/data/db.ts`,
`src/main/data/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`,
`src/renderer/src/test/mockApi.ts`, `src/renderer/src/components/FileVineView.tsx`,
`src/renderer/src/styles/global.css`, `package.json`/`package-lock.json`
(new deps: `marked`, `dompurify`); new `src/renderer/src/markdown.ts`.
`src/main/data/ipc.test.ts`'s exhaustive channel-list test needed a
content touch-up for the 5 new channels — no unrelated behavior changes.

lint/typecheck/build pass; existing suite unchanged at 454/454 (no new
tests added here — full coverage is `/test`'s job next). Phase set to
`test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
