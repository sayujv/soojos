---
name: brief
description: Report what has changed that actually affects a given project, by querying the claims ledger rather than reading notes. Use when returning to a project after time away, when the user asks what's new for a specific build, whether there's a better way to do something now, or whether an approach has been superseded.
---

# Brief

Purpose: turn the ledger into "here is what changed and what to do about it" for one project.

## Process

Query the ledger — this costs almost no context, so query before loading any file:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/bin/claims.py query --project trading-bot --since 2026-06-01
python3 ${CLAUDE_PLUGIN_ROOT}/bin/claims.py stale --days 60
python3 ${CLAUDE_PLUGIN_ROOT}/bin/claims.py stats
```

Open the underlying report only for claims that survive the relevance filter.

## Output

```
SINCE     <date of oldest claim considered>
STALE     <claims over 60 days that this project leans on — omit if none>

CHANGES THAT MATTER
  <claim> [confidence] — <what it means for this project> (source, date)

SUPERSEDED
  <what we're doing that a newer claim contradicts, with both dates>

NOTHING CHANGED FOR
  <areas checked with no relevant news — so the gap is visible>
```

End with one recommendation: the single thing worth acting on, or explicitly "nothing here changes the plan". Make the call.

## Rules

- Flag confidence inline. A direction change driven by an `anecdote` must say so in the same sentence.
- On a clash, surface both and say which is newer — don't silently pick.
- Cap at 15 lines.
- Absence of news is information. Always include `NOTHING CHANGED FOR`, so a silent gap isn't read as a clean bill of health.
- If `stale` returns claims this project depends on, say that before the recommendation. A brief built on stale claims is worse than no brief.
