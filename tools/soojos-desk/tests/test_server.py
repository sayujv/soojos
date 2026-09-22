#!/usr/bin/env python3
"""Offline tests for soojos-desk 0.3.1. Fake workers under tests/fakes; the canonical Desk from the
approved harness (policy code_root) runs against temporary state. No real claude/codex, no network.

Run:  /usr/bin/python3 -m unittest discover -s /Users/sayuj/soojos/tools/soojos-desk/tests -v
"""
import datetime as dt
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

LIVE_POLICY = "/Users/sayuj/soojos/context/desk/policy.json"
try:
    CODE_ROOT = json.load(open(LIVE_POLICY)).get("code_root")
except (OSError, ValueError):
    CODE_ROOT = None
HAVE_DESK = bool(CODE_ROOT) and os.path.isfile(os.path.join(CODE_ROOT, "scripts", "desk_core.py"))
ORG = "aedb04e3-c14d-4487-9917-3197efd00e95"


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


@unittest.skipUnless(HAVE_DESK, "canonical desk_core.py not available at policy code_root")
class DeskTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="soojos-desk-ut-")
        self.desk_dir = os.path.join(self.tmp, "desk")
        self.home = os.path.join(self.tmp, "home")
        self.private = os.path.join(self.home, "desk")
        os.makedirs(self.desk_dir)
        os.makedirs(self.private)
        for f in ("fake_claude", "fake_codex"):
            os.chmod(os.path.join(FAKES, f), 0o755)
        self.env_backup = dict(os.environ)
        os.environ.update({"SOOJOS_DESK_DIR": self.desk_dir, "SOOJOS_HOME": self.home,
                           "SOOJOS_CLAUDE_BIN": os.path.join(FAKES, "fake_claude"),
                           "SOOJOS_CODEX_BIN": os.path.join(FAKES, "fake_codex"),
                           "SOOJOS_MINUTE_SECONDS": "1.5", "HOME": self.home})
        for k in ("FAKE_MODE", "FAKE_TOUCH", "FAKE_AUTH", "FAKE_COMMIT", "FAKE_SWITCH",
                  "SOOJOS_CLAUDE_PERMISSION_MODE", "SOOJOS_CLAUDE_ALLOWED_TOOLS", "SOOJOS_CODEX_SANDBOX"):
            os.environ.pop(k, None)
        # canonical desk state in the temp dirs, migrated to the live v2 shape
        sys.path.insert(0, os.path.join(CODE_ROOT, "scripts"))
        core = importlib.import_module("desk_core")
        d = core.Desk(self.desk_dir, self.private, os.path.join(self.home, "STOP"))
        d.initialize(utcnow().isoformat(), CODE_ROOT)
        d.migrate_reporting_policy(utcnow().isoformat(), "test fixture: report-only tokens")  # live v2 shape
        self.write_billing(fresh=True)
        self.repo = self.make_repo()
        import server
        self.server = importlib.reload(server)
        self.server._MODULES.clear()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.env_backup)
        shutil.rmtree(self.tmp, ignore_errors=True)

    # helpers -------------------------------------------------------------
    def write_billing(self, fresh=True, present=True):
        when = (utcnow() - dt.timedelta(minutes=5 if fresh else 120)).isoformat()
        ev = {"usage_credits_disabled": True, "verified_at": when, "source": "test fixture", "org_id": ORG}
        for name in ("subscription-billing.json", "codex-billing.json"):
            path = os.path.join(self.private, name)
            if present:
                with open(path, "w") as fh:
                    json.dump(ev, fh)
            elif os.path.exists(path):
                os.unlink(path)

    def no_subscription(self):
        open(os.path.join(self.home, "FAKE_AUTH_NONE"), "w").close()

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

    def add(self, task="Smoke reply PONG", assignee="claude", budget=1, project="soojos"):
        return self.ok("queue_add", project=project, task=task, assignee=assignee, budget_minutes=budget)["added"]["id"]

    def queue(self):
        return {t["id"]: t for t in self.server.read_queue()}

    def set_task(self, tid, **fields):
        d = self.server.desk()
        with d.locked():
            rows = self.server.read_queue()
            for t in rows:
                if t["id"] == tid:
                    t.update(fields)
            d._save_queue(rows)

    def make_repo(self):
        repo = os.path.join(self.tmp, "repo")
        os.makedirs(repo)
        for cmd in (["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]):
            subprocess.run(["/usr/bin/git", "-C", repo] + cmd, check=True, capture_output=True)
        with open(os.path.join(repo, "README.md"), "w") as fh:
            fh.write("x\n")
        subprocess.run(["/usr/bin/git", "-C", repo, "add", "."], check=True, capture_output=True)
        subprocess.run(["/usr/bin/git", "-C", repo, "commit", "-q", "-m", "init"], check=True, capture_output=True)
        return os.path.realpath(repo)

    def wait_run(self, run_id, timeout=20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            rec = self.ok("run_status", id=run_id)["run"]
            if rec["state"] not in ("running", "reserved"):
                return rec
            time.sleep(0.2)
        self.fail("run %s still running after %ss" % (run_id, timeout))

    def assertNoWorkerRun(self, msg="worker must not have run"):
        for root, _dirs, files in os.walk(self.tmp):
            self.assertNotIn("ran", files, msg + " (found in %s)" % root)

    def worktree_of(self, tid):
        return os.path.join(self.repo, ".worktrees", "task-%s" % tid)

    def done_report(self):
        return {"verification": "checked by test", "evidence": ["fixture"], "actual_cost_aud": 0,
                "actual_tokens": 12, "summary": "ok"}


class TestStop(DeskTestCase):
    def test_every_tool_refuses_with_dangling_symlink(self):
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        for name in self.server.TOOL_MAP:
            body = self.refused(name, id="x", project="soojos", task="x", assignee="claude", budget_minutes=1,
                                cwd=self.tmp, report={}, status="done")
            self.assertIn("STOP is present", body)


class TestQueue(DeskTestCase):
    def test_add_uses_canonical_validation(self):
        body = self.refused("queue_add", project="not-a-project", task="x", assignee="claude", budget_minutes=1)
        self.assertIn("outside approved scope", body)
        self.refused("queue_add", project="soojos", task="x", assignee="gpt", budget_minutes=1)
        self.refused("queue_add", project="soojos", task="x", assignee="claude", budget_minutes=16)
        tid = self.add()
        row = self.queue()[tid]
        self.assertEqual(row["branch"], "desk/" + tid)
        self.assertEqual(row["status"], "queued")
        self.assertIn("request_fingerprint", row)
        self.assertIsNone(row["budget_tokens"])

    def test_claim_finish_done_through_desk(self):
        tid = self.add()
        claimed = self.ok("queue_claim", id=tid)["claimed"]
        self.assertEqual(claimed["status"], "running")
        self.assertIn("deadline", claimed)
        self.refused("queue_claim", id=tid)
        body = self.refused("queue_finish", id=tid, status="done", report={"summary": "no evidence"})
        self.assertIn("verification and evidence", body)
        body = self.refused("queue_finish", id=tid, status="done",
                            report={"verification": "v", "evidence": ["e"]})  # cash unknown
        self.assertIn("cash", body)
        fin = self.ok("queue_finish", id=tid, status="done", report=self.done_report())["finished"]
        self.assertEqual(fin["status"], "done")
        self.assertEqual(fin["actual_cost_aud"], 0)
        self.assertEqual(fin["actual_tokens"], 12)
        self.assertLessEqual(fin["actual_minutes"], 1)
        packet = self.ok("outbox_read", id=tid)["entry"]
        self.assertEqual(packet["task_id"], tid)          # canonical packet shape
        self.assertEqual(packet["project"], "soojos")
        self.assertEqual(packet["report"]["status"], "done")
        self.assertEqual(os.path.realpath(fin["result_path"]), os.path.realpath(self.ok("outbox_read", id=tid)["path"]))
        self.refused("queue_finish", id=tid, status="done", report=self.done_report())

    def test_done_refused_past_deadline(self):
        tid = self.add()
        self.ok("queue_claim", id=tid)
        self.set_task(tid, deadline=(utcnow() - dt.timedelta(minutes=1)).isoformat())
        body = self.refused("queue_finish", id=tid, status="done", report=self.done_report())
        self.assertIn("deadline", body)

    def test_blocked_requires_reason_and_uses_desk_fields(self):
        tid = self.add()
        self.ok("queue_claim", id=tid)
        self.refused("queue_finish", id=tid, status="blocked")
        fin = self.ok("queue_finish", id=tid, status="blocked", reason="no evidence")["finished"]
        self.assertEqual(fin["blocked_reason"], "no evidence")
        self.assertEqual(fin["attempts"], ["no evidence"])
        self.assertTrue(fin["next_attempt"])
        self.assertEqual(self.ok("outbox_read", id=tid)["entry"]["report"]["status"], "blocked")

    def test_max_workers(self):
        a, b, c = self.add("a"), self.add("b"), self.add("c")
        self.ok("queue_claim", id=a)
        self.ok("queue_claim", id=b)
        self.assertIn("concurrency", self.refused("queue_claim", id=c))

    def test_tick_blocks_overdue_and_recovers_persisted_completion(self):
        overdue, pending = self.add("overdue"), self.add("pending")
        self.ok("queue_claim", id=overdue)
        self.ok("queue_claim", id=pending)
        self.set_task(overdue, deadline=(utcnow() - dt.timedelta(minutes=1)).isoformat())
        # a canonical done packet written by an interrupted worker, queue never updated
        packet = {"task_id": pending, "project": "soojos", "at": utcnow().isoformat(),
                  "report": dict(self.done_report(), status="done", actual_minutes=0.1)}
        with open(os.path.join(self.desk_dir, "outbox", "%s-%s.json" % (utcnow().strftime("%Y-%m-%d"), pending)), "w") as fh:
            json.dump(packet, fh)
        out = self.ok("desk_tick")
        q = self.queue()
        self.assertEqual(q[overdue]["status"], "blocked")
        self.assertIn("deadline elapsed", q[overdue]["blocked_reason"])
        self.assertEqual(q[pending]["status"], "done")
        self.assertEqual(out["queue_counts"], {"blocked": 1, "done": 1})

    def test_outbox_write_refuses_task_ids(self):
        tid = self.add()
        self.assertIn("queue task id", self.refused("outbox_write", id=tid, report={"x": 1}))
        p = self.ok("outbox_write", id="note-1", report={"n": 1})["written"]
        self.assertTrue(os.path.exists(p))
        self.assertIsNone(self.ok("outbox_read", id="note-1")["entry"]["task_id"])


class TestRunRecords(DeskTestCase):
    def test_reservation_ids_unique_under_frozen_clock(self):
        frozen = utcnow()
        self.server.now_utc = lambda: frozen
        ids = {self.server.reserve_run("claude")["run_id"] for _ in range(5)}
        self.assertEqual(len(ids), 5)
        for rid in ids:
            self.assertTrue(os.path.exists(self.server.run_record_path(rid)))

    def test_dead_reservation_and_dead_runner_are_lost(self):
        self.server.save_run({"run_id": "run-claude-a", "kind": "claude", "state": "reserved", "pid": 999999,
                              "reserved_at": utcnow().isoformat()})
        self.server.save_run({"run_id": "run-claude-b", "kind": "claude", "state": "running", "pid": 999999,
                              "started_at": utcnow().isoformat()})
        self.server.save_run({"run_id": "run-claude-c", "kind": "claude", "state": "reserved", "pid": os.getpid(),
                              "reserved_at": (utcnow() - dt.timedelta(hours=1)).isoformat()})
        states = {r["run_id"]: r["state"] for r in self.server.all_runs()}
        self.assertEqual(states, {"run-claude-a": "lost", "run-claude-b": "lost", "run-claude-c": "lost"})
        self.assertIn("run-claude-a", self.ok("desk_tick")["lost_runs"])


class TestWorkers(DeskTestCase):
    def test_run_claude_ok(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertEqual(out["status"], "done")
        self.assertEqual(out["result"], "PONG")
        self.assertEqual(out["actual_tokens"], 115)
        allowed = out["command"][out["command"].index("--allowedTools") + 1]
        self.assertIn("Bash(git commit:*)", allowed)
        self.assertNotIn("push", allowed)
        note = self.ok("outbox_read", id=out["run_id"])["entry"]
        self.assertIsNone(note["task_id"])
        self.assertEqual(note["report"]["result"], "PONG")
        self.assertEqual(self.ok("run_status", id=out["run_id"])["run"]["state"], "done")

    def test_run_codex_ok(self):
        out = self.ok("run_codex", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertEqual(out["result"], "PONG")
        self.assertEqual(out["actual_tokens"], 1234)
        self.assertIn("--sandbox", out["command"])

    def test_worker_failure_is_tool_error_with_note(self):
        os.environ["FAKE_MODE"] = "fail"
        body = self.refused("run_claude", task="ping", cwd=self.tmp, budget_minutes=1)
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "failed")
        self.assertTrue(os.path.exists(report["outbox_file"]))

    def test_timeout_kills_whole_process_group(self):
        os.environ["FAKE_MODE"] = "hang"
        started = time.time()
        body = self.refused("run_codex", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertLess(time.time() - started, 15)
        self.assertEqual(json.loads(body.split("refused: ", 1)[1])["status"], "timeout")
        left = "unchecked"
        for _ in range(30):  # the group was signalled; give the kernel a moment to reap the grandchildren
            left = subprocess.run(["/usr/bin/pgrep", "-f", "sleep 300"], capture_output=True, text=True).stdout.strip()
            if not left:
                break
            time.sleep(0.1)
        self.assertEqual(left, "", "leftover sleep processes: %s" % left)

    def test_unknown_cash_refuses_launch_before_any_run(self):
        self.no_subscription()
        self.assertIn("zero incremental cash", self.refused("run_claude", task="ping", cwd=self.tmp, budget_minutes=1))
        self.assertIn("zero incremental cash", self.refused("run_codex", task="ping", cwd=self.tmp, budget_minutes=1))
        os.unlink(os.path.join(self.home, "FAKE_AUTH_NONE"))
        self.write_billing(fresh=False)
        self.assertIn("stale", self.refused("run_claude", task="ping", cwd=self.tmp, budget_minutes=1))
        self.write_billing(present=False)
        self.assertIn("usage-credit", self.refused("run_codex", task="ping", cwd=self.tmp, budget_minutes=1).lower())
        self.assertEqual(self.ok("run_status")["runs"], [])

    def test_background_run_completes(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1, background=True)
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "done")
        self.assertEqual(rec["result"], "PONG")

    def test_mutating_tools_refuse_without_canonical_desk(self):
        pol = json.load(open(os.path.join(self.desk_dir, "policy.json")))
        pol["code_root"] = os.path.join(self.tmp, "missing")
        json.dump(pol, open(os.path.join(self.desk_dir, "policy.json"), "w"))
        self.server._MODULES.clear()
        self.assertIn("canonical", self.refused("queue_add", project="soojos", task="x", assignee="claude", budget_minutes=1))
        self.assertFalse(self.ok("desk_status")["canonical_desk"]["available"])
        self.assertEqual(self.ok("queue_list")["count"], 0)


class TestRunTask(DeskTestCase):
    def test_end_to_end_done_through_desk(self):
        repo = self.repo
        os.environ["FAKE_COMMIT"] = "1"
        tid = self.add("commit a file", assignee="claude", budget=2)
        out = self.ok("run_task", id=tid, cwd=repo)
        self.assertEqual(out["status"], "done")
        wt = os.path.join(repo, ".worktrees", "task-%s" % tid)
        self.assertEqual(out["worktree"], wt)
        self.assertTrue(os.path.exists(os.path.join(wt, "worker-output.txt")))
        self.assertFalse(os.path.exists(os.path.join(repo, "worker-output.txt")))
        task = self.queue()[tid]
        self.assertEqual(task["status"], "done")
        self.assertEqual(task["actual_cost_aud"], 0)
        self.assertEqual(task["actual_tokens"], 115)
        self.assertLessEqual(task["actual_minutes"], 2)
        packet = json.load(open(task["result_path"]))
        self.assertEqual(packet["task_id"], tid)
        rep = packet["report"]
        self.assertIn("HEAD", rep["verification"])
        self.assertNotEqual(out["git_before"]["head"], out["git_after"]["head"])
        self.assertIn(out["git_after"]["head"], rep["verification"])
        self.assertEqual(rep["billing_mode"], "existing_subscription")
        self.assertTrue(any(wt in e for e in rep["evidence"]))
        self.assertEqual(self.ok("run_status", id=out["run_id"])["run"]["queue"]["status"], "done")
        self.refused("run_task", id=tid, cwd=repo)

    def test_worker_failure_blocks_with_desk_accounting(self):
        os.environ["FAKE_MODE"] = "fail"
        tid = self.add("will fail", budget=1)
        self.refused("run_task", id=tid, cwd=self.repo)
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIn("worker failed", task["blocked_reason"])
        self.assertTrue(task["attempts"][0].startswith("claude worker run run-claude-"))
        self.assertEqual(task["actual_cost_aud"], 0)
        self.assertIsNotNone(task["actual_minutes"])
        self.assertEqual(self.ok("outbox_read", id=tid)["entry"]["report"]["status"], "blocked")

    def test_duplicate_launch_is_refused_by_live_reservation(self):
        tid = self.add("dup", budget=1)
        self.ok("queue_claim", id=tid)
        self.server.save_run({"run_id": "run-claude-live", "kind": "claude", "task_id": tid, "state": "reserved",
                              "pid": os.getpid(), "reserved_at": utcnow().isoformat()})
        self.assertIn("already has a live run", self.refused("run_task", id=tid, cwd=self.repo))
        self.assertEqual(self.queue()[tid]["status"], "running")
        # a stale reservation from a crashed caller does not block recovery
        self.server.save_run({"run_id": "run-claude-live", "kind": "claude", "task_id": tid, "state": "reserved",
                              "pid": 999999, "reserved_at": utcnow().isoformat()})
        out = self.ok("run_task", id=tid, cwd=self.repo)
        self.assertEqual(out["status"], "done")

    def test_expired_deadline_refuses_launch_and_blocks(self):
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("late", budget=1)
        self.ok("queue_claim", id=tid)
        self.set_task(tid, deadline=(utcnow() - dt.timedelta(seconds=1)).isoformat())
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("deadline", body)
        self.assertNoWorkerRun("worker must not run past the deadline")
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIn("launch refused", task["blocked_reason"])
        self.assertEqual(self.ok("run_status")["runs"][0]["state"], "failed")

    def test_timeout_is_bounded_by_remaining_deadline_not_budget(self):
        os.environ["FAKE_MODE"] = "hang"
        tid = self.add("near", budget=15)  # 15 fake minutes = 22.5s budget; closure reserve 4.5s; deadline 7s away
        self.ok("queue_claim", id=tid)
        self.set_task(tid, deadline=(utcnow() + dt.timedelta(seconds=7)).isoformat())
        started = time.time()
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertLess(time.time() - started, 15)
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "timeout")
        self.assertLess(report["timeout_seconds"], 3)
        self.assertEqual(self.queue()[tid]["status"], "blocked")

    def test_unknown_cash_blocks_task_without_running(self):
        self.no_subscription()
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("cash", budget=1)
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("zero incremental cash", body)
        self.assertNoWorkerRun()
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIsNone(task.get("actual_cost_aud"))  # unknown stays unknown

    def test_background_task_completes_through_desk(self):
        tid = self.add("bg", budget=1)
        out = self.ok("run_task", id=tid, cwd=self.repo, background=True)
        self.assertEqual(self.queue()[tid]["status"], "running")
        self.assertIn("already has a live run", self.refused("run_task", id=tid, cwd=self.repo))
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "done")
        self.assertEqual(self.queue()[tid]["status"], "done")
        self.assertEqual(rec["queue"]["status"], "done")

    def test_max_workers_applies(self):
        a, b, c = self.add("a"), self.add("b"), self.add("c")
        self.ok("queue_claim", id=a)
        self.ok("queue_claim", id=b)
        self.refused("run_task", id=c, cwd=self.repo)
        self.assertEqual(self.queue()[c]["status"], "queued")

    def test_stop_at_runner_start_blocks_task(self):
        tid = self.add("stopped", budget=1)
        self.ok("queue_claim", id=tid)
        record = self.server.reserve_run("claude", tid, "soojos")
        spec = {"run_id": record["run_id"], "kind": "claude", "task": "x", "cwd": self.tmp, "budget_minutes": 1,
                "task_id": tid, "project": "soojos", "background": True, "zero_cash": True}
        spec_path = os.path.join(self.private, "runs", record["run_id"] + ".spec.json")
        self.server.write_json_atomic(spec_path, spec)
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        self.assertEqual(self.server.runner(spec_path), 3)
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        self.assertIn("STOP", self.queue()[tid]["blocked_reason"])


class TestPermissions(DeskTestCase):
    def test_defaults_compose_allow_and_deny_lists(self):
        perms = self.server.permission_settings()
        self.assertEqual(perms["claude_mode"], "acceptEdits")
        self.assertNotIn("Bash(git branch:*)", perms["claude_allowed"])
        self.assertIn("Bash(git push:*)", perms["claude_denied"])
        self.assertIn("Bash(git branch:*)", perms["claude_denied"])
        argv = self.server.worker_command("claude", "x", self.tmp, None)
        self.assertEqual(argv[argv.index("--disallowedTools") + 1], " ".join(self.server.CLAUDE_DENIED_RULES))
        self.assertEqual(argv[argv.index("--allowedTools") + 1], " ".join(self.server.APPROVED_CLAUDE_ALLOWED_RULES))
        self.assertTrue(self.ok("desk_status")["permissions"]["valid"])

    def test_widened_blank_and_unknown_overrides_are_refused(self):
        cases = {"SOOJOS_CLAUDE_PERMISSION_MODE": ["bypassPermissions", "auto", "manual", "nonsense", ""],
                 "SOOJOS_CLAUDE_ALLOWED_TOOLS": ["Bash(*)", "   ", "Bash(git status:*) Bash(rm:*)", "Bash(git branch:*)",
                                                 "Edit", "Bash(git commit:*)  Bash(git push:*)"],
                 "SOOJOS_CODEX_SANDBOX": ["danger-full-access", "", "full"]}
        for var, values in cases.items():
            for value in values:
                os.environ[var] = value
                with self.assertRaises(self.server.ToolError, msg="%s=%r" % (var, value)):
                    self.server.permission_settings()
                body = self.refused("run_claude", task="x", cwd=self.tmp, budget_minutes=1)
                self.assertIn("permission settings refused", body)
                self.assertFalse(self.ok("desk_status")["permissions"]["valid"])
                del os.environ[var]
        self.assertEqual(self.ok("run_status")["runs"], [], "no reservation may exist after refused launches")

    def test_narrowing_overrides_are_accepted(self):
        os.environ["SOOJOS_CLAUDE_ALLOWED_TOOLS"] = "Bash(git status:*) Bash(git diff:*)"
        self.assertEqual(self.server.permission_settings()["claude_allowed"], ["Bash(git status:*)", "Bash(git diff:*)"])
        os.environ["SOOJOS_CLAUDE_ALLOWED_TOOLS"] = "none"
        argv = self.server.worker_command("claude", "x", self.tmp, None)
        self.assertNotIn("--allowedTools", argv)
        self.assertIn("--disallowedTools", argv)
        os.environ["SOOJOS_CLAUDE_PERMISSION_MODE"] = "dontAsk"
        os.environ["SOOJOS_CODEX_SANDBOX"] = "read-only"
        perms = self.server.permission_settings()
        self.assertEqual((perms["claude_mode"], perms["codex_sandbox"]), ("dontAsk", "read-only"))

    def test_misconfiguration_is_refused_before_claim_or_reservation(self):
        os.environ["SOOJOS_CLAUDE_PERMISSION_MODE"] = "bypassPermissions"
        tid = self.add("never", budget=1)
        self.assertIn("permission settings refused", self.refused("run_task", id=tid, cwd=self.repo))
        self.assertEqual(self.queue()[tid]["status"], "queued", "task admission must not be consumed")
        self.assertEqual(self.ok("run_status")["runs"], [])
        self.assertFalse(os.path.isdir(self.worktree_of(tid)))


class TestContainment(DeskTestCase):
    def test_non_git_cwd_refused_before_claim(self):
        tid = self.add("nogit", budget=1)
        body = self.refused("run_task", id=tid, cwd=self.tmp)
        self.assertIn("not a git repository", body)
        self.assertEqual(self.queue()[tid]["status"], "queued")

    def test_worktree_opt_out_is_refused(self):
        tid = self.add("optout", budget=1)
        self.assertIn("use_worktree=false is not supported", self.refused("run_task", id=tid, cwd=self.repo, use_worktree=False))
        self.assertEqual(self.queue()[tid]["status"], "queued")

    def test_detached_head_in_worktree_refuses_launch(self):
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("detached", budget=1)
        self.server.ensure_task_worktree(self.repo, tid)
        subprocess.run(["/usr/bin/git", "-C", self.worktree_of(tid), "checkout", "-q", "--detach"], check=True, capture_output=True)
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("detached HEAD", body)
        self.assertNoWorkerRun()
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        self.assertIn("launch refused", self.queue()[tid]["blocked_reason"])

    def test_wrong_branch_in_worktree_refuses_launch(self):
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("wrongbranch", budget=1)
        self.server.ensure_task_worktree(self.repo, tid)
        subprocess.run(["/usr/bin/git", "-C", self.worktree_of(tid), "checkout", "-q", "-b", "other"], check=True, capture_output=True)
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("expected desk/%s" % tid, body)
        self.assertNoWorkerRun()
        self.assertEqual(self.queue()[tid]["status"], "blocked")

    def test_verify_task_worktree_rejects_paths_outside_and_wrong_names(self):
        tid = self.add("paths", budget=1)
        cwd, wt, branch = self.server.ensure_task_worktree(self.repo, tid)
        snap = self.server.verify_task_worktree(cwd, wt, tid)
        self.assertEqual(snap["branch"], "desk/%s" % tid)
        with self.assertRaises(self.server.ToolError):
            self.server.verify_task_worktree(self.repo, wt, tid)          # cwd outside the worktree
        with self.assertRaises(self.server.ToolError):
            self.server.verify_task_worktree(self.repo, self.repo, tid)   # primary checkout is not task-<id>
        with self.assertRaises(self.server.ToolError):
            self.server.verify_task_worktree(cwd, None, tid)              # no worktree

    def test_worker_that_leaves_its_branch_is_not_accepted(self):
        os.environ["FAKE_SWITCH"] = "1"
        tid = self.add("escape", budget=1)
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("left branch desk/%s" % tid, body)
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIn("escaped", task["blocked_reason"])
        self.assertEqual(self.ok("run_status")["runs"][0]["state"], "escaped")

    def test_adhoc_cwd_rules(self):
        self.assertIn("main branch", self.refused("run_claude", task="x", cwd=self.repo, budget_minutes=1))
        subprocess.run(["/usr/bin/git", "-C", self.repo, "checkout", "-q", "-b", "feature"], check=True, capture_output=True)
        self.assertIn("primary checkout", self.refused("run_codex", task="x", cwd=self.repo, budget_minutes=1))
        cwd, wt, branch = self.server.ensure_task_worktree(self.repo, "adhoc")
        self.assertEqual(self.ok("run_claude", task="x", cwd=wt, budget_minutes=1)["status"], "done")
        subprocess.run(["/usr/bin/git", "-C", wt, "checkout", "-q", "--detach"], check=True, capture_output=True)
        self.assertIn("detached HEAD", self.refused("run_claude", task="x", cwd=wt, budget_minutes=1))
        self.assertEqual(self.ok("run_codex", task="x", cwd=self.tmp, budget_minutes=1)["status"], "done")  # non-git ok


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
        self.assertEqual(init["result"]["serverInfo"]["version"], self.server.SERVER_VERSION)
        tools = self.rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["result"]["tools"]
        self.assertEqual({t["name"] for t in tools}, set(self.server.TOOL_MAP))
        ro = {t["name"] for t in tools if t["annotations"]["readOnlyHint"]}
        self.assertEqual(ro, {"desk_status", "queue_list", "outbox_read", "git_status", "run_status"})
        res = self.rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "desk_status", "arguments": {}}})
        self.assertFalse(res["result"]["isError"])
        status = json.loads(res["result"]["content"][0]["text"])
        self.assertTrue(status["canonical_desk"]["available"])
        self.assertTrue(status["billing_evidence"]["claude"]["fresh_within_hour"])
        self.assertEqual(self.rpc({"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "nope"}})["error"]["code"], -32602)
        self.assertEqual(self.rpc({"jsonrpc": "2.0", "id": 5, "method": "bogus"})["error"]["code"], -32601)

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
