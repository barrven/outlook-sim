---
id: 068
title: Ghost Practice tab — Ontario accident-benefits file tool (replaces FileVine)
status: accept
priority: high
---

## Description
The FileVine ribbon tab is replaced by a "Ghost Practice" tab implementing
the v1 "IN" list of `features/ghost-practice/SPEC.md`: a matter-centric
workspace for Ontario accident-benefits (AB) files. A legal assistant can
open and maintain an AB file, docket hours, record charges and settlement
fees, file documents in a default AB folder tree, and track benefits,
forms, treatment plans, denials, insurer events, the LAT docket, tasks and
a correspondence log.

This was implemented in one pass outside the usual `/features` →
`/implement` chain (the spec arrived as its own file rather than through
`docs/SPEC.md`), with no per-stage commits. It is parked at `accept` for
sign-off.

## Acceptance Criteria
- [x] The ribbon shows a tab labelled exactly "Ghost Practice" where
      FileVine was; no FileVine tab, heading, or "Save to FileVine" action
      remains in the UI
- [x] FILE-01..11: create/open/close a matter; client, accident, insurer,
      coverage flags, injury track, matter number + status, assignee;
      contacts with a role; search by client / matter # / claim # / date
      of loss; file list filtered by status and assignee
- [x] TIME-01..07: time entries with date, user, hours, description,
      activity, rate (user's default), billable flag; edit and void with a
      trace (never deleted); per-matter list, "My time today", totals by
      user and date range
- [x] CHG-01..06: charges with vendor, amount, tax, category, paid,
      recoverable, receipt flag, linked document; running totals
- [x] SET-01..05: staged settlements with a % / flat / hourly fee; a
      display-only statement (recovery − fee − disbursements = net);
      status moves to partially settled / settled
- [x] DOC-01..07: default folder template on every new matter;
      create/rename/move/delete folders and documents; upload by picker or
      drag-and-drop straight onto the matter; in-place preview; date,
      title, uploader; file-name search across the matter
- [x] WRK-01..10: activity log, tasks, global deadline diary, form
      tracker, treatment plans, benefits, denial register (limitation date
      defaults to +2 years, editable), LAT mini-file, s. 33 / s. 44 / EUO
      events, file summary note
- [x] ADM-02..04: users with role and default rate, firm name and
      letterhead, activity-type and charge-category pick-lists
- [x] Existing FileVine data is carried over, not lost
- [x] `npm run build`, `npm test`, `npm run lint` pass

## Implementation Notes
**Decisions where the spec and "replace FileVine" met, or the spec was
silent:**
- *Existing FileVine data* — migrated once on first launch
  (`MailDb.migrateFileVineData`): each root FileVine folder becomes a
  matter (folder name → client name, client persona link kept), its
  subfolders become that matter's document folders, its notes become
  documents. Old tables are renamed `filevine_*_migrated`, not dropped.
- *FileVine's three behaviours* are kept, retargeted: Markdown notes are
  now a kind of matter document; the persona-LLM context (049) reads the
  matters linked to that persona (`matterContext.ts`: key facts, file
  summary, documents); "Save to FileVine…" (066) is now "Save to Ghost
  Practice…" and saves into a matter's top level.
- *ADM-01 sign-in* — **not built**. Single-user desktop sandbox with no
  accounts; "current user" is the trainee identity from Settings. Users
  in Admin exist only as names with a role and default rate.
- *DOC-04 "preview PDF in place"* — the preview shows the file's
  **extracted text** (same extractor attachments use), plus "Open with
  your default application". A rendered page view would need loosening
  the renderer's CSP / enabling the PDF plugin, which seemed out of
  proportion; flagged for a decision.
- *Uploads* store a pointer to the original file plus its extracted text
  (same model mail attachments use) — the file is not copied into app
  storage.
- *Matter delete* — the spec only says create/open/close; a confirmed
  "Delete file" was added so a sandbox can be tidied.
- *Trackers* — one generic record table + form driven by field
  definitions (`GP_RECORD_FIELDS`), per the spec's "simple
  lists-with-dates, not a rules engine". No SABS deadline auto-calculation
  beyond the +2-year denial default (LATER-05).
- Left as LATER/OUT per the spec: tort files, letter merge, Outlook
  filing, Tracument, reports, permissions, trust/GL.

**Files:** `src/shared/ghostPractice.ts` (types, field definitions, money
and deadline helpers); `src/main/data/db.ts` (`gp_matters`, `gp_records`,
`gp_folders`, `gp_documents`, `gp_admin` + migration); `src/main/data/ipc.ts`
and `src/preload/*` (`window.api.gp`, `attachments.pathForFile`);
`src/main/llm/matterContext.ts` (replaces `fileVineContext.ts`);
`src/renderer/src/components/GhostPracticeView.tsx` and
`components/ghostPractice/*` (replace `FileVineView.tsx`); `App.tsx`,
`RibbonBar.tsx`, `ReadingPane.tsx`, `global.css`.

## Test Notes
872 → 928 tests. FileVine tests removed (`FileVineView.test.tsx`,
`fileVineContext.test.ts`, FileVine blocks in `db.test.ts`/`ipc.test.ts`)
or migrated (`App`, `RibbonBar`, `ReadingPane`, `personaReply`,
`scheduler`). New: `ghostPractice.test.ts` (date maths, money model,
deadlines, search), `matterContext.test.ts`, Ghost Practice blocks in
`db.test.ts` (incl. the FileVine migration against a hand-built legacy
database) and `ipc.test.ts`, and `GhostPracticeView.test.tsx` (files list,
matter home, time, charges, settlement, trackers, diary, LAT, documents,
admin) against an in-memory fake of `window.api.gp`.

## Validation Notes
`npm run build`, `npm test` (928/928), `npm run lint` pass. Checked in the
running app (`electron-vite preview`, driven over the DevTools protocol):
tab label and position, file creation, time entry defaults and totals,
charge totals, denial +2-year default, settlement statement and status
change, default folder tree, Markdown note preview, file delete.

Not checked in the running app: the native file picker upload,
drag-and-drop upload, LLM persona replies using matter context (covered by
unit tests only), and the FileVine migration against real data (the local
database had no FileVine rows).

## Acceptance Log
_Pending._
