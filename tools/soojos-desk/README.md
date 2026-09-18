# soojos-desk MCP server

Minimal MCP server for the partnership desk. Python 3.9 stdlib only, stdio
transport, hand-rolled JSON-RPC (no `mcp` or `fastmcp` dependency). Version 0.2.0.

Run: `/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/server.py`

## Tools

Read-only (annotated `readOnlyHint`, so Codex calls them headlessly without approval):

| Tool | What it does |
| --- | --- |
| `desk_status()` | STOP state, queue counts, running tasks with overdue flags, active background runs, policy, worker binaries. |
| `queue_list(status?)` | Lists `context/desk/queue.jsonl`, optional status filter. |
| `outbox_read(id)` | Newest `outbox/<date>-<id>[-HHMMSS].json` for a task or run id. |
| `git_status(project)` | Branch, HEAD, `status --short`, last 5 commits, worktrees. `project` is a slug from `projects.json` or an absolute path. |
| `run_status(id?)` | One background run, or the most recent runs. Marks a run `lost` if its runner pid is gone. |

Mutating:

| Tool | What it does |
| --- | --- |
| `queue_add(project, task, assignee, budget_minutes, inputs?, constraints?)` | Appends a schema-conformant queued task. Enums come from `queue.schema.json`; budget capped by `policy.json` `task_minutes`. |
| `queue_claim(id)` | queued → running with `started_at`, `deadline`, `claimed_by`. Refuses if `max_workers` are already running. |
| `queue_finish(id, status, reason?, report?)` | running → done or blocked with `completed_at`, `actual_minutes`, `blocked_reason`, plus an outbox entry. Blocked needs a reason. A never-claimed task can only be blocked. |
| `queue_reap(all?, grace_minutes?)` | Blocks running tasks past deadline plus grace with no live background runner. Only tasks this server claimed unless `all=true`. |
| `outbox_write(id, report)` | Immutable `{at, id, project, report, writer}` entry. Never overwrites. |

Workers:

| Tool | What it does |
| --- | --- |
| `run_claude(task, cwd, budget_minutes, background?)` | `/Users/sayuj/.local/bin/claude -p … --output-format json --permission-mode acceptEdits --no-session-persistence`. |
| `run_codex(task, cwd, budget_minutes, background?)` | `/Applications/ChatGPT.app/Contents/Resources/codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd -o <last-message>`. |
| `run_task(id, background?, use_worktree?, cwd?)` | End to end: claim if queued, create or reuse `<repo>/.worktrees/task-<id>` on branch `desk/<id>`, run the task's assignee with the task budget, write the outbox entry, finish done or blocked with accounting. |

Every tool refuses while `~/.soojos/STOP` exists (checked with `lexists`, so a
dangling symlink counts). The server never removes STOP. A detached runner that
finds STOP at start records that and blocks its task instead of running.

## Worker execution

- `budget_minutes` is a hard timeout. The worker runs in its own process group; the
  whole group is SIGTERMed, then SIGKILLed, on expiry.
- stdout and stderr are captured in full into the outbox entry (`run-<kind>-<stamp>`)
  and clipped to 20k chars per stream in the tool result.
- Non-zero exit, `is_error`, timeout or launch failure returns a tool error after the
  outbox entry is written. Under `run_task` the queue task is finished `blocked`
  with the worker status as the reason.
- `background=true` detaches a runner (`server.py --runner <spec>`) in its own session.
  It survives the MCP client exiting, so it fits an always-on Mac. The call returns a
  `run_id` immediately; poll `run_status(id)` and read `outbox_read(id)` when it is
  no longer `running`. Runner records and logs live in `~/.soojos/desk/runs/`.
- Foreground runs block the MCP call for up to the budget. If the client times out
  first, raise `MCP_TOOL_TIMEOUT` (milliseconds) in the client's environment, or use
  `background=true`.

`run_task` composes the worker prompt from the task text, constraints and inputs,
and tells the worker it is in an isolated worktree: commit on the task branch, no
push, no merge to main. Nothing is merged or promoted by the server.

## State and locking

- Queue/outbox: `/Users/sayuj/soojos/context/desk` (override `SOOJOS_DESK_DIR`).
- Private home: `~/.soojos` (override `SOOJOS_HOME`); STOP, the lock and `desk/runs/` live here.
- Queue writes take `~/.soojos/desk/coordinator.lock` with `flock`, the same lock
  the existing `desk.py` coordinator uses, and replace `queue.jsonl` atomically.

## Permission modes

- Claude default `acceptEdits`; override with `SOOJOS_CLAUDE_PERMISSION_MODE`
  (`acceptEdits`, `dontAsk`, `plan`, `auto`, `bypassPermissions`). In `-p` mode any
  unanswered permission prompt is denied, so a worker that needs other commands will
  fail rather than hang under the default.
- Claude is additionally allowed local git only, so it can commit on its task branch:
  `Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(git add:*) Bash(git commit:*)
  Bash(git branch:*)`. No push. Override or empty with `SOOJOS_CLAUDE_ALLOWED_TOOLS`.
- Codex default `workspace-write`; override with `SOOJOS_CODEX_SANDBOX`
  (`read-only`, `workspace-write`, `danger-full-access`).
- Binaries can be overridden for tests with `SOOJOS_CLAUDE_BIN` / `SOOJOS_CODEX_BIN`.

Calling this server headlessly: `codex exec` invokes the read-only tools without
approval and refuses the mutating ones ("requires approval, but approvals are
disabled"); use the interactive Codex app, or Claude Code, for those. `claude -p`
needs `--allowedTools "mcp__soojos-desk__*"` (or a narrower list) to call them.

## Testing

```sh
/usr/bin/python3 -m unittest discover -s /Users/sayuj/soojos/tools/soojos-desk/tests -v
```

26 offline tests with fake worker binaries in `tests/fakes/`: STOP refusal for every
tool, queue lifecycle and accounting, max_workers, reap rules, outbox immutability,
worker success/failure/timeout with process-group kill, background runs and lost-runner
detection, `run_task` end to end in a temporary git repo with worktree isolation,
and the JSON-RPC layer over a real stdio subprocess. `SOOJOS_MINUTE_SECONDS` shrinks a
"minute" so timeout tests run in seconds.

```sh
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py                  # isolated state, no workers
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py --live-readonly  # + live queue_list/git_status
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py --workers        # + real claude/codex runs
```

The smoke test uses a temp `SOOJOS_DESK_DIR`/`SOOJOS_HOME` so the live queue the
heartbeat consumes is never mutated.

## Registration

Claude Code: `/Users/sayuj/soojos/.mcp.json` (project scope, what Claude Code loads)
and the same block in `.claude/settings.json`:

```json
{"mcpServers": {"soojos-desk": {"type": "stdio", "command": "/usr/bin/python3",
  "args": ["/Users/sayuj/soojos/tools/soojos-desk/server.py"]}}}
```

Codex (`~/.codex/config.toml`, added 2026-09-17):

```toml
[mcp_servers.soojos-desk]
command = "/usr/bin/python3"
args = ["/Users/sayuj/soojos/tools/soojos-desk/server.py"]
```
