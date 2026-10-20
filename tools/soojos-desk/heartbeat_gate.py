#!/usr/bin/env python3
"""Deterministic quiet-heartbeat gate: answers "did anything change since the last beat?" with code,
so an unchanged beat costs zero model tokens (decision 0007).

    /usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/heartbeat_gate.py [--json] [--dry-run]

Exit 0 and print UNCHANGED when nothing needs a model's attention; exit 10 and print ATTENTION with
the reasons otherwise. The coordinator's automation should call this first and stop on UNCHANGED.

What it fingerprints (read-only): STOP presence; every queue row's status/deadline; outbox file set; INBOX.md;
run records' live states; billing evidence freshness; the canonical handoff's size; HEAD of the
soojos checkout. What always counts as attention regardless of the fingerprint: STOP present, a
queued task, a running task past its deadline, a lost/corrupt/quota run, the 07:00-07:59 Perth
daily-duty window, or no previous fingerprint. The last fingerprint lives in
~/.soojos/desk/heartbeat-gate.json (private); --dry-run compares without saving.
"""
import datetime as dt
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402

STATE_PATH = os.path.join(server.PRIVATE_DIR, "heartbeat-gate.json")
PERTH_OFFSET = dt.timezone(dt.timedelta(hours=8))
DAILY_DUTY_HOUR = 7


def snapshot(now=None):
    now = now or server.now_utc()
    tasks = server.read_queue()
    queue_view = sorted((t.get("id"), t.get("status"), t.get("deadline"), t.get("completed_at")) for t in tasks)
    outbox = sorted(os.listdir(server.OUTBOX_DIR)) if os.path.isdir(server.OUTBOX_DIR) else []
    runs = server.all_runs(mark=False)
    run_view = sorted((r.get("run_id"), r.get("state")) for r in runs)
    billing = {k: bool(server.load_json(p, {}).get("verified_at")) for k, p in server.BILLING_PATHS.items()}
    handoff = os.path.join(server.SOOJOS_ROOT, "context", "handoff.md")
    handoff_size = os.path.getsize(handoff) if os.path.exists(handoff) else 0
    inbox_path = os.path.join(server.DESK_DIR, "INBOX.md")
    inbox_new = 0
    inbox_size = 0
    if os.path.exists(inbox_path):
        inbox_size = os.path.getsize(inbox_path)
        inbox_new = sum(1 for sec in server.parse_inbox(open(inbox_path).read()) if sec["queued"] is None)
    _, head, _ = server.git(server.SOOJOS_ROOT, "rev-parse", "HEAD") if os.path.isdir(server.SOOJOS_ROOT) else (1, "", "")
    reasons = []
    if server.stop_present():
        reasons.append("STOP present")
    for t in tasks:
        if t.get("status") == "queued":
            reasons.append("queued task %s" % t.get("id"))
        elif t.get("status") == "running":
            deadline = server.parse_iso(t.get("deadline"))
            if deadline and now > deadline:
                reasons.append("running task %s past deadline" % t.get("id"))
    for r in runs:
        if r.get("state") in ("lost", "corrupt", "quota"):
            reasons.append("run %s is %s" % (r.get("run_id"), r.get("state")))
    if inbox_new:
        reasons.append("%d new inbox section(s) awaiting inbox_sync" % inbox_new)
    local = now.astimezone(PERTH_OFFSET)
    if local.hour == DAILY_DUTY_HOUR:
        reasons.append("daily duty window (07:00-07:59 Perth)")
    material = {"stop": server.stop_present(), "queue": queue_view, "outbox": outbox, "runs": run_view,
                "billing_present": billing, "handoff_size": handoff_size, "head": head, "inbox_size": inbox_size}
    digest = hashlib.sha256(json.dumps(material, sort_keys=True, default=str).encode()).hexdigest()
    return {"at": now.isoformat(), "fingerprint": digest, "always_attention": reasons,
            "summary": {"queue_rows": len(tasks), "outbox_files": len(outbox), "live_runs":
                        sum(1 for r in runs if r.get("state") in server.LIVE_STATES), "head": head[:7]}}


def diff_reasons(previous, current):
    """Human-readable reasons when the fingerprint moved."""
    if not previous:
        return ["no previous fingerprint"]
    reasons = []
    p, c = previous.get("summary", {}), current["summary"]
    for key, label in (("queue_rows", "queue rows"), ("outbox_files", "outbox files"), ("live_runs", "live runs")):
        if p.get(key) != c.get(key):
            reasons.append("%s %s -> %s" % (label, p.get(key), c.get(key)))
    if p.get("head") != c.get("head"):
        reasons.append("soojos HEAD %s -> %s" % (p.get("head"), c.get("head")))
    return reasons or ["state fingerprint changed"]


def evaluate(save=True, now=None):
    current = snapshot(now)
    previous = server.load_json(STATE_PATH, None)
    changed = not previous or previous.get("fingerprint") != current["fingerprint"]
    reasons = list(current["always_attention"])
    if changed:
        reasons += diff_reasons(previous, current)
    verdict = "ATTENTION" if reasons else "UNCHANGED"
    result = {"verdict": verdict, "reasons": reasons, "fingerprint": current["fingerprint"], "at": current["at"],
              "summary": current["summary"], "previous_at": (previous or {}).get("at")}
    if save:
        server.write_json_atomic(STATE_PATH, {"fingerprint": current["fingerprint"], "at": current["at"],
                                              "summary": current["summary"], "last_verdict": verdict}, mode=0o600)
    return result


def main():
    result = evaluate(save="--dry-run" not in sys.argv)
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(result["verdict"] + ("" if not result["reasons"] else ": " + "; ".join(result["reasons"])))
    return 0 if result["verdict"] == "UNCHANGED" else 10


if __name__ == "__main__":
    sys.exit(main())
