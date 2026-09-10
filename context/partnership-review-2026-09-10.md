# Claude–Codex partnership preflight for Sayuj and Claude

Date: 10 September 2026, AWST. Status: charter saved; scope, budgets and activation await Sayuj's confirmation. This is a review proposal, not a live task queue or permission to spend.

The governing charter, including the resourcefulness principle, is saved at `/Users/sayuj/soojos/context/partnership-charter.md`. Its formal text was preserved; only formatting and conversational scaffolding were removed. Scope and spending proposals below are kept outside the charter. Its held-back actions apply immediately. Older revenue and one-project-slot restrictions no longer govern this partnership.

## Scope to confirm

The proposed financial scope is exactly these nine projects:

| Project | Working source and current limit |
| --- | --- |
| Trading Bot / Equities Desk | `/Users/sayuj/AI/Claude/equities-desk`; research, engineering and offline validation only until explicit authority for live activity. Momentum OS remains dormant. |
| Prediction Betting / PredictOS | `/Users/sayuj/soojos/projects/prediction-betting/CLAUDE.md`; canonical code copy remains unresolved and must be established before code edits. |
| Sale Readiness Platform | `/Users/sayuj/soojos/projects/sale-readiness-platform/CLAUDE.md`; code workspace not yet mapped. |
| YouTube Business | `/Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build`; current files and handoff must be refreshed before work. |
| Digital Marketplace Business | `/Users/sayuj/soojos/projects/digital-marketplace-business/CLAUDE.md`; code workspace not yet mapped. |
| Online Shops | `/Users/sayuj/soojos/projects/online-shops/CLAUDE.md`; code workspace not yet mapped. |
| Business Search | `/Users/sayuj/soojos/projects/business-search/CLAUDE.md`; acquisition research and pipeline only; no fund movements or purchase commitments. |
| UGC assessment | `/Users/sayuj/soojos/projects/ugc/CLAUDE.md`; assessment scope. |
| Fan Accounts | `/Users/sayuj/soojos/projects/fan-accounts/CLAUDE.md`; disclosed-persona direction only; deceptive direction remains rejected. |

SoojOS is the coordinating harness, not a tenth revenue project. Related infrastructure is used only for these projects. PKF, Recipes, Language Learner, Travel, Credit Cards, SKLPC, Email, Laptop and Home Builds remain excluded. Every other unlisted project is also excluded; inventory membership does not confer permission. Project Manager's old single-slot rule is retired, without making that project another business in scope.

## Proposed pilot money limits — AUD

| Control | Proposal |
| --- | --- |
| Per-project rolling 30-day drawdown | A$50 for each of the nine projects. Drawdown = recognized spend minus received revenue over the preceding 30 days. |
| Unallocated harness drawdown | A$25 over 30 days. Shared costs assigned to projects must not also be counted here. |
| Total daily new spend | A$10 across all projects and the harness, per Perth calendar day. Reservations count against available capacity before dispatch. |
| Per-task and per-transaction new spend | A$5 maximum, also bounded by the remaining daily and project limits. Do not split a purchase or task to evade a limit. |
| New paid subscriptions | A$0 without Sayuj's explicit yes, even if a subscription fits another budget. |
| Live trading, orders, capital transfers | No standing authority; each remains held back regardless of any operating budget. |

These are small validation budgets, not expected investment returns. Record all direct operating costs and allocated existing subscription costs in project P&L. Prepaid subscription use must be reported separately as credits/tokens used; it is not a new cash charge or free unlimited capacity. Fixed subscription charges enter the ledger once, not again for every use. New metered API charges count as new spend. Revenue means received funds, not forecasts or pipeline value. Unknown costs, missing recent balances or an unknown exchange rate must not be silently treated as zero. Reserve a conservative, current AUD equivalent before any foreign-currency spend; no conversion rate is assumed in this proposal.

Pause new chargeable tasks when reservations would breach any cap. Auto-pause a project at its drawdown limit and alert Sayuj; agents cannot reset its ledger, move the costs or resume it to bypass the pause. Apply an equivalent pause to the harness if its limit is reached. Sayuj alone authorizes resumption after a financial pause.

