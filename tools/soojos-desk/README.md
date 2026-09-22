# soojos-desk MCP server

Minimal MCP server for the partnership desk. Python 3.9 stdlib only, stdio
transport, hand-rolled JSON-RPC (no `mcp` or `fastmcp` dependency). Version 0.3.1.

Run: `/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/server.py`

## One lifecycle, the canonical one

Since 0.3.0 the server keeps no queue lifecycle of its own. Admission and
completion are delegated to the approved harness's `Desk` class, loaded from
`policy.json` `code_root` (`scripts/desk_core.py`):

- `queue_add` → `Desk.enqueue` (scope, budgets, branch `desk/<id>`, ancestry).
- `queue_claim` / `run_task` → `Desk.claim` (max_workers, finance pauses, pending
  completion, STOP; sets `started_at` and `deadline`).
- `queue_finish` done → `Desk.finish`: requires `verification`, `evidence`, a known
  `actual_cost_aud`, `actual_minutes` within budget, and `at` before the deadline.
- `queue_finish` blocked → `Desk.block`: reason, attempts, alternatives, next
  attempt, optional accounting (zero cash only with `existing_subscription`).
- `desk_tick` → `Desk.tick`: applies persisted completion packets and blocks running
  tasks past their deadline with desk accounting.

Task completion packets (`{task_id, project, at, report}`) are written only by the
desk, so an interrupted completion is recovered by `desk_tick` or the existing
`desk.py tick`. `outbox_write` refuses ids that name a queue task. If the canonical
code is unavailable the mutating tools refuse and the read-only tools still work.

## Tools

Read-only (annotated `readOnlyHint`; headless `codex exec` calls them without approval):

| Tool | What it does |
| --- | --- |
| `desk_status()` | STOP, queue counts, running tasks with overdue flags, live/lost runs, canonical desk availability, billing evidence freshness, policy, worker binaries. |
| `queue_list(status?)` | Lists `context/desk/queue.jsonl`. |
| `outbox_read(id)` | Newest `outbox/<date>-<id>[-HHMMSS].json` for a task or run id. |
| `git_status(project)` | Branch, HEAD, short status, last 5 commits, worktrees. Slug from `projects.json` or absolute path. |
| `run_status(id?)` | One run or the recent runs. Reserved/running records whose process is gone are marked `lost`. |

Mutating:

| Tool | What it does |
| --- | --- |
| `queue_add(project, task, assignee, budget_minutes, action_kind?, inputs?, constraints?)` | Canonical enqueue. |
| `queue_claim(id)` | Canonical claim. |
| `queue_finish(id, status, reason?, report?)` | Canonical done/blocked. |
| `desk_tick()` | Canonical recovery; also lists lost runs. |
| `outbox_write(id, report)` | Free-form immutable note for a non-task id. |

Workers:

| Tool | What it does |
| --- | --- |
| `run_claude(task, cwd, budget_minutes, background?)` | `/Users/sayuj/.local/bin/claude -p … --output-format json --permission-mode acceptEdits --no-session-persistence --disallowedTools <fixed deny list> --allowedTools <local git only>`. |
| `run_codex(task, cwd, budget_minutes, background?)` | `/Applications/ChatGPT.app/Contents/Resources/codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd -o <last-message>`. |
| `run_task(id, background?, cwd?)` | Permission preflight → claim if queued → exclusive run reservation under the desk lock → `.worktrees/task-<id>` on `desk/<id>`, verified by git → deadline check → zero-cash check → run the assignee → `Desk.finish` or `Desk.block`. No worktree opt-out. |

Every tool refuses while `~/.soojos/STOP` exists (`lexists`, so a dangling symlink
counts). The server never removes STOP. A detached runner that finds STOP at start
blocks its task instead of running.

## Controls on worker runs

