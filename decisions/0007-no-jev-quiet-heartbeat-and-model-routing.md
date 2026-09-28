# 0007 — Save credits with a deterministic quiet heartbeat and model routing, not Jev

Date: 2026-09-25
Status: accepted

## Context
Sayuj wants lower credit use without more mistakes. Astra's Codex usage ran out on 24 September. Of Astra's 158 handoff entries from 19 to 24 September, 128 were "unchanged" checkpoints, and heartbeats rose from 11 to 47 a day: most spend bought the sentence "nothing changed". Worker runs showed about 90% of tokens are standing context re-read per turn; Sonnet cut list-price-equivalent cost 3.6x on a comparable review with shallower findings.

## Decision
The "did anything change" question is answered by code, not a model: `tools/soojos-desk/heartbeat_gate.py` fingerprints desk state and an unchanged beat ends without any LLM turn. Worker models are routed by task kind: verdict-bearing work (verify, retro) on Fable, production and research on Sonnet, an explicit model on the task wins. Jev is not adopted.

## Alternatives rejected
- Jev (TypeSafe hosted decision model, USD 0.042 per million input tokens): cannot write reviews or code, so it cannot replace either worker; it would need to absorb more than 7 of 11 Fable turns to beat Sonnet; a probability is a claim, not evidence, under the charter; waitlisted, closed weights, self-graded benchmarks, no published data-retention terms; a new paid provider needing Sayuj's approval. A script answers the unchanged question for zero tokens and cannot be confidently wrong.
- Sonnet everywhere: cheaper, but shallower on reviews, where a mistake propagates into a merge.
- Fable everywhere: quality, at 3.6x the draw-down on volume work whose mistakes downstream review already catches.

## Consequences
Heartbeat spend falls to near zero on quiet beats; LLM turns happen only when the gate reports attention. Review depth stays at Fable. Revisit Jev only with a measured turns-saved figure and Sayuj's approval.
