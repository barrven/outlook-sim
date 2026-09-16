---
id: 032
title: Settings — generate personas via LLM
status: validating
priority: medium
---

## Description
Settings' Personas section gains a "Generate Personas" UI — the user enters
a short company/industry description, and the app asks the configured LLM
to generate a full set of personas (name, email, role, bio, writing-style
notes, reports-to) reflecting that company, which the user reviews before
they're added to the persona list.

## Acceptance Criteria
- [ ] A "Generate Personas" control accepts a free-text company/industry
      description and triggers an LLM call using the currently configured
      provider/model/key
- [ ] A successful generation produces one or more well-formed personas
      (all required fields populated, reports-to relationships forming a
      sensible structure) shown to the user before being committed
- [ ] The user can accept (add generated personas to the list) or discard
      the generation result
- [ ] A failed generation (bad key, network error, malformed LLM output)
      shows a clear error rather than corrupting the existing persona list
- [ ] Generated personas persist across restarts like any other persona
      once accepted

## Implementation Notes
New `main/llm/generatePersonas.ts`'s `generatePersonas(config, description)` calls the
existing provider-agnostic `generateText` (AC1: uses `config.getSettings()`, same as every
other LLM call) with a system prompt instructing the model to return ONLY a JSON array
shaped exactly like `PersonasFilePersona` (031's standalone-import-file entry type), plus
guidance to form a coherent, acyclic `reportsTo` structure (AC2). The response is parsed
(stripping an optional markdown code fence some providers add despite instructions) and
handed to 031's existing `validatePersonasFile` — reused as-is rather than duplicated, so a
malformed/incomplete LLM response is caught by the same field-level validation a bad
hand-edited import file goes through, never thrown, never partially applied (AC4). A JSON
parse failure is caught explicitly with its own clear error. New `llm:generatePersonas` IPC
handler (`main/data/ipc.ts`) logs failures to the existing durable LLM failure log (027),
added `'generatePersonas'` to `LlmFailureSource`, matching every other user-triggered LLM
call in this app.

`PersonasSettings.tsx` gained a "Generate Personas" textarea + button below the existing
list/actions. A successful generation stages its result in `generatedPersonas` state and
shows a read-only review list (name/email/role/client/reports-to) with "Add N Personas" /
Discard buttons (AC2/AC3) — nothing is persisted until Accept, which appends (not replaces,
unlike 031's Load Personas file import) the generated personas to the existing list via the
same `personas.set` IPC call manual create/edit already uses, so persistence (AC5) needed no
new code. A failed generation shows the error via the same `settings-test-result-error`
`role="alert"` convention Load Personas/Test Connection use, leaving `personas` state (and
what's already been saved) completely untouched (AC4). A scenario-pack-load reload (030)
discards an in-progress review the same way it already discards an in-progress create/edit
form, since the underlying persona list it was reviewed against is about to change.

Verified live (throwaway tests, run then deleted): a Vitest+stubbed-`fetch` check of
`generatePersonas` covered a well-formed code-fence-wrapped response, non-JSON provider
output, JSON missing a required field, and a network failure — all four resolved to the
right `ok`/error shape, no throw, and (for the failure case) `config.getPersonas()`
confirmed unchanged; an RTL smoke test drove the full UI (generate → review → Accept
appends and persists via `personas.set`, generate → review → Discard leaves the list and
`personas.set` untouched, and a failed generation shows the exact error without touching the
list). lint/typecheck/build pass; existing suite unchanged 536/536 (only `ipc.test.ts`'s
exhaustive channel-list test needed a content touch-up for the new channel).

## Test Notes
Added 21 tests (536 → 557, all passing; re-run 3x, stable), all AC-traceable by number,
across 3 layers:

- `main/llm/generatePersonas.test.ts` (+10, new file, real `generatePersonas` against a
  real `ConfigStore` and a stubbed `fetch`): AC1 — calls the provider/model/key read from
  persisted Settings (not any caller-supplied value) and passes the free-text description
  through as the user prompt; AC2 — a well-formed response parses into fully-populated
  personas with `reportsTo` relationships preserved, including when the provider wraps the
  JSON in a markdown code fence; AC4 — a network error, a provider auth error (bad key),
  non-JSON output, and well-formed JSON missing a required field all resolve to a clear
  `{ ok: false, error }` rather than throwing, and a failure is confirmed to leave
  `config.getPersonas()` completely untouched (this call takes no dependency on the
  persisted persona list at all).
- `main/data/ipc.test.ts` (+4, new `llm:generatePersonas` describe block, real handlers):
  AC1 — the handler reads settings from the real persisted `ConfigStore`, not a
  caller-supplied value; AC4 — mirrors the existing 027-style durable-failure-log test
  pattern (`llm:test`'s), asserting a failure appends exactly one `LlmFailureLogEntry` with
  `source: 'generatePersonas'` and a success logs nothing; a malformed-JSON-response case
  confirms the persona list stays untouched; and a dedicated test pins the structural
  invariant that the IPC handler itself never calls `config.setPersonas` — persistence only
  happens if/when the renderer's Accept flow explicitly does so (AC3/AC5 boundary).
- `renderer/src/components/PersonasSettings.test.tsx` (+7): AC1 — Generate is disabled
  until a description is entered, and clicking it invokes `llm.generatePersonas` with the
  exact typed text; AC2 — a successful generation renders a review list (name/email/role/
  reports-to) *before* `personas.set` is ever called, with explicit Add/Discard controls
  still pending; AC3 — Accept appends the generated personas to the existing list (not
  replacing it, unlike 031's Load Personas) and persists the full merged array with
  generated ids, while Discard persists nothing and leaves the existing list/controls
  exactly as they were; AC4 — a failed generation shows the exact error via the same
  `role="alert"` convention every other LLM-failure surface in this app uses, without
  touching `personas.set` or the existing list; AC5 — an accepted generated persona is
  saved through the identical `personas.set` call manual create/edit and 031's Load
  Personas already use, so restart persistence needed no new code and no new persistence
  test — it's exercised by every existing `ConfigStore`/ `config:personas:set` coverage.

Deliberately not covered: the exact wording/shape of the system prompt sent to the LLM
(an implementation detail, not user-observable behavior); provider-specific response
parsing for Anthropic/Gemini/xAI (already fully covered by `client.test.ts`, which
`generatePersonas` delegates to unchanged); and a live end-to-end Electron GUI click-through
(no attached display in this environment — same non-blocking gap noted on every prior
feature's Validation Notes).

lint/typecheck/build all pass.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
