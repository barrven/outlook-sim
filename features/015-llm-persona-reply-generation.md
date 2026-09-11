---
id: 015
title: LLM persona reply generation
status: validating
priority: high
---

## Description
When the trainee sends or replies to a message addressed to a persona, and a
reply is appropriate, the app generates a reply in that persona's voice
using the system prompt, persona details, and thread context, and delivers
it into the Inbox.

## Acceptance Criteria
- [x] Sending/replying to a persona-addressed message triggers an LLM call
      assembling system prompt + persona fields + thread history
- [x] Generated replies appear in Inbox from the correct persona's From
      address, timestamped with simulated time
- [x] The app can decide not to reply when a reply isn't appropriate for
      that context (e.g. an FYI-only message), per system-prompt guidance
- [x] Reply generation failures degrade gracefully (visible error, no
      crash, no partial/garbled message inserted)

## Implementation Notes

**New module: `generatePersonaReply(db, config, clock, sentMessageId)` in
`src/main/llm/personaReply.ts`.** Called after any Send (new compose,
reply, reply all, or forward all go through the same `ComposeWindow`
persist path from feature 004/005). It:
1. Looks up the just-sent message and checks whether its `toEmail`
   matches a configured Persona. If not, it's a no-op (`{ok:true,
   replied:false}`) — this covers plain compose to a non-persona address.
2. Assembles the LLM system prompt from the user's configured System
   Prompt + the matched persona's role/bio/writingStyleNotes/extraPrompt,
   plus explicit instructions on the reply-or-not decision (see below).
3. Assembles thread history: since messages have no explicit
   `conversationId` anywhere in this app, threads are found the same way
   the Re:/Fwd: subject-prefixing (feature 005) already implies — new
   exported helper `findThread()` normalizes the subject (stripping any
   number of leading `Re:`/`Fwd:` prefixes) and matches every message
   between the trainee and this persona with that same normalized
   subject, sorted chronologically. Rendered as a plain From/To/Date/
   Subject/body transcript in the user-prompt.
4. Calls the existing `generateText` from feature 014 — persona-reply is
   just another caller of that one common interface, no new
   provider-specific code.
5. **Reply-or-not decision (AC3):** rather than adding structured
   output/JSON-mode support to the client (a much bigger change to
   014's interface), the system prompt instructs the model to respond
   with exactly the literal text `NO_REPLY` when a reply isn't
   warranted, and with only the reply body otherwise. `generatePersonaReply`
   checks for that exact (trimmed) marker before deciding to insert
   anything.
6. Only ever calls `db.createMessage` (into Inbox, `fromName`/`fromEmail`
   from the persona, `toName`/`toEmail` from the trainee identity,
   `timestamp` from `clock.now()` — simulated time, not wall clock) when
   the LLM call *and* the reply decision both resolve successfully. Any
   failure (missing key, network error, HTTP error, NO_REPLY) inserts
   nothing (AC4).

**Trigger wiring:** `ComposeWindow.tsx`'s `persist()` now captures the
persisted message's id (from `create()`'s return, or the existing
`draftId` when updating) and, only on the `'sent'` branch, fires
`window.api.llm.personaReply(messageId)` — deliberately NOT awaited,
since the compose window closes immediately after (as before) and an LLM
call can take several seconds; blocking Send on it would be a worse UX
than a fire-and-forget call whose outcome surfaces in the main window.

**New IPC channel `llm:personaReply`** (`ipc.ts`) wraps
`generatePersonaReply` and, based on the result, either broadcasts the
existing `data:messages-changed` event (so the main window's Inbox
picks up the new message the same way any other change does) or a new
`llm:persona-reply-failed` event carrying the error string (AC4's
"visible error"). `window.api.llm.personaReply` / `onPersonaReplyFailed`
added to preload.

**Visible error surface:** `App.tsx` subscribes to
`onPersonaReplyFailed` and renders a small dismissible red banner
("Persona reply failed: …") above the ribbon — the only place a fire-
and-forget failure from an already-closed compose window can reasonably
surface. No such banner/toast mechanism existed before this feature.

**Scope decisions (not literally specified by the ACs, called out
explicitly):**
- Only the message's primary `To` persona gets a generated reply; Cc'd
  personas (from reply-all) do not also get one. The ACs describe "the
  correct persona" (singular) replying, not a fan-out to every persona
  on the thread.
- Thread-matching is participant + normalized-subject based (no schema
  migration for an explicit conversation id) — matches the
  Re:/Fwd:-prefix threading convention feature 005 already established
  as this app's model of "a thread."
- Sending a message to a *non*-persona address (e.g. a plain typed
  email) triggers no LLM call at all — correctly a no-op, not a failure.

**Files touched:** new `main/llm/personaReply.ts` + `personaReply.test.ts`,
`main/data/ipc.ts` (+1 handler, +1 broadcast), `preload/index.ts` +
`index.d.ts` (+`llm.personaReply`, +`onPersonaReplyFailed`),
`renderer/src/ComposeWindow.tsx` (fire the call on Send),
`renderer/src/App.tsx` (+error banner state/effect/markup),
`renderer/src/styles/global.css` (+banner styling),
`renderer/src/test/mockApi.ts` (+`llm.personaReply`,
+`onPersonaReplyFailed`, and `messages.create`/`update` now resolve a
full mock `MailMessage` instead of `undefined`, since the new code reads
`.id` off the create result).

## Test Notes

175/175 passing (169 → 175; 6 new on top of the 18 already written during
`/implement`, since a testable design was central to the implementation
itself). Re-ran the full suite 3x — stable.

**AC1 (send/reply triggers an LLM call assembling system prompt + persona
fields + thread history):** `personaReply.test.ts` asserts the actual
request body sent to `fetch` contains the configured system prompt, all
of the matched persona's role/bio/writingStyleNotes, and the thread
history in chronological order; a new test confirms an *unrelated*
thread (different subject) is correctly excluded from that same prompt.
`ComposeWindow.test.tsx` confirms both a fresh Send and a Reply trigger
`window.api.llm.personaReply` with the right message id (Send: the
newly-created message's id; existing draft: the draft's id; Reply: the
newly-created message's id) — covering AC1's "sending/replying" wording
literally, not just one path. `ipc.test.ts` confirms sending to a
non-persona address makes no LLM call at all (correct no-op).

**AC2 (replies appear in Inbox from the correct persona, simulated
time):** new tests cover matching the correct persona out of several
configured ones (not just "a persona"), case-insensitive email matching,
and that the timestamp comes from `clock.now()` and is provably
independent of wall-clock time (mirroring the existing ComposeWindow
clock test pattern from feature 013) — `Date.now()` and `clock.now()`
are spied to different values and the inserted message's timestamp
matches only the simulated one.

**AC3 (decide not to reply per system-prompt guidance):** covered via
the `NO_REPLY` marker path (exact match and whitespace-tolerant), with
the system-prompt test confirming the model is actually instructed about
that marker.

**AC4 (graceful failure — visible error, no crash, no partial/garbled
insert):** covered at three layers — `personaReply.test.ts` (network
error and a real-shaped HTTP error response both resolve `{ok:false,
error}` with nothing inserted, never a thrown exception), `ipc.test.ts`
(the `llm:personaReply` handler broadcasts `llm:persona-reply-failed`
with that exact error string and never `data:messages-changed` on
failure), and `App.test.tsx` (the error renders as a dismissible banner,
and dismissing clears it — the app doesn't crash and the failure is
visible).

**Scope-decision coverage:** a new test locks in that a persona who is
only Cc'd (not the primary To) does *not* also get a generated reply —
only one Inbox message is created, from the primary persona.

**Deliberately not covered:**
- Live calls to real provider APIs (same sandbox limitation as 014 — no
  API keys here; the underlying `generateText` call itself was already
  validated against real live APIs during 014's `/validate`).
- The real Electron multi-window path (compose window closes while the
  main window later shows the reply/error) — Vitest can't drive two real
  BrowserWindows; the fire-and-forget IPC contract and each side's
  reaction to it are tested independently instead (ComposeWindow fires
  the call; ipc.ts broadcasts; App.tsx reacts to the broadcast).
- Group/multi-persona threads beyond the single Cc-does-not-reply case
  above — out of scope per the Implementation Notes' scope decision.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
