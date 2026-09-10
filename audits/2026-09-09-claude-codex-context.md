# Claude + Codex context audit — 2026-09-09

## Verdict
Drifting. Scope: local project discovery, instruction/skill parity and handoff readiness; not a full OS audit or runtime-service verification.

## What would give a wrong answer today
- “Is Momentum OS running?” Its own current_state document says operational, but Claude's 2026-08-29 shutdown record and newer Equities Desk/Viewer guidance describe it as dormant. No live service check was made.
- “What is the sanctioned deploy source?” The imported AGENTS.md rewrote AI/Claude to the nonexistent AI/Codex folder. The original CLAUDE.md preserves the actual source.
- “What must Qanat never do?” The current original Equities Desk instructions have a governance rule missing from the imported Codex copy.
- “Where is watch.py / what runs the headless sync?” Imported skills changed ~/.claude to nonexistent ~/.Codex and claude -p to Codex -p. These are literal commands, not brand labels.
- “Does Codex have IBKR access because the skill is present?” No IBKR connector tools were available in this task. Original skill producer fields are Claude-specific, requiring deliberate adaptation before any Codex import.
- “Where is YouTube Build?” The memory's old Downloads/Youtube Build path is missing. The project was found at Downloads/Projects/Youtube Build/Youtube Build.
- “Do all SoojOS project brains exist?” The router names six active project categories but its projects directory is empty. Trading Bot Conductor's imported instructions contain only a heading.

## Findings and prepared corrections
The three existing project AGENTS files were copied/translated snapshots. No unique Codex safety rule was found that is absent from the original source. Replace them with live routers, preserving all original files in a local backup. Six copied personal/project skill directories become links to their original source; eight additional authored SoojOS skills become discoverable by local links. Global instructions in both assistants route to the same startup/checkpoint workflow.

The original CLAUDE files, application code, data, accounts, hooks and service settings remain outside these corrections. SoojOS core/build imported plugin snapshots remain installed; the capability map routes authoring changes to the live source. Third-party skills are not installed by this work.

## Remaining work
1. Use Codex Settings → Import to verify automatic updates and register the four missing working folders. Computer Use blocked control of Codex itself.
2. Recover any Claude.ai-only project content the operator wants shared; no local content was found for the named personal/business categories.
3. When Momentum OS is deliberately revisited, reconcile historical state documents with shutdown evidence before any operational work.
4. Confirm connector authentication and hook behavior per host before operational reliance; this integration did not exercise them.
5. Review the second SoojOS folder under Downloads/Projects before treating it as a working copy.

## Evidence
Sources read on 2026-09-09: original and imported instruction files, skill directory hashes/diffs, Codex list_projects, selected Claude memory indexes and shutdown note, project READMEs, and safe configuration fields. Official import and instruction-discovery guidance: https://learn.chatgpt.com/docs/import and https://learn.chatgpt.com/docs/agent-configuration/agents-md .
