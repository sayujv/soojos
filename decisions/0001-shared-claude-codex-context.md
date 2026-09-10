# 0001 — Shared local context for Claude and Codex

Date: 2026-09-09 (AWST)
Status: accepted — implements the operator's request to switch between Claude and Codex on existing projects.

## Context
Imported instruction and skill snapshots had drifted, including broken literal paths and a missing newer safety rule. Credit limits make continuation in either assistant necessary.

## Decision
Use the same canonical local working folders, original project instructions, shared handoffs and dated decisions. Codex adapters read CLAUDE.md directly; copied personal/project skills link to the original source. Consult the live SoojOS capability map. Check files and Git state when switching; isolate simultaneous writers in separate worktrees.

## Alternatives rejected
- Separate Claude/Codex folder copies: they diverge and create overwrite hazards.
- A second memory database or provider proxy: extra moving parts and contrary to the existing local-tool preference.
- Chat history alone: unsaved context does not reliably transfer between assistants.

## Consequences
Either assistant can read current saved work. Context must still be refreshed at task boundaries. Automatic import and cloud-only project content require separate app setup; connectors and hooks remain host-specific.
