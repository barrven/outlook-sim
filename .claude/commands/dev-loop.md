---
description: "Run the dev loop continuously, stage by stage, until a real human gate or a stopping point"
---

You are the orchestrator for the full dev loop:

```
loop(
  spec > features >
  loop( implement > test > validate > accept ) >
  retro
)
```

The individual stages are documented in `.claude/commands/spec.md`,
`features.md`, `implement.md`, `test.md`, `validate.md`, `accept.md`, and
`retro.md`. Read the one you're about to run before running it, and follow
its steps exactly — this command does not restate their logic, it sequences
them.

Inner-loop rule: `/accept` is the only human input in
`implement > test > validate > accept`. `/implement` already chains test
and validate itself; after a feature is accepted, wait for the user to run
`/implement` (or `/dev-loop`) again — do not start the next feature.

Procedure:

1. Read `STATE.md` to find the current **Phase**.
2. Execute that phase's procedure per its command file above, including all
   of its own file updates (feature files, `BACKLOG.md`, `CHANGELOG.md`,
   `SPEC.md`, `STATE.md`). If **Phase** is `implement`, `test`, or
   `validate`, that command file already chains forward to `accept` — don't
   duplicate the chain here.
3. Move to the phase `STATE.md` now points to and repeat, without waiting for
   the user to type the next `/command` themselves — that's the point of
   this orchestrator — **except** after a successful `/accept` (see below).
4. Keep going through the outer cycle (`spec` > `features` > inner cycle >
   `retro`) **except** stop and hand control back to the user at any of
   these:
   - The `accept` stage's human gate (never skip or auto-answer it).
     After the user **accepts**, stop even if **Phase** is now `implement`
     for the next feature or `retro` because the backlog is empty. Wait
     for them to run `/implement` (or `/retro` / `/dev-loop`) themselves.
     After they **request changes**, continue the inner cycle for the same
     feature (`implement.md` already says to do this).
   - `spec` or `features` surfacing a genuine open question you can't
     resolve without the user.
   - `retro` concluding the project is complete for now.
   - Anything failing repeatedly (e.g. `validate` sends the same feature
     back to `implement` more than twice) — stop and ask rather than
     looping silently.
   - The user interrupts.
5. When you stop, say exactly where you stopped and why, and what running
   `/implement`, `/accept`, `/dev-loop`, or another single-stage command
   will do next.

Do not try to run every remaining phase in a single giant burst of edits with
no checkpoints — narrate progress stage-by-stage as you go so the user can
interrupt if something looks wrong.
