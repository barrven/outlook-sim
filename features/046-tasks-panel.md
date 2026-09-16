---
id: 046
title: Tasks side panel
status: testing
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
New data model + store, following the existing `calendar_items`/
`filevine_notes` pattern exactly, no new architecture:
- `shared/data-types.ts`: `Task { id, text, done, dueAt, createdAt }` +
  `NewTask`/`TaskPatch`. `dueAt` is the spec's optional "due indicator" —
  implemented as a plain due-date timestamp, not a full scheduling feature.
- `main/data/db.ts`: new `tasks` table (`id, text, done, due_at,
  created_at`) + `listTasks`/`getTask`/`createTask`/`updateTask`/
  `deleteTask`, mirroring `calendar_items`'s methods. Deliberately **not**
  touched by `resetMailboxAndCalendar`/free-play/scenario-pack loads —
  freestanding tasks are the trainee's own to-do list, not scenario data,
  so they survive a scenario reset the same way Settings/personas already
  do (a judgment call, not spelled out in the AC).
- `main/data/ipc.ts` + `preload/index.ts`/`index.d.ts`: new
  `db:tasks:list/get/create/update/delete` channels and `window.api.data.tasks`,
  symmetric with every other entity's CRUD surface (`get` unused by the
  renderer but kept for interface consistency, matching the codebase's
  existing convention).

UI:
- `RibbonBar.tsx`: View becomes a real, clickable tab (previously a
  disabled placeholder — the code comment there already anticipated this
  feature). It's tracked as its own `viewTabActive` concern, independent
  of `showFileVine`/`activeModule`, since selecting it only swaps which
  ribbon action set shows (now `['Tasks']`) — it never touches which
  Mail/Calendar content is displayed (AC1, and structurally supports AC6).
  The Tasks button is a toggle, not a fire-once action: `aria-pressed` +
  a `.ribbon-action.active` style reflect `showTasksPanel`.
- `App.tsx`: new `viewTabActive`/`showTasksPanel` state. Neither is reset
  by `handleSelectFolder`/`handleSelectModule` — that's what makes AC6
  hold (panel state survives folder/calendar-view navigation) without any
  special-casing. `TasksPanel` renders as an `app-body` sibling after the
  main content, shown whenever `showTasksPanel` is true and Settings isn't
  open (Settings already takes over the whole content area; hiding Tasks
  behind it matches that existing full-screen-takeover convention).
- New `TasksPanel.tsx`: two sections. "Flagged Mail" derives from
  `window.api.data.messages.list()` filtered by `isFlagged` — no new
  broadcast needed, it just refetches on the same `messagesVersion` prop
  App.tsx already bumps on every `data:messages-changed` broadcast (AC2),
  identical to how MessageListPane/ReadingPane already stay live. "Tasks"
  owns its own local list, refetched after each of its own
  create/update/delete calls (no cross-window broadcast — same
  no-broadcast-needed pattern `CalendarView` already uses for its own
  mutations, since nothing else in the app writes to this store).

Tradeoff: the toggle's on/off state is plain in-memory React state, not
persisted — the AC only requires freestanding *tasks* to survive a
restart, not the panel's visibility.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
