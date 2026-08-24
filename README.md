# SoojOS

One repo that carries the skills, agents, hooks and MCP wiring for every project. Projects subscribe to it; nothing is ever copied between them.

## Why this shape

A skill sitting in a project's `.claude/skills/` is available in that project only. Sharing it means copying it, and copies drift. A **plugin marketplace** is the mechanism built for the opposite: plugins live here once, projects declare a subscription, and a push to this repo reaches every project on their next session.

## Two roles, one repo

SoojOS is both:

- **The brain.** `cd` in here and `CLAUDE.md` routes to knowledge, decisions and projects. Segmented wikis, expertise-vs-situational context split, a read-only audit that checks every index against the disk.
- **The marketplace.** External repos subscribe to it and inherit every skill, agent and hook without copying a file.

The second role is the one a single-monorepo setup never needs and you do — Trading Bot has its own git history and can't live inside this repo.

## Layout

```
soojos/
├── CLAUDE.md                         the router — a table of contents, not a prompt
├── knowledge/
│   ├── INDEX.md                      a claim about what exists; the audit checks it
│   ├── HOT-CACHE.md                  few facts, most likely to be stale
│   ├── context/                      expertise context — loaded every session
│   └── wikis/{youtube,reddit}/       segmented; raw/ is distilled into notes/
├── decisions/                        numbered, binding
├── audits/                           read-only audit reports
├── projects/                         per-project CLAUDE.md routers
├── .claude-plugin/marketplace.json   the catalog — what exists and where
├── plugins/
│   ├── soojos-core/                  context hygiene, decisions, critique, audit, bootstrap
│   ├── soojos-ops/                   Notion registry + standup
│   ├── soojos-build/                 verify, worktree lanes, code review
│   ├── soojos-intel/                 harvest → distill → brief, plus launchd cadence
│   └── soojos-money/                 backtest review, risk checks, secrets guard
├── templates/                        CLAUDE.md, settings.json, context/, decisions/
└── bin/soojos-init                   drops a project onto the standard
```

## What's in each plugin

| Plugin | Skills | Agents | Other | Enable where |
| --- | --- | --- | --- | --- |
| `soojos-core` | `grill-me`, `session-handoff`, `decide`, `new-project`, `audit` | `critic` | — | everywhere |
| `soojos-ops` | `log-run`, `standup` | — | Notion MCP | projects tracked in Notion |
| `soojos-build` | `verify`, `lane` | `reviewer` | — | any repo with code |
| `soojos-intel` | `research`, `distill`, `brief` | `scout`, `skeptic` | `research.py`, `claims.py` | the brain repo |
| `soojos-money` | `backtest-review`, `risk-check` | — | secrets-guard hook | Trading Bot, Prediction Betting |

## The intel loop

Pull-based. A question comes first; the fetch is scoped to it. Nothing is scraped on a schedule.

```
question → research.py    → raw/          scoped fetch, Reddit + YouTube
         → distill        → claims.jsonl  sub-agent per file, claims only
         → report         → reports/      the human-readable answer
         → brief <proj>   → what changed and what to do about it
monthly  → audit          → what would give a wrong answer today
```

**Runs on the Mac.** Reddit returns 403 and YouTube IP-blocks any datacenter address. Claude Code executes on your machine, so its bash calls use your residential IP and these work — a hosted runner returns nothing, silently. First run needs `pip install youtube-transcript-api yt-dlp`.

### Two consumers, two artifacts

An agent deciding *whether* something is relevant, and an agent *acting* on it, need different things. Serving both with prose gives you files too long to scan and too thin to act on.

- **`claims.jsonl`** — one JSON object per claim: text, confidence, source, date, projects. Agents query it with `claims.py` to answer "is there anything about X" at near-zero context cost. Clash detection is mechanical, not a matter of an agent happening to notice.
- **`reports/`** — one markdown report per research question: the answer, a claims table, contradictions with both dates, what it changes per project, and what could not be established.

Raw is disposable and never read into the main context. A 25-minute transcript is thousands of words around two or three real claims.

### Confidence

`verified` (checked against docs or reproduced here) · `claimed` (asserted, unchecked — most video) · `anecdote` (one person's experience — most Reddit). Income and "10x" claims never rise above `claimed`, however often repeated.

## Setup — once per machine

```bash
gh repo create soojos --private --source=. --push     # or push to an existing remote
```

Then in Claude Code:

```
/plugin marketplace add YOUR_GH_USER/soojos
/plugin install soojos-core@soojos
/plugin install soojos-build@soojos
```

Check the install summary — if it says `Run /reload-plugins to activate.`, run that.

Verify with `/plugin`, then try `/soojos-core:grill-me`.

## Setup — once per project

From the project directory:

```bash
/path/to/soojos/bin/soojos-init YOUR_GH_USER            # core + build
/path/to/soojos/bin/soojos-init YOUR_GH_USER soojos-ops soojos-money
```

That writes `.claude/settings.json` declaring the marketplace and the enabled plugins, plus a router-style `CLAUDE.md`, `context/` and `decisions/`. Commit it, and the project is subscribed on every machine and in every worktree.

## Adding a skill

1. `mkdir -p plugins/soojos-core/skills/<name>` and write `SKILL.md`.
2. Test without installing: `claude --plugin-dir ./plugins/soojos-core`
3. Validate: `claude plugin validate ./plugins/soojos-core`
4. Commit and push. Other projects pick it up on `/plugin marketplace update`.

Write the `description` frontmatter to be slightly pushy about when to trigger — under-triggering is the common failure, not over-triggering.

## Versioning

No `version` field is set in any `plugin.json`, so the version resolves from the git commit SHA and every push is picked up. That is deliberate for a solo setup. If SoojOS is ever shared, add explicit versions and bump them per release.

## Rules

- A skill goes in SoojOS if two or more projects would use it. Otherwise it stays project-local.
- A plugin should be enable-able independently. If Trading Bot has to load Notion wiring to get a risk check, the split is wrong.
- Plugins are copied into a cache on install, so nothing may reference paths outside its own plugin directory.
