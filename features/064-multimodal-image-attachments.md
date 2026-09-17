---
id: 064
title: Mail — multimodal image attachments sent directly to the LLM
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
