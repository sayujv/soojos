# 0005 — Report tokens without a ceiling

Date: 2026-09-10
Status: accepted

## Context
The original 20,000-token pilot control prevented subscription dispatch. Sayuj requested a larger allowance for builds consuming millions of tokens. After automatic review requested clearer authorization, Sayuj explicitly confirmed the no-cap question with “commence”.

## Decision
Use policy v2 with reporting-only token totals and no per-task, family or descendant token ceiling. Unknown usage remains unknown and does not block descendants. Preserve time, turn, concurrency, chain, STOP and financial controls. Verify native subscription authentication and disabled paid usage credits before the first enabled Claude review.

## Alternatives rejected
A higher arbitrary ceiling would repeat the same constraint. A reporting target that stops subsequent dispatch would retain a token ceiling under another name. Paid API fallback lacks authorization.

## Consequences
Large builds can consume their existing subscription allowance without this harness imposing a token cap. Provider quotas still apply. Runtime, concurrency and cash limits remain independent. Existing policy and queue history are backed up during explicit migration; shared instructions must reflect this decision.
