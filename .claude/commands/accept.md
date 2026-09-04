---
description: "Dev-loop inner stage 4: get the user's sign-off on the active feature"
---

You are running the **accept** stage — the one human gate in the inner loop.
Never auto-approve this yourself, even when running inside `/dev-loop`.

1. Read `STATE.md` for the active feature and its feature file, including
   Validation Notes.
2. Present a short summary to the user: what the feature does, how it maps
   to each Acceptance Criterion, and the validation result. Show the actual
   diff or a way to try it if that's cheap to offer.
3. Ask the user to decide, with three real options: accept / request changes
   / reject. Use the AskUserQuestion tool for this so it's an explicit gate,
   not something inferable from silence.
4. Record the user's response verbatim (or a faithful summary) in the
   feature file's "Acceptance Log".
5. Branch on the decision:
   - **Accept:** `status: done`. Append an entry to `docs/CHANGELOG.md`.
     Update `features/BACKLOG.md`. Look at the backlog: if another
     `backlog`-status feature remains, set it as **Active feature** in
     `STATE.md` and **Phase** to `implement`. If none remain, clear **Active
     feature** and set **Phase** to `retro`.
   - **Request changes:** `status: implementing`, **Phase** back to
     `implement`, with the requested changes written into Implementation
     Notes.
   - **Reject:** ask the user whether to drop the feature entirely or send it
     back to `/features` for rethinking; act accordingly (`status: blocked`
     or remove it from the backlog per their answer).
6. Append a `STATE.md` History line and tell the user what's next.
