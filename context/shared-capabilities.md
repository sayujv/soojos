# Shared local capability sources
Checked: 2026-09-09 AWST. This is a source map, not a claim that all integrations are authenticated.

## Personal and project skills
- Personal originals: /Users/sayuj/.claude/skills/{watch,video-research}/. Codex's /Users/sayuj/.agents/skills counterparts point to these original folders.
- Equities Desk originals: /Users/sayuj/AI/Claude/equities-desk/.claude/skills/{desk-brief,desk-ops,ibkr-sync,ibkr-watchlist}/. Its .agents/skills counterparts point to the original project skills.
- Video watch development source: /Users/sayuj/AI/Claude/video-tools/watch-skill/watch/. This is separate from the installed personal watch skill; publish deliberate tested updates into the installed source.

## SoojOS (15 authored skills)
The live authoring source is /Users/sayuj/soojos/plugins. The existing core/build marketplace plugins are already installed in Claude and Codex. When applying those self-authored skills, read the corresponding live source below to catch changes since the import. Do not edit a plugin cache to develop a skill.
- soojos-core: audit, decide, grill-me, new-project, session-handoff.
- soojos-build: lane, verify.
- soojos-intel: brief, distill, recall, research.
- soojos-money: backtest-review, risk-check.
- soojos-ops: log-run, standup.

Layout: <source>/<plugin>/skills/<skill>/SKILL.md. The eight intel/money/ops skills are exposed to Codex by symlink under ~/.agents/skills/<plugin>-<skill>. These are existing local source files, not downloaded packages or newly enabled MCP connections. Skills that need Notion or another absent connector remain dependent on that connection. For CLI snippets with CLAUDE_PLUGIN_ROOT, substitute the exact owning plugin source directory after inspection.

## Agent role definitions
- /Users/sayuj/soojos/plugins/soojos-core/agents/critic.md
- /Users/sayuj/soojos/plugins/soojos-build/agents/reviewer.md
- /Users/sayuj/soojos/plugins/soojos-intel/agents/scout.md and skeptic.md
- /Users/sayuj/AI/Claude/equities-desk/.claude/agents/desk-guardian.md and desk-analyst.md
- /Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build/agents/ (pipeline prompts; read TEAMS.md for contracts).

Role text can be read by either assistant. Claude subagent frontmatter, pipeline prompts, and Codex agent registrations are different things. Use each host's supported delegation interface; never pretend a pipeline role or unavailable model is a callable subagent.

## Runtime capabilities observed
Codex currently exposes Serena, Scrapling and browser tools. Its configuration enables Serena and Scrapling. Claude's source notes record those tools plus ccusage and a test-output filtering hook. Hook portability and connector auth were not exercised.
The imported ibkr-sync skill still needs actual IBKR connector tools. No IBKR connector tools were available in this Codex task; reading the skill does not grant them. Do not fabricate a broker snapshot. The original ibkr-sync skill hardcodes Claude producer values: Codex may read it as reference, but must not execute an import until actual connector availability and truthful Codex producer provenance have been deliberately adapted and checked against the schema. Never label a Codex-produced snapshot as claude-session or claude-headless.
Follow-up on 2026-09-09 installed GitHub CLI 2.100.0 and Microsoft Playwright CLI 0.1.18 into ~/.local/bin. Both resolve from PATH and pass version/help checks. Details and dependency versions: context/cli-setup-2026-09-09.md (relative to the SoojOS root). GitHub authentication and browser execution were not tested. Other shortlisted tools remain recommendations; no new hosted provider, proxy, account connection or scheduled updater was added.

Current sourced recommendations: /Users/sayuj/soojos/knowledge/reports/2026-09-09-claude-codex-tool-research.md.

Claude cloud project names/source links are mapped in [claude-projects.md](claude-projects.md). This is an inventory and navigation map; cloud conversations and attachments have not been exported or continuously synchronized.
