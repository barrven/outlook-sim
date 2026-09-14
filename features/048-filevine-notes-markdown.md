---
id: 048
title: FileVine notes/files CRUD with Markdown content
status: backlog
priority: high
---

## Description
Within a FileVine folder (feature 047), the trainee has full CRUD over
notes/files — each entry has a name and full text content stored as
Markdown, with a formatted (rendered, not raw) Markdown view.

## Acceptance Criteria
- [ ] User can create, edit, and delete a note/file entry within a folder,
      with a name and Markdown body
- [ ] The viewing UI renders the Markdown formatted (headings, lists,
      bold/italic, links, etc.), not as raw text
- [ ] An edit mode exposes the raw Markdown source for editing, distinct
      from the rendered view
- [ ] Notes/files persist across restarts, associated with their folder
- [ ] Deleting a folder also removes its contained notes/files (an
      explicit, deliberate behavior, not silently undefined)

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
