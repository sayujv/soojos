# 0006 — Reciprocal Claude–Astra technical review

Date: 2026-09-10
Status: accepted

## Context
Sayuj requested direct IBKR continuation instructions to Claude and asked that Claude review and approve Astra's changes, with GPT doing the same for Claude. Current partnership responsibility is already shared.

## Decision
For IBKR development, the assistant that did not author a change independently reviews its exact commit and records PASS, CHANGES REQUESTED or BLOCKED, with findings and tests actually performed. Fixes require a new reviewed commit. Summaries alone support preliminary review, not code approval. Keep one writer per task and append shared handoffs.

PASS approves technical quality for an already-authorized development step. It does not transfer Sayuj's capital, live-execution, credential, protected-policy, push or main-merge authority. Existing STOP and task controls remain. No automatic approval-clicking or unlimited reply loop is authorized.

## Alternatives rejected
Self-approval provides no independent review. Requiring Sayuj to relay every ordinary review conflicts with the requested direct partnership.

## Consequences
Both assistants can continue each other's work. Missing repository access or unavailable review capacity is recorded honestly. Project-local review artifacts follow the Equities artifact system; this coordination decision does not modify its source or runtime.
