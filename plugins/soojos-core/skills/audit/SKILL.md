---
name: audit
description: Read-only audit of the operating system that checks every index, router and wiki against what is actually on disk, and reports what would give a wrong answer today. Use this whenever the user asks to audit, review or health-check the OS, says the system feels stale or disorganised, asks "is my knowledge base current", when an agent failed to find something the user knows exists, or on any monthly or scheduled review.
---

# Audit

Purpose: every index is a **claim** about what exists. Verify the claims against reality.

## Hard rule

**Read-only. Report, never fix.** Propose a fix list and stop. The user approves before anything changes.

## Fan out

Run these six checks in parallel, one sub-agent each, handing every one the project root. Merge their reports into a single audit.

1. **Routing integrity** — does every path named in `CLAUDE.md` and every project-level `CLAUDE.md` actually exist? Does anything on disk have no route pointing to it?
2. **Index truth** — does `knowledge/INDEX.md` match the disk? Count files and folders. Report the exact discrepancy, e.g. "index claims 12 notes, disk has 19".
3. **Freshness** — the newest dated item in each wiki, and in `HOT-CACHE.md`. Name the date each wiki is current through.
4. **Bloat and duplication** — the same fact stated in two places, oversized files, raw pulls that were never distilled.
5. **Hygiene** — undated claims, notes without a source URL, orphaned raw files, empty directories that a route points at.
6. **Context placement** — situational data that has been wrongly pinned into `knowledge/context/`, or expertise that is buried in a wiki where it won't load.

## The section that matters most

End with **"What would give a wrong answer today"** — concrete questions the system would currently answer confidently and incorrectly. Derive these from the freshness and clash findings. Example: "any question about Claude Code plugin behaviour would answer from a note dated 2026-06-12 and miss anything since."

Check specifically for the four failure modes:
- **Poisoning** — a false claim sitting in context, repeated confidently. Flag anything unsourced.
- **Bloat** — the needle lost in the haystack.
- **Confusion** — a gap the model will fill by inventing.
- **Clash** — two notes that contradict, with no way to tell which is current. Always report both dates.

## Output

Write to `audits/YYYY-MM-DD-audit.md`, creating the folder if missing. Structure:

```
# Audit — <date>

## Verdict
<one line: healthy | drifting | unreliable>

## What would give a wrong answer today
<the list — this goes first because it's the only section with consequences>

## Findings
<by check, severity-ordered, each with the exact discrepancy>

## Proposed fixes (awaiting approval)
<numbered, each one action>
```

Then report only the verdict and the wrong-answer list in chat, and point at the file. Do not paste the whole audit.
