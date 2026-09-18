---
id: 066
title: Mail — save an attachment into FileVine
status: done
priority: medium
---

## Description
Let the user save an attachment — real (feature 062, with content
extracted per feature 063) or LLM-generated (feature 065) — into a
FileVine folder as a note/file entry. Per 2026-09-18 accept-stage
feedback, this is not scoped to generated attachments only: any
attachment with content to save should get the same action, with no
distinction drawn between the two in the UI.

## Acceptance Criteria
- [ ] An attachment with content available to save (extracted text from a
      real attachment, feature 063, or an LLM-generated attachment's
      content, feature 065) has a "Save to FileVine" action, letting the
      user pick an existing FileVine folder to save it into — with no
      distinction made between a real and an LLM-generated attachment
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

### Addendum (2026-09-18, addressing accept-stage "Request changes")
The user's feedback at `/accept`: "you don't need to differentiate between
LLM generated attachments. any attachment should be able to be saved into
filvine." Removed the `generated` gate entirely — the action now shows for
*any* attachment with content to save
(`attachment.extractedText !== undefined`), regardless of whether it came
from a real trainee-picked file (062/063's extraction) or an LLM-generated
one (065). Dropped `MessageAttachment.generated` from
`shared/data-types.ts` and the `generated: true` `writeGeneratedAttachment`
was setting — nothing reads it anymore. `ReadingPane.tsx`'s button
condition simplified from
`attachment.generated && attachment.extractedText !== undefined` to just
`attachment.extractedText !== undefined`. A true mock/placeholder
attachment (no `path`, pre-062 data) or a real attachment with an
unsupported/failed extraction still correctly gets no action — not because
of what *kind* of attachment it is, but because there's genuinely no
content to put in the note, the structural constraint AC1's revised
wording now captures ("content available to save"), not a
generated-vs-real distinction. lint/typecheck/build pass.

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

### Addendum (2026-09-18, requested-changes fix)
822 → 821 net (all passing; re-run 3x, stable) across the same 2 files —
one obsolete test removed, one AC1 test rewritten, one new AC1 test added.
`generatedAttachment.test.ts`: removed the now-obsolete "marks the
attachment as generated" test (the field it checked no longer exists).
`ReadingPane.test.tsx`'s "066" block renamed to "Save an attachment into
FileVine" (no more "generated"); its AC1 test now covers two attachments
on the same message — one with a real-attachment path/extractedText shape,
one an LLM-generated-shaped one — asserting *both* get exactly one "Save
to FileVine" button each (the point being neither is special-cased,
replacing the old assertion that only the generated one got it); a new
AC1 test confirms an attachment with no content (a plain mock/unsupported
extraction) still gets none, since that's a structural "nothing to save"
constraint, not a generated-vs-real one. The other 7 tests (AC1/AC2 save
flow, AC3 non-destructive, AC4 create-folder path + blank-name guard,
Cancel, cross-message reset) needed no behavioral changes, only the shared
fixture's rename from `GENERATED_ATTACHMENT` to `ATTACHMENT_WITH_CONTENT`
(and dropping its now-nonexistent `generated: true` field). lint/
typecheck/build all pass.

## Validation Notes
lint/typecheck/build pass; full suite (822/822) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (0e93b36..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files; no new dependency
was added (`package.json`/`package-lock.json` unchanged) — this feature
reuses the existing FileVine folder/note IPC surface entirely.

All 4 ACs re-verified directly against current source, not just by
re-running the new tests:

- **AC1** (action on a generated attachment, pick an existing folder):
  `ReadingPane.tsx` gates the "Save to FileVine…" button on
  `attachment.generated && attachment.extractedText !== undefined` — only
  `writeGeneratedAttachment` (065) sets `generated: true`, so a real
  trainee-picked attachment (062), even one with its own `extractedText`
  from 063's extraction, never shows it. The dialog's `<select>` is
  populated straight from a fresh `fileVineFolders.list()` call each time
  it opens, so it can't go stale.
- **AC2** (creates a note viewable in FileVine's existing UI): `handleSaveToFileVine`
  calls `window.api.data.fileVineNotes.create({ folderId, name:
  attachment.filename, content: attachment.extractedText })` — the exact
  same API `FileVineView.tsx`'s own `submitCreateNote` uses for every other
  note, and `attachment.extractedText` already holds the attachment's raw
  Markdown source (065 sets both fields together), so `FileVineView.tsx`'s
  unchanged `renderMarkdown(selectedNote.content)` path renders it
  identically to any hand-written note — confirmed by reading that
  component directly, not just the new code.
- **AC3** (non-destructive): read both `handleSaveToFileVine` and
  `handleCreateFileVineFolderAndSave` end to end — neither calls
  `window.api.data.messages.*` at any point, only `fileVineFolders.create`/
  `fileVineNotes.create`; the message and its attachment are never
  reachable from either function.
- **AC4** (no folders yet → a clear path, not a dead end): when
  `fileVineFolders.length === 0`, the same dialog renders an inline
  create-folder form (name input + submit) instead of any error state or
  disabled button; submitting creates the folder then immediately the note
  in it, one interaction, with a blank name rejected before either API
  call fires.

Also confirmed structurally: `MessagePopoutWindow.tsx` renders the same
`ReadingPane` component with no attachment-specific overrides, so the
action is available there too with no extra wiring, as the Implementation
Notes claimed.

Not independently re-verified: the dialog's rendered appearance/layout (no
attached display — same non-blocking category as every prior CSS-touching
change) and a live click-through of the OS-level interaction (Electron
IPC round-trip) — both are the same category of manual/live gap this
project's other IPC-touching features already carry, not new to this one.
All checks pass, no blocking gaps found.

### Addendum (2026-09-18, requested-changes fix)
lint/typecheck/build pass; full suite (821/821) re-run 4x total across
this round's `/test` and `/validate`, stable. `git diff --stat`
(1c9a5d6..HEAD, from the "Request changes" documentation commit to now)
touched only the expected files — no new dependency added.

Re-verified the revised AC1 directly against current source: grepped for
`generated` across `shared/data-types.ts`, `generatedAttachment.ts`, and
`ReadingPane.tsx` — the only remaining hits are unrelated (the
`generated-attachments` directory name, an unrelated comment about
LLM-generated documents); the field and every reference to it are gone.
`ReadingPane.tsx`'s button condition is exactly
`attachment.extractedText !== undefined`, with no `generated` check
anywhere in the file — confirming the action is available for any
attachment with content, real or LLM-generated, with no distinction. Also
fixed one stale comment (still said "generated attachment" for the
now-generic `saveToFileVineIndex` state) caught during this pass. AC2/AC3/
AC4 are untouched by this fix (same `handleSaveToFileVine`/
`handleCreateFileVineFolderAndSave` bodies as the first validation pass)
and were not re-derived from scratch, but their governing functions were
re-read end to end to confirm nothing in this diff touched them. All
checks pass, no blocking gaps found.

## Acceptance Log
2026-09-18 — user selected "Request changes" against the validation
summary and AC-by-AC mapping. Asked what specifically, the user said:
"you don't need to differentiate between LLM generated attachments. any
attachment should be able to be saved into filvine." Decision: changes
requested — Description/AC1 revised and the fix written up as a dated
addendum in Implementation Notes; `/implement` re-entered to address it,
chaining back through test/validate.

2026-09-18 — after re-validation of the fix (the `generated` gate removed
entirely), user selected "Accept (Recommended)" against the revised
validation summary and AC-by-AC mapping, no further changes requested.
Decision: accepted.
