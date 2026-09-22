#!/usr/bin/env python3
"""Smoke test for server.py over real stdio. Read-only against the live desk; STOP refusal in an
isolated home. Never mutates live queue/outbox state. Lifecycle behaviour is covered by tests/.

Usage:  /usr/bin/python3 smoke_test.py
"""
import json
import os
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "server.py")
PY = "/usr/bin/python3"


class Client:
    def __init__(self, env):
        self.proc = subprocess.Popen([PY, SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, env=env, text=True, bufsize=1)
        self.n = 0
        self.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                    "clientInfo": {"name": "smoke", "version": "0"}})
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
        self.proc.stdin.flush()

    def request(self, method, params=None):
        self.n += 1
        msg = {"jsonrpc": "2.0", "id": self.n, "method": method}
        if params is not None:
            msg["params"] = params
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("server closed stdout; stderr:\n" + self.proc.stderr.read())
        return json.loads(line)

    def call(self, name, args):
        res = self.request("tools/call", {"name": name, "arguments": args})["result"]
        text = res["content"][0]["text"]
        try:
            body = json.loads(text)
        except ValueError:
            body = text
        return res.get("isError", False), body

    def close(self):
        self.proc.stdin.close()
        self.proc.wait(timeout=10)


def show(label, out):
    print("\n=== %s" % label)
    print(json.dumps(out, indent=2, default=str)[:2500])


def main():
    c = Client(dict(os.environ))
    tools = c.request("tools/list")["result"]["tools"]
    show("tools", [(t["name"], "ro" if t["annotations"]["readOnlyHint"] else "rw") for t in tools])
    for name, args in (("desk_status", {}), ("queue_list", {"status": "running"}),
                       ("git_status", {"project": "soojos"}), ("run_status", {"limit": 5})):
        is_error, body = c.call(name, args)
        show("LIVE %s (isError=%s)" % (name, is_error), body)
    c.close()

    home = tempfile.mkdtemp(prefix="soojos-desk-smoke-home-")
    os.makedirs(os.path.join(home, "desk"))
    os.symlink("/nonexistent-target", os.path.join(home, "STOP"))
    c = Client(dict(os.environ, SOOJOS_HOME=home))
    refusals = {}
    for t in tools:
        is_error, body = c.call(t["name"], {"id": "x", "project": "soojos", "task": "x", "assignee": "claude",
                                            "budget_minutes": 1, "cwd": home, "report": {}, "status": "done"})
        refusals[t["name"]] = is_error and "STOP is present" in str(body)
    c.close()
    show("STOP refuses every tool", refusals)
    assert all(refusals.values()), "some tool did not refuse under STOP"
    print("\nOK")


if __name__ == "__main__":
    main()
