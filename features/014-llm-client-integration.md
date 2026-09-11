---
id: 014
title: LLM client integration
status: done
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

**Automated checks:** lint, typecheck, and build all pass clean. Full test
suite: 151/151 passing, re-run 3x with no flakiness.

**Live network sanity check (beyond the mocked unit tests):** this
sandbox does have outbound internet access (confirmed via `curl` to
`api.openai.com`), so `client.ts` was bundled standalone with `esbuild`
and exercised with real `fetch` calls against all four real provider
endpoints, using syntactically-plausible but invalid API keys (no real
keys exist in this environment). Real responses received and correctly
turned into readable errors, with no thrown exceptions:
- `openai`: real 401 → `"openai API error (401): Incorrect API key provided: sk-inval...xxxx. You can find your API key at https://platform.openai.com/account/api-keys."`
- `anthropic`: real 401 → `"anthropic API error (401): API key is invalid."`
- `gemini`: real 400 → `"gemini API error (400): API key not valid. Please pass a valid API key."`
- `xai`: real 400 → `"xai API error (400): Model not found: grok-2-latest"`

This is stronger evidence than the mocked tests alone: it confirms the
request URL, headers, and body for all four providers are accepted and
evaluated by the real live API (not just theoretically correct), and
that each provider's real error-body shape is parsed into a clear
message exactly as the mocked tests assumed. It does not confirm the
success-path text extraction (`choices[].message.content` /
`content[].text` / `candidates[].content.parts[].text`) against a real
2xx response, since no valid key exists here to get one — that half
still rests on the documented API shapes + mocked tests. Recommend one
real Test Connection click with a real key at `/accept` as the final
confirmation of the success path.

**AC1 (calls all four providers, returns text) — PASS** (with the above
caveat on the success path specifically).

**AC2 (clear error state, no crash) — PASS.** Confirmed twice over: by
the live real-401/400 check above, and by the mocked unit tests covering
missing key, missing model, rejected `fetch` (network error), 429 (rate
limit), and an empty/textless 200 response. `SettingsView.test.tsx`
confirms the error string renders in the UI and the component doesn't
crash.

**AC3 (one common interface, no provider leakage) — PASS.** Grepped the
whole `src/` tree for `LlmProvider`/provider-name literals: they appear
only in `client.ts` (the request/response branching, by design), `shared/data-types.ts`
(type defs), `main/data/config.ts` (default settings values, not
API-call logic), and `SettingsView.tsx` (the dropdown's option list and
plain state — never used to alter what gets sent to `llm.test`). `ipc.ts`
and the preload layer only ever call `generateText`/`llm:generate`/
`llm:test` — none of them branch on provider. The new
"identical call/result shape across all four providers" test in
`client.test.ts` backs this mechanically.

**AC4 (no call without explicit trigger) — PASS, within 014's scope.**
Grepped for every call site of `window.api.llm.*`: the only one anywhere
in the app is `handleTestConnection` in `SettingsView.tsx`, wired solely
to the Test Connection button's `onClick` (no `useEffect`, no call on
mount). `window.api.llm.generate` (the channel intended for 015/016's
real triggers) has zero callers yet — nothing in the app can invoke it
automatically. Tests back this: mounting/loading Settings makes no LLM
call, and registering the IPC handlers alone makes no `fetch` call.
Caveat carried over from Test Notes: since 015 (persona-reply) and 016
(scheduler) don't exist yet, "only send/reply or scheduler tick trigger a
call" can't be verified against a real trigger path — only that 014
itself adds none. Re-check this once 015/016 land.

**Scope check:** `git diff` between the pre-014 commit and the tip of
this feature's work touches exactly the files listed in Implementation
Notes — no unrelated files (confirmed no leakage from the unrelated
013/B001 catch-up work committed just before `/implement` started).

**Not verified (flagged, not blocking):** live Electron GUI exercise of
the Test Connection button end-to-end in the real app window — no
Xvfb/display in this sandbox, same recurring gap as every prior feature,
deferred to the user's own check at `/accept`.

**Outcome: all four Acceptance Criteria pass.** Status set to `accept`.

## Acceptance Log

2026-09-11 — Presented the feature summary, AC-by-AC validation results,
and the live-network sanity-check evidence to the user via
`AskUserQuestion` (accept / request changes / reject). User selected
**Accept**. Decision: `status: done`.
