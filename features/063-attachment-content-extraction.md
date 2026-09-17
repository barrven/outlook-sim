---
id: 063
title: Mail — extract real attachment content into persona LLM context
status: testing
priority: high
---

## Description
When a message with a real attachment (feature 062) is sent, extract
readable text content from supported file types — PDF, plain text, DOCX,
XLSX, CSV, PPT/PPTX — and include it in the relevant persona's LLM
context, so replies can reference the attachment's actual content. No
OCR: image attachments are handled separately by feature 064.

## Acceptance Criteria
- [ ] Sending a message with a supported-type attachment extracts its text
      content and stores it (or a reference usable at reply-generation
      time) alongside the message
- [ ] Generating a persona reply to a message with extracted attachment
      content includes that content in the LLM prompt/context — verified
      by a live LLM response referencing something specific from the
      attachment (a manual check against a real provider/API key, the
      same category as this project's other "live LLM" acceptance
      criteria)
- [ ] Each of PDF, plain text, DOCX, XLSX, CSV, and PPT/PPTX produces
      readable extracted text (testable per format against a fixture
      file)
- [ ] An unsupported file type or an extraction failure doesn't block
      sending — the message still sends, the attachment is still present,
      just with no extracted content contributed to LLM context

## Implementation Notes
New `src/main/llm/attachmentExtraction.ts`'s `extractAttachmentText(filePath)`
dispatches on file extension: `.txt`/`.csv` are read directly as UTF-8 text
(CSV's raw comma-separated form already counts as "readable text" — no
tabular reformatting attempted); `.pdf`/`.docx`/`.xlsx`/`.pptx` go through
the new `officeparser` dependency's `parseOfficeAsync`. Anything else
(including legacy binary `.doc`/`.xls`/`.ppt`, which `officeparser` doesn't
support) or any thrown error (corrupted file, missing file, etc.) resolves
to `undefined` — never throws — satisfying AC4. Extracted text is truncated
at 4000 chars with a `[...truncated]` suffix, mirroring feature 049's
`MAX_NOTE_CONTENT_CHARS` FileVine convention exactly (per `docs/SPEC.md`'s
Open Question on this).

Picked `officeparser@5.1.1` specifically (pinned via `^5.1.1`, which stays
within the 5.x line) rather than the current `8.0.0` — versions 6.0.0+
bundle `tesseract.js`/OCR as a hard dependency, which this project
deliberately has no pipeline for (Core Requirement 3 / `docs/SPEC.md`'s
excluded-scope list: images go to a multimodal LLM directly instead,
feature 064). `npm audit` flags a moderate advisory in a transitive
`file-type` version this pin carries, but that code path only triggers when
`officeparser` is given a `Buffer` — we only ever pass it a real file path,
so it's unreachable here; a deliberate, documented tradeoff rather than an
oversight.

New IPC: `attachments:extractText` (main/index.ts) — no `dialog` involved,
just wraps the pure extraction function; exposed via preload's
`attachments.extractText`. `MessageAttachment` gained `extractedText?:
string`. `ComposeWindow.tsx`'s `persist()` now extracts text for every
attachment with a `path` and no `extractedText` yet, but **only when
`folderId === 'sent'`** (AC1 says "when...sent", and re-extracting on every
draft autosave would be wasteful) — idempotent, so a draft re-sent later or
an attachment extracted on an earlier send attempt isn't redone.

AC2's LLM-context wiring: extended `personaReply.ts`'s
`buildThreadTranscript` (already listed attachment filenames per message)
to also append each attachment's `extractedText`, when present, as a
`--- Content of <filename> ---` block after the message body — this is the
`userPrompt` half of the LLM call, not the system-prompt/FileVine-context
half (049's mechanism), since attachment content is specific to one
message in the thread, not persona-wide background. `scheduler.ts`
(unsolicited incoming mail) wasn't touched — it generates persona-initiated
messages, never a reply referencing something the trainee attached, so
there's no attachment content to surface there.

Verified live end-to-end (not just by inspection): generated real fixture
files (LibreOffice-converted .docx/.xlsx/.pptx/.pdf, each containing a
unique marker string, plus hand-written .txt/.csv) and ran
`extractAttachmentText` against all six directly — every supported type
correctly returned its marker text; an unrecognized extension and a
nonexistent file path both resolved to `undefined` without throwing.
lint/typecheck/build all pass; full suite unchanged at 714/714 (every new
field is optional, so no existing shape broke). Left for `/test`: the four
new surfaces (extraction module per-format, the IPC round trip, the
compose-time wiring/idempotence, and the transcript's attachment-content
block) have no automated coverage yet.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
