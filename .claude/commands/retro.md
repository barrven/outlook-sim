---
description: "Dev-loop stage: close out an outer-loop iteration and update the spec"
---

You are running the **retro** stage — the "update" step that closes the outer
loop (`spec > features > loop(implement > test > validate > accept) > retro >
back to spec`). It only runs once the inner loop has drained the backlog
(no `backlog`/`implementing`/`testing`/`validating`/`accept` items left).

1. Read `STATE.md`, `docs/SPEC.md`, `docs/CHANGELOG.md`, and every `done`
   feature file from this iteration.
2. Summarize for the user, briefly: what shipped this iteration, anything
   that surfaced during implementation/validation that the spec didn't
   anticipate, and anything rejected or dropped and why.
3. Ask the user whether the spec needs revising in light of what was
   learned, and whether there's more to build or the project is done for now.
4. If revising: append to `docs/SPEC.md`'s "Changelog of spec revisions"
   section (don't rewrite history, add to it) and make the actual edits to
   the spec body the user agrees to.
5. Update `STATE.md`: bump **Outer iteration**, set **Phase** to `spec` if
   the spec is changing, or straight to `features` if it isn't but there's
   more backlog to generate. If the user says the project is complete, say
   so plainly and leave **Phase** as `retro` — don't invent busywork.
6. Append a History line.
7. Commit and push:
   - `git status` / `git diff` to see what this stage touched.
   - Stage those paths specifically — never a blind `git add -A`.
   - Commit with `Retro iteration N.` (N = the **Outer iteration** just
     closed, from `STATE.md`).
   - If `git commit` fails on missing `user.name`/`user.email`, stop and ask
     rather than inventing an identity.
   - If `origin` exists, `git push origin master`. If the push fails, report
     it and continue — don't force-push or rewrite history to work around it.
8. Hand back to the user.
