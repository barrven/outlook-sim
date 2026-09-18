---
id: 067
title: Mail — pop-out window for viewing attachments
status: done
priority: medium
---

## Description
Let any attachment — a real outgoing file (feature 062) or an
LLM-generated incoming document (feature 065) — be opened in its own
pop-out window for viewing, separate from the main Reading Pane.

## Acceptance Criteria
- [ ] Clicking an attachment (in the Reading Pane or a message pop-out
      window) opens it in a new, dedicated pop-out window
- [ ] A generated (HTML) attachment renders its actual HTML content in the
      pop-out
- [ ] A real outgoing attachment's pop-out shows its extracted text
      content (for types feature 063 supports) or a clear fallback
      (filename/type, with an "open with your default application"
      affordance) when direct rendering isn't applicable — the exact
      behavior is decided and documented in Implementation Notes, per the
      spec's Open Questions
- [ ] Closing the attachment pop-out doesn't affect the main window or the
      message it came from, consistent with the app's existing pop-out
      pattern

## Implementation Notes
New `AttachmentPopoutWindow.tsx` mirrors the existing `MessagePopoutWindow`/
`CalendarPopoutWindow` pattern: its own `BrowserWindow`
(`createAttachmentPopoutWindow` in `windows.ts`), opened via a new
`window:openAttachmentPopout` IPC handler (parented to
`BrowserWindow.fromWebContents(event.sender)`, same convention as
`attachments:pick`, so it works whether triggered from the main window or
a message pop-out) and `window.api.attachmentPopout.open(messageId,
attachmentIndex)`. An attachment isn't its own addressable record, so the
window is opened with `messageId` + `attachmentIndex` (not the attachment
data itself) and fetches the parent message the same way
`MessagePopoutWindow` does, then reads out the one entry.

`ReadingPane.tsx`'s `handleAttachmentClick` now opens this pop-out for any
attachment with a `path` (AC1), instead of the old
`window.api.attachments.open` (OS handoff) — that call moves inside the
pop-out itself as the AC3 fallback's "open with your default application"
button. Both call sites this component serves (the main window's Reading
Pane and a message pop-out window) get the change identically, satisfying
AC1's "in the Reading Pane or a message pop-out window" with no extra
wiring, same as every prior `ReadingPane`-shared feature.

