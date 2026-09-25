# soojos-desk MCP server

Minimal MCP server for the partnership desk. Python 3.9 stdlib only, stdio
transport, hand-rolled JSON-RPC (no `mcp` or `fastmcp` dependency). Version 0.4.0.

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
| `queue_add(project, task, assignee, budget_minutes, action_kind?, model?, inputs?, constraints?)` | Canonical enqueue. `model` (Claude assignees only) from the approved set `sonnet` (default), `haiku`, `opus`, `fable`; stored as `worker_model`. |
| `queue_claim(id)` | Canonical claim. |
| `queue_finish(id, status, reason?, report?)` | Canonical done/blocked. |
| `desk_tick()` | Canonical recovery; also lists lost runs. |
| `outbox_write(id, report)` | Free-form immutable note for a non-task id. |

Workers:

| Tool | What it does |
| --- | --- |
| `run_claude(task, cwd, budget_minutes, background?, model?)` | `/Users/sayuj/.local/bin/claude -p … --output-format json --permission-mode acceptEdits --no-session-persistence --model <approved id> --max-turns <policy claude_turns> --strict-mcp-config --mcp-config worker-mcp.json --disallowedTools <fixed deny list> --allowedTools <local git only>`. |
| `run_codex(task, cwd, budget_minutes, background?)` | `/Applications/ChatGPT.app/Contents/Resources/codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd [--add-dir …] -o <last-message>`. In a linked worktree, `--add-dir` grants only the worktree's own gitdir, the shared object store and the `desk/` ref and reflog directories, so a commit on the task branch works while the main checkout's HEAD, index and other refs stay outside the sandbox. |
| `run_review(id, files, focus?, background?, cwd?)` | Two-stage review (decision 0007): a Sonnet triage names up to 12 hotspot regions in `files`, the task's verdict model (Fable by default) reviews only those excerpts (padded, at most 600 lines). Same claim, reservation, containment, deadline and completion as `run_task`; both stages' tokens are summed; whole-file fallback if triage yields nothing usable. Claude assignees only. |
| `inbox_sync(dry_run?)` | Turns new sections of `context/desk/INBOX.md` (plain-language tasks with optional `project:`, `assignee:`, `budget:`, `action:`, `model:`, `inputs:`, `constraints:` lines) into validated queue entries through the canonical desk and writes `queued: <id>` or `queued: REFUSED <reason>` back under each heading. Idempotent. |
| `desk_board(dry_run?)` | Renders `context/desk/BOARD.md`: running, queued, blocked with reasons, recent done, live runs. A view; the queue stays the truth. |
| `heartbeat_gate(dry_run?)` | The quiet-heartbeat check as a tool: UNCHANGED or ATTENTION with reasons. |
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
  HEAD. Token counts come from the CLI usage output when present. When the task text
  asks for a commit and HEAD did not change, the packet carries an
  `acceptance_warning` and the verification says so: the task is still done by the
  desk's rules, but the reader is told the worker's claim was not borne out.
- **Every run is supervised by a detached runner** (`server.py --runner <spec>`) in
  its own session, foreground or background. The foreground call only waits on the
  run record, so a client that kills the server cannot orphan an unsupervised
  worker: the runner still enforces the timeout and completes through the desk.
  The runner is the only writer of running and terminal states; the parent writes
  the record before spawning it, and a non-terminal write can never follow a
  terminal one. Records carry the runner's pid and process start time, so a reused
  pid is not mistaken for a live runner. A runner that receives SIGTERM, SIGINT or
  SIGHUP kills its worker group, records `killed`, and blocks the task.
- **No unbounded wait.** After the timeout the child is waited on with bounded
  SIGTERM and SIGKILL phases and the pipes are drained with a timeout; a grandchild
  that escaped the process group and holds stdout cannot hang the runner.
- **Every failure after a claim is accounted for.** Any exception between the
  claim and the runner taking over (git timeout, OSError, spec collision,
  reservation failure) fails the run record and blocks the task with the reason.
  A launch is refused when less than a launch floor remains (the smaller of one
  minute and 10% of the budget). A worker that finished but whose completion the
  desk refused is returned as `completion-refused`, not success. Transient
  completion errors are retried with backoff. A `.worktrees/task-<id>` directory
  that is not a registered worktree is refused as stale, or re-added if empty.

## State

- Queue/outbox: `/Users/sayuj/soojos/context/desk` (override `SOOJOS_DESK_DIR`).
- Private: `~/.soojos/desk` (override `SOOJOS_HOME` → `<home>/desk`): STOP at
  `<home>/STOP`, `coordinator.lock`, billing evidence, `runs/<run-id>.json` (record),
  `runs/<run-id>.note.json` (full prompt and output, 0600), `runs/<run-id>.log`. The
  `.spec.json` a runner starts from is removed when it reaches a terminal state.
