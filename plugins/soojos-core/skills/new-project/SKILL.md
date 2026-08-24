---
name: new-project
description: Bootstrap a new project onto the SoojOS standard — router-style CLAUDE.md, context and decisions directories, and the marketplace subscription so every shared skill and agent is available immediately. Use this whenever the user starts a new project, repo or build, says "set up a new project", clones something they intend to work in, or opens Claude Code in a directory with no CLAUDE.md.
---

# New Project

Purpose: a new project inherits the whole toolkit in one step, with nothing copied by hand.

## Steps

1. **Confirm the project name and category** (make-money / save-spend / personal / admin). One line each, don't interview.

2. **Create the structure:**

```
CLAUDE.md          router only, see below
context/           background the model loads on demand
  handoff.md       created on first handoff
decisions/         numbered decision records
.claude/settings.json
```

3. **Write `.claude/settings.json`** so the project subscribes to SoojOS:

```json
{
  "extraKnownMarketplaces": {
    "soojos": { "source": { "source": "github", "repo": "REPLACE_ME/soojos" } }
  },
  "enabledPlugins": {
    "soojos-core@soojos": true,
    "soojos-build@soojos": true
  }
}
```

Add `"soojos-ops@soojos": true` if the project is tracked in Notion, and `"soojos-money@soojos": true` only for trading, betting or spend projects.

4. **Write `CLAUDE.md` as a router, not a manual.** It should be short enough to read in ten seconds and point everywhere else:

```markdown
# <Project> — <one-line purpose>

Category: <make-money | save-spend | personal | admin>
Stage: <idea | building | running>

## Read before working
- Background and constraints: `./context/`
- Prior decisions (binding): `./decisions/`
- Last session state: `./context/handoff.md`

## Standing rules
- Verify before claiming done. Untested is not working.
- Log any directional choice with the `decide` skill.
- Write a handoff before clearing context.

## This project specifically
<three to six lines max: what it does, the one constraint that matters, what "done" looks like>
```

5. **Tell the user the single next action** for this project, and stop.

## Rules

- Never inline background into `CLAUDE.md`. If it's more than six lines, it belongs in `./context/`.
- Do not populate `context/` with speculation. Empty is fine.
