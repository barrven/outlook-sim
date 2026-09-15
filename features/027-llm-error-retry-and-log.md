---
id: 027
title: LLM error banner — Retry button and durable failure log
status: accept
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
Added 18 tests across 5 layers (467 → 485, all passing, re-run 3x stable),
all AC-traceable by number:

- **`config.test.ts`** (+3) — AC4: the failure log starts empty; entries
  append in order without overwriting earlier ones (three different
  sources in one log); the log survives a close/reopen cycle.
- **`scheduler.test.ts`** (+3, plus one assertion added to an existing
  test) — AC4: the existing "calls onFailed..." test now also asserts the
  scheduler's own `tick()` produces exactly one durable log entry per
  real failure, proving `attemptUnsolicitedMail` is genuinely wired into
  the normal scheduled path, not just the new manual-retry one. A new
  `attemptUnsolicitedMail` describe block covers: a real failure logs one
  entry; a success logs nothing; the no-personas-configured no-op (`{ ok:
  true, sent: false }`) logs nothing either, since that's explicitly not a
  failure.
- **`ipc.test.ts`** (+6) — AC4: `llm:personaReply`'s existing failure test
  now also asserts a log entry with `source: 'personaReply'`; a new
  `llm:test` test covers a failure logging `source: 'testConnection'` and
  a subsequent success adding nothing more (still length 1). AC2/AC3: a
  new test drives the actual Retry mechanics through the real registered
  handlers — call `llm:personaReply` with a `sentMessageId`, get a
  failure, call it again with the *same* id, get a success this time,
  and assert both the success broadcast (`data:messages-changed`) and
  that a message was actually inserted (AC3's "completes the original
  action"), while confirming the failure log keeps the first attempt's
  entry (a later success doesn't retroactively erase history). AC1/AC3: a
  new `llm:retryUnsolicitedMail` describe block covers a failure
  (broadcasts + logs) and a success (broadcasts `data:messages-changed`,
  inserts a message, logs nothing).
- **`App.test.tsx`** (+4) — AC1: a persona-reply failure banner shows both
  a Retry and a Dismiss button. AC2: clicking Retry calls
  `window.api.llm.personaReply` with the exact `sentMessageId` from the
  original failure (not just "some" id) — the concrete proof of "same
  call, same inputs". AC2: a second failure via Retry (simulating the
  main-process handler's own re-broadcast, since `llm.personaReply` is
  mocked at the IPC boundary in these tests) leaves exactly one
  `role="alert"` element on screen with the *new* error text — proving
  update-in-place, not stacking. AC3: a successful Retry clears the
  banner. AC1/AC2/AC3: the same three behaviors (Retry button present,
  calls `retryUnsolicitedMail`, clears on success) covered for the
  unsolicited-mail banner in one combined test, since its Retry path has
  no "same input" to separately verify (there's nothing to replay).
- **`SettingsView.test.tsx`** (+4) — AC1: Retry and a new "Dismiss test
  result" button appear on failure and are both absent on success. AC2:
  Retry re-calls `llm.test` with the exact currently-displayed
  provider/model/key (asserted via `toHaveBeenNthCalledWith`, proving it's
  the same call the original Test Connection click made, not a
  differently-shaped one). AC2: a second Retry failure replaces the
  displayed error text rather than appending to it. AC1: Dismiss clears
  the error without touching any form field (the Model field's value is
  asserted unchanged), distinguishing it from the pre-existing
  "clears on field change" behavior.

Deliberately not covered: no in-app log-viewer tests, since none was
built (not an AC bullet — see Implementation Notes). Real Electron
IPC/contextBridge serialization untested (same non-blocking sandbox gap
noted in every prior feature). Full suite re-run 3x, stable;
lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 485/485, re-run 3x, stable.
`git diff c9d52c7..bb52071` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria, each checked independently of `/implement`'s and
`/test`'s own checks:

- **AC1** (failure banner for persona-reply, unsolicited-mail, and Test
  Connection shows Retry alongside dismiss) — **pass**. `App.tsx` renders
  one banner (`llmBackgroundFailure`) with both a Retry and a Dismiss
  button for both persona-reply and unsolicited-mail failures (confirmed
  by direct code inspection of the render block, matching
  `App.test.tsx`'s assertions); `SettingsView.tsx`'s Test Connection error
  display now has both a Retry and a new "Dismiss test result" button,
  absent on success.
- **AC2** ("same call, same inputs"; a second failure updates rather than
  stacks) — **pass**. By inspection: `handleRetryLlmFailure` re-invokes
  `window.api.llm.personaReply(llmBackgroundFailure.sentMessageId)` — the
  literal id from the original failure, not a fresh lookup — or
  `retryUnsolicitedMail()` (no caller input exists there to replay, so
  "same call" is re-attempting generation, the only sensible reading).
  Non-stacking is structural, not just tested: `llmBackgroundFailure` is a
  single nullable value, not an array, so a second failure of either kind
  necessarily replaces it. `ipc.test.ts`'s new test drives this through
  the real registered handlers (fail, then retry with the identical
  `sentMessageId`, succeed) rather than mocks.
- **AC3** (a successful Retry clears the banner and completes the
  original action) — **pass**. `handleRetryLlmFailure` clears the banner
  based on the IPC call's own resolved `result.ok`, not a broadcast —
  correctly, since `data:messages-changed` never fires when a persona
  legitimately declines to reply, which would otherwise leave a
  successful-but-silent retry's banner stuck. "Completes the original
  action" is inherent: the same `llm:personaReply`/`llm:retryUnsolicitedMail`
  handlers that inserted a message on the first successful attempt do the
  same on a retry — `ipc.test.ts`'s new test asserts a message actually
  lands in `inbox` after the retry succeeds, not just that the banner
  disappears.
- **AC4** (every LLM failure appended to a durable log surviving restart,
  independent of dismissal) — **pass**. All three failure points
  (`llm:personaReply`, `llm:test`, `attemptUnsolicitedMail` — used by both
  the scheduler's own tick and the manual retry handler) append via
  `config.appendLlmFailureLog` at the moment of failure, before any
  broadcast/UI involvement, so dismissing (or never showing) the banner
  has no bearing on it. Independently re-verified live: bundled `config.ts`
  standalone with `esbuild` and ran it against a scratch copy of the real,
  in-use `~/.config/outlook-sim/config/` directory (15 real personas
  carried over, confirming this wasn't a fresh/empty environment) — two
  appended entries, in order, survived a close/reopen cycle, and the real
  on-disk config directory was confirmed byte-for-byte unchanged (md5)
  afterward, with no `llm-failure-log.json` created there (only the
  scratch copy was written to).

Minor, non-blocking observation: in `App.tsx`, the new `LlmBackgroundFailure`
type declaration sits between two import statements (a `type ModuleId`
import follows it) rather than after all imports — harmless since imports
hoist regardless of position, and lint/typecheck both pass, but slightly
unconventional placement worth a cosmetic tidy-up if this file is touched
again.

No live multi-window Electron GUI click-through attempted — same
non-blocking sandbox gap noted in every prior feature (no attached
display). The RTL-driven test coverage plus the independent live
data-layer check above are the strongest available substitute.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
