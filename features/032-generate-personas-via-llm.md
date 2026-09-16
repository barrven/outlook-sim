---
id: 032
title: Settings — generate personas via LLM
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
