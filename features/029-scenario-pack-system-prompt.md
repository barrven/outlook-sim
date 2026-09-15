---
id: 029
title: Scenario packs include the system prompt
status: testing
priority: medium
---

## Description
Both saving and loading a scenario pack now include the system prompt,
alongside the existing inbox/personas/calendar/timed-messages. Loading a
pack replaces the current system prompt the same way it already replaces
personas/calendar/inbox.

## Acceptance Criteria
- [ ] Save Scenario Pack writes the current system prompt into the pack's
      JSON
- [ ] Load Scenario Pack applies the pack's system prompt, replacing
      whatever was configured before
- [ ] A pack saved before this feature (missing the system-prompt field)
      still loads without error, leaving the current system prompt
      unchanged
- [ ] Round-tripping (save, then load into a fresh store) preserves the
      system prompt exactly

## Implementation Notes

**Data shape.** Added `systemPrompt?: string` to `ScenarioPack`
(`shared/data-types.ts`) — genuinely optional (`undefined`), not defaulted
to `''` like every other pack field. This is the key design decision: a
pre-029 pack's JSON has no `systemPrompt` key at all, and AC3 requires
that case to leave the current system prompt untouched, which is a
different behavior than "replace with empty" (what an explicitly-empty
`systemPrompt: ""` in a pack should do, per AC2 — replacing whatever was
configured before, including replacing it with nothing). Distinguishing
"key absent" from "key present but empty" is exactly what `undefined` vs
`''` gives here; defaulting to `''` the way `optionalString` does for
every other field would have collapsed that distinction and broken AC3.

**Validation** (`validateScenarioPack`). `root.systemPrompt === undefined
? undefined : requireString(...)` — present-but-wrong-typed still fails
validation with a clear error (consistent with every other field); absent
passes through as `undefined`.

**Apply** (`applyScenarioPack`). `if (pack.systemPrompt !== undefined)
config.setSystemPrompt(...)` — only touches the current system prompt when
the pack actually carried one (AC2 + AC3 in one guard).

**Build** (`buildScenarioPack`). Always includes the current
`config.getSystemPrompt().systemPrompt` (AC1) — system prompt lives in its
own `system-prompt.json`, not `Settings`/API keys, so this doesn't
conflict with the function's existing "never reads Settings, so secrets
can't end up in the file" guarantee (still true, unchanged).

No renderer changes: `SettingsView.tsx`'s Save/Load Scenario Pack flow
already just calls `scenario.savePack()`/`scenario.applyPack()` and
doesn't itself inspect pack contents — the system prompt now riding along
is entirely a main-process concern. Live-refreshing the System Prompt
textarea after a pack load is out of scope (a separate, not-yet-built
feature, 030 — no panel refreshes live after a pack load today).

**Verified live before finishing:** a standalone `esbuild`-bundled
`scenarioPack.ts`/`config.ts`/`db.ts`/`clock.ts` script drove all 4 ACs
directly: `buildScenarioPack` picks up a real configured system prompt;
`applyScenarioPack` replaces a different current one with the pack's;
a hand-constructed pre-029-shaped pack object (the `systemPrompt` key
deleted entirely) validates fine and, when applied, leaves the current
system prompt completely untouched; and building a pack then applying it
into a totally fresh `ConfigStore`/`MailDb`/`SimClock` reproduces the
exact same system prompt string.

Files touched: `src/shared/data-types.ts`, `src/main/data/scenarioPack.ts`.
`src/main/data/scenarioPack.test.ts`'s one exact-shape `toEqual` assertion
needed a content touch-up for the new field — no unrelated behavior
changes.

lint/typecheck/build pass; existing suite unchanged at 498/498 (no new
tests added here — full coverage is `/test`'s job next). Phase set to
`test`.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
