---
id: 069
title: Modern visual style and a registry-based theme system
status: accept
priority: medium
---

## Description
The app gets a modern look — floating rounded panes on a tinted canvas, a
flat ribbon, pill and outline buttons, focus rings, slim scrollbars — and
a new theme system in which every color comes from one registry. All four
existing schemes were redone and two were added. Themes can be switched
from Settings (swatches) or from the View ribbon tab.

Done directly at the user's request, outside the `/features` →
`/implement` chain; parked at `accept`.

**This deliberately departs from `docs/SPEC.md` Core Requirement 2**
("layout/chrome stay classic Outlook, unrounded"). The pane arrangement
(ribbon, folder rail, list, reading pane) is unchanged; its styling is
not classic any more. The spec text has not been edited — that belongs to
`/spec` or `/retro`.

## Acceptance Criteria
- [x] One registry (`src/shared/themes.ts`) defines every theme as a set
      of seed colors; Settings, the View-tab picker, config validation and
      the tests all read it. Adding a theme is adding one entry
- [x] No stylesheet contains a color literal; every color is a token
- [x] The four original schemes (`default`, `sage`, `plum`, `dark`) keep
      their ids so a saved choice still loads, with redone palettes; two
      new themes (`sand`, `midnight`)
- [x] Every theme passes WCAG AA contrast for text, muted text, accent
      text, button labels and status colors on the surfaces they appear on
- [x] A theme can be switched from Settings and from the View ribbon tab,
      applies immediately in every open window, and persists
- [x] `npm run build`, `npm test`, `npm run lint` pass

## Implementation Notes
- `src/shared/themes.ts` — `THEMES` (11 seed colors each: canvas, surface,
  text, muted text, accent, on-accent, danger, on-danger, warning,
  success, flag) and `themeTokens()`, which derives the 32 CSS tokens
  (borders, hover/selection fills, banner tints, focus ring, shadows) by
  mixing seeds. The existing token names are kept, so component CSS did
  not need renaming.
- `src/renderer/src/theme.ts` — `applyTheme()` sets the tokens as custom
  properties on `<html>`, plus `data-theme`, `data-theme-mode` and
  `color-scheme` (so native scrollbars, selects and date pickers follow
  dark themes). The last theme is cached in `localStorage` so a new window
  paints in it immediately; the config file remains the source of truth.
- Styles split into `tokens.css` (radius scale, fonts, pane gap,
  transition — nothing theme-dependent), `base.css` (zero-specificity
  `:where()` defaults for buttons, inputs, focus, scrollbars) and
  `global.css` (components). The old `:root[data-theme=…]` color blocks
  are gone.
- `config.getAppearance()` returns the default for an unknown stored id.
- Reading pane: only Reply is a filled primary button now; Reply All and
  Forward are neutral, so the action row has one clear primary.
- Ribbon Delete is outlined at rest and fills red on hover.
- Theme labels: Azure (`default`), Sage, Plum, Sand, Graphite (`dark`),
  Midnight.

## Test Notes
928 → 978 tests. `globalCssStyling.test.ts` was rewritten: the old tests
pinned the hex-block structure this replaces; the new ones assert no color
literals in any stylesheet, no color token declared in CSS, every `var()`
resolves to a known token, radius and shadow tokens only, and the shared
floating-pane rule. Tests for per-component semantic colors (ribbon
actions, reading pane buttons, clock, flagged rows) were kept. New:
`themes.test.ts` (registry, colour maths, per-theme contrast across all
six themes), `theme.test.ts` (applying, switching, caching, fallbacks),
picker tests in `SettingsView`, `RibbonBar` and `App`, and an
unknown-id case in `config.test.ts`.

## Validation Notes
Build, lint and 978/978 tests pass. Looked at in the running app: mail
(Azure, Graphite), calendar (Midnight, Sage), Settings with the swatch
picker (Sand), Ghost Practice (Plum, Graphite), Tasks panel, and the
Compose window (Graphite).

Not looked at in the running app: message and calendar pop-out windows,
the attachment pop-out, the File menu and right-click menu, the mini
calendar, error and reminder banners, and the inner tabs of an open Ghost
Practice file. These use the same tokens but were not viewed.

## Acceptance Log
_Pending._
