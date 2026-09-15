---
id: 028
title: Trainee identity & personas — org-structure fields
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
