---
id: 061
title: Settings — Appearance color scheme switcher
status: testing
priority: medium
---

## Description
Add an "Appearance" control in Settings letting the user pick between all
available color schemes (feature 058's default, feature 059's two
additional light schemes, and feature 060's dark scheme). The choice
persists like any other setting.

## Acceptance Criteria
- [ ] A new "Appearance" control in Settings lists all 4 available color
      schemes and lets the user pick one
- [ ] Selecting a scheme applies it immediately across the whole app, no
      restart required
- [ ] The selected scheme persists across app restarts, stored the same
      way other settings are (JSON config)
- [ ] On launch, the app applies the persisted scheme; a fresh install
      defaults to the revised default scheme from feature 058

## Implementation Notes
New "Appearance" config category, following the exact pattern
`systemPrompt`/`identity` already use end to end:

- `shared/data-types.ts`: `ColorScheme` union (`'default' | 'sage' |
  'plum' | 'dark'`, the same four values as global.css's
  `:root[data-theme='...']` blocks) and `AppearanceConfig { colorScheme
  }`.
- `main/data/config.ts`: `appearance.json`, default `{ colorScheme:
  'default' }` (AC4 — fresh install gets 058's default scheme),
  `getAppearance`/`setAppearance`.
- `main/data/ipc.ts`: `config:appearance:get`/`:set` handlers.
  `:set` also calls a new `broadcastAppearanceChanged`, mirroring the
  existing `broadcastMessagesChanged`/`broadcastCalendarItemsChanged`
  cross-window pattern — every open window (main, Compose, message/
  calendar pop-outs) is its own document with its own `data-theme`
  attribute, so a change made in one has to reach all of them (AC2).
- `preload/index.ts` + `index.d.ts`: exposes `data.appearance.get/set`
  and `onAppearanceChanged`.
- `renderer/src/main.tsx`: on every window's own bootstrap, fetches the
  persisted scheme and sets `document.documentElement.dataset.theme`
  (AC3 — applies on launch), then subscribes to
  `onAppearanceChanged` for live updates from other windows. This one
  file is the shared entry point for all four window types (App/
  Compose/MessagePopout/CalendarPopout — see the query-param branch
  below it), so this covers all of them without touching each
  component.
- `renderer/src/components/SettingsView.tsx`: new "Appearance" section,
  a single `<select>` (like the Provider picker) listing all 4 schemes.
  Unlike every other section here, there's no Save button — `onChange`
  applies the scheme to the current window immediately
  (`document.documentElement.dataset.theme`) *and* persists+broadcasts
  via `appearance.set`, matching AC2's "applies immediately" wording.
- `renderer/src/test/mockApi.ts` + `main/data/ipc.test.ts`: updated the
  shared `Window['api']` mock and the "registers every documented
  channel" list — both are typed/asserted against the full API surface,
  so they don't compile/pass without the new members even though this
  isn't new feature-specific test coverage (deferred to `/test`).

Scenario pack load does NOT refresh Appearance (unlike System Prompt/
Personas) — color scheme is a device-level preference, not scenario
content, same reasoning `settings` (LLM provider) is already excluded
from that refresh.

`index.html`'s static `data-theme="default"` is left as-is — it's only
ever the pre-JS fallback; `main.tsx` overwrites it on every load.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
