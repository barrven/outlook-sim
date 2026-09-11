---
id: 012
title: "Settings: personas (contacts) CRUD"
status: done
priority: high
---

## Description
Settings screen lets the trainee create, edit, and delete personas
(contacts), each with display name, email, role, bio, writing-style notes,
and an optional extra prompt. Personas are usable as contacts and as mail
To/From parties.

## Acceptance Criteria
- [x] User can create, edit, and delete personas with all specified fields
      (display name, email, role, bio, writing-style notes, optional extra
      prompt)
- [x] Personas persist across restarts in local JSON
- [x] Personas appear as selectable recipients in mail compose (To field)
- [x] Persona data is stored in a form ready for later LLM prompt assembly

## Implementation Notes

**Backend already existed:** `Persona { id, displayName, email, role, bio,
writingStyleNotes, extraPrompt }`, `ConfigStore.getPersonas/setPersonas`
(JSON), and `window.api.data.personas.get/set` IPC all already existed
from feature 002. `config.ts` only exposes whole-array get/set (no
per-item create/update/delete IPC, unlike folders/messages) — CRUD here
mutates the array client-side and writes the full array back on each
action.

**AC3 was already true before this feature touched anything:**
`ComposeWindow.tsx` already calls `window.api.data.personas.get()` and
renders them as `<option>`s in the To dropdown (feature 004) — see
`src/renderer/src/ComposeWindow.tsx:23,134`. Compose windows fetch fresh
on open, so no live-update broadcast is needed when personas change in
Settings (unlike messages, which needed `data:messages-changed` in
feature 004 because the main window stays mounted).

**New component: `PersonasSettings.tsx`**, rendered as the 4th section in
`SettingsView.tsx` (list + CRUD, more state/logic than a flat field form,
so split out rather than inlined like the other three sections):
- A list of existing personas (name, email, role) each with Edit/Delete
  buttons.
- "+ New Persona" opens an inline editor form (Display Name, Email, Role,
  Bio, Writing Style, Extra Prompt — Extra Prompt has an "Optional"
  placeholder per the spec's explicit "optional extra prompt"; the other
  fields aren't given hard validation beyond requiring Display Name +
  Email to be non-empty, since an emailless/nameless persona couldn't
  usefully be a mail To/From party — AC1).
- Save (create or edit) writes the recomputed full array via
  `personas.set()` immediately — no separate page-level Save button,
  matching `FolderPane`'s immediate-persist CRUD pattern rather than the
  other three sections' "type then click Save" pattern, since this is a
  list of records being added/edited/removed rather than one record's
  fields.
- Delete removes the persona and persists immediately, with no
  confirmation dialog — matches `FolderPane`'s existing delete UX (no
  `window.confirm`, consistent styling of behavior already in this repo).
- IDs generated client-side (`generatePersonaId`), following the same
  pattern as `FolderPane`'s `generateFolderId`.

