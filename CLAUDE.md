# SoojOS

Sayuj's operating system. This file is a router, not a system prompt. It says where things are; it does not contain them.

Timezone AWST. macOS only, no Microsoft tools.

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

Decisions are binding. If something here contradicts a decision record, the decision record wins and this file is wrong — fix it.

## Projects

Project brains live in `./projects/<name>/CLAUDE.md`. Repos that need their own git history stay external and subscribe to this marketplace instead; `./projects/<name>/CLAUDE.md` still holds the context and points at the repo.

Active: Claude Platform, Trading Bot, Travel, PKF, Prediction Betting, Personal.

## Standing rules

- Verify before claiming done. Untested is not working.
- Every claim in a wiki carries a source URL and a date. An undated claim is not evidence.
- Log directional choices with `decide`. Write a handoff before clearing context.
- Never edit credential files. Say what needs changing; the human does it.
