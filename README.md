# SoojOS

A single repo that holds the Claude Code skills, agents and hooks for all of one person's projects, published as a plugin marketplace that each project subscribes to.

## The problem

A skill in a project's `.claude/skills/` is visible to that project only. Sharing it across repos means copying it, and copies drift. Some projects (a trading bot, for example) need their own git history, so a monorepo is not an option.

Claude Code's plugin marketplace is the mechanism for the opposite: plugins live here once, each project declares a subscription in `.claude/settings.json`, and a push to this repo reaches every subscriber on their next session.

The same repo is also the "brain": a router-style `CLAUDE.md` over a small knowledge base whose contents are meant to be queried by agents rather than read into context.

## Architecture

```
soojos/
├── CLAUDE.md                        router: says where things are, contains nothing itself
├── .claude-plugin/marketplace.json  catalog of the five plugins below
├── plugins/
│   ├── soojos-core/    skills: grill-me, session-handoff, decide, new-project, audit   agent: critic
│   ├── soojos-build/   skills: verify, lane                                            agent: reviewer
│   ├── soojos-ops/     skills: log-run, standup                        .mcp.json → hosted Notion MCP
│   ├── soojos-intel/   skills: research, distill, recall, brief        agents: scout, skeptic
│   │                   bin/research.py  bin/claims.py  scripts/retrieve.py
│   └── soojos-money/   skills: backtest-review, risk-check             hook: guard-secrets.sh
├── scripts/
│   ├── dispatch.py     fire-and-poll headless `claude -p` runs per registered project
│   └── loop.py         planner → builder → verify → commit loop against any repo
├── knowledge/
│   ├── claims.jsonl    the ledger: one dated, sourced claim per line
│   ├── reports/        one markdown report per research question
│   ├── wikis/{youtube,reddit}/raw/   fetched source material, disposable once distilled
│   ├── context/        identity, constraints, projects — loaded every session
│   ├── INDEX.md, HOT-CACHE.md        indexes that the `audit` skill checks against disk
├── bin/soojos-init     bootstraps a project: settings.json, CLAUDE.md, context/, decisions/
└── templates/          the files soojos-init writes
```

### Plugins

Five plugins, fourteen skills, four agents, one hook. Each plugin is enable-able on its own; a repo that wants a risk check should not have to load Notion wiring.

| Plugin | Purpose | Intended scope |
| --- | --- | --- |
| `soojos-core` | Interrogate plans before building, record decisions as numbered files, write session handoffs, bootstrap projects, audit indexes against disk | every project |
| `soojos-build` | "Written" vs "verified" discipline; one git worktree per task; adversarial code review | any repo with code |
| `soojos-ops` | Log runs and spend to Notion databases; cross-project standup | projects tracked in Notion |
| `soojos-intel` | Question-scoped research from Reddit/YouTube → claims ledger → report | this repo |
| `soojos-money` | Backtest sanity checks, go-live risk checklist, PreToolUse hook that refuses writes to `.env`, `*.pem`, `*.key`, `credentials*`, `*live_config*`, `*production.*` | trading / betting projects; `defaultEnabled: false` |

A subscriber's `.claude/settings.json` looks like:

```json
{
  "extraKnownMarketplaces": { "soojos": { "source": { "source": "github", "repo": "OWNER/soojos" } } },
  "enabledPlugins": { "soojos-core@soojos": true, "soojos-build@soojos": true }
}
```

No `plugin.json` carries a `version`, so the version resolves from the commit SHA and every push is picked up.

### Intel pipeline

Pull-based. A question comes first and the fetch is scoped to it; nothing is scraped on a schedule.

```
question → research.py → wikis/*/raw/     Reddit JSON API + youtube-transcript-api / yt-dlp
         → distill     → claims.jsonl     one sub-agent per raw file, emits claims only
         → report      → reports/
         → recall / brief                 query the ledger; never open raw files into main context
```

A claim is `{id, text, confidence, source, source_type, published, recorded, projects, note, supersedes}`. Confidence is one of `verified`, `claimed`, `anecdote`. `claims.py` handles add/query/clash/stale/stats; `retrieve.py` does keyword scoring weighted by confidence and decayed by age, in Python, so a lookup costs the model almost no tokens.

`research.py` must run on the Mac: Reddit and YouTube return 403 to datacenter IPs, and the script exits with an explicit "blocked at the network level" message rather than falling back to web search.

### Headless runners

`scripts/dispatch.py` (stdlib only) reads `~/.soojos/projects.json`, launches `claude -p --output-format json` detached in the project's cwd with that project's `allowedTools`, `permissionMode` and `maxTurns`, and writes `.json/.err/.meta/.done` files under `~/.soojos/runs/`. `status` polls a run, stores the returned `session_id` under `~/.soojos/sessions/<project>` so the next run resumes it, and reports cost and turn count. `cancel` sends SIGTERM to the process group. Output is JSON on stdout so an MCP tool or chat supervisor can drive it.

`scripts/loop.py` alternates a read-only planner and a read-write builder against any repo. Each planner call starts a fresh session and is fed a digest (carried state, recent commits, last instruction, last builder report, last verify result) instead of a resumed session, to keep context bounded. It stops on planner "done", a failing verify command, two consecutive non-compliant builds, a cycle cap, or a dollar cap. Transcripts land in `<repo>/.soojos-loop/<run_id>/`.

## Key design decisions

