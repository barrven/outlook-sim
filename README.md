# Outlook Trainer

A Windows desktop training sandbox that looks and feels like classic Outlook.
Office employees practice email correspondence and calendar/deadline management
against LLM-generated mock correspondents. No real mail is ever sent or received.
There is no scoring, grading, or coaching — practice only.

The workplace domain is not hardcoded. An editable system prompt plus personas
define the office (legal, insurance, medical, etc.).

This repo is an Electron + Vite + React + TypeScript app (`outlook-sim`).
The packaged product name is **Outlook Trainer**.

## What it does

- Classic Outlook layout: ribbon, left nav (Mail / Calendar), folder pane,
  message list, reading pane, and a separate compose window.
- Mail: folders (Inbox, Drafts, Sent Items, Deleted Items, plus custom folders),
  compose, mock-send, drafts, reply / reply-all / forward.
- Settings: LLM provider (OpenAI, Anthropic, Gemini, Grok/xAI), model, and a
  per-provider API key stored locally.
- Local persistence only: SQLite for mail/calendar runtime data; JSON files
  for settings, system prompt, trainee identity, and personas.

Still in progress: trainee identity & system prompt UI, personas CRUD, the
simulated office clock, live LLM replies and unsolicited incoming mail,
calendar views, search, flags/categories, delete, mock attachments, and
scenario packs. See `docs/SPEC.md` and `features/BACKLOG.md`.

## Non-goals (v1)

- Real SMTP, Exchange, Graph, or IMAP
- Cloud backend or telemetry
- Scoring / grading / coaching UI
- People, Tasks, and Notes modules
- Conversation threading
- Meeting invite / RSVP workflow
- macOS / Linux as a supported product (Windows-only for v1; Linux is used
  for development)

## Prerequisites

- Node.js 22+ (the mail store uses Node's built-in `node:sqlite`)
- npm

## Run locally

```bash
npm install
npm run dev
```

`npm install` runs a `postinstall` script that downloads the Electron
binary (`node node_modules/electron/install.js`). This version of the
`electron` package doesn't declare that as a lifecycle script itself, so
if you ever see an `Error: Electron uninstall` error on `npm run dev`,
re-run `node node_modules/electron/install.js` manually.

On Linux, `npm run dev` launches Electron with `--ozone-platform=x11`.

Other scripts:

| Script | What it does |
|---|---|
| `npm test` | Vitest (renderer + main-process tests) |
| `npm run typecheck` | `tsc --noEmit` for node and web tsconfigs |
| `npm run lint` | ESLint |
| `npm run build` | typecheck + electron-vite production build |
| `npm run dist:win` | Windows NSIS installer via electron-builder |

## Data on disk

Runtime files live in Electron's user-data directory:

- Linux: `~/.config/outlook-sim/`
- Windows: `%APPDATA%\outlook-sim\`

That directory holds `outlook-sim.db` (SQLite) and a `config/` folder with
`settings.json`, `system-prompt.json`, `identity.json`, and `personas.json`.

The app does not send network traffic except future LLM API calls to the
provider the user configures. Mock-send is local persistence only.

## Docs

- `docs/SPEC.md` — living product spec
- `docs/CHANGELOG.md` — what shipped, in user-facing terms
- `features/BACKLOG.md` — feature index and status
- `STATE.md` — current dev-loop phase and active feature

## Dev loop

This project is driven by a file-based loop rather than ad-hoc requests:

```
loop(
  spec > features >
  loop( implement > test > validate > accept ) >
  retro
)
```

| Command | Stage |
|---|---|
| `/spec` | write or revise the product spec |
| `/features` | decompose the spec into a feature backlog |
| `/implement` | build the active feature, then run test and validate, then stop for `/accept` |
| `/test` | write/run tests, then continue into validate |
| `/validate` | lint/typecheck/build/test + check against acceptance criteria; on pass, stop for `/accept` |
| `/accept` | human sign-off gate — the only inner-loop human input. After accept, wait for the next `/implement` |
| `/retro` | close an iteration, feed learnings back into the spec |
| `/dev-loop` | run the stages above automatically. Inner loop: implement → test → validate, then stop at `/accept`. After accept, wait for the next `/implement`. Also stops on an open question, retro concluding the project's done, or repeated failure |
