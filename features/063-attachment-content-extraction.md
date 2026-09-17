---
id: 063
title: Mail — extract real attachment content into persona LLM context
status: backlog
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
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
