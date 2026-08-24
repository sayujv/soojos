#!/usr/bin/env python3
"""Deterministic retrieval over the claims ledger.

Scoring runs here, not in the model — recall should cost effectively no tokens.
Query keywords are matched against claim text (plus projects and note path),
weighted by confidence and decayed by age.

  retrieve.py "mcp elicitation gate" --top 5
  retrieve.py "bybit rate limits" --sources
  retrieve.py "skills" --since 2026-06-01 --format json
"""
import argparse, json, math, os, re, sys
from datetime import datetime, timezone

DEFAULT_LEDGER = os.path.expanduser("~/soojos/intel/claims.jsonl")
FALLBACK_LEDGER = os.path.expanduser("~/soojos/knowledge/claims.jsonl")
RANK = {"anecdote": 0, "claimed": 1, "verified": 2}
CONF_WEIGHT = {"anecdote": 0.7, "claimed": 1.0, "verified": 1.2}
STOP = set("the a an is are was were be been of to in on for and or with that this it as at by from "
           "what did we have about any there how does do".split())


def stem(w):
    for suf in ("ies", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def keywords(text):
    return {stem(w) for w in re.findall(r"[a-z0-9]+", text.lower())
            if w not in STOP and len(w) > 2}


def load(path):
    out = []
    with open(path) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"warning: line {i} of {path} is not valid JSON, skipped", file=sys.stderr)
    return out


def claim_date(c):
    for k in ("published", "recorded"):
        v = c.get(k)
        if v:
            try:
                return datetime.strptime(v, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    return None


def score(c, qkw, half_life, now):
    ckw = keywords(c.get("text", ""))
    # projects and the note path are weak signal — count them at half weight
    weak = keywords(" ".join(c.get("projects") or []) + " " + (c.get("note") or ""))
    hit = len(qkw & ckw) + 0.5 * len(qkw & (weak - ckw))
    if not hit:
        return 0.0
    base = hit / len(qkw)
    base *= CONF_WEIGHT.get(c.get("confidence"), 1.0)
    d = claim_date(c)
    if d and half_life > 0:
        age = max(0.0, (now - d).days)
        base *= math.pow(0.5, age / half_life)
    return base


def main():
    p = argparse.ArgumentParser(description="Deterministic retrieval over claims.jsonl")
    p.add_argument("query")
    p.add_argument("--top", type=int, default=5)
    p.add_argument("--sources", action="store_true",
                   help="print only the deduplicated source/note paths")
    p.add_argument("--since", metavar="YYYY-MM-DD",
                   help="ignore claims published/recorded before this date")
    p.add_argument("--format", choices=("text", "json"), default="text")
    p.add_argument("--half-life", type=float, default=180.0,
                   help="recency decay half-life in days (0 disables decay)")
    p.add_argument("--ledger", default=os.environ.get("SOOJOS_CLAIMS", ""),
                   help="ledger path (env SOOJOS_CLAIMS, default ~/soojos/intel/claims.jsonl)")
    a = p.parse_args()

    ledger = a.ledger or DEFAULT_LEDGER
    if not os.path.exists(ledger) and not a.ledger and os.path.exists(FALLBACK_LEDGER):
        ledger = FALLBACK_LEDGER
    if not os.path.exists(ledger):
        print(f"no ledger at {ledger} — nothing has been distilled yet", file=sys.stderr)
        return 2

    qkw = keywords(a.query)
    if not qkw:
        print("query reduced to no keywords — ask with more specific terms", file=sys.stderr)
        return 2

    claims = load(ledger)
    if a.since:
        cutoff = datetime.strptime(a.since, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        claims = [c for c in claims if (claim_date(c) or cutoff) >= cutoff]

    now = datetime.now(timezone.utc)
    ranked = sorted(((score(c, qkw, a.half_life, now), c) for c in claims),
                    key=lambda t: -t[0])
    hits = [(s, c) for s, c in ranked if s > 0][: a.top]

    if not hits:
        print("no claims matched")
        return 1

    if a.sources:
        seen = []
        for _, c in hits:
            src = c.get("note") or c.get("source") or ""
            base = src.split("#")[0]
            if base and base not in seen:
                seen.append(base)
        if a.format == "json":
            print(json.dumps(seen, indent=2))
        else:
            print("\n".join(seen))
        return 0

    if a.format == "json":
        print(json.dumps([dict(c, _score=round(s, 4)) for s, c in hits], indent=2))
        return 0

    for s, c in hits:
        date = c.get("published") or c.get("recorded") or "????-??-??"
        conf = c.get("confidence", "?")
        print(f"[{s:.2f}] ({conf}, {date}) {c.get('text', '')}")
        src = c.get("note") or c.get("source")
        if src:
            print(f"       ↳ {src}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
