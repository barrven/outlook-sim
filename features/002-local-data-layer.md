---
id: 002
title: Local data layer (SQLite + JSON config store)
status: backlog
priority: high
---

## Description
Introduce the persistence layer the rest of the app builds on: a SQLite
database for runtime mail/calendar data (folders, messages, calendar items,
flags, read state) and a JSON file store for configuration (settings, system
prompt, trainee identity, personas, scenario packs). No UI yet — just the
schema/store and read/write APIs.

## Acceptance Criteria
- [ ] SQLite database file is created locally on first run with tables for
      folders, messages, and calendar items (including flag/read-state
      columns)
- [ ] JSON config files are created locally on first run for settings,
      system prompt, trainee identity, and personas
- [ ] App exposes internal read/write APIs for both stores that other
      features can call
- [ ] Data persists across app restarts
- [ ] No network calls are made by this layer

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
