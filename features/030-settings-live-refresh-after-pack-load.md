---
id: 030
title: Settings panels refresh live after a scenario pack load
status: accept
priority: medium
---

## Description
If Settings is open (in particular the Personas section, and now the
System Prompt section per feature 029) when a scenario pack is loaded, it
now reflects the newly loaded data immediately, without the user needing to
close and reopen Settings.

## Acceptance Criteria
- [ ] With Settings open on the Personas section, loading a scenario pack
      updates the visible persona list without navigating away and back
- [ ] With Settings open on the System Prompt section, loading a scenario
      pack updates the visible system prompt text the same way
- [ ] Loading a pack while Settings is closed is unaffected — the data is
      simply correct the next time Settings is opened, as today
- [ ] An in-progress unsaved edit in an open Settings section is not
      silently discarded any more destructively than existing app behavior
      elsewhere (call out the chosen behavior explicitly in Implementation
      Notes)

## Implementation Notes

**Mechanism.** `SettingsView.tsx`'s `handleLoadScenarioPack` now calls a new
`refreshAfterScenarioPackLoad()` after a pack is actually applied (both the
no-confirmation-needed path and the confirmed-replace path): it re-fetches
`systemPrompt.get()` directly into local state (AC2) and bumps a new
`personasReloadKey` counter passed to `<PersonasSettings reloadKey={...}
/>` as a prop (AC1). `PersonasSettings` owns its own persona list and
editor state in a separate component instance, so it can't be poked
directly from `SettingsView` — its existing mount-only `useEffect` fetch
now depends on `[reloadKey]` instead of `[]`, matching the same
version-counter pattern `App.tsx` already uses for `messagesVersion`
(bumped on `data:messages-changed`, consumed by `MessageListPane`/etc.) —
consistent with an existing convention rather than a new one. The prop is
optional (`reloadKey?: number`) so it stays backward compatible with any
render site that doesn't pass it (none currently do besides
`SettingsView`, but existing tests render `<PersonasSettings />` bare).

**AC3** (Settings closed ⇒ unaffected) needs no code: `App.tsx` already
conditionally renders `<SettingsView />` only when `showSettings` is true
(a ternary, not a CSS-hidden div), so the whole component — and
`PersonasSettings` inside it — is unmounted while Settings is closed.
Reopening it always mounts fresh and fetches current data, exactly as
before this feature.

