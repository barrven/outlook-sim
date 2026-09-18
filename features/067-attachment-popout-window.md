---
id: 067
title: Mail — pop-out window for viewing attachments
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
