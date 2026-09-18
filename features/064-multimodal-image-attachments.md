---
id: 064
title: Mail — multimodal image attachments sent directly to the LLM
status: testing
priority: medium
---

## Description
When an attached file (feature 062) is an image, send it directly to the
configured LLM provider/model as an image — not OCR'd or text-extracted —
when that provider/model supports multimodal input.

## Acceptance Criteria
- [ ] An attached image file (PNG/JPEG at minimum) is sent as an image
      content block to the LLM when generating a persona reply, for
      providers/models that support multimodal input
- [ ] For a provider/model that doesn't support multimodal input, the
      image attachment is omitted from the LLM context gracefully — no
      crash, no failed send; the filename still shows in the UI
- [ ] No local OCR or text extraction is attempted on image content
      (matches the spec's Non-goals)

## Implementation Notes
New `src/main/llm/imageAttachment.ts`: `readImageAttachment(filePath)` reads a
PNG/JPEG attachment's raw bytes off disk and base64-encodes them (never
OCR'd/text-extracted — AC3), returning `undefined` for any other extension,
a missing file, or a read error — same never-throws convention as feature
063's `extractAttachmentText`. `LlmGenerateInput` (shared/data-types.ts)
gained an optional `images: Array<{ mimeType, base64Data }>`.
`personaReply.ts`'s `collectImageAttachments()` reads image attachments
fresh from the thread at generation time (not stored as `extractedText`)
and passes them into `generateText`.

`client.ts`'s `buildRequest` attaches images as each provider's native
multimodal content block when present (OpenAI/xAI `image_url` data URLs,
Anthropic `image` base64 source blocks, Gemini `inline_data` parts) — content
stays a plain string when there are no images, so every pre-existing
non-image request/test shape is unchanged (AC1).

AC2 (graceful omission for a non-multimodal provider/model): this app has no
per-model capability list — `model` is a free-text field — so there's no way
to know in advance whether a given model accepts image content. `client.ts`
now tries the request with images first and, only if that attempt fails,
retries once with `images: undefined`, returning that result instead. A
provider/model that rejects the image content block still produces a normal
reply (or a normal unrelated failure, on the retry) rather than surfacing an
image-specific failure — no crash, no failed send, and the attachment's
filename still appears in the thread transcript's "Attachments:" line either
way (unchanged from feature 063).

Verified live via a throwaway script: `buildRequest` produces the expected
content-block shape for all 4 providers given a fake base64 image, and the
retry-without-images path returns a clean success when the first (with-image)
attempt is made to fail. lint/typecheck/build pass; full suite unchanged at
793/793 (no new tests yet — that's `/test`'s job).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
