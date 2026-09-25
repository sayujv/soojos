# Astra resume playbook — soojos-desk

Written 25 September 2026 by Claude while Astra was offline (Codex usage limit). Everything
below is in place; the only things Astra needs to do are in **Step 1** and **Step 2**.

## Step 1 — one command

```sh
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/preflight.py --tests
```

It prints a PASS/WARN/FAIL checklist and ends with `READY` or `NOT READY`. Expected on return:

- `Astra heartbeat` WARN until the first new checkpoint lands; clears itself.
- `claude/codex billing evidence` WARN if the last observation is over an hour old. Refresh
  (Step 3) only when a worker launch is actually wanted; read-only work needs no evidence.
- Everything else PASS. A FAIL names the exact item.

## Step 2 — the queued task addressed to you

`20260924-092409-codex-reciprocal-review-decision-0006-of-the-s` (assignee codex, action
`verify`, 15 min) asks for a decision-0006 review of PR #1,
https://github.com/sayujv/soojos/pull/1, branch `desk/soojos-desk-mcp`, head `5acd341`
(8 commits rebased onto `main`; content identical to `desk/20260917-soojos-desk-mcp` at
06b4811 for `tools/soojos-desk`, `.mcp.json`, `.claude/settings.json`). The task text carries
the full instructions and the three earlier reviews it should be checked against. It is a
read-only review: no merge, push, GitHub action, worker dispatch or policy change. Sayuj holds
merge authority.

Since then 0.3.4 was committed on both branches with two host-tolerance fixes (below); review
the head that `git ls-remote origin desk/soojos-desk-mcp` reports and say which commit the
verdict applies to.

## What is in place

| Item | State |
| --- | --- |
| Server | `tools/soojos-desk/server.py` 0.3.4, stdlib only; `README.md` documents every tool and control |
| Registration | Claude Code: `.mcp.json` (approved in `~/.claude.json`); Codex: `[mcp_servers.soojos-desk]` in `~/.codex/config.toml` |
| Lifecycle | delegated to the canonical `Desk` at policy `code_root`; no second schema |
| Tests | 56 offline tests (`tests/`), fake workers; native probe evidence in `tests/evidence/` |
| Live use | two tasks completed end to end on 22 Sep (Claude review, Codex changelog); handoff entries on `desk/20260917-soojos-desk-mcp` |
| Reviews answered | your 0.2.0 lifecycle review (6), your 0.2.1 permission review (3), the Claude worker's REVIEW-2026-09-18 (17) |
| Branches | `desk/20260917-soojos-desk-mcp` (shared checkout, carries handoff entries and your earlier desk commits); `desk/soojos-desk-mcp` (PR #1, rebased onto main) |

## Heartbeat with the MCP tools

Headless `codex exec` can call the read-only tools without approval: `desk_status`, `queue_list`,
`outbox_read`, `git_status`, `run_status`. Mutating tools (`queue_add`, `queue_claim`,
`queue_finish`, `desk_tick`, `run_task`, `run_claude`, `run_codex`, `outbox_write`) need the
interactive Codex app or Claude Code as the caller. Per beat:

1. `desk_status`. If `stop_present`, stop.
2. `desk_tick` (recovery), then `queue_list(status="running")` and `run_status`.
3. For an eligible queued task: `run_task(id, background=true)`; poll `run_status(run_id)`
   next beat; `outbox_read(id)` gives the desk's packet. Tasks run inside
   `.worktrees/task-<id>` on `desk/<id>`, bounded by budget and deadline.
4. Nothing queued: `queue_add(project, task, assignee, budget_minutes, action_kind, inputs,
   constraints)` for one concrete authorized step.
5. Append the canonical handoff from outbox evidence.

The full text is the "soojos-desk MCP tools" section of `context/desk/active-development.md`
on the shared checkout.

## Step 3 — refreshing billing evidence (only before a worker launch)

The launch gate applies the canonical worker's rule: native subscription login plus usage
credits verified OFF within the last hour. Observe, then record what you saw:

- Claude: https://claude.ai/settings/usage → the "Usage credits" switch is off.
- Codex: https://chatgpt.com/codex/cloud/settings/analytics#usage → credits remaining, and the
  Auto-reload dialog still offers "Turn on auto-reload" (so it is off).

```sh
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/record_billing_evidence.py both \
  --observed-claude "claude.ai Settings > Usage: Usage credits switch off; plan Max (5x)" \
  --observed-codex  "chatgpt.com Codex Analytics: credits remaining 0; auto-reload not enabled"
```

Without fresh evidence a launch is refused and the task is blocked with the reason; nothing
is spent. Sayuj or Claude can also record it.

## Known limits on your host

- `ps -o lstart=` was unavailable in your restricted environment on 23 Sep (one test failed
  on process-start metadata). 0.3.4 records `pid_start_note` and falls back to pid-only
  liveness; that test now tolerates a host without `ps`.
- A worker that hits a usage limit now ends as `quota` with "usage limit reached" in the
  blocked reason instead of a bare non-zero exit.
- Codex commits inside a linked worktree need the `--add-dir` grants 0.3.2 adds; proven with
  real Codex in `tests/evidence/native-boundary-20260922T163134Z.json`.

## Open for Sayuj, not for either assistant

- Merge PR #1 after your review.
- Whether `run_task` should compare a task's stated acceptance (for example a required commit)
  with git evidence before accepting done. Today the worker's exit status and the desk's
  validation decide.
- Your blocked task `20260923-mcp-process-group-cleanup` asked for an extension; that family
  is yours to close or continue.
