# Shared project registry
Inventory checked: 2026-09-09 AWST. Paths were verified on disk. Status descriptions below are documentary evidence, not live service checks.
Both assistants should use these exact folders. Do not translate "Claude" in a path into "Codex".

| Project | Canonical folder | Read / shared handoff | Codex sidebar at audit |
| --- | --- | --- | --- |
| SoojOS / Claude Platform | /Users/sayuj/soojos | CLAUDE.md; knowledge/context/; knowledge/HOT-CACHE.md; context/handoff.md; decisions/ | Connected |
| Equities Desk | /Users/sayuj/AI/Claude/equities-desk | CLAUDE.md; README.md; artifacts/reports/context/handoff.md; artifacts/reports/decisions/ | Connected |
| Momentum OS (documented dormant) | /Users/sayuj/AI/Claude/momentum-os | CLAUDE.md; docs/current_state.md; docs/project_architecture.md; docs/data_quality_register.md; shutdown memory below; context/handoff.md when work resumes | Connected |
| Momentum Orchestrator | /Users/sayuj/AI/Claude/momentum_orchestrator | README.md; build_persona.md and brain_persona.md when relevant; context/handoff.md when first used | Not listed individually |
| Video Tools | /Users/sayuj/AI/Claude/video-tools | README.md; watch-skill/watch/; context/handoff.md when first used | Not listed individually |
| Viewer | /Users/sayuj/AI/Claude/viewer | README.md; docs/status-envelope-v1.md; context/handoff.md when first used | Not listed individually |
| YouTube Build | /Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build | README.md; PROJECT_BRIEF.md; agents/TEAMS.md; TREND_INTELLIGENCE_BRIEF.md for trends work; context/handoff.md when first used | Not listed |
| Trading Bot Conductor | /Users/sayuj/Documents/Claude/Projects/Trading Bot Conductor | AGENTS.md is only an import heading; original project content has not been recovered | Connected, empty instructions |

The /Users/sayuj/AI/Claude parent folder is also connected. Its child directories are accessible from that saved project, but individual saved projects improve root-specific instruction discovery.

## Lifecycle and stale context
- Momentum OS was shut down on 2026-08-29 according to /Users/sayuj/.claude/projects/-Users-sayuj-AI-Claude-momentum-os/memory/project_shutdown_2026-08-29.md. Equities Desk's CLAUDE.md and Viewer's README.md also describe it as dormant/terminated. Its own state document still claims an operational loop; flag this clash. No VPS check or restart was performed during this integration.
- /Users/sayuj/AI/Claude/momentum-os-archive is archived runtime data, not a working project. Leave it untouched.
- The old YouTube path /Users/sayuj/Downloads/Youtube Build is missing. The canonical folder above was found under Downloads/Projects and contains a Git repository.
- /Users/sayuj/Downloads/Projects/SoojOS/soojos is a second SoojOS folder discovered during the path search. Treat /Users/sayuj/soojos (already saved in Codex and referenced by installed skills) as the working source; do not sync or delete the second copy without inspecting why it exists.
- Follow-up discovery found 25 Claude project entries. Their source links and local navigation records are now listed in [claude-projects.md](claude-projects.md) and projects/<name>/CLAUDE.md. Cloud conversations/attachments are not exported or continuously synced; read the linked source before continuing that work.
- Downloads, home, scratch workspaces and .claude/jobs temporary roots are not promoted to independent active projects by this registry.

## Memory lookup
Read indexes only as needed, then the relevant referenced note:
- General: /Users/sayuj/.claude/projects/-Users-sayuj/memory/MEMORY.md
- Shared Claude folder: /Users/sayuj/.claude/projects/-Users-sayuj-AI-Claude/memory/MEMORY.md
- Momentum OS: /Users/sayuj/.claude/projects/-Users-sayuj-AI-Claude-momentum-os/memory/MEMORY.md

These are original local Claude memory files, readable by Codex. New durable project facts belong in project-owned handoff/state/decision files so either system can update them. Do not copy the whole memory tree or private conversation history.

## Codex import step
Official app flow: Settings → Import → choose Claude Code / Claude Cowork as applicable → select project/setup items → import → enable automatic updates and review any "Finish setup" notices. Add the four missing canonical working folders above as saved projects if the import chooser does not discover them.
Computer Use explicitly blocked control of Codex itself during this task; neither the automatic-updates switch nor new sidebar registration has been verified.
Automatic import is supplementary. Existing chat context still needs an explicit file/state refresh. After an import, verify that AGENTS.md still routes to the real CLAUDE.md and that literal source paths, commands and safety rules were preserved.
Source: https://learn.chatgpt.com/docs/import


## Project alignment and first builds — 2026-09-10

All 25 names were rechecked against the live Claude project list and created as matching ChatGPT cloud project containers. The Codex app keeps all eight original local project entries and groups all33 cloud/local entries under SoojOS, Business projects, Other Claude projects and Imported history. No original folder or conversation was deleted, archived or moved on disk. Exact reversible IDs and moves: [alignment record](desk/project-alignment-2026-09-10.json). The names and organization do not imply that web ChatGPT can access Mac files or all Claude conversation histories. No additional local folder attachment was verified.

Approved first business builds live in isolated desk task worktrees under /Users/sayuj/soojos/.worktrees/task-<id>, each with its own exact commit, usage instructions, verification and current limitations. The [live first-build catalogue](desk/portfolio-builds-2026-09-10.md) gives their current status. Read the canonical projects/<slug>/CLAUDE.md and its latest appended context/handoff.md to locate a completed build. Preserve the original canonical sources above; no worktree is silently promoted or merged.
