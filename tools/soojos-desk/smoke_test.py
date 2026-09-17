#!/usr/bin/env python3
"""Drive server.py over stdio exactly like an MCP client and exercise every tool once.

Usage:
  python3 smoke_test.py [--live-readonly] [--workers]

Default: isolated state (temp SOOJOS_DESK_DIR and SOOJOS_HOME) so the live desk
queue the heartbeat consumes is never touched.  --live-readonly additionally
runs queue_list and git_status against the canonical desk.  --workers runs the
real run_claude / run_codex tools with a trivial task (spends real quota).
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "server.py")
PY = "/usr/bin/python3"


class Client:
    def __init__(self, env):
        self.proc = subprocess.Popen([PY, SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, env=env, text=True, bufsize=1)
        self.n = 0

    def request(self, method, params=None):
        self.n += 1
        msg = {"jsonrpc": "2.0", "id": self.n, "method": method}
        if params is not None:
            msg["params"] = params
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            err = self.proc.stderr.read()
            raise RuntimeError("server closed stdout; stderr:\n" + err)
        return json.loads(line)

    def notify(self, method):
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method}) + "\n")
        self.proc.stdin.flush()

    def call(self, name, args):
        resp = self.request("tools/call", {"name": name, "arguments": args})
        if "error" in resp:
            return {"rpc_error": resp["error"]}
        res = resp["result"]
        text = res["content"][0]["text"]
        try:
            body = json.loads(text)
        except ValueError:
            body = text
        return {"isError": res.get("isError", False), "body": body}

    def close(self):
        self.proc.stdin.close()
        self.proc.wait(timeout=10)


def show(label, out):
    print("\n=== %s" % label)
    print(json.dumps(out, indent=2, default=str)[:3000])


def main():
    live_ro = "--live-readonly" in sys.argv
    workers = "--workers" in sys.argv
    tmp = tempfile.mkdtemp(prefix="soojos-desk-test-")
    desk = os.path.join(tmp, "desk")
    home = os.path.join(tmp, "home")
    os.makedirs(desk)
    os.makedirs(os.path.join(home, "desk"))
    # copy the real schema + policy so validation matches the live desk
    for name in ("queue.schema.json", "policy.json"):
        src = os.path.join("/Users/sayuj/soojos/context/desk", name)
        if os.path.exists(src):
            with open(src) as s, open(os.path.join(desk, name), "w") as d:
                d.write(s.read())
    env = dict(os.environ, SOOJOS_DESK_DIR=desk, SOOJOS_HOME=home)
    print("isolated state:", tmp)

    c = Client(env)
    show("initialize", c.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                                "clientInfo": {"name": "smoke", "version": "0"}}))
    c.notify("notifications/initialized")
    tools = c.request("tools/list")["result"]["tools"]
    show("tools/list names", [t["name"] for t in tools])

    show("queue_list (empty)", c.call("queue_list", {}))
    added = c.call("queue_add", {"project": "soojos", "task": "Smoke test: reply PONG", "assignee": "claude",
                                 "budget_minutes": 2})
    show("queue_add", added)
    task_id = added["body"]["added"]["id"]
    show("queue_add rejects bad budget", c.call("queue_add", {"project": "soojos", "task": "x", "assignee": "claude",
                                                             "budget_minutes": 99}))
    show("queue_claim", c.call("queue_claim", {"id": task_id}))
    show("queue_claim again (should refuse)", c.call("queue_claim", {"id": task_id}))
    show("queue_list running", c.call("queue_list", {"status": "running"}))
    show("outbox_write", c.call("outbox_write", {"id": task_id, "report": {"status": "done", "summary": "smoke ok"}}))
    show("outbox_read", c.call("outbox_read", {"id": task_id}))
    show("outbox_read missing", c.call("outbox_read", {"id": "does-not-exist"}))
    show("git_status soojos", c.call("git_status", {"project": "soojos"}))
    show("git_status non-repo path", c.call("git_status", {"project": tmp}))

    if workers:
        show("run_claude", c.call("run_claude", {"task": "Reply with exactly the single word PONG and nothing else. Do not use any tools.",
                                                 "cwd": tmp, "budget_minutes": 3}))
        show("run_codex", c.call("run_codex", {"task": "Reply with exactly the single word PONG and nothing else. Do not run any commands.",
                                               "cwd": tmp, "budget_minutes": 3}))
        show("run_claude timeout (1 min budget, sleep task)",
             c.call("run_claude", {"task": "Run the shell command `sleep 300` and wait for it to finish, then reply DONE.",
                                   "cwd": tmp, "budget_minutes": 1}))
    c.close()

    # STOP refusal: every tool must refuse while STOP exists (dangling symlink counts)
    os.symlink("/nonexistent-target", os.path.join(home, "STOP"))
    c = Client(env)
    c.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "smoke", "version": "0"}})
    c.notify("notifications/initialized")
    all_tools = [t["name"] for t in c.request("tools/list")["result"]["tools"]]
    refusals = {name: c.call(name, {"id": "x", "project": "soojos", "task": "x", "assignee": "claude",
                                    "budget_minutes": 1, "cwd": tmp, "report": {}, "status": "done"})
                for name in all_tools}
    show("STOP refusals", {k: (v["isError"], v["body"]) for k, v in refusals.items()})
    c.close()
    os.unlink(os.path.join(home, "STOP"))

    if live_ro:
        c = Client(dict(os.environ))
        c.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "smoke", "version": "0"}})
        c.notify("notifications/initialized")
        out = c.call("queue_list", {"status": "queued"})
        show("LIVE queue_list queued", out)
        out = c.call("queue_list", {})
        print("LIVE queue total:", out["body"]["count"] if not out["isError"] else out)
        show("LIVE git_status trading-bot", c.call("git_status", {"project": "trading-bot"}))
        c.close()
    print("\nisolated state left at", tmp)


if __name__ == "__main__":
    main()
