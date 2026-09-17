---
id: 062
title: Mail — real outgoing attachments (file picker)
status: testing
priority: high
---

## Description
Replace the current mock attachment flow (typing a filename into a text
field) with a real OS file picker when composing or replying, so an
actual file from the local filesystem gets attached — the foundation for
features 063/064's content extraction and multimodal handling.

## Acceptance Criteria
- [ ] The compose window's attachment control opens a real OS file-picker
      dialog (the same `dialog.showOpenDialog` pattern already used for
      Load/Save Scenario Pack), replacing the current filename text input
- [ ] The picked file's name and a reference to its real content (stored
      path or copied file) are attached to the message, persisting
      correctly on both the draft/original copy and, once sent, the Sent
      Items copy
- [ ] Multiple attachments can still be added/removed before sending, as
      today
- [ ] Picking a file of any type succeeds (attaching doesn't require the
      file to be a supported-for-extraction type — that's features
      063/064's concern, not this one's)

## Implementation Notes
Mirrors the existing `scenario:pickPack`/`personasFile:pick` `dialog.showOpenDialog`
pattern exactly, adding a new `attachments:pick` IPC handler in `main/index.ts`
(no file-type filter, no JSON parsing/validation needed since any file type is
attachable) that returns `{ ok: true, filename, path }` or `{ ok: false,
canceled: true }` (new `PickAttachmentResult` type in `shared/data-types.ts`).
Uses `BrowserWindow.fromWebContents(event.sender)` (falling back to
`mainWindow`) as the dialog's parent, since Compose is its own window, unlike
the two existing handlers which always target `mainWindow`.

`MessageAttachment` gained an optional `path: string` field (optional so
pre-existing filename-only attachment data in old messages keeps loading
without a migration). `ComposeWindow.tsx`'s old
`attachmentDraft`/`handleAddAttachment`(form submit)/text-input trio is
replaced by a single "Add attachment..." button calling
`window.api.attachments.pick()` and pushing `{ filename, path }` into the same
`attachments` state used everywhere else (chips, remove, persist on
draft/sent) — no changes needed to persistence, since `persist()` already just
forwards whatever's in `attachments` state through `messages.create`/`update`
to the SQLite JSON column.

Exposed via preload (`attachments` namespace in `preload/index.ts` +
`AttachmentsApi` in `preload/index.d.ts`) and added a mock entry in
`test/mockApi.ts` (required for `Window['api']` to keep type-checking, per
this repo's convention). Left the 5 pre-existing `ComposeWindow.test.tsx`
attachment tests that drive the old text-input UI (`getByLabelText`
+ typing + `Add` button) failing for `/test` to rewrite against
`window.api.attachments.pick`, per this repo's established convention (same
as features 033/034/035/038). Full suite otherwise green (708/713 passing);
lint/typecheck/build all pass.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