**AC4 (unsaved-edit handling, called out explicitly per the AC).** Chosen
behavior: **overwritten/discarded, not preserved or merged.** Both the
System Prompt textarea and any open Persona create/edit form get replaced
by the freshly-loaded data — an in-progress unsaved edit in either is
lost. Rationale: `handleLoadScenarioPack` already gates a non-empty
mailbox/calendar/personas replacement behind a `window.confirm(...)`
warning the user that "personas" (and, as of it running at all,
necessarily the system prompt state this refresh call is now surfacing
live) are about to be replaced — the user has already agreed to a
destructive replace to reach this code path at all. Silently preserving a
stale unsaved edit alongside freshly-loaded data would be more confusing
than useful (it'd look like the load half-worked), and there's no existing
precedent in this app for merging/preserving unsaved form state across an
external data replacement — every other destructive action here (Start
Free-Play, deleting the persona currently being edited) already just
overwrites. Concretely: the Personas reload effect unconditionally closes
any open create/edit form (`setCreating(false)`, `setEditingId(null)`)
before/alongside setting the fresh list — a no-op on the ordinary initial
mount, a discard only when triggered by an actual reload after a pack
load. The System Prompt textarea's local state is simply reassigned to
the freshly-fetched value, the same way `handleSaveIdentity`-style
"set state directly" patterns already work elsewhere in this file.

**Verified live before finishing:** a throwaway RTL smoke test (written,
run, deleted — not part of this diff) drove the full flow: with Settings
open on both the System Prompt and Personas sections simultaneously
(they're just different scroll positions on one page, not separate
navigable views), loading a scenario pack updated the visible System
Prompt text and the visible persona list in place, without any
navigation; a second scenario had an in-progress "+ New Persona" form
with unsaved text mid-edit, and confirmed the form was gone (not left
dangling, not silently preserved) after the pack load.

Files touched: `src/renderer/src/components/SettingsView.tsx`,
`src/renderer/src/components/PersonasSettings.tsx`. No shared-type or
main-process changes — this is entirely a renderer-side data-freshness
fix; the underlying `scenario:applyPack` IPC call and its main-process
handling are unchanged.

lint/typecheck/build pass; existing suite unchanged at 506/506 (no
existing test needed updates, and no new tests added here — full
coverage is `/test`'s job next). Phase set to `test`.

## Test Notes
Added 9 tests across 2 files (506 → 515, all passing, re-run 3x stable),
all AC-traceable by number:

- **`PersonasSettings.test.tsx`** (+5, unit-level on the component in
  isolation via `rerender`) — AC1: bumping `reloadKey` refetches the
  persona list and shows the new data, without unmounting/remounting;
  re-rendering with the *same* `reloadKey` does not trigger an extra
  fetch (proving the effect is keyed correctly, not just re-running on
  every render). AC4: a `reloadKey` bump discards an in-progress unsaved
  "+ New Persona" form (the Display Name field and its typed text are
  gone, but the "+ New Persona" button is back — a clean close, not a
  crash) and, separately, an in-progress unsaved *edit* form the same way
  (asserted via `queryByDisplayValue`, and that `personas.set` was never
  called — nothing was silently saved either). Plus a backward-
  compatibility check: rendering with no `reloadKey` prop at all (every
  existing call site before this feature) still fetches exactly once on
  mount, unchanged.
- **`SettingsView.test.tsx`** (+4, integration-level through the real
  parent/child wiring) — AC1: loading a pack updates the visible persona
  list in place, with the Provider section's own field still present
  throughout (proof nothing navigated away). AC2: loading a pack updates
  the visible System Prompt textarea the same way. AC3: unmounting
  `SettingsView` (simulating closing it) and mounting a fresh instance
  with different underlying data shows the fresh data, cleanly, with
  nothing carried over from the previous instance — the actual mechanism
  behind "loading while closed is unaffected." AC4: typing an unsaved
  System Prompt edit, then loading a pack, shows the pack's system prompt
  (not the unsaved draft), and confirms `systemPrompt.set` was never
  called (the discard is silent state replacement, not an accidental
  save).

Deliberately not covered: real Electron IPC/contextBridge serialization
(same non-blocking sandbox gap noted in every prior feature). The literal
"scenario pack loaded via some means while Settings is closed" scenario
isn't separately testable through the UI, since the only way to load a
pack at all is the button inside Settings — AC3 is instead verified via
the unmount/remount behavior that's the actual mechanism guaranteeing it
holds. Full suite re-run 3x, stable; lint/typecheck/build all pass.

## Validation Notes
lint/typecheck/build all pass. Full test suite 515/515, re-run 3x, stable.
`git diff 6c7eaf7..de0637c` (the `/test` stage's commit) confirms it
touched only test files and docs — no implementation drift.

This is a purely renderer-side UI-wiring feature with no main-process or
data-layer component, so — unlike prior features — there's no standalone
`esbuild`-bundled script to independently re-run; the equivalent
"skeptical, don't just re-trust the test suite" check here is direct code
inspection of the actual wiring, done fresh rather than assuming the Test
Notes' description is accurate:

- **AC1** (Personas section updates live) — **pass**. Confirmed by
  reading `PersonasSettings.tsx`'s fetch effect: `useEffect(() => {...},
  [reloadKey])` refetches and calls `setPersonas`/`setLoaded` whenever
  `reloadKey` changes, and `SettingsView.tsx` passes
  `reloadKey={personasReloadKey}`, bumped by `refreshAfterScenarioPackLoad`
  only after a pack is actually applied.
- **AC2** (System Prompt section updates live) — **pass**. Confirmed:
  `refreshAfterScenarioPackLoad` directly awaits
  `window.api.data.systemPrompt.get()` and calls `setSystemPrompt` with
  the result — no intermediate caching or stale-closure risk, since it
  re-fetches rather than trusting the just-applied pack's in-memory
  value (correctly reflects whatever `applyScenarioPack` actually
  persisted, including feature 029's "absent key ⇒ unchanged" case).
- **AC3** (closed ⇒ unaffected) — **pass**. Confirmed in `App.tsx`:
  `{showSettings ? <SettingsView ... /> : ...}` is a ternary, not a
  CSS-hidden element — `SettingsView` (and `PersonasSettings` inside it)
  is fully unmounted while Settings is closed, so there is no live
  component instance for a pack load to (or fail to) notify; reopening
  always mounts fresh and fetches current data via the ordinary
  mount-effect, unchanged from before this feature.
- **AC4** (unsaved-edit handling, called out explicitly) — **pass**, and
  the chosen behavior (overwrite/discard) is exactly what's implemented:
  `refreshAfterScenarioPackLoad` reassigns `systemPrompt` state directly
  (no merge/preserve logic), and `PersonasSettings`'s reload effect
  unconditionally calls `setCreating(false)`/`setEditingId(null)`
  alongside the fresh fetch. Both are backed by `/test`'s coverage
  proving *specifically* that nothing gets silently auto-saved in the
  process (`personas.set`/`systemPrompt.set` are asserted never called
  during a discard) — the in-progress edit is dropped, not persisted
  behind the user's back either.

No live Electron GUI click-through attempted — same non-blocking sandbox
gap noted in every prior feature (no attached display). Given this
feature has no main-process component to independently re-verify outside
the test framework, the code-inspection check above plus the existing
integration-level RTL coverage (which exercises the real parent/child
component wiring, not mocks of it) are the strongest available
substitute.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