Use a private local ledger, proposed at `/Users/sayuj/.soojos/desk/finance.jsonl`, with stable transaction IDs and pending-sync status for the specified Notion Spend & Revenue database, `dc79f953b9ea40dca1a2045defa99a56`. Notion access and reconciliation are not verified in this preflight. Preserve unsynced transactions and disclose any gap in the digest. Initialize the preceding 30 days of relevant spending and receipts before permitting paid tasks. Ledger implementation and scheduling are pending.

## Proposed queue and reports

`/Users/sayuj/soojos/context/desk/queue.jsonl` will have one JSON object per task, retaining every requested field. A single coordinator owns queue writes, using a lock and atomic updates. Workers return results; they do not race to rewrite the queue. Fields added for first-dollar estimates, ancestry, evidence and actual accounting make the charter enforceable and reviewable.

Illustrative first intake entry only — this has not been enqueued:

```json
{
  "id": "20260910-001",
  "project": "trading-bot",
  "task": "Assess the pending reel and identify testable applications with Claude",
  "assignee": "codex",
  "inputs": ["https://www.instagram.com/reel/Dc-5s7EEojU/"],
  "constraints": ["local residential-IP intake", "provenance required", "no live financial action", "no new account or subscription"],
  "priority": {"rank": 1, "reason": "Sayuj's specified first intake; economic estimates require assessment"},
  "expected_return": {"currency": "AUD", "horizon_days": 90, "net_low": null, "net_high": null, "confidence": "unassessed", "basis": "Research has not run; this is not a promise of profit"},
  "expected_time_to_first_dollar_days": {"low": null, "high": null, "basis": "unassessed"},
  "created_at": "2026-09-10T10:40:00+08:00",
  "status": "queued",
  "budget_tokens": 20000,
  "budget_minutes": 15,
  "budget_aud": 0,
  "cycle_id": "20260910-pilot",
  "parent_id": null,
  "chain_depth": 1,
  "branch": "desk/20260910-001",
  "worktree": null,
  "approval_refs": [],
  "blocked_reason": null,
  "attempts": [],
  "alternatives_checked": [],
  "next_attempt": null,
  "actual_tokens": null,
  "actual_minutes": null,
  "actual_cost_aud": null,
  "result_path": null
}
```

Assignee is `codex` or `claude`; status is `queued`, `running`, `done` or `blocked`. A financial pause is tracked at project level and blocks dispatch of its queued tasks. Unknown estimates stay null with an explanation; evidence gathering must improve them before economic prioritization is treated as settled. Rank actionable work by expected time-to-first-dollar, expected net return, confidence, cost and dependencies. No nine-project profit ranking has yet been researched.

Each completed task produces a dated report under `/Users/sayuj/soojos/context/desk/outbox/` with the task ID, scope, changes, tests actually run, evidence, commit, token/time/cost totals, caveats, dissent and next recommendation. Partial or blocked work also retains an evidence report. A blocked entry records attempts, alternatives checked and the next possible attempt; lack of authority or budget is recorded as such without attempting to bypass it.

Proposed circuit breakers: default 20,000 total input/output tokens including descendants per task, 15 minutes wall time, eight Claude turns as an additional candidate limit, maximum chain depth three per cycle counting the initial task as one, and an initial concurrency limit of two workers. A common supervisor must reserve aggregate budgets so parallel workers cannot each consume the same remaining allowance. Check `/Users/sayuj/.soojos/STOP` before each cycle and dispatch, between task steps, and while supervising a worker. A STOP cancels pending dispatch and terminates active workers safely; it never authorizes rollback or deletion. The file is currently absent and enforcement is not yet implemented. On reaching chain depth three, stop and report; do not manufacture a new cycle solely to escape the limit.

## Claude dispatch command and enforcement gaps

