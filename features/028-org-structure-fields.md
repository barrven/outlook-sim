---
id: 028
title: Trainee identity & personas — org-structure fields
status: accept
priority: medium
---

## Description
Trainee Identity in Settings gains "Reports to" and "Department" fields;
the Persona create/edit form gains a "Reports to" field. Together these let
the configured cast express a real corporate reporting structure, not just
a flat contact list.

## Acceptance Criteria
- [ ] Trainee Identity form has Reports To and Department fields, saved and
      loaded alongside the existing identity fields
- [ ] Persona create/edit form has a Reports To field (free text, since a
      persona may report to someone outside the configured persona list),
      saved and loaded alongside existing persona fields
- [ ] Both new fields are optional (empty is valid) and persist across
      restarts
- [ ] Existing trainee identity / persona data saved before this feature
      (missing these fields) loads without error, defaulting them to empty

## Implementation Notes

**Data layer.** Added `reportsTo`/`department` to `TraineeIdentity` and
`reportsTo` to `Persona` (`shared/data-types.ts`) — both plain required
`string` fields (empty string means "not set"), matching this codebase's
existing convention (e.g. `role`, `bio`) of not using `?:` for optional-in-
spirit string fields. AC4 ("existing data missing these fields loads
without error, defaulting to empty") is enforced at the data layer, not
just the UI: `ConfigStore.getIdentity()` now merges the parsed file over
`DEFAULT_IDENTITY` (`{ ...DEFAULT_IDENTITY, ...parsed }`), and
`getPersonas()` maps each persona through `{ ...persona, reportsTo:
persona.reportsTo ?? '' }` — so every reader (renderer, main-process code,
tests) gets `''` for a pre-028 record, not `undefined`, regardless of
where it's consumed. (Tried `{ reportsTo: '', ...persona }` for the
persona case first — TypeScript's TS2783 flagged it as "will be
overwritten" since `Persona.reportsTo` is a required field the compiler
assumes is always present in `persona`; the `?? ''` form sidesteps that
false assumption cleanly.) The renderer components also guard defensively
at the point of reading into form state (`persona.reportsTo ?? ''` in
`PersonasSettings.tsx`, `identity.reportsTo ?? ''` in `SettingsView.tsx`)
— redundant given the config-layer fix, but cheap insurance against any
future direct construction that bypasses `ConfigStore`.

**UI.** `SettingsView.tsx`'s Trainee Identity section gained "Reports To"
and "Department" text inputs (both optional, placeholder "Optional"),
saved/loaded alongside the existing three fields via the same
`handleSaveIdentity`/loading-`useEffect` path — no new save button or
persistence mechanism. `PersonasSettings.tsx`'s create/edit form gained a
"Reports To" text input (free text, not a dropdown of configured personas
— the spec explicitly notes a persona may report to someone outside the
configured cast), positioned after Role, before the Client checkbox.

**Scenario packs.** `ScenarioPackPersona` doesn't carry a `reportsTo`
field — out of this feature's scope, and consistent with how 047's
`isClient` was already left out of scenario packs (trainer-side data, not
scenario data). `applyScenarioPack` now defaults loaded personas'
`reportsTo` to `''` alongside the existing `isClient: false` default.

**Verified live before finishing:** a standalone `esbuild`-bundled
`config.ts` script wrote raw pre-028-shaped JSON directly to disk (an
`identity.json` missing `reportsTo`/`department`, a `personas.json` entry
missing `reportsTo`) and confirmed `ConfigStore` loads both without
throwing, with the missing fields correctly defaulting to `''` — then
round-tripped fresh identity/persona data with real `reportsTo`/
`department` values. A throwaway RTL smoke test (written, run, deleted —
not part of this diff) drove the full UI: editing and saving Trainee
Identity's Reports To field (prefilled from loaded data), a legacy
identity object missing the new fields rendering blank inputs without
error, creating a persona with Reports To, and a legacy persona (missing
`reportsTo` entirely) opening for edit with a blank Reports To field.

Files touched: `src/shared/data-types.ts`, `src/main/data/config.ts`,
`src/main/data/scenarioPack.ts`, `src/renderer/src/components/SettingsView.tsx`,
`src/renderer/src/components/PersonasSettings.tsx`,
`src/renderer/src/test/mockApi.ts`. Existing test fixtures across
`config.test.ts`, `ipc.test.ts`, `no-network.test.ts`, `scenarioPack.test.ts`,
`personaReply.test.ts`, `scheduler.test.ts`, `ComposeWindow.test.tsx`,
`FileVineView.test.tsx`, `PersonasSettings.test.tsx`, `SettingsView.test.tsx`,
`composeIntent.test.ts` needed compile/content touch-ups for the two now-
required fields — no unrelated behavior changes.

