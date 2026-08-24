# 0001 — This project runs on SoojOS

Date: 2026-08-09
Status: accepted

## Context
Skills and agents kept in a project's own `.claude/` directory are available only in that project and have to be copied by hand to be reused. Across six projects that meant duplicated files, drift between copies, and no way to push an improvement everywhere at once.

## Decision
Every project subscribes to the `soojos` plugin marketplace via `.claude/settings.json`. Shared skills, agents and hooks live only in the SoojOS repo. Project-local `.claude/skills/` is for things genuinely specific to this project and nothing else.

## Alternatives rejected
- **Copy skills per project** — the status quo; guarantees drift and makes improvement expensive.
- **Symlink a shared folder** — breaks on clone, invisible to any other machine, and carries no versioning.
- **One giant plugin** — every project would load trading guardrails and Notion wiring it doesn't need, spending context for nothing.

## Consequences
Easy: one push updates every project. New projects inherit the full toolkit in one command.
Hard: a bad edit to a shared skill now reaches every project, so shared skills need the same care as shared code.
