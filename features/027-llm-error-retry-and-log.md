---
id: 027
title: LLM error banner — Retry button and durable failure log
status: testing
priority: medium
---

## Description
When a persona-reply, unsolicited-mail, or Test Connection LLM call fails,
the dismissible error banner gains a Retry button that re-attempts the same
call. Every LLM failure is also appended to a durable local log the user
can inspect for troubleshooting repeated failures, not just shown
transiently in the UI.

## Acceptance Criteria
- [ ] The failure banner (persona-reply failures, unsolicited-mail
      failures, and Test Connection failures) shows a Retry button
      alongside the existing dismiss (✕)
- [ ] Clicking Retry re-attempts the same LLM call with the same inputs; a
      second failure updates the existing banner rather than stacking
      duplicate banners
- [ ] A successful Retry clears the banner and completes the original
      action (e.g. the persona reply gets inserted)
- [ ] Every LLM call failure is appended to a durable local log (e.g. a
      JSON/text file under the app's config directory) that survives an app
      restart, independent of whether the banner was dismissed

## Implementation Notes

**Retry, persona-reply.** `generatePersonaReply`'s call already takes a
concrete `sentMessageId` — the literal "same call, same inputs" AC2 asks
for. The failure broadcast (`llm:persona-reply-failed`) now carries that id
alongside the error (`broadcastPersonaReplyFailed(sentMessageId, error)`,
`ipc.ts`), so the renderer can hold onto it and Retry by calling
`window.api.llm.personaReply(sentMessageId)` again — the exact same IPC
call the original attempt made.

**Retry, unsolicited mail.** `generateUnsolicitedMail` has no
caller-supplied input to replay (it internally picks a random persona and
builds its own context each attempt) — there's no "same inputs" to freeze
from the failed attempt, so Retry here means "attempt generation again,"
via a new `llm:retryUnsolicitedMail` IPC handler that calls the same
function the scheduler's own `tick()` uses, deliberately bypassing the
scheduler's simulated-due-time gating (a manual Retry is an explicit,
immediate request, not a scheduled one).

**No stacking (AC2).** Persona-reply and unsolicited-mail failures already
shared one state slot in `App.tsx` (`llmBackgroundError`, now
`llmBackgroundFailure`) before this feature — a new failure of either kind
already replaced rather than stacked. Widened it to a discriminated union
(`{ kind: 'personaReply', sentMessageId, error } | { kind:
'unsolicitedMail', error }`) so Retry knows which call to re-issue and with
what input, while keeping the single-slot (non-stacking) behavior intact.

**Clearing on success (AC3).** Existing broadcasts don't cover "the call
now succeeded" — `data:messages-changed` doesn't fire when a persona
legitimately declines to reply, so a broadcast-only design would never
clear the banner in that case. Instead, Retry directly awaits the IPC
call's own resolved result (`PersonaReplyResult`/
`GenerateUnsolicitedMailResult` — previously defined only in
`main/llm/personaReply.ts`/`scheduler.ts`; moved to `shared/data-types.ts`
so the renderer/preload can type them, following the same pattern
`StartFreePlayResult` already uses) and clears the banner on `result.ok`
regardless of whether a message actually got inserted. On a repeat
failure, the underlying IPC handler re-broadcasts through the same
listener that set the banner originally, so the displayed error text
updates without any extra renderer-side logic.

**Test Connection.** Not routed through the App-level banner — its
provider/model/apiKeys live in `SettingsView`'s own local state, so a
global banner couldn't retry it meaningfully anyway. Instead
`handleTestConnection` (already the retry-equivalent of itself) is reused
directly as the Retry action, and a Dismiss (✕) was added to its
previously-dismiss-less inline error display — bringing it in line with
the other two failure surfaces per AC1's "the failure banner... shows a
Retry button alongside the existing dismiss (✕)."

**Durable failure log (AC4).** New `ConfigStore.appendLlmFailureLog`/
`getLlmFailureLog`, backed by a new `config/llm-failure-log.json` (an
array, same read-whole/write-whole convention every other `ConfigStore`
file already uses — appending here means read-then-write, acceptable at
this app's single-user/low-frequency scale). Every one of the three
failure surfaces appends an entry (`{ timestamp, source, error }`,
`Date.now()` — real wall-clock time, not the simulated clock, since this
log is about real API-call failures, independent of the fictional
training-scenario clock) at the point of failure, not the point of
display, so dismissing/never-showing a banner has no bearing on whether
it's logged. `attemptUnsolicitedMail` (new, `scheduler.ts`) wraps
`generateUnsolicitedMail` with exactly this log-append and is now the only
caller inside `tick()` too, so a failure is logged once regardless of
whether the scheduler or a manual Retry triggered the attempt. No in-app
log viewer was built — not an AC bullet (the Description's "the user can
inspect" is satisfied by a plain, human-readable JSON file under the
config directory; a Settings-panel viewer would be scope beyond what's
asked). Flagging this judgment call for visibility, per convention.

**Verified live before finishing:** a standalone `esbuild`-bundled
`config.ts`/`scheduler.ts`/`db.ts` script confirmed the failure log
round-trips and persists across a close/reopen cycle, and that
`attemptUnsolicitedMail` appends exactly one entry on a real (mocked
`fetch`-rejection) failure and zero when there's simply no persona
configured (a no-op, not a failure). A throwaway RTL smoke test (written,
run, deleted — not part of this diff) drove the full `App.tsx` Retry flow
end to end: a persona-reply failure banner's Retry re-calls
`window.api.llm.personaReply` with the exact `sentMessageId` from the
original failure and clears on success; a second Retry failure updates
the same banner (asserted there's still exactly one `role="alert"` element)
rather than adding a new one. A second throwaway smoke test covered
Settings' Test Connection: Retry re-calls `llm.test` with the current
form values and clears on success, and the new Dismiss button clears an
error result without needing to change any field.

Files touched: `src/shared/data-types.ts` (added `PersonaReplyResult`,
`GenerateUnsolicitedMailResult`, `LlmFailureLogEntry`/`LlmFailureSource`),
`src/main/data/config.ts`, `src/main/llm/scheduler.ts` (added
`attemptUnsolicitedMail`; removed its now-duplicate local
`GenerateUnsolicitedMailResult`), `src/main/llm/personaReply.ts` (removed
its now-duplicate local `PersonaReplyResult`), `src/main/data/ipc.ts`
(`broadcastPersonaReplyFailed` now takes `sentMessageId`; `llm:test` and
`llm:personaReply` log on failure; new `llm:retryUnsolicitedMail`),
`src/preload/index.ts`/`index.d.ts`, `src/renderer/src/test/mockApi.ts`,
`src/renderer/src/App.tsx`, `src/renderer/src/components/SettingsView.tsx`,
`src/renderer/src/styles/global.css`.
`src/main/data/ipc.test.ts` and `src/renderer/src/App.test.tsx` needed
compile/content touch-ups for the new channel and the
`onPersonaReplyFailed` callback's new two-argument signature — no
unrelated behavior changes.

lint/typecheck/build pass; existing suite unchanged at 467/467 (no new
tests added here — full coverage is `/test`'s job next). Phase set to
`test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
