---
id: 055
title: Mail message list — show each message's timestamp
status: testing
priority: low
---

## Description
Show each message's timestamp in the message list row. Today
`.message-list-item` shows only from/subject/categories — no time/date at
all, unlike the Reading Pane header which already shows it.

## Acceptance Criteria
- [ ] Each message row displays its timestamp (date and/or time),
      formatted consistently with how the Reading Pane already displays it
- [ ] Existing row content (subject, from, categories, flag button) remains
      visible and functional alongside the new timestamp
- [ ] No change to sorting, filtering, or search behavior — this is a
      display-only addition

## Implementation Notes
Scoped to `MessageListPane.tsx` + `global.css`. Each row's `from` span is
now wrapped, alongside a new timestamp span, in a
`<div className="message-list-item-top-row">` (`display: flex;
justify-content: space-between;`) — sender on the left, timestamp on the
right, classic Outlook-style row header. Subject and categories stay
exactly where they were, unstacked below (AC2).

Timestamp formatting: `new Date(message.timestamp).toLocaleString()` —
the exact same call `ReadingPane.tsx` already uses for its own
`.reading-pane-timestamp` (AC1's "formatted consistently with how the
Reading Pane already displays it" is satisfied by literally reusing the
same formatting call, not just a visually-similar one).

New CSS: `.message-list-item-top-row` (flex row); `.message-list-item-from`
gained `min-width: 0; overflow: hidden; text-overflow: ellipsis;
white-space: nowrap;` — needed once it became a flex child alongside a
fixed-width timestamp, so a long sender name truncates instead of pushing
the timestamp off the row or wrapping awkwardly; `.message-list-item-
timestamp` (`flex: 0 0 auto`, small muted text, `white-space: nowrap`) so
the timestamp itself never wraps or shrinks.

AC3 (no sorting/filtering/search change): purely additive display markup
— `visibleMessages`'s computation (search/scope filtering, sort order)
is completely untouched; the new elements only read `message.timestamp`
for display, nothing else reads or derives from them.

Verified live via a throwaway RTL script (not committed): the rendered
timestamp text matches `new Date(timestamp).toLocaleString()` exactly
(e.g. "1/15/2026, 10:30:00 AM"); from/subject/categories/flag button all
still render alongside it. lint/typecheck/build pass; full suite
unchanged at 852/852 (no new feature-specific tests yet — that's
`/test`'s job).

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
