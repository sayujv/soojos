#!/usr/bin/env python3
"""The claims ledger — the OS's machine-readable index of what it believes.

One JSON object per line in knowledge/claims.jsonl. Agents query this instead of
loading notes, so "is there anything about X" costs no context.

  claims.py add --text "..." --source URL --date 2026-08-01 --confidence claimed \
                --projects trading-bot,claude-platform --note notes/2026-08-01-x.md
  claims.py query --project trading-bot --since 2026-06-01 --min-confidence claimed
  claims.py clash --text "..."          # find contradictions before adding
  claims.py stale --days 60
  claims.py stats
"""
import argparse, hashlib, json, os, re, sys
from datetime import datetime, timedelta, timezone

LEDGER = os.environ.get("SOOJOS_CLAIMS", "knowledge/claims.jsonl")
RANK = {"anecdote": 0, "claimed": 1, "verified": 2}
STOP = set("the a an is are was were be been of to in on for and or with that this it as at by from".split())


def load():
    if not os.path.exists(LEDGER):
        return []
    out = []
    with open(LEDGER) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"warning: line {i} of {LEDGER} is not valid JSON, skipped", file=sys.stderr)
    return out


def stem(w):
    """Crude singularisation. 'skills'/'skill' must collide or clashes slip through."""
    for suf in ("ies", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def keywords(text):
    return {stem(w) for w in re.findall(r"[a-z0-9]+", text.lower())
            if w not in STOP and len(w) > 2}


def overlap(a, b):
    ka, kb = keywords(a), keywords(b)
    if not ka or not kb:
        return 0.0
    return len(ka & kb) / min(len(ka), len(kb))


def cmd_add(a):
    claims = load()
    cid = hashlib.sha1(f"{a.text}{a.source}".encode()).hexdigest()[:10]
    if any(c["id"] == cid for c in claims):
        print(f"duplicate, not added: {cid}")
        return 0
    rec = {
        "id": cid,
        "text": a.text,
        "confidence": a.confidence,
        "source": a.source,
        "source_type": a.source_type,
        "published": a.date,
        "recorded": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "projects": [p.strip() for p in (a.projects or "").split(",") if p.strip()],
        "note": a.note,
        "supersedes": a.supersedes,
    }
    conflicts = [c for c in claims if overlap(a.text, c["text"]) >= 0.5 and c["id"] != cid]
    os.makedirs(os.path.dirname(LEDGER) or ".", exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(f"added {cid}  [{a.confidence}]  {a.text[:70]}")
    for c in conflicts:
        print(f"  ! possible clash with {c['id']} ({c['published']}): {c['text'][:70]}")
    if conflicts:
        print("  -> both kept. Resolve in the report, never by deleting.")
    return 0


def cmd_query(a):
    claims = load()
    if a.project:
        claims = [c for c in claims if a.project in c.get("projects", [])]
    if a.since:
        claims = [c for c in claims if (c.get("published") or "0") >= a.since]
    if a.min_confidence:
        floor = RANK[a.min_confidence]
        claims = [c for c in claims if RANK.get(c.get("confidence"), 0) >= floor]
    if a.match:
        claims = [c for c in claims if overlap(a.match, c["text"]) >= 0.3]
    claims.sort(key=lambda c: c.get("published") or "", reverse=True)
    if a.json:
        print(json.dumps(claims, indent=2))
    elif not claims:
        print("no claims match")
    else:
        for c in claims:
            print(f"{c['published']}  [{c['confidence']:<8}]  {c['text']}")
            print(f"          {c['source']}")
    return 0


def cmd_clash(a):
    claims = load()
    hits = sorted(((overlap(a.text, c["text"]), c) for c in claims), key=lambda x: -x[0])
    hits = [(s, c) for s, c in hits if s >= 0.5]
    if not hits:
        print("no overlapping claims — safe to add")
        return 0
    print("overlapping claims already on record:")
    for s, c in hits[:5]:
        print(f"  {s:.2f}  {c['published']}  [{c['confidence']}]  {c['text'][:80]}")
        print(f"        {c['id']}  {c['source']}")
    return 0


def cmd_stale(a):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=a.days)).strftime("%Y-%m-%d")
    old = [c for c in load() if (c.get("published") or "0") < cutoff]
    if not old:
        print(f"nothing older than {a.days} days")
        return 0
    print(f"{len(old)} claims older than {a.days} days (suspect, not wrong):")
    for c in sorted(old, key=lambda c: c.get("published") or ""):
        print(f"  {c['published']}  [{c['confidence']:<8}]  {c['text'][:70]}")
    return 0


def cmd_stats(a):
    claims = load()
    if not claims:
        print("ledger empty")
        return 0
    by_conf, by_proj = {}, {}
    for c in claims:
        by_conf[c.get("confidence", "?")] = by_conf.get(c.get("confidence", "?"), 0) + 1
        for p in c.get("projects") or ["(none)"]:
            by_proj[p] = by_proj.get(p, 0) + 1
    dates = sorted(c.get("published", "") for c in claims if c.get("published"))
    print(f"claims: {len(claims)}   span: {dates[0]} .. {dates[-1]}" if dates else f"claims: {len(claims)}")
    print("by confidence: " + ", ".join(f"{k}={v}" for k, v in sorted(by_conf.items())))
    print("by project:    " + ", ".join(f"{k}={v}" for k, v in sorted(by_proj.items(), key=lambda x: -x[1])))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("add"); p.set_defaults(fn=cmd_add)
    p.add_argument("--text", required=True); p.add_argument("--source", required=True)
    p.add_argument("--date", required=True); p.add_argument("--note", default="")
    p.add_argument("--confidence", default="claimed", choices=["verified", "claimed", "anecdote"])
    p.add_argument("--source-type", default="web", choices=["youtube", "reddit", "docs", "web"])
    p.add_argument("--projects", default=""); p.add_argument("--supersedes", default="")

    p = sub.add_parser("query"); p.set_defaults(fn=cmd_query)
    p.add_argument("--project"); p.add_argument("--since"); p.add_argument("--match")
    p.add_argument("--min-confidence", choices=["anecdote", "claimed", "verified"])
    p.add_argument("--json", action="store_true")

    p = sub.add_parser("clash"); p.set_defaults(fn=cmd_clash); p.add_argument("--text", required=True)
    p = sub.add_parser("stale"); p.set_defaults(fn=cmd_stale); p.add_argument("--days", type=int, default=60)
    p = sub.add_parser("stats"); p.set_defaults(fn=cmd_stats)

    a = ap.parse_args()
    sys.exit(a.fn(a))

if __name__ == "__main__":
    main()
