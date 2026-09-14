---
id: 046
title: Tasks side panel
status: backlog
priority: medium
---

## Description
A lightweight Tasks panel, toggled on/off from the View ribbon tab, renders
as a column on the right-hand side of the UI. It shows every currently-
flagged email and lets the user add/complete/remove freestanding tasks that
aren't tied to any email.

## Acceptance Criteria
- [ ] View tab has a Tasks toggle; turning it on shows a right-hand column
      panel, off hides it
- [ ] The panel lists every message currently flagged, live-updating as
      flags change elsewhere in the app
- [ ] The user can add a freestanding task (text + optional due indicator)
      directly in the panel
- [ ] Freestanding tasks can be marked complete and removed
- [ ] Freestanding tasks persist across restarts (a new data model/store —
      flagged mail already persists via existing message flags)
- [ ] The panel's on/off state and freestanding tasks are unaffected by
      which Mail folder or Calendar view is active

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
