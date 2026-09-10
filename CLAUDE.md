# SoojOS

Sayuj's operating system. This file is a router, not a system prompt. It says where things are; it does not contain them.

Timezone AWST. macOS only, no Microsoft tools.

## Governing partnership charter

Both Claude and Codex must read [Sayuj's partnership charter](context/partnership-charter.md) before planning or acting. Its scope and authority rules supersede conflicting older memories, active-project lists and workflow guidance. Sayuj confirmed the nine-project pilot and preflight limits on 10 September 2026. Read [the current desk state](context/desk/README.md) and its separate approval record before dispatch: Sayuj explicitly confirmed the no-cap change with “commence” on 10 September. Live policy v2 reports token usage without a hard cap. Keep the existing time, turn, concurrency, chain, STOP and financial controls; read the current approval.json and policy.json before dispatch. Paid work requires complete financial coverage. Local handoffs are append-only. Claude cloud instruction edits require Sayuj's explicit approval.

Sayuj's 10 September amendment establishes Claude and Astra as partners sharing strategy, execution, review and results, with Sayuj as shareholder approving capital deployment. Both may initiate work and choose agents, MCPs, CLIs and other models. A named task executor coordinates writes; responsibility remains shared. Bring concrete capital proposals to Sayuj and measure received revenue, costs and downside. Read the charter's amendment rather than retaining the earlier master-agent hierarchy.

## Knowledge

| Need | Go to |
| --- | --- |
| Who I am, goals, standing constraints (load every session) | `./knowledge/context/` |
| What's true and recent, at a glance | `./knowledge/HOT-CACHE.md` |
| What exists in the knowledge base | `./knowledge/INDEX.md` |
| Everything the OS believes, queryable | `./knowledge/claims.jsonl` (via `claims.py`) |
| Research reports, one per question | `./knowledge/reports/` |
| Raw source material, fetched per question | `./knowledge/wikis/{youtube,reddit}/raw/` |
| Live registry: projects, tasks, spend, automations | Notion — via `soojos-ops` |

Expertise context (`./knowledge/context/`) is always loaded. Everything else is
fetched just in time and never pinned.

Research is **pull-based**: a question comes first, and the fetch is scoped to
it. Nothing is scraped on a schedule. Query the ledger before opening any file —
it answers "is there anything about X" for almost no context.

## Capabilities

| Need | Go to |
| --- | --- |
| Shared skills, agents, hooks | `./plugins/` |
| What each plugin does and who enables it | `./README.md` |
| Add a project to the system | `./bin/soojos-init` |

Skills and agents are distributed to other repos through the `soojos` marketplace, not copied. See README.

## Decisions and history

| Need | Go to |
| --- | --- |
| Binding decisions, numbered | `./decisions/` |
| Last session state | `./context/handoff.md` |
| Past OS audits | `./audits/` |

Decisions are binding subject to Sayuj's current instructions and the partnership charter. If other guidance here contradicts an applicable decision record, the decision record wins and this file is wrong — fix it.

## Projects

Project brains live in `./projects/<name>/CLAUDE.md`. Repos that need their own git history stay external and subscribe to this marketplace instead; `./projects/<name>/CLAUDE.md` still holds the context and points at the repo.

Current first-build catalogue: [the nine approved business projects](context/desk/portfolio-builds-2026-09-10.md). It records tested development branches, exact evidence and the next unresolved question. Read the latest canonical project handoff before using a prototype; a branch is not a production deployment. [The alignment record](context/desk/project-alignment-2026-09-10.md) documents matching ChatGPT/Codex organization and its access limits.

Historical inventory: Claude Platform, Trading Bot, Travel, PKF, Prediction Betting, Personal. This is not the partnership's authorization list; use the charter and its approved scope. SoojOS is the harness.

## Standing rules

- Verify before claiming done. Untested is not working.
- Every claim in a wiki carries a source URL and a date. An undated claim is not evidence.
- Log directional choices with `decide`. Write a handoff before clearing context.
- Never edit credential files. Say what needs changing; the human does it.

## Claude and Codex project continuity

Use [the canonical local registry](context/project-registry.md) for coding work and [the Claude project source index](context/claude-projects.md) for the 25 project entries observed on 2026-09-09. Their local projects/<name>/CLAUDE.md records point to original cloud sources; they do not claim to contain the cloud conversation history. Read [the shared workflow](context/shared-agent-workflow.md) before switching assistants.
