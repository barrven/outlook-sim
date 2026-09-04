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

Procedure:

1. Read `STATE.md` to find the current **Phase**.
2. Execute that phase's procedure per its command file above, including all
   of its own file updates (feature files, `BACKLOG.md`, `CHANGELOG.md`,
   `SPEC.md`, `STATE.md`).
3. Move to the phase `STATE.md` now points to and repeat, without waiting for
   the user to type the next `/command` themselves — that's the point of
   this orchestrator.
4. Keep looping through the inner cycle across every backlog feature, then
   through the outer cycle across iterations, **except** stop and hand
   control back to the user at any of these:
   - The `accept` stage's human gate (never skip or auto-answer it).
   - `spec` or `features` surfacing a genuine open question you can't
     resolve without the user.
   - `retro` concluding the project is complete for now.
   - Anything failing repeatedly (e.g. `validate` sends the same feature
     back to `implement` more than twice) — stop and ask rather than
     looping silently.
   - The user interrupts.
5. When you stop, say exactly where you stopped and why, and what running
   `/dev-loop` again (or a specific single-stage command) will do next.

Do not try to run every remaining phase in a single giant burst of edits with
no checkpoints — narrate progress stage-by-stage as you go so the user can
interrupt if something looks wrong.
