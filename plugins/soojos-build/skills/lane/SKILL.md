---
name: lane
description: Set up an isolated git worktree so multiple builds run in parallel without colliding, one task per branch per terminal. Use this whenever the user wants to work on two things at once, mentions running builds in parallel, starts a second task while one is in flight, or asks how to avoid sessions overwriting each other.
---

# Lane

Purpose: one task → one branch → one worktree → one clean lane.

## Create a lane

From the repo root:

```bash
git worktree add ../<repo>-<task> -b <task>
cd ../<repo>-<task>
claude
```

That second working copy is on its own branch. A session running there cannot touch the files of a session in the main checkout.

## Finish a lane

```bash
git checkout main && git merge <task>
git worktree remove ../<repo>-<task>
git branch -d <task>
```

## Rules

- One task per lane. If a lane accumulates two unrelated changes, split it — the merge is where parallel work goes wrong.
- Name the lane after the task, not the date.
- Check `git worktree list` before creating a new one. More than three or four live lanes means work is being started faster than it's being finished; say so.
- Marketplace state is per-user, not per-worktree, so every lane already has the SoojOS plugins. Do not re-add the marketplace inside a worktree.
- Before merging, run the `verify` skill in the lane. Merging unverified work is how a broken main happens.