- Outbox notes are created exclusively (`O_EXCL`) and never overwritten; a second note
  for the same free id in the same second gets a time-and-random suffix. A run note in
  the shared outbox is trimmed (prompt head, 4k output tails) and mode 0600, with a
  `full_note` pointer to the private copy. Task completion packets are the desk's.
- A zero-byte or partial record is reported as `corrupt` by `run_status` and
  `desk_status` instead of taking a tool down; `load_json` never raises.
- STOP is polled every 2 seconds while a worker runs. If it appears, the worker group is
  killed, the run ends as `stopped` with `stop_seen_at`, and the task is blocked with
  that reason. A signal or STOP that lands before the worker is spawned prevents the
  spawn.
- `live_run_for`, the check made under the desk lock, reads only the records that claim
  to be live and never writes; lost-marking happens in `run_status`/`desk_status`
  outside the lock.

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

## Token discipline (0.3.5)

Measured on the 22 September review run: 11 turns, 694k cache-read tokens, about 63k
tokens of standing context re-read every turn, because a `claude -p` worker in the soojos
checkout inherited every user MCP server, claude.ai connector and plugin tool. Zero cash on
the subscription, but all of it counted against the plan's usage limit. 0.3.5 therefore:

- **Strips the worker session.** `--strict-mcp-config --mcp-config worker-mcp.json` (an
  empty `{"mcpServers": {}}`), so a worker loads no connectors, plugin servers or user MCP
  servers. It still reads the repository's CLAUDE.md router.
- **Routes the model by where a mistake costs the most.** Verdict-bearing tasks
  (`action_kind` `verify` or `retro`: reviews, verification, retrospectives) default to
  `fable`; production and research tasks default to `sonnet`, whose mistakes the same desk
  controls and a later review catch at a third of the draw-down. An explicit `model`
  (`sonnet`, `haiku`, `opus`, `fable`) on the task always wins. Codex workers inherit their
  configured model; an override is refused.
- **Caps turns** at policy `claude_turns` (8), the already-approved control.
- **Reports the split** in every run note and record as `token_split`: input, output,
  cache creation, cache reads, turns, and `standing_context_per_turn`, so a saving is visible
  next to the accounting instead of asserted.

**Measured, 25 September.** The same review task re-run on Sonnet with the stripped session:
10 turns, 640k cache reads, 76k cache creation, 23k output; standing context per turn about
72k versus about 63k on 22 September (server.py had grown by 600 lines, which the reviewer
reads). A direct one-turn probe put the baseline system context at about 40k tokens with 88
MCP tools loaded and about 37k with none, so the strip removes only about 3k tokens per turn;
its value is that a worker reaches no connectors at all. The saving that mattered was the
model: list-price equivalent A$-neutral cost fell from USD 2.40 to USD 0.66 for a comparable
review (6 findings versus 17, different depth), and the plan's usage limit is drawn down in
the same proportion. Findings 1, 5 and 6 of that review (transient `ps` failure marking a
live worker lost; reservation TTL; directory fsync) were fixed in this version.

**Two-stage review, measured 25 September** (`run_review` on server.py, same task as the two
earlier runs): Sonnet triage 3 turns, 203k tokens, 12 hotspots, 432 excerpt lines; Fable
verdict 11 turns, 339k tokens, standing context about 29k per turn instead of 63k to 72k.
Combined 543k tokens against 781k for single-stage Fable, with Fable's own share down 57%
and a list-price equivalent of roughly USD 1.2 against 2.40. Findings: 16 (2 high, 5 medium,
9 low) against 17 for single-stage Fable and 6 for Sonnet alone. So the verdict model keeps
its depth while reading less; that is the credit saving that does not create mistakes.

Jev and similar hosted decision models were considered and not adopted: they are a new paid
provider needing Sayuj's explicit approval, and they address tool-call gating rather than the
standing-context cost the numbers point at. Revisit with data if wanted.

## Quiet heartbeat (0.3.7, decision 0007)

Of Astra's 158 heartbeat entries from 19 to 24 September, 128 were "unchanged" checkpoints,
each paid for with a model turn. `heartbeat_gate.py` answers "did anything change?" in code:
it fingerprints STOP, every queue row's status and deadline, the outbox file set, run states,
billing-evidence presence, the handoff size and the soojos HEAD, and compares with the last
beat (private `~/.soojos/desk/heartbeat-gate.json`). It prints `UNCHANGED` (exit 0) or
`ATTENTION: <reasons>` (exit 10). A queued task, an overdue running task, STOP, a lost,
corrupt or quota run, the 07:00 Perth daily-duty window, or a missing previous fingerprint
always mean attention. The coordinator's automation calls it first and stops on UNCHANGED,
so a quiet beat costs zero model tokens and cannot be "confidently wrong". `--dry-run`
compares without saving; `--json` for machines. It reads desk state and writes only its own
fingerprint file.

## Five-minute beat, notes, routing and project scope (0.4.0)

