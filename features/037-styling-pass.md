---
id: 037
title: Element-level styling pass — semantic colors, border-radius, red flags
status: backlog
priority: low
---

## Description
Buttons, chips, panels, and other interactive elements get a consistent,
logical color system (e.g. primary/secondary/destructive distinctions) and
a modest border-radius for a more modern feel. The classic-Outlook
ribbon/pane layout and chrome are deliberately left alone. Flag
icons/buttons specifically render in red.

## Acceptance Criteria
- [ ] Buttons/chips/panels across the app use a defined, consistent color
      system (CSS custom properties/tokens), not ad-hoc per-component
      colors
- [ ] Interactive elements have a visible, consistent border-radius (not
      sharp 0px corners)
- [ ] Flag icon/button color is red wherever flags render (Reading Pane
      toggle, message-list row indicator)
- [ ] Overall ribbon/pane layout, sizing, and information density are
      visually unchanged — a regression check, not just a new-styles check

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
