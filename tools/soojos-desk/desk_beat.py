#!/usr/bin/env python3
"""The 5-minute beat (decision 0007, extended 25 Sep 2026). Zero model tokens unless something changed.

    /usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/desk_beat.py [--dry-run] [--json]

Order: gate -> (on ATTENTION) desk_tick -> inbox_sync (Haiku routes only sections that left project: out)
-> when an auto task waits on evidence older than 45 minutes, observe_billing.py reads the account page
and refreshes it (or reports why it could not) -> dispatch queued tasks that carry auto_dispatch, oldest
first, while worker slots are free and the assignee's zero-cash evidence is fresh -> desk_board -> one
line in ~/.soojos/desk/beat.log.
Every action goes through the same server tools a person would call, so every refusal is the desk's.
STOP makes every tool refuse; the beat then only logs. Tasks without auto_dispatch (for example one
addressed to Astra) are left alone.
"""
import datetime as dt
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402
import heartbeat_gate  # noqa: E402

LOG_PATH = os.path.join(server.PRIVATE_DIR, "beat.log")


def call(name, **args):
    text, is_error = server.call_tool(name, args)
    try:
        body = json.loads(text)
    except ValueError:
        body = text
    return body, is_error


def evidence_fresh(kind):
    ev = server.load_json(server.BILLING_PATHS[kind], {})
    verified = server.parse_iso(ev.get("verified_at")) if ev else None
    return bool(verified and 0 <= (server.now_utc() - verified).total_seconds() <= 3600 and ev.get("usage_credits_disabled"))


OBSERVER = os.environ.get("SOOJOS_OBSERVER_CMD")  # tests point this at a fake; default is the real observer
OBSERVER_DEFAULT = ["/Users/sayuj/.local/share/uv/tools/scrapling/bin/python", os.path.join(HERE, "observe_billing.py")]
REFRESH_BEFORE_SECONDS = 45 * 60  # observe when evidence is older than this and an auto task is waiting


def evidence_age(kind):
    ev = server.load_json(server.BILLING_PATHS[kind], {})
    verified = server.parse_iso(ev.get("verified_at")) if ev else None
    return (server.now_utc() - verified).total_seconds() if verified else None


def observe(kind, dry_run):
    """Refresh the evidence by really reading the account page (observe_billing.py). Never writes on failure."""
    if dry_run:
        return {"kind": kind, "would_observe": True}
    cmd = (OBSERVER.split() if OBSERVER else OBSERVER_DEFAULT) + ["--only", kind, "--json"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        try:
            status = json.loads(r.stdout)
            obs = (status.get("results") or {}).get(kind, {})
            return {"kind": kind, "verified": bool(obs.get("verified")), "reason": obs.get("reason"), "exit": r.returncode}
        except ValueError:
            return {"kind": kind, "verified": False, "reason": "observer produced no JSON (exit %s): %s" % (r.returncode, (r.stderr or r.stdout)[-200:])}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"kind": kind, "verified": False, "reason": "observer failed: %s" % exc}


def dispatch(dry_run):
    """Launch auto tasks into free slots. Skips (and says why) rather than forcing a refusal.
    When an auto task waits on stale evidence, the observer is asked to look at the account page first."""
    out = []
    tasks = server.read_queue()
    waiting_kinds = {t.get("assignee") for t in tasks if t.get("status") == "queued" and t.get("auto_dispatch")}
    for kind in sorted(k for k in waiting_kinds if k in server.BILLING_PATHS):
        age = evidence_age(kind)
        if age is None or age > REFRESH_BEFORE_SECONDS:
            out.append({"observe": observe(kind, dry_run)})
    running = sum(1 for t in tasks if t.get("status") == "running")
    slots = max(0, int(server.policy().get("max_workers", 2)) - running)
    queued = sorted((t for t in tasks if t.get("status") == "queued"), key=lambda t: t.get("created_at") or "")
    for t in queued:
        if slots <= 0:
            out.append({"id": t["id"], "skipped": "no free worker slot"})
            continue
        if not t.get("auto_dispatch"):
            out.append({"id": t["id"], "skipped": "not marked for automatic dispatch (left for the coordinator)"})
            continue
        kind = t.get("assignee")
        if not evidence_fresh(kind):
            out.append({"id": t["id"], "skipped": "%s billing evidence not fresh; refresh with record_billing_evidence.py" % kind})
            continue
        if dry_run:
            out.append({"id": t["id"], "would_launch": True})
            slots -= 1
            continue
        body, is_error = call("run_task", id=t["id"], background=True)
        out.append({"id": t["id"], "refused": body[:300]} if is_error else {"id": t["id"], "launched": body.get("run_id")})
        if not is_error:
            slots -= 1
    return out


def beat(dry_run=False):
    started = server.now_utc()
    gate = heartbeat_gate.evaluate(save=not dry_run)
    record = {"at": started.isoformat(), "gate": gate["verdict"], "reasons": gate["reasons"], "dry_run": dry_run}
    if gate["verdict"] == "UNCHANGED":
        return record
    if server.stop_present():
        record["stop"] = True
        return record
    body, err = call("desk_tick")
    record["tick"] = body if not err else {"refused": body[:200]}
    body, err = call("inbox_sync", dry_run=dry_run)
    record["inbox"] = body if not err else {"refused": body[:200]}
    record["dispatch"] = dispatch(dry_run)
    body, err = call("desk_board", dry_run=dry_run)
    record["board"] = "ok" if not err else {"refused": body[:200]}
    record["elapsed_seconds"] = round((server.now_utc() - started).total_seconds(), 2)
    return record


def main():
    dry = "--dry-run" in sys.argv
    record = beat(dry_run=dry)
    if not dry:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a") as fh:
            fh.write(json.dumps(record, default=str) + "\n")
    if "--json" in sys.argv:
        print(json.dumps(record, indent=2, default=str))
    else:
        summary = record["gate"]
        if record.get("dispatch"):
            launched = [d["id"] for d in record["dispatch"] if d.get("launched")]
            summary += "; launched %d; %s" % (len(launched), "; ".join(d.get("skipped") or d.get("refused", "") for d in record["dispatch"] if not d.get("launched"))[:300])
        print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