- **`desk_beat.py` every 5 minutes** (launch agent `com.soojos.desk-beat`, installed by
  `launchd/install.sh`, removed with `--remove`). Order: gate; on ATTENTION `desk_tick`,
  `inbox_sync`, dispatch, `desk_board`; one JSON line per beat in `~/.soojos/desk/beat.log`.
  An unchanged beat costs zero model tokens. Under STOP it only logs.
- **Dispatch** launches queued tasks that carry `auto_dispatch` (set by `queue_add … auto=true`,
  and by default for tasks written in INBOX.md unless `auto: no`), oldest first, while worker
  slots are free and the assignee's zero-cash evidence is fresh. Tasks without the flag, for
  example one addressed to Astra, are left for the coordinator. Every launch goes through
  `run_task`, so every desk control applies.
- **Routing by a small model.** A task section that leaves `project:` out (or says
  `route: auto`) is read once by Haiku, no tools, which proposes project, assignee, action,
  model and budget; the proposal only fills gaps, is validated like any other input, and the
  heading records `routed by haiku: {...}`. When zero cash cannot be established the section
  is refused with the reason instead. Execution then uses the routed model: verify and retro
  on Fable, code on Sonnet, Opus or Fable when named. Model names are CLI aliases, so `opus`
  is the latest Opus.
- **Your notes.** An inbox section with `type: note` (or a heading starting `Note:`), scoped by
  `project:` or `scope: all`, is appended to `context/desk/notes/<project>.md` with a timestamp,
  and every later worker prompt for that project carries the most recent notes for it and for
  all projects. `inbox_add(kind="note", …)` does the same from Claude Code or Codex, so a
  thought typed in either app lands in the same place as one typed into the file.
- **Project scope.** Each task already runs in its own worktree of its own repository. When a
  project is a folder inside a shared repository, the worker is told the folder is its scope,
  and after the run any committed or dirty path outside that folder refuses the result
  (`escaped`, "changed files outside its project folder") and blocks the task. Projects are
  mapped in `projects.json`; a Claude chat is context, not a place a worker can reach.

## The human way in and out (0.3.9)

The queue is dense JSON and stays the single source of truth. People write and read
elsewhere:

- **`context/desk/INBOX.md`** is where a task is asked for in plain words, one section per
  task with a few optional `key:` lines. `inbox_sync` validates each new section through the
  canonical desk and writes the outcome under the heading, so the file shows what happened
  to your words and nothing is silently dropped. The heartbeat gate counts new sections as
  attention, so writing a task is exactly what wakes the desk.
- **`context/desk/BOARD.md`** is the generated status view. Evidence stays in the outbox.

## Operating helpers

- `preflight.py [--tests] [--json]`: read-only readiness checklist (interpreter, server and
  canonical desk import, registration in both clients, binaries and logins, STOP, billing
  evidence freshness, queue state, Astra's last heartbeat age, optional unit suite). Ends with
  `READY` or `NOT READY` and exits non-zero on any FAIL.
- `record_billing_evidence.py claude|codex|both --observed …`: writes the operator-attested
  zero-cash evidence files (mode 0600, org id from `claude auth status`), keeping a `.bak`.
  It records only what you say you observed; it observes nothing itself.
- `ASTRA-RESUME.md`: the playbook for Astra returning after an outage.
- `dispatch_first_tasks.py`: the two-task first live dispatch used on 22 September.

A worker that hits its subscription usage limit ends as `quota` and the task is blocked
with "usage limit reached" rather than a bare non-zero exit. On a host where `ps` is
unavailable, run records carry `pid_start_note` and liveness falls back to pid only.

## Testing

```sh
/usr/bin/python3 -m unittest discover -s /Users/sayuj/soojos/tools/soojos-desk/tests -v
```

88 offline tests (`tests/test_server.py`, `tests/test_gate.py`). They initialise a canonical desk in temporary state (via
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
the worktree, branch escape after launch, ad-hoc cwd rules); and one test per finding
addressed in 0.3.2 (Codex add-dir, exception after reservation, reservation failure,
completion refused, signalled runner, escaped pipe holder, stale worktree directory,
launch floor, reused pid, record ownership) and per finding in 0.3.3 (outbox notes never
overwritten within one second, private trimmed run notes, corrupt records reported not
fatal, STOP appearing mid-run, spec cleanup and a non-writing liveness scan under the
lock). `SOOJOS_MINUTE_SECONDS` shrinks a "minute".

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
- First live dispatch (22 Sep): a Claude worker's static review of 0.3.1
  (`REVIEW-2026-09-18.md` on its task branch, 3 high / 8 medium / 6 low) and a Codex
  worker that could not commit in a linked worktree. 0.3.2 addresses the Codex
  add-dir gap (proven by the native probe, evidence
  `tests/evidence/native-boundary-20260922T163134Z.json`: commit landed in the
  worktree, main checkout untouched, push still blocked) and review findings 1 to 12
  (all three high, mediums 4 to 11, low 12). 0.3.3 addresses lows 13 to 17. Still open
  from that review: only the question of checking a task's stated acceptance against
  git evidence, which is a policy decision rather than a defect.
