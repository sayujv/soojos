# Knowledge Index

This file is a **claim** about what exists. The `audit` skill checks it against the disk. When they disagree, the disk is right.

Last verified: never

| Store | Path | Covers | Count | Fresh through |
| --- | --- | --- | --- | --- |
| Claims ledger | `claims.jsonl` | Every claim the OS believes, machine-queryable | 3 | 2026-08-09 |
| Reports | `reports/` | One per research question, human-readable | 0 | — |
| YouTube raw | `wikis/youtube/raw/` | Transcripts, fetched per question | 1 | 2026-08-09 |
| Reddit raw | `wikis/reddit/raw/` | Threads, fetched per question | 0 | — |

Query the ledger, don't read the reports, unless a specific claim needs its
context:

    python3 plugins/soojos-intel/bin/claims.py query --project <name> --since <date>
    python3 plugins/soojos-intel/bin/claims.py stale --days 60

## Expertise context

| File | Covers |
| --- | --- |
| `context/identity.md` | Who I am, how I work, what I optimise for |
| `context/constraints.md` | Hard limits: budget, time, platform, security |
| `context/projects.md` | One paragraph per active project |

## Rules

- One wiki per distinct source type. Segment before a store gets unwieldy, not after.
- Raw is fetched per question, never on a schedule, and never read directly into the main context — it is distilled by sub-agents first.
- Raw is disposable. The ledger and reports are the assets; raw can be deleted once distilled.
