---
id: 014
title: LLM client integration
status: backlog
priority: high
---

## Description
A provider-agnostic internal client that sends prompts to whichever
provider/model/key is configured in Settings (010) and returns generated
text, to be consumed by the persona-reply and unsolicited-mail features.

## Acceptance Criteria
- [ ] Client can successfully call OpenAI, Anthropic, Gemini, and Grok APIs
      given a valid key/model, returning generated text
- [ ] Client surfaces a clear error state in the UI if a call fails (bad
      key, network error, rate limit) without crashing the app
- [ ] No provider-specific code leaks into calling features — they call one
      common interface
- [ ] No LLM call is made without an explicit trigger (send/reply or
      scheduler tick) — no background chatter beyond what 016 defines

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
