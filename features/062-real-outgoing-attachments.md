---
id: 062
title: Mail — real outgoing attachments (file picker)
status: accept
priority: high
---

## Description
Replace the current mock attachment flow (typing a filename into a text
field) with a real OS file picker when composing or replying, so an
actual file from the local filesystem gets attached — the foundation for
features 063/064's content extraction and multimodal handling.

## Acceptance Criteria
- [x] The compose window's attachment control opens a real OS file-picker
      dialog (the same `dialog.showOpenDialog` pattern already used for
      Load/Save Scenario Pack), replacing the current filename text input
- [x] The picked file's name and a reference to its real content (stored
      path or copied file) are attached to the message, persisting
      correctly on both the draft/original copy and, once sent, the Sent
      Items copy
- [x] Multiple attachments can still be added/removed before sending, as
      today
- [x] Picking a file of any type succeeds (attaching doesn't require the
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
713 → 714 net (+1, all passing; re-run 3x, stable), all within
`ComposeWindow.test.tsx`. Rewrote the 5 tests `/implement` left failing
(they drove the old text-input UI) to instead mock
`window.api.attachments.pick` and click the new "Add attachment..." button:
adds one-or-more picked files as chips with real `filename`+`path` and sends
them along (AC1/AC2/AC3 — picking is mocked to resolve twice in sequence to
prove multiple adds work), a canceled dialog (`{ ok: false, canceled: true
}`) adds nothing, and removing a chip still works unchanged. Added one new
test (AC4): picking a file with an unusual/non-specific extension
(`archive.tar.gz`) succeeds and attaches normally, confirming no
extension/type filtering exists anywhere in the flow. Updated both
B004/025 AC4 reply/forward tests (attachment survives onto the Sent Items
copy) to go through the same picker mock and assert the `path` field is
preserved end-to-end through `messages.create`. Left unchanged: "loads
existing attachments from a draft" (filename-only legacy data, no picker
involved) and "does not carry attachments over on reply/forward" — neither
touches the picker.

While rewriting, found and fixed a real accessibility bug introduced by
`/implement`: the `<label htmlFor="compose-attachment">` still pointed at
the new button's `id`, and per HTML's native-labelling rules a `<button>`
is a labelable element, so the label's text ("Attachments") silently
overrode the button's own accessible name ("Add attachment...") — every
`getByRole('button', { name: 'Add attachment...' })` query failed to find
it despite the button rendering correctly. Fixed by making the field caption
a plain `<span className="compose-field-label">` (no label association),
restoring the button's own text as its accessible name; added the matching
CSS selector so the caption keeps its original visual style, and replaced
now-dead `.compose-attachment-add-form`/`input` rules (left over from the
removed mock-input form) with styling for the new button. Not independently
covered by a test: actual computed CSS in a live browser (jsdom here doesn't
load the external stylesheet, the same pre-existing gap as every other CSS
change in this codebase). lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 714/714, re-run 3x, stable.
`git diff --stat` (734dd28..c37e44c) confirms `/implement`+`/test` touched
only the expected files — no drift into unrelated modules.

All 4 ACs re-verified directly against current source:
- **AC1** (`src/main/index.ts:110-122`): `attachments:pick` uses
  `dialog.showOpenDialog` with the identical canceled/empty-`filePaths`
  early-return shape as the pre-existing `scenario:pickPack`/
  `personasFile:pick` handlers it was modeled on. `ComposeWindow.tsx` has no
  remaining text input/form for attachments (`grep` confirms
  `attachmentDraft`/`handleAddAttachment`'s old form-submit signature and the
  `compose-attachment-add-form`/text-`<input>` are gone) — a single button
  calls `window.api.attachments.pick()`.
- **AC2**: `handleAddAttachment` (`ComposeWindow.tsx:81-85`) stores both
  `filename` and the real absolute `path` returned by the dialog handler.
  `persist()` (`ComposeWindow.tsx:91-119`) forwards the same `attachments`
  state into `fields` regardless of `folderId` ('drafts' or 'sent'), so both
  the draft/original copy and the Sent Items copy go through the identical
  code path. `MailDb` (`db.ts:337,362,376,393`) round-trips the attachments
  array via plain `JSON.stringify`/`JSON.parse` with no per-field mapping,
  so the new `path` field survives create and update unchanged — confirmed
  structurally (no field allow-list anywhere in the DB layer) and by the
  two rewritten B004/025 AC4 tests asserting `path` is present on the
  `messages.create` call for both reply and forward.
- **AC3**: `setAttachments`'s functional-update append and `removeAttachment`'s
  index-based filter are unchanged from before this feature — only the
  *source* of a new attachment (picker vs. typed text) changed. Covered by
  the rewritten "opens a real file picker..." test (two sequential picks,
  both attached) and "removes an attachment chip" test.
- **AC4**: the `attachments:pick` dialog config (`src/main/index.ts:114-117`)
  has no `filters` option — unlike `scenario:pickPack`/`personasFile:pick`,
  which both restrict to `.json`. Covered by the new "picking a file of any
  type (no extension filter) succeeds" test (`archive.tar.gz`).

Not independently re-verified: an actual live OS file-picker dialog and
real multi-window Electron click-through (no attached display on this dev
box, and no existing pattern in this repo for mocking Electron's `dialog`
module in a main-process test — same non-blocking gap class flagged on
every prior feature touching `dialog`/main-process code, e.g. 021/022/031).
The main-process `attachments:pick` handler itself has no dedicated
unit test (mirrors the pre-existing, also-untested `scenario:pickPack`/
`personasFile:pick` handlers — this repo's established pattern is to unit
test the pure validation/formatting logic, not the `dialog`-wrapping
handler, and this handler has no validation logic to extract).

All checks pass, no gaps found. Phase set to `accept`.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
