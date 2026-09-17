---
id: 065
title: Mail — LLM-generated incoming attachments
status: backlog
priority: high
---

## Description
When a scenario calls for a persona-generated (incoming) email to include
a document attachment, the LLM produces that document's text, which gets
rendered into a real HTML file written to local disk — replacing today's
filename-only mock for incoming mail.

## Acceptance Criteria
- [ ] A persona reply or unsolicited-mail generation can produce an
      attachment: the LLM's response includes document content for it,
      distinct from the email body itself
- [ ] That content is rendered into a real HTML file written to disk
      (under the app's existing local data directory), not just a
      filename placeholder
- [ ] The generated attachment is downloadable/openable by the user — a
      real file exists and is reachable from the UI
- [ ] A generated attachment persists correctly alongside its message
      (survives app restart, shows up when the message is reopened)
- [ ] Not every persona-generated message needs an attachment — this only
      applies when the scenario/LLM determines a document is warranted;
      the everyday no-attachment flow is unaffected

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
