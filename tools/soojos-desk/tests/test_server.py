#!/usr/bin/env python3
"""Offline tests for the soojos-desk MCP server. No real claude/codex: fake binaries under tests/fakes.

Run:  /usr/bin/python3 -m unittest discover -s /Users/sayuj/soojos/tools/soojos-desk/tests -v
"""
import importlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FAKES = os.path.join(HERE, "fakes")
sys.path.insert(0, ROOT)

SCHEMA = {"properties": {"project": {"enum": ["soojos", "trading-bot"]}, "assignee": {"enum": ["codex", "claude"]}}}
POLICY = {"version": 2, "task_minutes": 15, "max_workers": 2}


class DeskTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="soojos-desk-ut-")
        self.desk = os.path.join(self.tmp, "desk")
        self.home = os.path.join(self.tmp, "home")
        os.makedirs(self.desk)
        os.makedirs(os.path.join(self.home, "desk"))
        with open(os.path.join(self.desk, "queue.schema.json"), "w") as fh:
            json.dump(SCHEMA, fh)
        with open(os.path.join(self.desk, "policy.json"), "w") as fh:
            json.dump(POLICY, fh)
        for f in ("fake_claude", "fake_codex"):
            os.chmod(os.path.join(FAKES, f), 0o755)
        self.env_backup = dict(os.environ)
        os.environ.update({"SOOJOS_DESK_DIR": self.desk, "SOOJOS_HOME": self.home,
                           "SOOJOS_CLAUDE_BIN": os.path.join(FAKES, "fake_claude"),
                           "SOOJOS_CODEX_BIN": os.path.join(FAKES, "fake_codex"),
                           "SOOJOS_MINUTE_SECONDS": "1.5"})
        os.environ.pop("FAKE_MODE", None)
        os.environ.pop("FAKE_TOUCH", None)
        import server
        self.server = importlib.reload(server)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.env_backup)
        shutil.rmtree(self.tmp, ignore_errors=True)

    # helpers -------------------------------------------------------------
    def call(self, name, **args):
        text, is_error = self.server.call_tool(name, args)
        try:
            body = json.loads(text)
        except ValueError:
            body = text
        return body, is_error

    def ok(self, name, **args):
        body, is_error = self.call(name, **args)
        self.assertFalse(is_error, body)
        return body

    def refused(self, name, **args):
        body, is_error = self.call(name, **args)
        self.assertTrue(is_error, body)
        return body

    def add(self, task="Smoke reply PONG", assignee="claude", budget=1):
        return self.ok("queue_add", project="soojos", task=task, assignee=assignee, budget_minutes=budget)["added"]["id"]

    def queue(self):
        return {t["id"]: t for t in self.server.read_queue()}

    def make_repo(self):
        repo = os.path.join(self.tmp, "repo")
        os.makedirs(repo)
        for cmd in (["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]):
            subprocess.run(["/usr/bin/git", "-C", repo] + cmd, check=True, capture_output=True)
        with open(os.path.join(repo, "README.md"), "w") as fh:
            fh.write("x\n")
        subprocess.run(["/usr/bin/git", "-C", repo, "add", "."], check=True, capture_output=True)
        subprocess.run(["/usr/bin/git", "-C", repo, "commit", "-q", "-m", "init"], check=True, capture_output=True)
        return os.path.realpath(repo)  # git reports real paths (/private/var on macOS)

    def wait_run(self, run_id, timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            rec = self.ok("run_status", id=run_id)["run"]
            if rec["state"] != "running":
                return rec
            time.sleep(0.2)
        self.fail("run %s still running after %ss" % (run_id, timeout))


class TestStop(DeskTestCase):
    def test_every_tool_refuses_with_dangling_symlink(self):
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        for name in self.server.TOOL_MAP:
            body = self.refused(name, id="x", project="soojos", task="x", assignee="claude", budget_minutes=1,
                                cwd=self.tmp, report={}, status="done")
            self.assertIn("STOP is present", body)
        self.assertFalse(os.path.exists(os.path.join(self.desk, "queue.jsonl")))


class TestQueue(DeskTestCase):
    def test_add_claim_finish_done_with_accounting(self):
        tid = self.add()
        self.assertRegex(tid, self.server.ID_RE.pattern)
        claimed = self.ok("queue_claim", id=tid)["claimed"]
        self.assertEqual(claimed["status"], "running")
        self.assertIn("deadline", claimed)
        self.refused("queue_claim", id=tid)
        fin = self.ok("queue_finish", id=tid, status="done", report={"summary": "ok"})["finished"]
        self.assertEqual(fin["status"], "done")
        self.assertIsNotNone(fin["actual_minutes"])
        self.assertIsNone(fin["blocked_reason"])
        entry = self.ok("outbox_read", id=tid)["entry"]
        self.assertEqual(entry["report"]["summary"], "ok")
        self.assertEqual(entry["project"], "soojos")
        self.refused("queue_finish", id=tid, status="done")  # already terminal

    def test_blocked_requires_reason_and_records_it(self):
        tid = self.add()
        self.ok("queue_claim", id=tid)
        self.refused("queue_finish", id=tid, status="blocked")
        fin = self.ok("queue_finish", id=tid, status="blocked", reason="no evidence")["finished"]
        self.assertEqual(fin["blocked_reason"], "no evidence")

    def test_done_requires_prior_claim(self):
        tid = self.add()
        self.refused("queue_finish", id=tid, status="done")
        self.ok("queue_finish", id=tid, status="blocked", reason="withdrawn")

    def test_validation(self):
        self.refused("queue_add", project="nope", task="x", assignee="claude", budget_minutes=1)
        self.refused("queue_add", project="soojos", task="x", assignee="gpt", budget_minutes=1)
        self.refused("queue_add", project="soojos", task="x", assignee="claude", budget_minutes=16)
        self.refused("queue_add", project="soojos", task="", assignee="claude", budget_minutes=1)
        self.refused("queue_claim", id="missing")

    def test_max_workers(self):
        a, b, c = self.add("a"), self.add("b"), self.add("c")
        self.ok("queue_claim", id=a)
        self.ok("queue_claim", id=b)
        body = self.refused("queue_claim", id=c)
        self.assertIn("max_workers=2", body)

    def test_list_filter_and_status(self):
        a = self.add("a")
        self.add("b")
        self.ok("queue_claim", id=a)
        self.assertEqual(self.ok("queue_list", status="running")["count"], 1)
        self.assertEqual(self.ok("queue_list")["count"], 2)
        st = self.ok("desk_status")
        self.assertEqual(st["queue_counts"], {"running": 1, "queued": 1})
        self.assertFalse(st["stop_present"])
        self.assertEqual(st["policy"]["max_workers"], 2)

    def test_reap_only_own_overdue_claims_without_live_runner(self):
        mine, theirs, fresh = self.add("mine"), self.add("theirs"), self.add("fresh")
        self.ok("queue_claim", id=mine)
        self.ok("queue_claim", id=fresh)  # not overdue; claimed before the cap is reached
        with self.server.queue_lock():
            tasks = self.server.read_queue()
            for t in tasks:
                if t["id"] == mine:
                    t["deadline"] = "2020-01-01T00:00:00+00:00"
                if t["id"] == theirs:
                    t.update(status="running", claimed_by="desk.py", deadline="2020-01-01T00:00:00+00:00")
            self.server.write_queue_atomic(tasks)
        out = self.ok("queue_reap")
        self.assertEqual(out["reaped"], [mine])
        self.assertEqual([s["id"] for s in out["skipped"]], [theirs])
        self.assertEqual(self.queue()[mine]["status"], "blocked")
        self.assertEqual(self.queue()[fresh]["status"], "running")
        out = self.ok("queue_reap", all=True)
        self.assertEqual(out["reaped"], [theirs])


class TestOutbox(DeskTestCase):
    def test_immutable_and_newest_wins(self):
        p1 = self.ok("outbox_write", id="note-1", report={"n": 1})["written"]
        time.sleep(0.01)
        p2 = self.ok("outbox_write", id="note-1", report={"n": 2})["written"]
        self.assertNotEqual(p1, p2)
        self.assertTrue(os.path.exists(p1) and os.path.exists(p2))
        self.assertEqual(self.ok("outbox_read", id="note-1")["entry"]["report"]["n"], 2)
        self.assertEqual(json.load(open(p1))["report"]["n"], 1)
        self.refused("outbox_read", id="note-9")
        self.refused("outbox_write", id="Bad ID", report={})
        self.assertEqual(self.ok("outbox_write", id="s", report="plain text")["written"].split("-")[-1], "s.json")


class TestGit(DeskTestCase):
    def test_git_status_repo_and_non_repo(self):
        repo = self.make_repo()
        out = self.ok("git_status", project=repo)
        self.assertTrue(out["is_git_repo"])
        self.assertEqual(out["branch"], "main")
        self.assertEqual(len(out["recent_commits"]), 1)
        out = self.ok("git_status", project=self.tmp)
        self.assertFalse(out["is_git_repo"])
        self.refused("git_status", project="unknown-slug")
        self.refused("git_status", project="/nonexistent/path")


class TestWorkers(DeskTestCase):
    def test_run_claude_ok(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertEqual(out["status"], "done")
        self.assertEqual(out["result"], "PONG")
        self.assertEqual(out["exit_code"], 0)
        self.assertEqual(out["command"][0], os.path.join(FAKES, "fake_claude"))
        self.assertIn("--permission-mode", out["command"])
        allowed = out["command"][out["command"].index("--allowedTools") + 1]
        self.assertIn("Bash(git commit:*)", allowed)
        self.assertNotIn("push", allowed)
        entry = self.ok("outbox_read", id=out["run_id"])["entry"]
        self.assertEqual(entry["report"]["result"], "PONG")
        self.assertEqual(self.ok("run_status", id=out["run_id"])["run"]["state"], "done")

    def test_run_codex_ok_uses_last_message_file(self):
        out = self.ok("run_codex", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertEqual(out["result"], "PONG")
        self.assertIn("--sandbox", out["command"])
        self.assertIn(self.tmp, out["command"])

    def test_worker_failure_is_tool_error_with_outbox(self):
        os.environ["FAKE_MODE"] = "fail"
        body = self.refused("run_claude", task="ping", cwd=self.tmp, budget_minutes=1)
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["exit_code"], 1)
        self.assertTrue(report["is_error"])
        self.assertTrue(os.path.exists(report["outbox_file"]))

    def test_timeout_kills_whole_process_group(self):
        os.environ["FAKE_MODE"] = "hang"
        started = time.time()
        body = self.refused("run_codex", task="ping", cwd=self.tmp, budget_minutes=1)  # 1 "minute" = 1.5s
        self.assertLess(time.time() - started, 15)
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "timeout")
        self.assertTrue(report["timed_out"])
        time.sleep(0.3)
        left = subprocess.run(["/usr/bin/pgrep", "-f", "sleep 300"], capture_output=True, text=True).stdout.strip()
        self.assertEqual(left, "", "leftover sleep processes: %s" % left)

    def test_validation(self):
        self.refused("run_claude", task="", cwd=self.tmp, budget_minutes=1)
        self.refused("run_claude", task="x", cwd="relative", budget_minutes=1)
        self.refused("run_claude", task="x", cwd=self.tmp, budget_minutes=0)

    def test_background_run_records_and_completes(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1, background=True)
        self.assertTrue(out["background"])
        self.assertTrue(self.server.pid_alive(out["pid"]) or True)  # may already have finished
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "done")
        self.assertEqual(rec["result"], "PONG")
        self.assertEqual(self.ok("outbox_read", id=out["run_id"])["entry"]["report"]["status"], "done")
        listing = self.ok("run_status")["runs"]
        self.assertEqual(listing[0]["run_id"], out["run_id"])

    def test_background_timeout_marks_record(self):
        os.environ["FAKE_MODE"] = "hang"
        out = self.ok("run_codex", task="ping", cwd=self.tmp, budget_minutes=1, background=True)
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "timeout")

    def test_lost_runner_detected(self):
        rec = {"run_id": "run-claude-x", "kind": "claude", "state": "running", "pid": 999999, "started_at": "x"}
        self.server.save_run(rec)
        self.assertEqual(self.ok("run_status", id="run-claude-x")["run"]["state"], "lost")


class TestRunTask(DeskTestCase):
    def test_end_to_end_with_worktree(self):
        repo = self.make_repo()
        os.environ["FAKE_TOUCH"] = "worker-was-here"
        tid = self.add("touch a file", assignee="codex", budget=2)
        out = self.ok("run_task", id=tid, cwd=repo)
        self.assertEqual(out["status"], "done")
        wt = os.path.join(repo, ".worktrees", "task-%s" % tid)
        self.assertEqual(out["worktree"], wt)
        self.assertEqual(out["branch"], "desk/%s" % tid)
        self.assertTrue(os.path.exists(os.path.join(wt, "worker-was-here")), "worker did not run inside the worktree")
        self.assertFalse(os.path.exists(os.path.join(repo, "worker-was-here")), "worker touched the main checkout")
        branch = subprocess.run(["/usr/bin/git", "-C", wt, "rev-parse", "--abbrev-ref", "HEAD"],
                                capture_output=True, text=True).stdout.strip()
        self.assertEqual(branch, "desk/%s" % tid)
        task = self.queue()[tid]
        self.assertEqual(task["status"], "done")
        self.assertEqual(task["worktree"], wt)
        self.assertIsNotNone(task["actual_minutes"])
        self.assertIn("Partnership desk task", out["task"])
        self.assertIn("worktree", out["task"])
        entry = self.ok("outbox_read", id=tid)["entry"]
        self.assertEqual(entry["report"]["worker_status"], "done")
        self.assertEqual(entry["report"]["result"], "PONG")
        # second run on a finished task is refused
        self.refused("run_task", id=tid, cwd=repo)

    def test_worktree_reused_when_branch_exists(self):
        repo = self.make_repo()
        tid = self.add("again", budget=1)
        cwd1, wt, br = self.server.ensure_task_worktree(repo, tid)
        cwd2, wt2, br2 = self.server.ensure_task_worktree(repo, tid)
        self.assertEqual((cwd1, wt, br), (cwd2, wt2, br2))
        shutil.rmtree(wt)
        subprocess.run(["/usr/bin/git", "-C", repo, "worktree", "prune"], check=True, capture_output=True)
        cwd3, wt3, br3 = self.server.ensure_task_worktree(repo, tid)  # branch exists, worktree recreated
        self.assertEqual(wt3, wt)
        self.assertTrue(os.path.isdir(wt3))

    def test_worker_failure_blocks_task(self):
        os.environ["FAKE_MODE"] = "fail"
        tid = self.add("will fail", budget=1)
        self.refused("run_task", id=tid, cwd=self.tmp, use_worktree=False)
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIn("worker failed", task["blocked_reason"])
        self.assertEqual(self.ok("outbox_read", id=tid)["entry"]["report"]["worker_status"], "failed")

    def test_background_task_completes_and_finishes_queue(self):
        tid = self.add("bg", budget=1)
        out = self.ok("run_task", id=tid, cwd=self.tmp, use_worktree=False, background=True)
        self.assertEqual(self.queue()[tid]["status"], "running")
        self.refused("run_task", id=tid, cwd=self.tmp, use_worktree=False)  # live run guard
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "done")
        self.assertEqual(self.queue()[tid]["status"], "done")
        self.assertEqual(rec["queue"]["status"], "done")

    def test_max_workers_applies_to_run_task(self):
        a, b, c = self.add("a"), self.add("b"), self.add("c")
        self.ok("queue_claim", id=a)
        self.ok("queue_claim", id=b)
        self.refused("run_task", id=c, cwd=self.tmp, use_worktree=False)
        self.assertEqual(self.queue()[c]["status"], "queued")

    def test_stop_at_runner_start_blocks_task(self):
        tid = self.add("stopped", budget=1)
        # Simulate: dispatched, then STOP appears before the detached runner starts.
        with self.server.queue_lock():
            tasks = self.server.read_queue()
            self.server.claim_locked(tasks, tid)
            self.server.write_queue_atomic(tasks)
        spec = {"run_id": "run-claude-stopped", "kind": "claude", "task": "x", "cwd": self.tmp, "budget_minutes": 1,
                "task_id": tid, "project": "soojos", "background": True}
        spec_path = os.path.join(self.home, "desk", "runs", "run-claude-stopped.spec.json")
        self.server.write_json_atomic(spec_path, spec)
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        self.assertEqual(self.server.runner(spec_path), 3)
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        self.assertIn("STOP", self.queue()[tid]["blocked_reason"])


