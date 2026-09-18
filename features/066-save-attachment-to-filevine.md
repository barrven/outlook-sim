---
id: 066
title: Mail — save a generated attachment into FileVine
status: validating
priority: medium
---

## Description
Let the user save an LLM-generated (incoming) attachment (feature 065)
into a FileVine folder as a note/file entry.

## Acceptance Criteria
- [ ] A generated attachment has a "Save to FileVine" action, letting the
      user pick an existing FileVine folder to save it into
- [ ] Saving creates a FileVine note/file entry containing the
      attachment's content, viewable through FileVine's existing notes UI
      afterward
- [ ] The original message's attachment is unaffected by saving a copy
      into FileVine (non-destructive)
- [ ] Attempting to save when no FileVine folders exist yet offers a clear
      path to create one first, rather than failing silently

## Implementation Notes
`MessageAttachment` (shared/data-types.ts) gained an optional `generated?:
boolean`, set `true` by `writeGeneratedAttachment` (feature 065) — the only
signal the UI needs to tell an LLM-generated (incoming) attachment apart
from a real, trainee-picked one (feature 062), since a real attachment is
already a file the trainee has on their own filesystem and doesn't need
this action.

All new UI lives in `ReadingPane.tsx` (used by both the main window and the
message pop-out window, feature 041, with no extra wiring needed since both
already render this component identically). A generated attachment
(`attachment.generated && attachment.extractedText !== undefined`) gets a
"Save to FileVine…" button alongside its existing filename button. Clicking
it opens an inline dialog, fetching the current FileVine folder list fresh
each time:
- **Folders exist (AC1):** a `<select>` of folders + Save, calling
  `window.api.data.fileVineNotes.create({ folderId, name: filename, content:
  extractedText })` — reusing the exact FileVine note-creation API
  `FileVineView.tsx` already uses, no new IPC surface needed. `extractedText`
  already holds the attachment's raw Markdown source (065's
  `writeGeneratedAttachment` sets both together), so the resulting note
  renders through FileVine's existing Markdown view unchanged (AC2).
- **No folders yet (AC4):** instead of a dead end, the same dialog shows an
  inline "create a folder" form; submitting it calls
  `fileVineFolders.create({ name })` then immediately creates the note in
  the new folder — one step, no separate trip to the FileVine tab required.
- Saving never touches the message or its attachments array — only reads
  `attachment.filename`/`extractedText` — so the original is structurally
  unaffected (AC3).

New CSS (`global.css`): `.attachment-item` gained `flex-wrap: wrap` so the
dialog (`.attachment-save-filevine-*`, `flex-basis: 100%`) drops to its own
row instead of squeezing into the attachment-chip row; styled to match the
existing FileVine note-editor's `input`/`textarea` look.

Verified live via a throwaway RTL script (not committed): saving into an
existing folder calls `fileVineNotes.create` with the exact
`{folderId, name, content}` expected; the no-folders path creates the
folder then the note in one interaction; a real (non-generated) attachment
never shows the button at all. lint/typecheck/build pass; full suite
unchanged at 813/813 (no new feature-specific tests yet — that's
`/test`'s job).

## Test Notes
813 → 822 net (+9, all passing; re-run 3x, stable) across 2 files.
`generatedAttachment.test.ts` (+1) locks in `writeGeneratedAttachment`
setting `generated: true`, the signal the UI relies on.

`ReadingPane.test.tsx` (+9, new "066: Save a generated attachment into
FileVine" block) covers:
- AC1: a generated attachment shows exactly one "Save to FileVine" action
  even alongside a plain real attachment on the same message; a real
  attachment — including one with `extractedText` from feature 063's
  extraction — never shows it.
- AC1/AC2: picking a folder from the `<select>` (multiple real options,
  picking a non-default one) and clicking Save calls
  `fileVineNotes.create` with the exact `{folderId, name, content}`
  expected, and the dialog closes afterward.
- AC3: saving never calls `messages.update`, and the attachment's own
  filename button is unaffected afterward.
- AC4: with no folders, the empty-state copy and inline create-folder form
  show instead of a dead end (no Save button present at all in that
  state); submitting it calls `fileVineFolders.create` then
  `fileVineNotes.create` with the new folder's id, in one interaction; a
  blank folder name submits neither call.
- Supporting UI behavior: Cancel closes the dialog without calling any
  create API; switching to a different message resets the open dialog
  (mirrors the existing `openAttachmentIndex` reset test for the mock-
  attachment placeholder).

Deliberately uncovered: the actual rendered appearance of the dialog (CSS
layout, no attached display — same non-blocking category as every prior
pure-CSS-touching change) and viewing the saved note afterward through
`FileVineView.tsx` itself — that component's own Markdown-rendering path
is already covered by its existing test suite and is unchanged by this
feature (the note is created through the same `fileVineNotes.create` API
`FileVineView.tsx` already uses for every other note). lint/typecheck/build
all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
