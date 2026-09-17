---
id: 058
title: Color scheme infrastructure + revised default palette
status: backlog
priority: medium
---

## Description
Establish a mechanism for swapping the app's entire color palette at
runtime from a single switch point (e.g. a `data-theme` attribute on the
root element, with scheme-specific CSS custom-property overrides), and
revise the current default palette to use more color and less gray. This
lays the groundwork features 059-061 build on. No ribbon/pane layout
changes — colors only (Core Requirement 2).

## Acceptance Criteria
- [ ] Every color value used throughout the app is still expressed via CSS
      custom properties (tokens) — no new hardcoded colors introduced
- [ ] A scheme-switching mechanism exists (e.g. a root-level
      attribute/class selecting which token set applies) that can swap
      every token's value in one place, even with only one scheme defined
      so far
- [ ] The default scheme's token values are revised to reduce the amount
      of gray/muted color and introduce more distinct hues, while every
      existing acceptance criterion from feature 037 (semantic tokens,
      consistent border-radius, red flags) still holds
- [ ] No ribbon/pane layout, sizing, or chrome changes — this is a
      color-only revision

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
