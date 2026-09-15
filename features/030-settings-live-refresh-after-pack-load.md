---
id: 030
title: Settings panels refresh live after a scenario pack load
status: testing
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
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