- **One launch per task.** A run identity (`run-<kind>-<stamp>-<8 hex>`) is created
  with `O_EXCL` under the desk's `coordinator.lock` before any launch. A task with a
  live reservation or running runner cannot be launched again. A reservation whose
  process died, or that never started within 10 minutes, is marked `lost` and no
  longer blocks recovery.
- **Persisted deadline wins.** The worker timeout is the smaller of `budget_minutes`
  and the time left before the task's `deadline`, minus a closure reserve
  (20% of the budget, at most 3 minutes) kept for completion accounting. An expired
  deadline refuses the launch and blocks the task; the detached runner re-checks at
  start.
- **Unknown cash stays unknown.** Before launch the server applies the canonical
  worker's rule: `claude auth status --json` must show a first-party Pro/Max login,
  and `~/.soojos/desk/subscription-billing.json` must say `usage_credits_disabled`
  with a `verified_at` under one hour old, a `source`, and an `org_id` matching the
  CLI. Codex needs `codex login status` = ChatGPT login and the same shape in
  `~/.soojos/desk/codex-billing.json`. Without both, the launch is refused and the
  task is blocked with the reason. Only then is `actual_cost_aud: 0` with
  `billing_mode: existing_subscription` reported.
- **Process group kill.** On timeout the whole group is SIGTERMed, then SIGKILLed.
- **Evidence, not claims.** The done report's `verification` records exit code,
  elapsed time, timeout, the worktree HEAD before and after, and dirty paths; the
  server states it ran no tests itself. `evidence` lists the run note, worktree and
  HEAD. Token counts come from the CLI usage output when present.
- `background=true` detaches a runner (`server.py --runner <spec>`) in its own
  session that survives the MCP client. Poll `run_status`; the task's outcome goes
  through the desk exactly as in the foreground.

## State

- Queue/outbox: `/Users/sayuj/soojos/context/desk` (override `SOOJOS_DESK_DIR`).
- Private: `~/.soojos/desk` (override `SOOJOS_HOME` → `<home>/desk`): STOP at
  `<home>/STOP`, `coordinator.lock`, billing evidence, `runs/<run-id>.json|.spec.json|.log`.

## Permission settings (0.3.1)

Settings are validated against fixed approved sets before any launch side effect, and
before a task is claimed. An override may only narrow; anything wider, blank, malformed
or unrecognised is refused with the reason, never silently replaced.

| Setting | Approved values | Default |
| --- | --- | --- |
| `SOOJOS_CLAUDE_PERMISSION_MODE` | `acceptEdits`, `dontAsk`, `plan` | `acceptEdits` |
| `SOOJOS_CLAUDE_ALLOWED_TOOLS` | subset of `Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(git rev-parse:*) Bash(git add:*) Bash(git commit:*)`, or `none` | the full subset |
| `SOOJOS_CODEX_SANDBOX` | `read-only`, `workspace-write` | `workspace-write` |

Not overridable: `--disallowedTools` always carries `git push/checkout/switch/branch/reset/rebase/
merge/worktree/remote/clean/stash/tag/fetch/pull`, `WebFetch` and `WebSearch`. Deny rules win
over allow rules in Claude Code.

Read this as preapproval, not restriction: under `acceptEdits` file edits and the allowed
git commands run unattended, and prefix matchers mean `git add -A` is inside `git add:*`.
The allow list exists so a worker can stage and commit on its task branch; nothing else.

**Branch containment.** A task worker only launches inside `<repo>/.worktrees/task-<id>`
with git confirming: the cwd resolves inside that directory, the git toplevel is that
directory, HEAD is the symbolic branch `desk/<id>` (not detached, not main), and the
directory is named `task-<id>` under `.worktrees`. A non-git project directory or
`use_worktree=false` is refused before the claim. A preflight cannot stop the worker
switching branches later, so the post-run snapshot is checked too: if the worktree is no
longer on `desk/<id>` the result is not accepted and the task is blocked as `escaped`.
Ad-hoc `run_claude`/`run_codex` in a git checkout require a `.worktrees/` isolation on a
named non-main branch; a non-git directory is allowed and recorded as uncontained.

