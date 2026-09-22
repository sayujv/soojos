#!/usr/bin/env python3
"""First live use of soojos-desk: queue two small harness tasks and run them in the background.

Run from your own terminal (the Claude Code session was not permitted to launch these itself):

    /usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/dispatch_first_tasks.py

Then, at any time:

    /usr/bin/python3 /Users/sayuj/soojos/tools/soojos-desk/dispatch_first_tasks.py --status

Task A (codex): write tools/soojos-desk/CHANGELOG.md from git log + README, run the unit tests, commit.
Task B (claude): independent review of server.py written to REVIEW-2026-09-18.md, commit.
Both run in isolated worktrees .worktrees/task-<id> on branch desk/<id>; nothing merges or pushes.

Prerequisites (0.3.0): the server refuses a launch unless zero incremental cash is established, so
~/.soojos/desk/subscription-billing.json (Claude) and ~/.soojos/desk/codex-billing.json (Codex) must each
hold {"usage_credits_disabled": true, "verified_at": <ISO, tz-aware, < 1 hour old>, "source": "...",
"org_id": "<uuid>"} with the Claude org_id matching `claude auth status --json`. desk_status shows freshness.
A refused launch blocks the task with the reason; nothing is spent.
"""
import json
import subprocess
import sys

SERVER = "/Users/sayuj/soojos/tools/soojos-desk/server.py"


class Desk:
    def __init__(self):
        self.p = subprocess.Popen(["/usr/bin/python3", SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  text=True, bufsize=1)
        self.n = 0
        self.req("initialize", {})
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
        self.p.stdin.flush()

    def req(self, method, params=None):
        self.n += 1
        m = {"jsonrpc": "2.0", "id": self.n, "method": method}
        if params is not None:
            m["params"] = params
        self.p.stdin.write(json.dumps(m) + "\n")
        self.p.stdin.flush()
        return json.loads(self.p.stdout.readline())

    def call(self, name, args):
        r = self.req("tools/call", {"name": name, "arguments": args})["result"]
        text = r["content"][0]["text"]
        if r["isError"]:
            raise SystemExit("TOOL ERROR: " + text)
        return json.loads(text)

    def close(self):
        self.p.stdin.close()
        self.p.wait(timeout=10)


COMMON = [
    "No push, no merge to main, no credential/policy/charter/cloud-instruction edits, no network, no paid usage.",
    "Stay inside tools/soojos-desk in this worktree; commit on the current task branch only.",
    "Finish substantive work by minute 5 and commit by minute 8 of the 10-minute budget.",
]

TASK_A = {
    "project": "soojos", "assignee": "codex", "budget_minutes": 10,
    "task": ("Create tools/soojos-desk/CHANGELOG.md summarising versions 0.1.0, 0.2.0 and 0.2.1 of the soojos-desk "
             "MCP server, using only `git log -- tools/soojos-desk` and tools/soojos-desk/README.md as sources (one "
             "dated section per version, bullet points, no invented features). Then run "
             "`/usr/bin/python3 -m unittest discover -s tools/soojos-desk/tests` and record the exact result line at "
             "the bottom of the changelog. Commit with message 'soojos-desk: add CHANGELOG'. Report the commit hash "
             "and the test result line."),
    "inputs": ["tools/soojos-desk/README.md", "git log -- tools/soojos-desk"], "constraints": COMMON,
}

TASK_B = {
    "project": "soojos", "assignee": "claude", "budget_minutes": 10,
    "task": ("Review tools/soojos-desk/server.py for correctness bugs, race conditions and failure modes (queue "
             "locking, atomic writes, timeout/process-group kill, background runner records, run_task worktree "
             "handling). Write findings to tools/soojos-desk/REVIEW-2026-09-18.md as a numbered list, each with "
             "file:line, severity (high/medium/low), the concrete failing scenario, and a suggested fix. Do not "
             "modify server.py. You may only use file reading/editing and local git commands. Commit with message "
             "'soojos-desk: independent review 2026-09-18'. Report the number of findings by severity and the "
             "commit hash."),
    "inputs": ["tools/soojos-desk/server.py", "tools/soojos-desk/tests/test_server.py"], "constraints": COMMON,
}


def main():
    d = Desk()
    st = d.call("desk_status", {})
    print("stop_present:", st["stop_present"], "| queue:", st["queue_counts"], "| running:", [r["id"] for r in st["running"]])
    if "--status" in sys.argv:
        for rec in d.call("run_status", {"limit": 10})["runs"]:
            print(json.dumps(rec))
        for t in d.call("queue_list", {})["tasks"][-4:]:
            print(t["id"], t["status"])
        d.close()
        return
    if st["stop_present"]:
        raise SystemExit("STOP present; not dispatching")
    a = d.call("queue_add", TASK_A)["added"]["id"]
    b = d.call("queue_add", TASK_B)["added"]["id"]
    print("queued:", a, "|", b)
    for tid in (a, b):
        out = d.call("run_task", {"id": tid, "background": True})
        print("dispatched", tid, "->", out["run_id"], "pid", out["pid"], "worktree", out["worktree"])
    print("poll with: --status ; results: outbox_read(<task id>) or the files under context/desk/outbox/")
    d.close()


if __name__ == "__main__":
    main()
