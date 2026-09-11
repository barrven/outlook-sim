---
id: 016
title: LLM unsolicited incoming mail scheduler
status: validating
priority: high
---

## Description
Independent of trainee action, the app periodically generates unsolicited
incoming mail (status updates, demands, reminders, new requests) driven by
the system prompt, personas, current mailbox/calendar state, and simulated
time.

## Acceptance Criteria
- [x] While the simulated clock is running, unsolicited messages arrive in
      Inbox at a reasonable interval (default interval chosen absent spec
      guidance, documented in Implementation Notes)
- [x] Generated messages come from configured personas and reference
      current mailbox/calendar state coherently (e.g. reference an open
      deadline)
- [x] No unsolicited mail arrives while the simulated clock is paused
- [x] Scheduler stops cleanly when the app closes and resumes appropriately
      on relaunch

## Implementation Notes

**New module: `src/main/llm/scheduler.ts`**, with two pieces:

1. **`generateUnsolicitedMail(db, config, clock)`** — the content-generation
   half, structurally parallel to 015's `generatePersonaReply`: picks a
   random configured persona, builds a system prompt (system prompt +
   persona role/bio/writingStyleNotes/extraPrompt + an instruction to write
   a *new*, unsolicited email, not a reply) and a user prompt containing (a)
   the last 5 messages between that persona and the trainee (any subject —
   this isn't reply-specific, just "what's the ongoing relationship"), and
   (b) up to 10 upcoming calendar deadlines/events (`startTime >= now`, past
   ones excluded) via the existing `db.listCalendarItems()`. Calls the same
   `generateText` from 014. Since a *new* message needs its own subject
   (unlike 015's replies, which reuse the original), and `generateText` has
   no structured-output mode, the model is instructed to respond in a fixed
   `Subject: <line>\n\n<body>` format, parsed with a regex; a response that
   doesn't match is treated as a failure (no message inserted) rather than
   inserting something malformed.
2. **`UnsolicitedMailScheduler`** — the scheduling half. A real
   `setInterval` (every 10 real seconds — `CHECK_INTERVAL_REAL_MS`) calls
   `tick()`, which: no-ops if `clock.getState().running` is false (AC3);
   otherwise compares `clock.now()` against a persisted `nextDueSimTime`
   (`ConfigStore.getSchedulerState()/setSchedulerState()`, new methods
   alongside Settings/Identity/Personas/SystemPrompt — a new
   `config/scheduler.json`, same pattern, deliberately **not** exposed via
   IPC since nothing in the renderer needs to read/write it); if due,
   immediately advances `nextDueSimTime` by a fresh random interval *before*
   attempting generation (so a failure — bad key, network — can't retry in
   a tight loop every 10 seconds), then calls
   `generateUnsolicitedMail`. `start()`/`stop()` just wrap the interval
   timer (called from `index.ts`'s existing app-ready / `before-quit`
   hooks, alongside `simClock.start`/`.pause()` — AC4). `tick()` itself is
   public and synchronous-per-call (guarded by a `ticking` flag against
   overlap) so tests can invoke it directly without waiting on a real timer.

**Default interval (AC1, no spec guidance given):** randomized 1–3
simulated hours per cycle (avg. ~2h) rather than a fixed number, so it
doesn't feel mechanical — `MIN_INTERVAL_SIM_MS`/`MAX_INTERVAL_SIM_MS` in
`scheduler.ts`. Because the interval is defined in *simulated* time, it
naturally paces with whatever clock speed (1x–60x) the trainee has chosen,
rather than needing separate tuning per speed.

**AC4 "resumes appropriately on relaunch":** falls out of the existing
013 design rather than needing new logic — `nextDueSimTime` persists across
restarts, and since the sim clock itself is paused on quit (013) and stays
paused until the trainee manually resumes it, no catch-up flood happens on
relaunch; the first `tick()` after resuming just checks whether the
(unchanged, since paused) simulated time has already passed the persisted
due time.

**Wiring:** `index.ts` constructs one `UnsolicitedMailScheduler` alongside
the existing `SimClock`/`MailDb`/`ConfigStore`, passing
`broadcastMessagesChanged`/`broadcastUnsolicitedMailFailed` (both now
exported from `ipc.ts`) as its `onGenerated`/`onFailed` callbacks — reusing
the exact same "Inbox updated" signal 015 already broadcasts on a
successful reply, and a new `llm:unsolicited-mail-failed` channel for
failures. Deliberately did **not** wire this into
`registerDataIpcHandlers` itself: that function runs in every
`ipc.test.ts` test's `beforeEach`, and starting a real background
`setInterval` there would leak timers across ~20 unrelated tests.

**Generalized the error banner from 015:** rather than duplicate a second
banner for this feature's failures, `App.tsx`'s persona-reply-error state
was renamed to `llmBackgroundError`/`llm-error-banner` (generic) and now
also subscribes to the new `onUnsolicitedMailFailed` channel; each source
now formats its own message prefix ("Persona reply failed: …" /
"Unsolicited mail generation failed: …") before setting the shared state,
so 015's exact rendered banner text is unchanged (its existing test still
passes untouched).

**Verified against a real model (beyond mocked tests):** bundled
`scheduler.ts` with `esbuild` and ran `generateUnsolicitedMail` against a
temp DB/config seeded with the real, already-configured Anthropic key/
personas/identity/system-prompt plus one seeded calendar deadline. Result:
a coherent, in-character email from the configured persona that correctly
referenced the seeded deadline by name — strong real-world confirmation of
AC2, not just the Subject/body parsing contract.

**Scope/dependency note:** calendar items (`db.listCalendarItems()`)
already exist at the data layer (feature 002) but there is still no UI to
create them (that's 018/019, both still `backlog`) — so "reference an open
deadline" is fully implemented and tested (including live, above) but
can't yet be demonstrated by a user creating a deadline through the app
itself; only by a scenario/seed file or direct DB insertion until 018/019
land. Same forward-looking-dependency pattern as prior features (e.g.
010's note about 014 not existing yet).

**Files touched:** `shared/data-types.ts` (+`SchedulerState`),
`main/data/config.ts` (+`getSchedulerState`/`setSchedulerState`,
+`scheduler.json`), new `main/llm/scheduler.ts` + `scheduler.test.ts`,
`main/data/ipc.ts` (exported `broadcastMessagesChanged`, added
`broadcastUnsolicitedMailFailed`), `main/index.ts` (construct/start/stop
the scheduler), `preload/index.ts` + `index.d.ts`
(+`onUnsolicitedMailFailed`), `renderer/src/App.tsx` (+generalized error
banner, +subscription), `renderer/src/styles/global.css` (banner class
rename), `renderer/src/test/mockApi.ts` (+`onUnsolicitedMailFailed`),
`main/data/config.test.ts` (+scheduler-state coverage).

## Test Notes

193/193 passing (189 → 193; 4 new on top of the 14 already written during
`/implement`, since a testable design was central to the implementation
itself). Re-ran the full suite 3x — stable.

**AC1 (reasonable interval, running clock):** the "generates once due"
test now asserts the advanced `nextDueSimTime` falls within the
documented 1–3 simulated-hour range (`MIN_INTERVAL_SIM_MS`/
`MAX_INTERVAL_SIM_MS`), not just "some value greater than now." A new
"picks among several configured personas" test runs `generateUnsolicitedMail`
20 times with two personas configured and asserts every generated
message's `fromEmail` is one of the two — proving persona selection
actually varies rather than being hardcoded to the first entry.

**AC2 (personas + coherent mailbox/calendar reference):** in addition to
the existing content-assembly and past-calendar-exclusion tests, a new
test seeds correspondence with a *second*, non-selected persona and
confirms it never leaks into the chosen persona's prompt (participant
scoping is correct, not just "any mail mentioning this trainee").

**AC3 (no unsolicited mail while paused):** in addition to the existing
mocked-`clock.getState()` tests, a new integration-style test wires
`UnsolicitedMailScheduler` to a *real* `SimClock` (not a stub) and drives
it through paused → started → paused again, confirming generation only
happens in the running window — higher-fidelity evidence than mocking
`getState()` return values by hand.

**AC4 (stops cleanly, resumes appropriately):** the existing `start()`/
`stop()` fake-timer test remains the main real-time-polling proof. A new
concurrency test makes `fetch` hang mid-flight, calls `tick()` twice
without awaiting the first, and confirms only one `fetch` call and one
Inbox insert happen — proving the overlap guard (relevant since `start()`
polls every 10 real seconds regardless of how long a prior generation
takes).

**Deliberately not covered:**
- Live network calls to a real provider from an automated test (same
  sandbox limitation as 014/015 — no API keys here); the Subject/body
  parsing contract was instead verified against a real Claude response
  during `/implement` (see Implementation Notes) and again below during
  `/validate`.
- The real Electron app lifecycle actually invoking `before-quit` /
  `app.whenReady` — `index.ts` itself has never been unit-tested in this
  repo (no `index.test.ts` exists for any prior feature either); the
  scheduler's own `start()`/`stop()` are tested directly instead.
- Calendar items created through the app's own UI — no such UI exists
  yet (018/019 are still backlog); tests seed calendar items directly
  via `db.createCalendarItem`, the same interface a future UI would
  eventually call.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