**Native enforcement is tested, not assumed.** `tests/native_boundary_probe.py` runs the
real `claude` and `codex` binaries with the server's exact argv in a throwaway task
worktree that has a bare remote under `$HOME` (outside the worktree and outside `$TMPDIR`,
which the Codex sandbox also permits). Evidence from 22 September 2026
(`tests/evidence/native-boundary-20260922T095202Z.json`): Claude ran `git status` and
committed, and its own `permission_denials` list shows `git push origin HEAD`,
`git checkout -b escape-probe` and `touch ~/…` denied; the remote and branch were unchanged.
Codex created a file inside the worktree, failed to create one under `$HOME`, and its push
to the bare remote failed with the remote unchanged. The probe spends real subscription
usage and is opt-in. A prefix argument is still not the total effective policy: settings,
hooks and other configuration on this machine also apply.

Binaries: `SOOJOS_CLAUDE_BIN` / `SOOJOS_CODEX_BIN` (tests use fakes).

Headless `codex exec` refuses the mutating tools ("requires approval"); use the
interactive Codex app or Claude Code. `claude -p` needs
`--allowedTools "mcp__soojos-desk__*"` (or narrower) to call them.

## Testing

```sh
/usr/bin/python3 -m unittest discover -s /Users/sayuj/soojos/tools/soojos-desk/tests -v
```

39 offline tests. They initialise a canonical desk in temporary state (via
`Desk.initialize` and the v2 migration), use fake `claude`/`codex` under
`tests/fakes/` that also answer the auth probes, and cover: STOP for every tool;
canonical add/claim/finish/block validation; done refused without evidence, without
known cash, or past the deadline; max_workers; tick reaping and recovery of a
persisted packet; outbox immutability; unique run ids under a frozen clock; lost
reservations and runners; worker success/failure/timeout with process-group kill;
launch refused on unknown cash (API-key login, stale or missing evidence) before any
run; duplicate-launch refusal and recovery from a stale reservation; expired deadline
refusing launch; timeout bounded by the deadline rather than the budget; end-to-end
`run_task` in a temporary repo with the worker committing inside the worktree;
background completion through the desk; STOP at runner start; the JSON-RPC layer over
a real subprocess; permission overrides (bypass, auto, blank, wildcard, foreign rules,
malformed, unknown sandbox) refused before claim or reservation while narrowing is
accepted; containment (non-git cwd, opt-out, detached HEAD, wrong branch, cwd outside
the worktree, branch escape after launch, ad-hoc cwd rules). `SOOJOS_MINUTE_SECONDS`
shrinks a "minute".

`smoke_test.py` runs the read-only tools against the live desk and checks STOP
refusal for every tool in an isolated home; it does not mutate live state.

## Registration

Claude Code: `/Users/sayuj/soojos/.mcp.json` (project scope) and `.claude/settings.json`:

```json
{"mcpServers": {"soojos-desk": {"type": "stdio", "command": "/usr/bin/python3",
  "args": ["/Users/sayuj/soojos/tools/soojos-desk/server.py"]}}}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.soojos-desk]
command = "/usr/bin/python3"
args = ["/Users/sayuj/soojos/tools/soojos-desk/server.py"]
```

## Review history

- 0.2.0 lifecycle review (17 Sep): six findings — duplicate launch, deadline not
  enforced at launch, completion contradicting accounting, interrupted completion not
  recoverable, run-id collisions, reaping without bounds or reconciliation.
  All addressed in 0.3.0 by delegating to the canonical desk and by the controls above.
- 0.2.1 permission review (18 Sep): validate permission overrides, verify branch
  containment before launch, test the enforcement boundary natively. Addressed in 0.3.1
  (approved sets with refusal of widening, git-verified worktree preflight plus post-run
  branch check, native probe with recorded evidence).
