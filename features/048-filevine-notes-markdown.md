---
id: 048
title: FileVine notes/files CRUD with Markdown content
status: accept
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
Added 13 tests across 3 layers (454 → 467, all passing, re-run 3x stable),
all AC-traceable by number:

- **`db.test.ts`** (+6, real `MailDb`, no mocking) — AC1: create/edit/
  delete a note; `listFileVineNotes` scoped to its own folder (a note in
  an unrelated folder isn't returned). AC4: a note (name, content,
  `folderId`) survives a close/reopen cycle unchanged. AC5: deleting a
  folder deletes its own notes but leaves an unrelated folder's notes
  intact; a regression test mirroring 047's own cascade-delete FK-ordering
  bug — a folder *and* its nested child both had notes, deleting the root
  must not throw `FOREIGN KEY constraint failed` and must clear both
  folders' notes. Plus a not-found regression (`getFileVineNote`/
  `updateFileVineNote` on a missing id).
- **`ipc.test.ts`** (+1) — the exhaustive channel-list test now includes
  all 5 `db:fileVineNotes:*` channels (done during `/implement`); a new
  test drives create (into one folder, plus an unrelated note in a second
  folder) → list (scoped to the first folder only) → get → update → delete
  through the actual registered IPC handlers, not `MailDb` directly.
- **`FileVineView.test.tsx`** (+6, in-memory fake note store mirroring the
  existing fake folder store) — AC1: empty "No notes yet." state; create a
  note via "+ New note" (name + Markdown-source textarea), asserting the
  exact `create` call args and that the empty state clears; submitting a
  blank name is a no-op; delete a note, back to the empty state. AC2: a
  selected note's Markdown renders as real `<h1>`/`<strong>` DOM elements
  — explicitly asserts the literal `# Hello` / `**bold**` source text does
  *not* appear anywhere, so a regression to raw-text rendering would fail
  this rather than just missing an assertion. AC3: clicking "Edit" shows
  the raw Markdown source in a textarea (not the rendered HTML) and hides
  the rendered view entirely while mid-edit, proving edit mode is a
  distinct UI state rather than an overlay on top of the rendered view;
  saving returns to the rendered view. Plus one UI-level regression for the
  `/implement`-stage `selectFolder()` fix: switching to a different folder
  shows that folder's own notes (or its own empty state), not the
  previously-selected folder's notes lingering on screen.

Deliberately not covered: AC5's data-layer cascade is proven in
`db.test.ts`; no separate UI-level "delete folder clears its notes from
the screen" test was added since `FileVineView`'s folder-delete handler
already resets `selectedFolderId` (and, via `selectFolder`, the note
state) regardless of feature 048 — that path is exercised by 047's own
folder-delete test, and re-deriving it here would just be testing the
same `selectFolder` reset twice under a different label. Real Electron
IPC/contextBridge serialization untested (same non-blocking sandbox gap
noted in every prior feature). Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 467/467, re-run 3x, stable.
`git diff 9572ecc..3d4c5b3` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria, each checked independently of `/implement`'s and
`/test`'s own checks:

- **AC1** (create, edit, delete a note/file with a name and Markdown body)
  — **pass**. `db.test.ts` and `FileVineView.test.tsx` both cover the full
  round trip at their respective layers. Independently re-verified live:
  bundled `db.ts` standalone with `esbuild` and ran create → edit → against
  a scratch copy of the real, in-use `~/.config/outlook-sim/outlook-sim.db`
  — a real note was created with a name and Markdown content, then edited,
  both correctly reflected on immediate re-fetch.
- **AC2** (renders Markdown formatted — headings, lists, bold/italic,
  links — not as raw text) — **pass**. `FileVineView.test.tsx` proves a
  selected note's `#`/`**` source renders as real `<h1>`/`<strong>`
  elements and that the literal source text is absent. Went further here
  than `/test`'s own coverage: a fresh throwaway jsdom check (written, run,
  deleted — not part of this diff) fed `renderMarkdown` a heading, a
  two-item list, italic, bold, and a link, and asserted `<h1>`/`<h2>`,
  both `<li>`s, `<em>`, `<strong>`, and a real `<a href>` all came back as
  actual DOM elements with the right text/attributes, plus that
  `dangerouslySetInnerHTML`'s sanitization isn't a no-op — a raw
  `<script>alert(1)</script>` embedded in note content is stripped
  entirely, not merely escaped-and-displayed.
- **AC3** (edit mode exposes raw Markdown source, distinct from the
  rendered view) — **pass**. `FileVineView.test.tsx` asserts the edit
  form's textarea holds the exact raw source (not rendered HTML) and that
  `.filevine-note-rendered` is absent from the DOM entirely while a note is
  mid-edit — confirmed by code inspection too: the rendered block's render
  condition (`selectedNote && editingNoteId !== selectedNote.id`)
  structurally cannot coexist with the edit form for the same note.
- **AC4** (notes persist across restarts, associated with their folder) —
  **pass**. `db.test.ts` covers a close/reopen cycle at the unit level; the
  live check above independently confirms the same against the real
  on-disk `outlook-sim.db` — a note's content and `folderId` came back
  identical after a full `MailDb` close/reopen.
- **AC5** (deleting a folder removes its notes — explicit, not
  undefined) — **pass**. `db.test.ts` covers both a direct case and a
  regression mirroring 047's own cascade-delete FK-ordering bug for a
  folder with a nested child. The live check above independently
  reproduced this against the real on-disk data: created a folder with a
  nested child, a note in each, deleted the root — both notes gone,
  pre-existing unrelated FileVine folders in the real data (3 of them)
  left untouched. Real on-disk `outlook-sim.db` confirmed byte-for-byte
  unchanged (md5) afterward — only the scratch copy was written to.

No live multi-window Electron GUI click-through attempted — same
non-blocking sandbox gap noted in every prior feature (no attached
display). The RTL-driven `FileVineView.test.tsx` coverage plus the two
independent live data-layer checks above are the strongest available
substitute.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
