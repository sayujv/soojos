---
name: recall
description: Look up anything previously researched or decided — prior findings, past decisions, known constraints, "have we looked at X", "what did we conclude about Y", "is there anything on Z". Use this BEFORE reading any file in intel/reports or decisions/, and before running a fresh web search on a topic that may already be covered. Do not open research reports directly; query the ledger first.
---

# recall

Deterministic retrieval over `claims.jsonl`. Scoring runs in Python, not in the
model — searching the knowledge base should cost effectively no tokens.

## The rule

**Never grep, glob, or open files under `intel/reports/` or `decisions/` to find
something.** Those are large. The claims ledger is the index; the reports are the
payload. Query the index, and only fetch payload if the index is insufficient.

## Procedure

1. Run the retriever with the user's question verbatim — it strips the query to
   keywords itself, so no need to pre-process:

   ```bash
   python3 plugins/soojos-intel/scripts/retrieve.py "<the question>" --top 5
   ```

2. Read the returned claims. In most cases they answer the question outright —
   that is the intended outcome. Answer from them and stop.

3. Only if the claims are genuinely insufficient — they gesture at the answer but
   lack the specific detail asked for — open the single highest-scoring source,
   and read only the section named after the `#` in the path. Never read a whole
   report.

4. If nothing matched (`no claims matched`), retry once with a broader query. If
   still empty, say so plainly and treat it as an unresearched topic — that is
   when a fresh research run is warranted, not before.

## Options worth knowing

| Flag | Use |
|---|---|
| `--top N` | More candidates when the question is broad. Default 5. |
| `--sources` | Just the deduplicated report paths — for "where is this written down". |
| `--since YYYY-MM-DD` | Ignore older claims when recency actually matters. |
| `--format json` | When the result feeds another script rather than a reply. |
| `--half-life D` | Recency decay in days. Default 180. Lower it for fast-moving topics. |
| `--ledger PATH` | Override the ledger location (env `SOOJOS_CLAIMS`, default `~/soojos/intel/claims.jsonl`). |

## Reporting back

When answering from recall, cite the source path so the claim stays traceable —
`(intel/reports/2026-07-28-mcp-sdk.md#elicitation)`. If a retrieved claim
contradicts something in the current conversation, surface the conflict rather
than silently picking one.
