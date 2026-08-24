---
name: research
description: Answer a specific question by fetching only the sources that bear on it from Reddit and YouTube, then producing a sourced report with a claims table. Use this whenever the user asks what the current best approach to something is, whether a tool or technique has been superseded, what practitioners report about a specific problem, or asks to look into, research or dig into a topic. Also use before committing to any new tool or architectural approach.
---

# Research

Purpose: a question comes first. The fetch is scoped to the question. Nothing is pulled speculatively.

## Hard constraints

- **Runs on the Mac.** Reddit and YouTube refuse datacenter IPs. If a fetch reports a network block, stop and say so — never fall back to general web search while presenting the result as if it came from the sources requested.
- **Raw never enters the main context.** Transcripts are thousands of words around a handful of claims. Hand each raw file to a sub-agent; only the sub-agent's findings come back.
- **No question, no fetch.** If the user's ask is vague, sharpen it into one answerable question first, in one line, and proceed. Don't interview.

## Process

1. **State the question** in one line, and which projects the answer would affect.

2. **Scope the sources.** Use the `scout` agent to pick which subreddits or search terms are worth the call. Prefer official docs first — if the answer is in documentation, a Reddit thread is a worse source and the research is already done.

3. **Fetch, narrowly:**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/bin/research.py reddit \
  --query "<question keywords>" --subs ClaudeAI,algotrading --window year --min-score 10

python3 ${CLAUDE_PLUGIN_ROOT}/bin/research.py youtube \
  --query "<question keywords>" --limit 4

python3 ${CLAUDE_PLUGIN_ROOT}/bin/research.py youtube --video <ID>   # a specific video
```

First run needs: `pip install youtube-transcript-api yt-dlp`

4. **Distil in parallel** — one sub-agent per raw file, each returning only claims with source and date. Pass anything load-bearing through the `skeptic` agent.

5. **Check the ledger before writing anything down:**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/bin/claims.py clash --text "<the claim>"
```

If it overlaps an existing claim, that clash goes in the report. Both survive.

6. **Record each kept claim:**

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/bin/claims.py add \
  --text "<claim>" --source "<url>" --date YYYY-MM-DD \
  --confidence verified|claimed|anecdote --source-type reddit|youtube|docs \
  --projects trading-bot,claude-platform --note "<path to report>"
```

7. **Write the report** to `knowledge/reports/YYYY-MM-DD-<slug>.md` using `${CLAUDE_PLUGIN_ROOT}/templates/report.md`. Report the answer and the verdict in chat; point at the file for the rest.

## Confidence, applied strictly

- **verified** — checked against documentation or reproduced on this machine. Say what was checked.
- **claimed** — the source asserts it, unchecked. Most video content.
- **anecdote** — one person's experience. Most Reddit content. Excellent for failure modes, worthless as proof of a general result.

Income claims, "10x", and before/after metrics are marketing. They never rise above `claimed`, however often repeated.

## Rules

- Reading more is not the goal. If four sources answer it, stop at four.
- `no-signal` is a real verdict. Returning "nothing credible found, here's why" beats assembling a confident answer from weak sources.
- Never let a `claimed` or `anecdote` item drive a change of direction without flagging its confidence in the same sentence.
- Every claim carries a source URL and a date. An undated claim is a future wrong answer.
