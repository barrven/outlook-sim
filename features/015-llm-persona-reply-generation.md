---
id: 015
title: LLM persona reply generation
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
