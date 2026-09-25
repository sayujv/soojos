#!/usr/bin/env python3
"""Readiness check for soojos-desk. One command, one checklist, exit 1 if anything is FAIL.

    /usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/preflight.py [--tests] [--json]

Checks, in order: interpreter, server import and version, canonical desk import from policy code_root,
registration in Claude Code (.mcp.json + ~/.claude.json approval) and Codex (~/.codex/config.toml),
worker binaries and their login state, STOP, billing evidence freshness (the zero-cash gate), queue
state including the queued reciprocal-review task, the age of Astra's last heartbeat checkpoint, and
optionally the offline unit suite. Read-only: it changes nothing.
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    import server
    IMPORT_ERROR = None
except Exception as exc:  # reported as the first FAIL row rather than a traceback
    server, IMPORT_ERROR = None, exc

ROWS = []


def row(status, item, detail=""):
    ROWS.append((status, item, detail))


def run(argv, timeout=15):
    try:
        cwd = server.SOOJOS_ROOT if server and os.path.isdir(server.SOOJOS_ROOT) else None
        r = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)


def main():
    want_tests = "--tests" in sys.argv
    now = dt.datetime.now(dt.timezone.utc)

    row("PASS" if sys.version_info >= (3, 9) else "FAIL", "python", "%s at %s" % (sys.version.split()[0], sys.executable))
    if server is None:
        row("FAIL", "server import", str(IMPORT_ERROR))
        return finish()
    row("PASS", "server import", "version %s" % server.SERVER_VERSION)

    try:
        mods = server.desk_modules()
        row("PASS", "canonical desk", mods["scripts"])
    except server.ToolError as exc:
        row("FAIL", "canonical desk", str(exc))

    try:
        perms = server.permission_settings()
        row("PASS", "permission settings", "mode=%s allow=%d rules deny=%d rules sandbox=%s"
            % (perms["claude_mode"], len(perms["claude_allowed"]), len(perms["claude_denied"]), perms["codex_sandbox"]))
    except server.ToolError as exc:
        row("FAIL", "permission settings", str(exc))

    mcp = server.load_json(os.path.join(server.SOOJOS_ROOT, ".mcp.json"), {})
    ok = "soojos-desk" in (mcp.get("mcpServers") or {})
    row("PASS" if ok else "FAIL", "Claude Code .mcp.json", "registered" if ok else "missing soojos-desk entry")
    code, out = run([server.CLAUDE_BIN, "mcp", "list"], timeout=90)  # asks Claude Code itself, whatever its config shape
    line = next((l for l in (out or "").splitlines() if "soojos-desk" in l), "")
    if "Connected" in line:
        row("PASS", "Claude Code approval", "claude mcp list: connected")
    elif "Pending" in line:
        row("WARN", "Claude Code approval", "pending; launch `claude` in the soojos folder once and approve")
    else:
        row("WARN", "Claude Code approval", line.strip() or "soojos-desk not listed by `claude mcp list` (run from %s)" % server.SOOJOS_ROOT)
    try:
        toml = open(os.path.expanduser("~/.codex/config.toml")).read()
        ok = "[mcp_servers.soojos-desk]" in toml and "tools/soojos-desk/server.py" in toml
    except OSError:
        ok = False
    row("PASS" if ok else "FAIL", "Codex config.toml", "mcp_servers.soojos-desk present" if ok else "block missing")

    for kind, path in (("claude", server.CLAUDE_BIN), ("codex", server.CODEX_BIN)):
        row("PASS" if os.path.exists(path) else "FAIL", "%s binary" % kind, path)
    code, out = run([server.CLAUDE_BIN, "--restricted", "--safe-mode", "auth", "status", "--json"])
    try:
        auth = json.loads(out)
        good = auth.get("loggedIn") and auth.get("authMethod") == "claude.ai" and auth.get("subscriptionType") in ("pro", "max")
        row("PASS" if good else "FAIL", "claude login", "%s/%s/%s org %s" % (auth.get("authMethod"), auth.get("apiProvider"),
                                                                          auth.get("subscriptionType"), (auth.get("orgId") or "?")[:8]))
        org = auth.get("orgId")
    except ValueError:
        row("FAIL", "claude login", out[:120]); org = None
    code, out = run([server.CODEX_BIN, "login", "status"])
    row("PASS" if code == 0 and "ChatGPT" in out else "FAIL", "codex login", out.splitlines()[0][:100] if out else "no output")

    row("FAIL" if server.stop_present() else "PASS", "STOP", server.STOP_PATH + (" present: everything refuses" if server.stop_present() else " absent"))

    for kind, path in server.BILLING_PATHS.items():
        ev = server.load_json(path, {})
        verified = server.parse_iso(ev.get("verified_at")) if ev else None
        age = (now - verified).total_seconds() if verified else None
        if not ev:
            row("WARN", "%s billing evidence" % kind, "missing (%s); worker launches will be refused until recorded" % path)
        elif not ev.get("usage_credits_disabled"):
            row("FAIL", "%s billing evidence" % kind, "usage_credits_disabled is not true")
        elif age is None or age > 3600:
            row("WARN", "%s billing evidence" % kind, "stale (verified %s); refresh with record_billing_evidence.py" % ev.get("verified_at"))
        elif kind == "claude" and org and ev.get("org_id") != org:
            row("FAIL", "%s billing evidence" % kind, "org_id does not match the CLI organisation")
        else:
            row("PASS", "%s billing evidence" % kind, "fresh, %d min old" % (age // 60))

    tasks = server.read_queue()
    counts = {}
    for t in tasks:
        counts[t.get("status")] = counts.get(t.get("status"), 0) + 1
    queued = [t for t in tasks if t.get("status") == "queued"]
    running = [t for t in tasks if t.get("status") == "running"]
    row("PASS", "queue", "%s; queued: %s; running: %s" % (counts, [t["id"] for t in queued] or "none", [t["id"] for t in running] or "none"))
    review = [t for t in queued if "reciprocal-review" in t["id"]]
    row("INFO" if review else "PASS", "review task for Astra", review[0]["id"] if review else "none queued")
    for f in sorted(os.listdir(os.path.join(server.DESK_DIR, "heartbeat-checkpoints")), reverse=True)[:1] if os.path.isdir(os.path.join(server.DESK_DIR, "heartbeat-checkpoints")) else []:
        stamp = server.parse_iso(re.sub(r"(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})Z\.json", r"\1T\2:\3:00+00:00", f))
        age_h = (now - stamp).total_seconds() / 3600 if stamp else None
        row("PASS" if age_h is not None and age_h < 1 else "WARN", "Astra heartbeat", "last checkpoint %s (%.1f h ago)" % (f, age_h or -1))
    live = [r for r in server.all_runs(mark=False) if r.get("state") in server.LIVE_STATES]
    row("PASS" if not live else "INFO", "live runs", ", ".join(r["run_id"] for r in live) or "none")

    if want_tests:
        code, out = run([sys.executable, "-m", "unittest", "discover", "-s", os.path.join(HERE, "tests")], timeout=600)
        last = [l for l in out.splitlines() if l.strip()][-1:] or ["no output"]
        row("PASS" if code == 0 else "FAIL", "unit suite", last[0])
    else:
        row("INFO", "unit suite", "skipped; pass --tests to run (about 35 s)")
    return finish()


def finish():
    if "--json" in sys.argv:
        print(json.dumps([{"status": s, "item": i, "detail": d} for s, i, d in ROWS], indent=2))
    else:
        width = max(len(i) for _, i, _ in ROWS)
        for s, i, d in ROWS:
            print("%-4s  %-*s  %s" % (s, width, i, d))
    fails = [i for s, i, _ in ROWS if s == "FAIL"]
    print("\nREADY" if not fails else "\nNOT READY: " + ", ".join(fails))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
