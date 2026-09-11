---
id: 014
title: LLM client integration
status: validating
priority: high
---

## Description
A provider-agnostic internal client that sends prompts to whichever
provider/model/key is configured in Settings (010) and returns generated
text, to be consumed by the persona-reply and unsolicited-mail features.

## Acceptance Criteria
- [x] Client can successfully call OpenAI, Anthropic, Gemini, and Grok APIs
      given a valid key/model, returning generated text
- [x] Client surfaces a clear error state in the UI if a call fails (bad
      key, network error, rate limit) without crashing the app
- [x] No provider-specific code leaks into calling features — they call one
      common interface
- [x] No LLM call is made without an explicit trigger (send/reply or
      scheduler tick) — no background chatter beyond what 016 defines

## Implementation Notes

**New module: `generateText(settings, input)` in `src/main/llm/client.ts`.**
A single pure async function is the entire "common interface" (AC3):
`(Settings, { systemPrompt?, userPrompt }) => Promise<{ ok: true; text }
| { ok: false; error }>`. It never throws — every failure path (missing
key, missing model, network error, non-2xx response, empty/unparseable
response body) is caught and turned into `{ ok: false, error }` (AC2).
Provider-specific request shaping (`buildRequest`) and response parsing
(`extractText`/`extractErrorMessage`) are private to this file and
switch on `settings.provider`; nothing outside `client.ts` branches on
provider. No SDKs were added — each provider is called directly via
global `fetch` against its plain REST API (OpenAI/xAI: `/v1/chat/completions`
with `Authorization: Bearer`, xAI's is OpenAI-compatible; Anthropic:
`/v1/messages` with `x-api-key` + `anthropic-version`; Gemini:
`/v1beta/models/{model}:generateContent?key=`), matching this repo's
existing no-added-dependency-if-avoidable pattern.

**IPC surface (`src/main/data/ipc.ts`):** two handlers, both just thin
wrappers around `generateText`:
- `llm:generate(input)` — reads provider/model/key from the *persisted*
  `ConfigStore` settings. This is what future callers (015 persona-reply,
  016 scheduler) will use for real triggered calls.
- `llm:test(settings)` — takes explicit settings from the caller instead
  of reading persisted config, so the Settings UI can test whatever is
  currently typed into the form without requiring Save first.

Exposed to the renderer as `window.api.llm.{generate,test}` (preload +
`preload/index.d.ts`), alongside the existing `data`/`compose`
namespaces.

**Explicit-trigger UI (AC4/AC1/AC2 end-to-end verification):** since 015
(persona-reply) and 016 (scheduler) — the real callers — don't exist yet,
014 has no automatic trigger of its own (correctly: AC4 requires none).
To still make AC1/AC2 concretely verifiable and give the user a way to
confirm a real key/model actually works, added a "Test Connection" button
to `SettingsView`'s LLM Provider section, calling `llm:test` with a fixed
throwaway prompt ("Reply with exactly one word: pong") and rendering
either the returned text or the error message inline. This is itself an
explicit, user-initiated trigger — not background chatter — so it stays
within AC4. Any field edit (provider/model/key) clears the stale result.

**Tradeoff:** AC1 ("can successfully call... APIs") is verified by unit
tests against mocked `fetch` responses shaped like each provider's
documented API (request URL/headers/body, and response parsing), not
against the real live APIs — no API keys are available in this sandbox.
Deferred to the user's own manual check via the new Test Connection
button at `/accept`, same pattern as prior features' live-Electron gaps.

**Files touched:** `shared/data-types.ts` (added `LlmGenerateInput`/
`LlmGenerateResult`), new `main/llm/client.ts` + `client.test.ts`,
`main/data/ipc.ts` (+2 handlers), `preload/index.ts` + `index.d.ts`,
`renderer/src/components/SettingsView.tsx` (+Test Connection button/state),
`renderer/src/styles/global.css` (+result styling),
`renderer/src/test/mockApi.ts` (+`llm` mock).

## Test Notes

151/151 passing (148 → 151; 3 new tests added on top of the substantial
suite already written during `/implement`, since building a testable
client was central to the implementation itself). Re-ran the full suite
3x — stable.

**AC1 (calls all four providers, returns text):** `client.test.ts` has
one test per provider (openai, xai, anthropic, gemini) mocking `fetch`
and asserting both the outgoing request (URL, auth header shape, body)
and the extracted reply text match that provider's documented API.
Real live-API verification is out of reach here (no API keys in this
sandbox) — same gap called out in Implementation Notes, deferred to the
user's own check via the new Test Connection button at `/accept`.

**AC2 (clear error state, no crash):** `client.test.ts` covers missing
key, missing model, HTTP 401 (bad key), HTTP 429 (rate limit), network
failure (rejected fetch), and an empty/no-text response — every path
resolves `{ok:false,error}` rather than throwing. `SettingsView.test.tsx`
covers the UI side: an error result renders inline without the component
crashing, and the error text is exactly what `llm:test` returned.
`ipc.test.ts` covers a rejected `fetch` surfacing as a resolved (not
rejected) IPC call.

**AC3 (one common interface, no provider leakage):** a new test in
`client.test.ts` calls `generateText` with the identical `(settings,
input)` shape across all four providers and asserts an identical
`{ok:true,text}` result shape — nothing about the call site differs by
provider. Provider branching is structurally confined to `client.ts`
(private `buildRequest`/`extractText`); confirmed by inspection that no
other file (`ipc.ts`, `SettingsView.tsx`) references `LlmProvider` values
or provider-specific URLs/headers.

**AC4 (no call without explicit trigger):** two new tests assert the
*absence* of a call: `SettingsView.test.tsx` mounts and loads Settings
and asserts neither `llm.generate` nor `llm.test` was called until the
button is clicked; `ipc.test.ts` asserts that registering the IPC
handlers alone triggers no `fetch`. There is no scheduler yet (016) and
no persona-reply caller yet (015), so "only send/reply or scheduler tick
trigger a call" can't be tested end-to-end from a real trigger — only
that 014 itself introduces none. Re-verify this once 015/016 land.

**Deliberately not covered:** live network calls to real provider APIs
(no keys available); the Electron multi-window "does the Settings window
actually reach a real API over the real internet" path (same live-app
gap as every prior feature — no Xvfb/display in this sandbox).

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