lint/typecheck/build pass; existing suite unchanged at 485/485 (no new
tests added here — full coverage is `/test`'s job next). Phase set to
`test`.

## Test Notes
Added 13 tests across 3 layers (485 → 498, all passing, re-run 3x stable),
all AC-traceable by number:

- **`config.test.ts`** (+6, real `ConfigStore`, no mocking) — AC1/AC3:
  identity `reportsTo`/`department` survive a close/reopen cycle. AC2/AC3:
  persona `reportsTo` survives a close/reopen cycle. AC3: both fields are
  optional — an explicit empty string round-trips as empty (not coerced
  to something else). AC4: a raw `identity.json` written directly to disk
  in the pre-028 shape (missing `reportsTo`/`department` entirely) loads
  without throwing and defaults both to `''`; same for a raw
  `personas.json` entry missing `reportsTo`.
- **`SettingsView.test.tsx`** (+4, plus 2 existing assertions updated for
  the now-non-empty `IDENTITY` fixture) — AC1: Reports To/Department
  prefill from saved identity. AC1/AC3: editing and saving both fields
  persists them alongside the existing three (asserts the exact
  `identity.set` payload). AC3: leaving both blank on save persists them
  as `''`, not omitted or some other sentinel. AC4: an identity object
  missing the two fields entirely (simulating pre-028 data returned by
  the API) renders both inputs blank rather than crashing or showing
  `undefined`.
- **`PersonasSettings.test.tsx`** (+5, plus 1 existing assertion extended
  for the now-non-empty `PERSONA` fixture's `reportsTo`) — AC2: creating a
  persona with a Reports To value persists it; leaving it blank on create
  persists `''` (optional, AC3). AC2: the existing Edit-prefill test now
  also asserts Reports To prefills from the persona being edited; a new
  test edits it and confirms the save payload reflects only that change,
  same pattern the existing Role-edit test already used. AC4: a persona
  object missing `reportsTo` entirely opens for edit with a blank field
  instead of crashing.

Deliberately not covered: real Electron IPC/contextBridge serialization
(same non-blocking sandbox gap noted in every prior feature). Full suite
re-run 3x, stable; lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 498/498, re-run 3x, stable.
`git diff affdca0..e59a380` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

Acceptance criteria, each checked independently of `/implement`'s and
`/test`'s own checks:

- **AC1** (Trainee Identity form has Reports To/Department, saved/loaded
  alongside existing fields) — **pass**. Confirmed by code inspection:
  `SettingsView.tsx`'s `handleSaveIdentity` includes both in the saved
  `TraineeIdentity` object, and the loading `useEffect` populates both
  from `identity.get()`. Independently re-verified live below.
- **AC2** (Persona form has a free-text Reports To field, saved/loaded
  alongside existing fields) — **pass**. Confirmed by inspection:
  `PersonasSettings.tsx`'s `handleSubmit` spreads the whole form
  (including `reportsTo`) onto the persona; it's a plain text `<input>`,
  not a dropdown of configured personas, matching the spec's explicit
  "may report to someone outside the configured cast."
- **AC3** (both fields optional; persist across restarts) — **pass**.
  `db.test.ts`/`config.test.ts`-style unit coverage plus the live check
  below confirm persistence across a real close/reopen; an explicit blank
  value round-trips as `''`, not omitted or coerced.
- **AC4** (pre-feature data loads without error, defaulting to empty) —
  **pass**, and unusually strongly confirmed: this session's own real,
  in-use `~/.config/outlook-sim/config/identity.json` and `personas.json`
  genuinely predate this feature (no synthetic legacy fixture needed) —
  `identity.json` has no `reportsTo`/`department` keys at all, and none of
  its 15 real personas have `reportsTo`. Loading them via a fresh
  `esbuild`-bundled `config.ts` against a scratch copy did not throw, and
  every reader defaulted the missing fields to `''` while leaving every
  other field (names, roles, bios, etc.) intact — then a further
  round-trip (setting real values for the trainee's identity and one
  persona) persisted correctly while every *other* persona correctly kept
  its `''` default (not accidentally overwritten by the map). Real on-disk
  config directory confirmed byte-for-byte unchanged (md5) afterward —
  only the scratch copy was written to.

No live multi-window Electron GUI click-through attempted — same
non-blocking sandbox gap noted in every prior feature (no attached
display). The RTL-driven test coverage plus the live check against this
session's own real production config data are the strongest available
substitute — arguably a more convincing AC4 check than a synthetic
fixture would have been, since it proves the real trainee's actual saved
data (not a stand-in shaped to match the bug) survives the upgrade.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