- **Router, not prompt.** `CLAUDE.md` is a table of where things are. Content lives in files that are fetched when needed. Only `knowledge/context/` is loaded every session.
- **Framework-level skills are near-constitutional.** A skill goes in SoojOS only if two or more projects would use it and it would survive the project changing entirely. Domain rules stay project-local; `soojos-money` is the one domain plugin and is off by default.
- **The ledger is the asset, raw is disposable.** Agents answer "is there anything about X" from `claims.jsonl` via a script, not by reading reports. Every claim carries a source URL and a date; undated claims are not evidence. Clashes are resolved by `supersedes`, never by deleting the older claim.
- **Indexes are claims to be audited.** `INDEX.md` and `HOT-CACHE.md` describe what exists; the `audit` skill is read-only and reports where they are wrong. The disk wins.
- **Guardrails are hooks, not instructions.** The secrets guard is a PreToolUse command hook that exits 2. An instruction-only permission is not treated as a permission.
- **Local execution for research.** The IP is the constraint, not the protocol, so the fetchers are plain scripts that run on the machine rather than a hosted service.
- **Decisions are files.** `decide` writes `decisions/NNNN-slug.md`; decision records override this README and `CLAUDE.md` when they disagree.

## Status

Checked on 2026-08-29 against the working tree, `~/.soojos`, `~/.claude/settings.json`, `claude mcp list` and Claude Code 2.1.251.

### Working

- **Marketplace catalog and all five plugins.** 14 `SKILL.md`, 4 agents, 1 hook present. `claude plugin validate` passes on all five (with warnings).
- **Marketplace registered at user scope** in `~/.claude/settings.json` as a directory source pointing at this checkout.
- **`knowledge/claims.jsonl` exists.** It holds 3 claims, all `anecdote`, all from one YouTube video (`Ek1NBfnnTH0`, published 2026-08-09, distilled 2026-08-24), all tagged `soojos`. That is the entire ledger.
- **`claims.py`** — `stats` and `query` run against the ledger. **`retrieve.py`** returns ranked results, but only via its fallback path; its default `~/soojos/intel/claims.jsonl` does not exist.
- **`research.py` YouTube path** has been run once (the one raw file above). Distillation from that file produced the 3 claims.
- **`guard-secrets.sh`** blocks `.env` (exit 2 with reason) and allows `main.py` (exit 0) when invoked with a PreToolUse payload.
- **`dispatch.py`** — one run recorded (2026-08-24, project `soojos`, exit 0, 3 turns, $0.36, session id saved). Registry contains only `soojos` with `Read,Grep,Glob`.
- **`loop.py`** — five runs on 2026-08-24; two produced commits (`loop cycle 1`, `loop cycle 2`) that are in `main`.
- **`bin/soojos-init`** — read; writes settings/CLAUDE.md/context/decisions as described. Not executed during this check.

### Not yet done

- **No SoojOS MCP server exists.** There is no server code in this repo or in `$HOME`, `claude mcp list` shows only the claude.ai Gmail/Microsoft 365/Notion connectors, and `~/.claude.json` has no `mcpServers` entries. Tools such as `soojos_status`, `claims_search`, `reports_list`, `report_read`, `research_youtube`, `research_reddit`, `code_projects`, `code_dispatch`, `code_status` do not exist anywhere. `plugins/soojos-ops/.mcp.json` only points at `https://mcp.notion.com/mcp`.
- **No plugin is enabled anywhere that was checked.** `enabledPlugins` in `~/.claude/settings.json` is `{}`, and this repo has no `.claude/settings.json` of its own. Skills are therefore not loading in sessions unless started with `--plugin-dir`. No external subscriber repo was verified.
- **`decisions/` does not exist**, though `CLAUDE.md`, the `decide` skill and the standing rules all point at it. No decision record has been written.
- **`context/handoff.md` does not exist**; `CLAUDE.md` links to it.
- **`projects/` is empty.** `CLAUDE.md` names six active projects; none has a `projects/<name>/CLAUDE.md`.
- **`audits/` is empty** and `INDEX.md` says `Last verified: never`. `INDEX.md` reports 0 reports; there is 1 (`reports/ibkr-equities-preflight-2026-08-27.md`, uncommitted). `HOT-CACHE.md` has no entries.
- **Reddit path of `research.py` has never been run** — `wikis/reddit/raw/` is empty.
- **Notion wiring unverified.** `log-run` hardcodes database IDs; no run was checked against Notion.
- **`dispatch.py` is not driven by anything.** The supervisor/MCP layer it was designed for does not exist; it has been invoked by hand once.
- **No worktree support in `dispatch.py`**; parallel lanes exist only as the manual `lane` skill.
- **No scheduler.** Nothing runs on a cadence; the `soojos-intel` marketplace tag `cadence` describes nothing that exists.
- **No plugin versions.** Fine for one user; required before anyone else subscribes.

## Setup

Once per machine, in Claude Code:

```
/plugin marketplace add OWNER/soojos      # or a local directory path
/plugin install soojos-core@soojos
/plugin install soojos-build@soojos
```

Once per project, from its root:

```bash
/path/to/soojos/bin/soojos-init OWNER [soojos-ops] [soojos-money]
```

Research fetches need `pip install youtube-transcript-api yt-dlp` and a residential IP.

To add a skill: create `plugins/<plugin>/skills/<name>/SKILL.md`, test with `claude --plugin-dir ./plugins/<plugin>`, run `claude plugin validate ./plugins/<plugin>`, commit. Plugins are copied into a cache on install, so nothing may reference paths outside its own plugin directory.

## Requirements

macOS, Claude Code 2.1.x, Python 3 (stdlib for `dispatch.py`, `loop.py`, `claims.py`, `retrieve.py`; `youtube-transcript-api` and `yt-dlp` for `research.py`).
