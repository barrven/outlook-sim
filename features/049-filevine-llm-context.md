---
id: 049
title: FileVine content feeds persona LLM context
status: testing
priority: medium
---

## Description
When generating a persona reply or unsolicited mail (features 015/016) for
a persona that has an associated FileVine folder (feature 047), that
folder's notes/files (feature 048) are included in the persona's LLM prompt
context, so the persona can meaningfully reference and correspond about the
documents there.

## Acceptance Criteria
- [ ] Generating a reply/unsolicited mail for a persona with an associated
      FileVine folder includes that folder's notes/files (name + content,
      or a reasonable summary if very large) in the LLM prompt
- [ ] A persona with no associated FileVine folder generates exactly as
      before this feature (no regression)
- [ ] A live/manual check confirms a persona references specific content
      from its folder when prompted about it (e.g. asking about a deadline
      described only in a FileVine note)
- [ ] A folder content update is reflected in the very next generation for
      that persona — no stale caching

## Implementation Notes
New `main/llm/fileVineContext.ts`: `buildFileVineContextPrompt(db, personaId)`
finds every FileVine folder with `clientPersonaId === personaId` (a persona
can in principle have more than one, though the UI typically assigns one),
lists each folder's notes, and formats name + content into a prompt
section — a per-note character cap (4000) with a `[...truncated]` marker
stands in for "a reasonable summary if very large" (AC1) rather than a
second LLM call to actually summarize, keeping this free/instant/simple.
Returns `null` when the persona has no associated folder, so callers can
omit the section outright (`Array.filter(Boolean)` in the existing prompt-
assembly arrays already does this) instead of including an empty one —
this is what makes AC2 (no-folder personas unaffected) hold structurally,
not just by convention.

Wired into both existing prompt builders exactly where `persona.bio`/
`persona.extraPrompt` already live — `main/llm/personaReply.ts`'s
`buildSystemPrompt` (feature 015) and `main/llm/scheduler.ts`'s
`buildSystemPrompt` (feature 016), each now taking an extra
`fileVineContext: string | null` parameter computed once per call via
`buildFileVineContextPrompt(db, persona.id)`. No new IPC/renderer changes
— this is entirely a main-process prompt-assembly change.

AC4 (no stale caching) needed no code: `buildFileVineContextPrompt` always
re-reads `db.listFileVineFolders()`/`listFileVineNotes()` fresh on every
call, exactly like every other piece of context these two builders already
assemble (recent messages, upcoming calendar items) — there was never a
cache to invalidate.

Verified live: a standalone `esbuild`-bundled script (real `MailDb`/
`ConfigStore`/`SimClock`, only `fetch` stubbed) confirmed the system
prompt sent to the LLM includes both the folder name and specific note
content for a persona with an associated folder; a persona with none gets
no FileVine section at all (byte-comparable to pre-feature behavior); and
updating a note's content changes what's sent on the very next generation
call, with the old content gone. AC3 ("a live/manual check confirms a
persona references specific content... when prompted about it") needs a
real LLM response, not a stubbed one — left for the user to confirm
against their own configured provider/API key, same category of gap as
every prior feature's "no live multi-window Electron GUI click-through
attempted" note. lint/typecheck/build pass; existing `personaReply.test.ts`/
`scheduler.test.ts` unchanged and passing (39/39), confirming no regression
for personas without a FileVine folder.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