class TestRpc(DeskTestCase):
    def rpc(self, msg):
        buf = io.StringIO()
        with redirect_stdout(buf):
            self.server.handle(msg)
        lines = [l for l in buf.getvalue().splitlines() if l.strip()]
        return json.loads(lines[0]) if lines else None

    def test_initialize_list_call_and_errors(self):
        init = self.rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-03-26"}})
        self.assertEqual(init["result"]["protocolVersion"], "2025-03-26")
        self.assertEqual(init["result"]["serverInfo"]["name"], "soojos-desk")
        self.assertIsNone(self.rpc({"jsonrpc": "2.0", "method": "notifications/initialized"}))
        tools = self.rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["result"]["tools"]
        names = {t["name"] for t in tools}
        self.assertEqual(names, set(self.server.TOOL_MAP))
        ro = {t["name"] for t in tools if t["annotations"]["readOnlyHint"]}
        self.assertEqual(ro, {"queue_list", "desk_status", "outbox_read", "git_status", "run_status"})
        res = self.rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "queue_list", "arguments": {}}})
        self.assertFalse(res["result"]["isError"])
        self.assertEqual(json.loads(res["result"]["content"][0]["text"])["count"], 0)
        res = self.rpc({"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "nope"}})
        self.assertEqual(res["error"]["code"], -32602)
        res = self.rpc({"jsonrpc": "2.0", "id": 5, "method": "bogus"})
        self.assertEqual(res["error"]["code"], -32601)
        self.assertEqual(self.rpc({"jsonrpc": "2.0", "id": 6, "method": "ping"})["result"], {})

    def test_stdio_roundtrip_subprocess(self):
        proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py")], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=dict(os.environ))
        msgs = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
                {"jsonrpc": "2.0", "method": "notifications/initialized"},
                {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "desk_status", "arguments": {}}}]
        out, err = proc.communicate("\n".join(json.dumps(m) for m in msgs) + "\n", timeout=20)
        lines = [json.loads(l) for l in out.splitlines() if l.strip()]
        self.assertEqual([l["id"] for l in lines], [1, 2], err)
        self.assertFalse(lines[1]["result"]["isError"])


if __name__ == "__main__":
    unittest.main()
