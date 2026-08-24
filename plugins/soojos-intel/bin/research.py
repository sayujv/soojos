#!/usr/bin/env python3
"""Targeted research fetch. A question comes first; the fetch is scoped to it.

Run on the Mac — Reddit and YouTube both block datacenter IPs.

  research.py reddit --query "claude code plugin marketplace" --subs ClaudeAI,ClaudeCode --limit 8
  research.py youtube --query "claude code skills workflow" --limit 5
  research.py youtube --video Ek1NBfnnTH0

Writes raw files and prints a manifest of what landed. Interprets nothing.
"""
import argparse, json, os, subprocess, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone

UA = "soojos-intel/0.2 (personal research; single user)"
BLOCK_MSG = ("Blocked at the network level. This machine's IP is refused — run from the Mac, "
             "not a hosted box or container.")


def get_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and i == retries - 1:
                sys.exit(f"HTTP {e.code}. {BLOCK_MSG}")
            time.sleep(4 * (i + 1))
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(3)
    return None


def reddit(a):
    os.makedirs(a.out, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q = urllib.parse.quote(a.query)
    scope = [s.strip() for s in (a.subs or "").split(",") if s.strip()]
    urls = ([f"https://www.reddit.com/r/{s}/search.json?q={q}&restrict_sr=1&sort={a.sort}&t={a.window}&limit={a.limit}"
             for s in scope]
            or [f"https://www.reddit.com/search.json?q={q}&sort={a.sort}&t={a.window}&limit={a.limit}"])

    results = []
    for url in urls:
        data = get_json(url)
        for child in (data or {}).get("data", {}).get("children", []):
            p = child.get("data", {})
            if p.get("score", 0) < a.min_score:
                continue
            item = {
                "title": p.get("title"),
                "subreddit": p.get("subreddit"),
                "url": "https://www.reddit.com" + p.get("permalink", ""),
                "score": p.get("score"),
                "num_comments": p.get("num_comments"),
                "published": datetime.fromtimestamp(p.get("created_utc", 0), timezone.utc).strftime("%Y-%m-%d"),
                "selftext": (p.get("selftext") or "")[:5000],
                "top_comments": [],
            }
            if a.comments:
                time.sleep(2)
                try:
                    c = get_json(item["url"] + ".json?limit=%d&sort=top" % a.comments)
                    if c and len(c) > 1:
                        for cc in c[1]["data"]["children"][: a.comments]:
                            d = cc.get("data", {})
                            if d.get("body"):
                                item["top_comments"].append({"score": d.get("score"), "body": d["body"][:2000]})
                except SystemExit:
                    raise
                except Exception as e:
                    item["top_comments"] = [{"error": str(e)[:120]}]
            results.append(item)
            time.sleep(2)

    slug = "".join(ch if ch.isalnum() else "-" for ch in a.query.lower())[:50].strip("-")
    path = os.path.join(a.out, f"{stamp}-{slug}.json")
    with open(path, "w") as f:
        json.dump({"query": a.query, "scope": scope or ["all"], "window": a.window,
                   "pulled": stamp, "results": results}, f, indent=2)
    print(f"wrote {path}")
    print(f"  {len(results)} threads above score {a.min_score}")
    for r in results[:10]:
        print(f"  [{r['score']:>5}] {r['published']}  r/{r['subreddit']}  {r['title'][:60]}")
    if not results:
        print("  nothing met the bar — widen --window or lower --min-score before assuming no signal")


def yt_search(query, limit):
    try:
        out = subprocess.run(["yt-dlp", "--flat-playlist", "-J", f"ytsearch{limit}:{query}"],
                             capture_output=True, text=True, timeout=240)
    except FileNotFoundError:
        sys.exit("yt-dlp not installed. Run: pip install yt-dlp")
    if out.returncode != 0:
        sys.exit(f"yt-dlp failed: {out.stderr[:300]}")
    d = json.loads(out.stdout)
    return [(e["id"], e.get("title", ""), e.get("upload_date", ""), e.get("channel", ""))
            for e in d.get("entries", [])]


def youtube(a):
    os.makedirs(a.out, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    targets = [(a.video, "", "", "")] if a.video else yt_search(a.query, a.limit)
    if not targets:
        print("no videos found"); return

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        sys.exit("missing dependency. Run: pip install youtube-transcript-api")

    got = 0
    for vid, title, upload, channel in targets:
        try:
            text = " ".join(s.text for s in YouTubeTranscriptApi().fetch(vid))
        except Exception as e:
            msg = str(e).lower()
            if "block" in msg or "ip" in msg and "request" in msg:
                sys.exit(BLOCK_MSG)
            print(f"  no captions: {vid} {title[:50]}")
            continue
        path = os.path.join(a.out, f"{upload or stamp}-{vid}.md")
        with open(path, "w") as f:
            f.write(f"---\nvideo_id: {vid}\ntitle: {title}\nchannel: {channel}\n"
                    f"url: https://www.youtube.com/watch?v={vid}\n"
                    f"upload_date: {upload}\npulled: {stamp}\n"
                    f"query: {a.query or '(direct)'}\nwords: {len(text.split())}\n---\n\n{text}\n")
        print(f"  wrote {path}  ({len(text.split())} words)  {title[:50]}")
        got += 1
    print(f"{got}/{len(targets)} transcripts retrieved")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("reddit"); r.set_defaults(fn=reddit)
    r.add_argument("--query", required=True); r.add_argument("--subs", default="")
    r.add_argument("--out", default="knowledge/wikis/reddit/raw")
    r.add_argument("--window", default="year", choices=["day", "week", "month", "year", "all"])
    r.add_argument("--sort", default="relevance", choices=["relevance", "top", "new"])
    r.add_argument("--limit", type=int, default=8); r.add_argument("--min-score", type=int, default=5)
    r.add_argument("--comments", type=int, default=5)

    y = sub.add_parser("youtube"); y.set_defaults(fn=youtube)
    y.add_argument("--query", default=""); y.add_argument("--video")
    y.add_argument("--out", default="knowledge/wikis/youtube/raw")
    y.add_argument("--limit", type=int, default=5)

    a = ap.parse_args()
    if a.cmd == "youtube" and not (a.query or a.video):
        sys.exit("need --query or --video")
    a.fn(a)

if __name__ == "__main__":
    main()