Installed CLI observed: `/Users/sayuj/.local/bin/claude`, Claude Code 2.1.263. Only local version/help inspection was performed, with no Claude model request. Prefer a direct fresh CLI worker inside a validated isolated worktree on `desk/<id>`. Compile the current charter, project instructions, latest handoff, task inputs, constraints and structured result schema into its prompt. Restricted mode ignores ordinary user/project settings, so the supervisor must not assume existing hooks or instructions were loaded automatically.

Planned command template, not run; placeholders must be resolved by the supervisor using an argument array, never interpolated shell text:

```text
working directory: <validated task worktree on desk/<id>>
/Users/sayuj/.local/bin/claude -p
  --model sonnet
  --restricted
  --tools "Read,Grep,Glob,Edit,Write"
  --allowedTools "Read,Grep,Glob,Edit,Write"
  --permission-mode dontAsk
  --permission-prompts none
  --strict-mcp-config
  --mcp-config '{"mcpServers":{}}'
  --max-turns 8
  --max-budget-usd <reserved per-task USD amount within approved AUD limits>
  --output-format json
  --json-schema <structured report schema JSON>
  --no-session-persistence
  <compiled task prompt>
```

The first assessment worker should use only `Read,Grep,Glob`. The shown file-editing tools are for subsequent build tasks in their isolated worktrees. Codex's supervisor runs narrowly authorized tests and local commits; the worker has no general shell or MCP access. The charter's `desk/<id>` branch naming overrides the usual `codex/` default. Neither pushes nor merges to main are approved; no push is proposed for this pilot.

Local help describes restricted file access to working directories, denial of bypass mode, and protected settings/Git/tool configuration writes. File restrictions, credential-path denial, command boundaries and STOP behavior still need practical verification. Never rely on prompt instructions alone as the money or credential guard.

Existing `/Users/sayuj/soojos/scripts/dispatch.py` supplies JSON output, allowed tools and a candidate turn limit, resumes sessions by default and uses registry working directories. Its `--fresh` option avoids resumption. It does not implement charter worktrees, STOP, hard time/token budgets, spend reservations or held-back enforcement. It will not be used unchanged for autonomous work; its existing read-only SoojOS registration will be preserved.

Important unresolved enforcement: the CLI documents `--max-budget-usd` for API calls, not a hard subscription-credit limit. `--max-turns` is used by the existing dispatcher but is absent from current help; its enforcement has not been tested. No advertised hard cumulative token limit was found. A token number in the queue is not itself enforcement. Before unattended work, verify a metered and bounded execution path; if that cannot be demonstrated within current authority, leave those workers paused and present the evidence and alternatives. Authentication, the combined command, spend enforcement and all runtime guards remain untested.

## Telegram and schedule status

Status: **existing implementation found; current authenticated delivery unverified**. No Telegram message or test was sent.

Two paths exist in the dormant Momentum OS workspace:

- `/Users/sayuj/AI/Claude/momentum-os/core/alerts/telegram.py` uses `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. It does not return an acknowledged delivery result or validate Telegram's JSON `ok`. The narrowly inspected old event file contains 866 Telegram entries, all `sent=false`, last dated 7 June 2026.
- `/Users/sayuj/AI/Claude/momentum-os/.claude/hooks/notify_stop.py` is a separate Stop hook. Its throttle marker was modified on 3 September 2026 at 09:27:06 AWST. The code writes the marker after an HTTP request returns; this suggests historical request success but does not prove present delivery or that Sayuj received a message.

Neither variable is set in the inspected current shell. A local `.env` exists; its contents were not read. Do not ask for or replace credentials based only on shell absence. After go, reuse the existing destination through an isolated helper, verify a redacted acknowledged send, and persist retries with idempotency. This must not start Momentum's retired trading processes. Any credential/account change still needs Sayuj's explicit yes.

Proposed local Codex heartbeat: every 30 minutes, quiet when unchanged or non-actionable; actionable notifications contain the item, one required action and a link. Daily digest: 07:00 Perth. Weekly digest and joint retro: Monday 07:00 Perth, combined with that day's daily digest to avoid duplication. Both digests include each project's actual spend, received revenue, rolling drawdown, blocked items and next work; weekly adds continue/pivot/kill recommendations. Retro proposals go to `/Users/sayuj/soojos/context/desk/evolution.md`. No heartbeat, digest, retro or Telegram delivery schedule was created in this preflight. Local sleep/offline behavior and missed-run recovery must be checked before promising delivery at a particular minute.

## Ownership of CLAUDE.md files

There is one shared original per project, not an assistant-specific copy. Codex is accountable for coordination and consistency; Claude is a co-builder and reviewer and may update an assigned project's instructions within the charter. One writer owns a checkout at a time; simultaneous builds use distinct worktrees. The governing charter and cloud instructions remain Sayuj-controlled.

| Files | Stewardship |
| --- | --- |
| `/Users/sayuj/soojos/CLAUDE.md`, `/Users/sayuj/soojos/context/shared-agent-workflow.md`, registry and desk documentation | Codex maintains; Claude reviews and can implement bounded harness tasks. |
| `/Users/sayuj/AI/Claude/equities-desk/CLAUDE.md` | Shared project authority; assigned task owner maintains. Claude may co-build; Codex verifies integration and continuity. |
| `/Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build/CLAUDE.md` | Same shared ownership and task assignment rule. |
| Nine in-scope `/Users/sayuj/soojos/projects/<slug>/CLAUDE.md` routers listed above, including `trading-bot` and `youtube-business` | Codex maintains routing; Claude may update assigned project context. Routers are not substitutes for actual repo instructions. |
| PredictOS's eventual canonical repo `CLAUDE.md` | Ownership attaches only after the canonical copy is verified. No current path is assumed. |
| Other local/global CLAUDE.md files and excluded-project instructions | No new ownership or edits granted by this pilot. |

Claude web chats still cannot automatically read Mac files. Shared local files and fresh handoffs support Claude Code/Codex continuity; cloud context needs a supplied handoff or available authorized read tool. There is no verified real-time chat synchronization.

## Dated checkpoint — 10 September 2026 AWST

Actual changes during this preflight, all documentary and uncommitted:

1. Saved `/Users/sayuj/soojos/context/partnership-charter.md`, preserving the supplied formal charter and resourcefulness addition.
2. Updated `/Users/sayuj/soojos/CLAUDE.md` to route both agents to the charter and label the old active list as historical inventory.
3. Updated `/Users/sayuj/soojos/context/shared-agent-workflow.md` for charter precedence, append-only handoffs, scoped work and explicit approval for cloud instruction edits.
4. Added `/Users/sayuj/soojos/decisions/0002-partnership-charter-and-activation-gate.md`; prior shared-local-context decision 0001 remains accepted.
5. Saved this review, appended a checkpoint to `/Users/sayuj/soojos/context/handoff.md`, and recorded document hashes and checks in `/Users/sayuj/soojos/audits/2026-09-10-partnership-preflight.json`.

No project code, project-specific CLAUDE.md, credentials, cloud instructions, running service or financial system was changed. No queue, model worker, research reel fetch, automation, Telegram send, commit, push or merge was executed. Original September 9 integration files and private notes were retained. Known migration staging names were absent from `/private/tmp` at this inspection, so nothing was deleted. The original backup manifests remain under `/Users/sayuj/.agents/bridge-backups/`; they were not altered.

## Approval boundary for the next phase

Sayuj's go is requested for the nine-project scope and proposed money/circuit-breaker settings, then building and verifying the harness before activating it. No paid or autonomous task can run merely because this review exists. The first research intake remains the specified Instagram reel after activation prerequisites are satisfied.

Cloud cleanup remains separate: preserve all local bridge files and private notes, and propose removing only the exact September 9 inserted continuity and Shared handoff blocks from cloud projects outside the nine-project scope, leaving other text intact. Keep the nine in-scope blocks. Any further revision to those retained blocks needs its own concrete approved text. Since removing excluded-project blocks is itself a cloud instruction edit to otherwise excluded projects, it needs a one-time explicit exception. “Go” for the local harness must not silently mean approval for that cleanup. No cloud cleanup has occurred.
