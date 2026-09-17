# soojos-desk MCP server

Minimal MCP server for the partnership desk. Python 3.9 stdlib only, stdio
transport, hand-rolled JSON-RPC (no `mcp` or `fastmcp` dependency).

Run: `/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/server.py`

## Tools

| Tool | What it does |
| --- | --- |
| `queue_list(status?)` | Lists `context/desk/queue.jsonl`, optional status filter. |
| `queue_add(project, task, assignee, budget_minutes, inputs?, constraints?)` | Appends a schema-conformant queued task. Project/assignee enums come from `queue.schema.json`; budget is capped by `policy.json` `task_minutes`. |
| `queue_claim(id)` | queued → running with `started_at`, `deadline`, `claimed_by`. Refuses if not queued or if `max_workers` are already running. |
| `outbox_read(id)` | Newest `outbox/<date>-<id>.json`. |
| `outbox_write(id, report)` | Writes an immutable `{at, id, project, report, writer}` entry. Never overwrites. |
| `git_status(project)` | Branch, HEAD, `status --short`, last 5 commits. `project` is a slug from `projects.json` or an absolute path. |
| `run_claude(task, cwd, budget_minutes)` | `/Users/sayuj/.local/bin/claude -p … --output-format json --permission-mode acceptEdits --no-session-persistence`. |
| `run_codex(task, cwd, budget_minutes)` | `/Applications/ChatGPT.app/Contents/Resources/codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd -o <last-message>`. |

Every tool refuses while `~/.soojos/STOP` exists (checked with `lexists`, so a
dangling symlink counts). The server never removes STOP.

`run_*` enforce `budget_minutes` as a hard timeout: the worker runs in its own
process group and the whole group is SIGTERMed, then SIGKILLed, on expiry.
stdout and stderr are captured in full into the outbox entry
(`run-<kind>-<UTC stamp>`) and clipped to 20k chars per stream in the tool
result. A non-zero exit, `is_error`, timeout or launch failure is returned as a
tool error after the outbox entry is written.

## State and locking

- Queue/outbox: `/Users/sayuj/soojos/context/desk` (override `SOOJOS_DESK_DIR`).
- Private home: `~/.soojos` (override `SOOJOS_HOME`); STOP and the lock live here.
- Queue writes take `~/.soojos/desk/coordinator.lock` with `flock`, the same lock
  the existing `desk.py` coordinator uses, and replace `queue.jsonl` atomically.

## Worker permission modes

- Claude default `acceptEdits`; override with `SOOJOS_CLAUDE_PERMISSION_MODE`
  (`acceptEdits`, `dontAsk`, `plan`, `auto`, `bypassPermissions`). In `-p` mode any
  unanswered permission prompt is denied, so a worker that needs Bash will fail
  rather than hang under the default.
- Codex default `workspace-write`; override with `SOOJOS_CODEX_SANDBOX`
  (`read-only`, `workspace-write`, `danger-full-access`).

Long worker runs block the MCP call for up to `budget_minutes`. If the client
times out first, raise `MCP_TOOL_TIMEOUT` (milliseconds) in the client's
environment; the worker still finishes and writes its outbox entry.

## Testing

```sh
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py                  # isolated state, no workers
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py --live-readonly  # + live queue_list/git_status
/usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/smoke_test.py --workers        # + real claude/codex runs
```

The smoke test uses a temp `SOOJOS_DESK_DIR`/`SOOJOS_HOME` so the live queue the
heartbeat consumes is never mutated.

## Registration

Claude Code (`/Users/sayuj/soojos/.claude/settings.json`):

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