**AC4 ("stored in a form ready for later LLM prompt assembly"):** already
true, same reasoning as feature 011's system-prompt AC4 — every field is
a plain string (feature 002's design), the simplest directly-usable form;
no transformation is needed until an LLM client (feature 014/015)
actually assembles persona context into a prompt.

**Files touched:** `src/renderer/src/components/PersonasSettings.tsx`
(new), `src/renderer/src/components/SettingsView.tsx` (renders the new
section), `src/renderer/src/styles/global.css`. No changes to
`data-types.ts`, `config.ts`, `ipc.ts`, preload, or `ComposeWindow.tsx` —
all already correct from features 002/004.

## Test Notes

Added 7 new tests in `PersonasSettings.test.tsx` (103 → 110 total, all
passing), plus typecheck/lint/build all clean.

- **Empty state:** shows "No personas yet." when the list is empty.
- **List rendering:** an existing persona shows its name and
  `email · role`.
- **Validation:** "Add Persona" stays disabled until both Display Name
  and Email are non-empty (typing name alone isn't enough; email
  completes it) (AC1).
- **Create:** fills all six fields except Extra Prompt (deliberately left
  blank to prove it's genuinely optional, per the spec's "optional extra
  prompt"), submits, and asserts `personas.set()` is called with the full
  array — the pre-existing persona unchanged plus the new one with a
  generated, non-empty `id` and every field (including `extraPrompt: ''`)
  matching what was typed. Also confirms the editor closes and the new
  persona appears in the list afterward (AC1, AC2's "the UI correctly
  calls set" half).
- **Edit:** clicking Edit prefills all six fields from the existing
  persona (proving no field is dropped on the round trip into the form);
  changing one field and clicking Save calls `personas.set()` with that
  one persona updated in place and everything else byte-identical to the
  original, and the list reflects the change (AC1).
- **Cancel:** discards in-progress edits — `personas.set` is never called,
  and the original data is still shown (not itself an AC, but the natural
  counterpart to Save that's cheap to lock in given the editor state
  machine already exists).
- **Delete:** removes the target persona and persists the remaining array
  intact — verified with two personas so the surviving one's data proves
  nothing else was mutated (AC1).

**AC2 ("persist across restarts in local JSON"):** the "restarts" half is
not re-tested here — same reasoning as features 010/011: `ConfigStore`'s
persona round-trip is already covered by `config.test.ts`'s pre-existing
`round-trips personas` and `persists all four stores across a
close/reopen cycle` tests, and `ConfigStore` is unchanged by this feature
(confirmed via `git diff`). What's new and tested above is that the UI
calls `personas.set()` with the right shape for create/edit/delete.

**AC3 ("personas appear as selectable recipients in mail compose"):** not
re-tested here — already covered by `ComposeWindow.test.tsx`'s existing
tests (from feature 004), which mock `personas.get()` and assert the
persona renders as a `<option>` in the To dropdown and is selectable.
This feature doesn't touch `ComposeWindow.tsx` at all.

**Deliberately not covered:**
- No network-call assertion re-added — same `ConfigStore` JSON-write path
  already covered by `no-network.test.ts`; this feature adds no new I/O
  code.
- AC4's "ready for later LLM prompt assembly" — no prompt-assembly code
  exists yet to test against (feature 014/015); the persisted shape is
  covered by `config.test.ts`.
- Uniqueness/collision handling for generated persona IDs wasn't tested —
  `generatePersonaId()` follows the exact same `Date.now() + random`
  pattern already used untested by `FolderPane`'s `generateFolderId`
  (from feature 003), so this isn't a new risk introduced here.

## Validation Notes

**Automated checks — all pass:**
- `npm run lint` — clean, no output.
- `npm run typecheck` — clean, no output.
- `npm run build` — clean (main/preload/renderer all built successfully).
- `npm test` — **110/110 passing** (full suite, not just this feature's
  new tests).
- No leftover `console.*`/`TODO`/`FIXME` in `PersonasSettings.tsx`.

**Extra mechanical checks:**
- `git diff --stat HEAD -- src/main/data/config.ts src/shared/data-types.ts
  src/main/data/ipc.ts src/preload/index.ts src/preload/index.d.ts
  src/renderer/src/ComposeWindow.tsx` — empty. Confirms the Implementation
  Notes' claim that this is UI-only.
- Read the real, already-existing `~/.config/outlook-sim/config/personas.json`
  (untouched, read-only) — `{ "personas": [] }`, matching `PersonasConfig`
  exactly, so no compatibility gap.
- Read `ComposeWindow.tsx:23` and `:128-138` directly to confirm the AC3
  claim: `personas.get()` is fetched on mount and rendered as `<option>`s
  in the To `<select>`, unconditionally — not something added or touched
  by this feature.

**Acceptance criteria:**

1. **"User can create, edit, and delete personas with all specified
   fields (display name, email, role, bio, writing-style notes, optional
   extra prompt)"** — PASS. `PersonasSettings.tsx` provides a list with
   Edit/Delete per persona and a "+ New Persona" editor covering all six
   fields. Verified by tests: create (with Extra Prompt deliberately left
   blank, proving it's genuinely optional rather than silently required),
   edit-in-place preserving untouched fields, delete leaving the
   remaining array intact, and Add-Persona's disabled state gating on
   Display Name + Email.

2. **"Personas persist across restarts in local JSON"** — PASS. The UI
   half (calling `personas.set()` with the correct full array on every
   create/edit/delete) is verified directly by the new tests; the
   restart-persistence half rides on the unmodified, already-tested
   `ConfigStore` (`config.test.ts`'s `round-trips personas` and
   `persists all four stores across a close/reopen cycle`) — confirmed
   unchanged via `git diff` above, not just asserted.

3. **"Personas appear as selectable recipients in mail compose (To
   field)"** — PASS, and pre-existing: `ComposeWindow.tsx` has fetched and
   rendered personas as To options since feature 004, confirmed by direct
   code read above and by `ComposeWindow.test.tsx`'s existing tests. This
   feature adds the missing piece — a way to actually create/edit those
   personas — without touching the compose side at all.

4. **"Persona data is stored in a form ready for later LLM prompt
   assembly"** — PASS by design, same reasoning as features 010/011's
   equivalent AC: every field is a plain string (feature 002), the most
   directly usable form for prompt assembly; no LLM client exists yet to
   verify an actual assembly step against (feature 014/015).

**Live Electron GUI verification:** not re-attempted — same sandbox
limitation (no Xvfb, no passwordless sudo) documented in feature 005's
`/validate` and reconfirmed in features 010/011's. Nothing about the
environment has changed. This feature's CRUD logic (list mutation,
full-array persist, editor open/close/prefill) is covered end-to-end by
integration-level tests against the real rendered DOM and click handlers,
so this is judged low-risk and deferred to the user's own check at
`/accept`.

## Acceptance Log

Presented the feature summary (behavior per AC, the "already-true AC3"
note, validation results including the 110/110 test run and the
real-JSON-file compatibility check, and the live-GUI-verification gap)
via `AskUserQuestion` with three options: Accept / Request changes /
Reject. The user selected **Accept**.

**Decision: accepted.**
