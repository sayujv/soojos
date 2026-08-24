---
name: distill
description: Convert raw fetched transcripts and threads into dated sourced claims recorded in the ledger, discarding everything unverifiable. Use immediately after any research fetch, whenever raw files sit unprocessed, and whenever the user shares a video, thread or article whose substance should be kept rather than merely discussed.
---

# Distill

Purpose: raw material is content. The system stores **claims**. This converts one to the other and discards the rest.

## Process

One sub-agent per raw file, so no transcript pollutes the main context. Each returns claims only — never a summary of the source.

For each candidate claim:

1. **Check for a clash** — `claims.py clash --text "<claim>"`. Overlap means it goes in the report as a clash; never resolve by deleting.
2. **Rate confidence** via the `skeptic` agent for anything load-bearing.
3. **Record it** — `claims.py add ...` with source, date, confidence, and the projects it bears on.

## What survives

A claim survives if it would change a decision, or explain a failure. Everything else is discarded — including things that are true, interesting, and irrelevant.

A 25-minute video typically yields two or three claims. If you've recorded fifteen, you summarised rather than distilled.

## What gets discarded on sight

- Restatements of things already in the ledger as `verified`
- Income and productivity claims, unless the *method* is the claim
- Anything with no identifiable source or date
- Opinion with no mechanism behind it

## Rules

- `projects:` set only where a claim genuinely bears on that project. Empty is valid and means general background.
- Never overwrite a contradicted claim. Add the new one; the ledger's clash warning is the trail.
- After a batch, run `claims.py stats` and update `knowledge/INDEX.md` counts and the "fresh through" date.