Content decision (AC2/AC3, the spec's Open Question #3 — resolved here
rather than deferred): the pop-out determines what to render from the
attachment's *existing* fields only, no new provenance flag (matching
066's "don't differentiate on origin" feedback — this is a rendering
decision based on what content actually exists, not a UI gate):
- **`filename` ends in `.html` AND `extractedText` is set** → this
  combination can only be an LLM-generated document: 065's
  `writeGeneratedAttachment` always forces `.html` and always sets
  `extractedText` to the Markdown source, while 063's real-attachment
  extraction never supports `.html`. Rendered via the exact same
  `renderMarkdown` helper FileVineView (and 066's saved note) use, so it
  looks identical wherever the same content is viewed (AC2).
- **`extractedText` set, filename not `.html`** → a real attachment's
  063-extracted content: plain text, shown verbatim (not run through a
  Markdown renderer, since it's not Markdown source and could contain
  incidental `#`/`*`/`_` characters) (AC3, direct-render case).
- **Neither** (unsupported/failed extraction, an image, etc.) → fallback:
  "No preview is available" + an "Open with your default application"
  button wired to the pre-existing `window.api.attachments.open` (AC3,
  fallback case).

AC4 (closing doesn't affect the main window) falls out structurally from
being a genuinely separate `BrowserWindow`/renderer document, same as
`MessagePopoutWindow`/`CalendarPopoutWindow` already are — no shared state,
nothing extra needed. The window also closes itself if the message/
attachment it was opened for is gone by the time it fetches (mirrors
`CalendarPopoutWindow`'s same dead-window guard).

New CSS (`global.css`, `.attachment-popout-*`) styled to match the
existing pop-out windows' `--pane-bg`/`--text` token usage.

Verified live via a throwaway RTL script (not committed): the generated-
document path renders real Markdown-derived HTML; the real-attachment path
shows extracted text verbatim; the fallback path's button calls
`attachments.open` with the right path; the window closes itself when the
message/attachment is missing; and `ReadingPane`'s click now calls
`attachmentPopout.open(messageId, index)` instead of `attachments.open`.

lint/typecheck/build pass. One pre-existing test (065's "clicking a real
attachment opens it via the OS") now fails because it asserts the old
click behavior this feature deliberately replaces — left for `/test` to
rewrite, per this repo's established convention (e.g. feature 062 left 5
attachment tests failing the same way). Full suite otherwise unchanged at
820/821.

## Test Notes
821 → 833 net (+12, all passing; re-run 3x, stable) across 3 files.

New `AttachmentPopoutWindow.test.tsx` (+8) covers: fetching the right
message and reading out the right attachment by index; AC2 — a `.html` +
`extractedText` attachment renders as real DOM elements (`<h1>`/`<strong>`)
via Markdown, not the literal source text; AC3 — a real attachment's
extracted text renders verbatim (a leading `#` stays plain text, no
`<heading>` role produced) and, separately, a `.html` attachment *without*
`extractedText` (not the generated-document shape) correctly falls back
rather than being misrendered as HTML; the full fallback path (no
preview + "Open with your default application" calling
`attachments.open` with the exact path); AC4 — no cross-window
subscription or shared state (only the one scoped fetch), and the window
closes itself both when the message is gone and when the attachment index
no longer exists on it.

`windows.test.ts` (+3) covers `createAttachmentPopoutWindow`: same icon as
the main window (existing per-window-type pattern), the window title is
set to the attachment's filename, and `messageId`/`attachmentIndex` are
passed through to `loadRenderer` as the exact query params `main.tsx`
reads.

`ReadingPane.test.tsx`: rewrote the one test 067 broke (065's "clicking a
real attachment opens it via the OS") into 067 AC1's actual behavior —
asserts `attachmentPopout.open('msg-1', 0)` is called and
`attachments.open` is *not* (+1 net after replacing an existing test), and
a new test confirms the clicked attachment's own index is passed correctly
when a message has several attachments (not always `0`).

Deliberately uncovered: the actual `window:openAttachmentPopout` IPC
handler in `main/index.ts` and its `BrowserWindow.fromWebContents`
parenting choice — `main/index.ts` itself has no direct test coverage
anywhere in this repo (same as `window:openMessagePopout`/
`window:openCalendarPopout`, `attachments:pick`, etc. — the established
convention is to test the window-creation function in `windows.ts` and the
renderer's own API call, not the thin IPC wiring itself); and the rendered
appearance of the pop-out's CSS (no attached display, same non-blocking
category as every prior CSS-touching feature). lint/typecheck/build all
pass.

## Validation Notes
lint/typecheck/build pass; full suite (833/833) re-run 4x total across
`/test` and `/validate`, stable. `git diff --stat` (100df33..HEAD, the
commit immediately before this feature's `/implement` started) confirms
`/implement`+`/test` touched only the expected files; no new dependency
was added (`package.json`/`package-lock.json` unchanged) — this feature
reuses the existing message/calendar pop-out window pattern and the
existing `renderMarkdown`/`attachments.open` helpers entirely.

During this pass, cleaned up an unnecessary `as string` type cast in
`AttachmentPopoutWindow.tsx` (destructured `extractedText` once and
narrowed on the local binding instead) — a code-quality fix, not a
behavior change; re-ran that file's tests to confirm.

All 4 ACs re-verified directly against current source, not just by
re-running the new tests:

- **AC1** (opens in a dedicated pop-out, from either entry point):
  `ReadingPane.tsx`'s `handleAttachmentClick` calls
  `window.api.attachmentPopout.open(currentMessage.id, index)` for any
  attachment with a `path`; since `MessagePopoutWindow.tsx` renders this
  exact same `ReadingPane` component with no attachment-specific
  overrides (confirmed by reading it directly), both the main window's
  Reading Pane and a message pop-out get the new behavior identically,
  with no separate wiring.
- **AC2** (generated HTML attachment renders its actual content): the
  `isGeneratedDocument` check (`.html` filename + `extractedText` present)
  can only match a `writeGeneratedAttachment`-produced attachment (065
  always sets both together; 063's real-attachment extraction never
  supports `.html`, confirmed by re-reading `attachmentExtraction.ts`'s
  extension lists, unchanged) — rendered via the same `renderMarkdown`
  helper `FileVineView.tsx` and 066's saved note already use.
- **AC3** (real attachment: extracted text or a fallback with an
  open-with-default-app affordance): confirmed both branches read
  directly off `attachment.extractedText`/`attachment.path` with no new
  IPC read, and the fallback button calls the pre-existing
  `attachments:open` handler unchanged.
- **AC4** (closing doesn't affect the main window/message): the pop-out
  is a genuinely separate `BrowserWindow` (confirmed in `windows.ts`) with
  no cross-window broadcast subscription anywhere in
  `AttachmentPopoutWindow.tsx` (grepped — no `onMessagesChanged` or
  similar), and its only two possible side effects (`shell.openPath` via
  the fallback button, and closing itself) never touch message/attachment
  data.

Not independently re-verified: the pop-out's rendered appearance/layout
(no attached display — same non-blocking category as every prior
CSS-touching change) and a live Electron click-through opening a real
generated `.html` file's actual on-disk content end to end (this repo's
established manual-gap category for anything `dialog`/`shell`/window-
creation-adjacent, same as 062/065's own non-blocking gaps). All checks
pass, no blocking gaps found.

## Acceptance Log
2026-09-18 — user selected "Accept (Recommended)" against the validation
summary and AC-by-AC mapping, no changes requested. Decision: accepted.
