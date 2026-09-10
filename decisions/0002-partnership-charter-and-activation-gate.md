# 0002 — Adopt Sayuj's partnership charter; await activation approval

Date: 2026-09-10 (AWST)
Status: accepted — charter adoption and approval boundaries only; operating scope and budgets remain proposed.

## Context

Sayuj supplied a joint Claude–Codex charter after reviewing the continuity migration. It changes the operating authority and requires a concrete preflight before “go”.

## Decision

Use `context/partnership-charter.md` as the governing user document for both agents. Preserve shared local continuity from decision 0001. Append new handoffs at the end. Codex coordinates and Claude co-builds, subject to the charter's held-back actions. The old revenue and one-project-slot restrictions are retired. Do not activate queued work, Claude dispatch or schedules before Sayuj confirms scope, budgets and “go”. Proposed settings belong in the preflight review, not the charter.

## Alternatives rejected

- Automatically activate from earlier broad permission: ignores the newer explicit confirmation gate.
- Duplicate assistant-specific project instructions: reintroduces drift.
- Automatic cloud instruction updates: conflicts with the charter's approval boundary.

## Consequences

Existing project code and services are unaffected by adoption. Cloud cleanup, dispatch enforcement, budgets and notifications still require the review and implementation steps. This record supplements decision 0001; its shared-folder approach remains accepted.
