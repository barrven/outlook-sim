---
id: 010
title: "Settings: LLM provider, model & API key storage"
status: backlog
priority: high
---

## Description
Settings screen lets the trainee pick an LLM provider (OpenAI, Anthropic,
Gemini, Grok/xAI) and model, and enter/store an API key per provider
locally.

## Acceptance Criteria
- [ ] Settings UI lists OpenAI, Anthropic, Gemini, and Grok (xAI) as
      selectable providers
- [ ] User can pick a model for the selected provider
- [ ] User can enter and save an API key per provider; keys persist across
      restarts in local JSON (per spec's Open Question default: plaintext
      local storage for v1)
- [ ] Switching provider/model selection updates which key is used for
      subsequent LLM calls
- [ ] No API key is ever transmitted anywhere except to that provider's own
      API

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
