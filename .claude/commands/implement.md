---
description: "Dev-loop inner stage 1: implement the active feature, then continue through test and validate"
---

You are running the **implement** stage of the inner cycle
(`implement > test > validate > accept`).

`/implement` is the kickoff for one inner-loop pass. After this stage's
own work, continue into test then validate in the same turn — do not wait
for the user to type `/test` or `/validate`. Stop only when validate has
set **Phase** to `accept`, or at a stopping condition below. `/accept` is
the user's job; never auto-run it.

If `STATE.md` **Phase** is already `test` or `validate`, skip this stage
and start at that one (read its command file and follow it). If **Phase**
is `accept`, tell the user `/accept` is next and stop. If **Phase** is
`spec`, `features`, or `retro`, tell them to run that command instead.

If `STATE.md` History shows this same feature has already been sent back
from `validate` to `implement` more than twice this inner-loop pass, stop
and ask rather than looping.

1. Read `STATE.md` for the active feature, then read that feature's file in
   `features/`. If there is no active feature, tell the user to run
   `/features` first.
2. Set that feature's frontmatter `status: implementing`.
3. Implement it. Follow the repo's existing conventions; don't add scope
   beyond the feature's Description and Acceptance Criteria. If you discover
   the criteria are ambiguous or the feature is bigger than expected, stop
   and say so rather than guessing.
4. Fill in the feature file's "Implementation Notes" (approach, files
   touched, any tradeoffs) — terse, not a narrative.
5. Set `status: testing`, update `features/BACKLOG.md`'s row for this
   feature, set `STATE.md` **Phase** to `test`, append a History line.
6. Commit and push:
   - `git status` / `git diff` to see what this stage touched.
   - Stage those paths specifically — never a blind `git add -A`.
   - Commit with `Implement NNN: <title>.`
   - If `git commit` fails on missing `user.name`/`user.email`, stop and ask
     rather than inventing an identity.
   - If `origin` exists, `git push origin master`. If the push fails, report
     it and continue — don't force-push or rewrite history to work around it.
7. Do not stop here and do not ask the user to run `/test`. Read
   `.claude/commands/test.md` and follow it exactly (it continues into
   validate on its own). Narrate that you are entering the test stage.

When the chained pass reaches `accept`, tell the user validation passed
and `/accept` is next, then stop.
