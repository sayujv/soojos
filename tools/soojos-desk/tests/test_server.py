#!/usr/bin/env python3
"""Offline tests for soojos-desk 0.4.1. Fake workers under tests/fakes; the canonical Desk from the
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
        for k in ("FAKE_MODE", "FAKE_TOUCH", "FAKE_AUTH", "FAKE_COMMIT", "FAKE_SWITCH", "FAKE_SLEEP", "FAKE_HOTSPOT_FILE",
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
        # Every project slug resolves to the temp repo, so no test can ever touch the real soojos checkout.
        self.projects_path = os.path.join(self.tmp, "projects.json")
        with open(self.projects_path, "w") as fh:
            json.dump({"soojos": self.repo, "trading-bot": self.repo}, fh)
        self.server.PROJECTS_PATH = self.projects_path

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
            if rec["state"] not in self.server.LIVE_STATES:
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
            left = subprocess.run(["/usr/bin/pgrep", "-f", "^sleep 300$"], capture_output=True, text=True).stdout.strip()
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


class TestReviewFixes032(DeskTestCase):
    """One test per finding of REVIEW-2026-09-18 addressed in 0.3.2."""

    def test_codex_add_dir_for_linked_worktree_only(self):
        self.assertEqual(self.server.codex_worktree_dirs(self.repo), [])          # primary checkout
        self.assertEqual(self.server.codex_worktree_dirs(self.tmp), [])           # non-git
        cwd, wt, _ = self.server.ensure_task_worktree(self.repo, "adddir")
        dirs = self.server.codex_worktree_dirs(cwd)
        gitdir = os.path.join(self.repo, ".git", "worktrees", "task-adddir")
        self.assertEqual(dirs, [gitdir, os.path.join(self.repo, ".git", "objects"),
                                os.path.join(self.repo, ".git", "refs", "heads", "desk"),
                                os.path.join(self.repo, ".git", "logs", "refs", "heads", "desk")])
        argv = self.server.worker_command("codex", "x", cwd, "/dev/null")
        self.assertEqual(argv.count("--add-dir"), 4)
        self.assertNotIn(os.path.join(self.repo, ".git"), argv)                   # never the whole .git
        self.assertNotIn("--add-dir", self.server.worker_command("codex", "x", self.repo, "/dev/null"))

    def test_h1_exception_after_reservation_blocks_task(self):
        tid = self.add("boom", budget=1)
        self.server.ensure_task_worktree = lambda *a: (_ for _ in ()).throw(OSError("disk gone"))
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("launch failed: OSError", body)
        task = self.queue()[tid]
        self.assertEqual(task["status"], "blocked")
        self.assertIn("OSError", task["blocked_reason"])
        self.assertEqual(self.ok("run_status")["runs"][0]["state"], "failed")
        self.assertIsNone(self.server.live_run_for(tid))

    def test_m6_reservation_failure_after_claim_blocks_task(self):
        tid = self.add("reserve", budget=1)
        self.server.reserve_run = lambda *a, **k: (_ for _ in ()).throw(self.server.ToolError("could not reserve"))
        self.refused("run_task", id=tid, cwd=self.repo)
        self.assertEqual(self.queue()[tid]["status"], "blocked")

    def test_m8_completion_refused_is_not_success(self):
        import threading
        os.environ["FAKE_SLEEP"] = "1"
        os.environ["SOOJOS_MINUTE_SECONDS"] = "6"
        self.server = importlib.reload(self.server); self.server._MODULES.clear()
        tid = self.add("refused", budget=1)
        def block_meanwhile():
            time.sleep(0.4)
            self.server.call_tool("queue_finish", {"id": tid, "status": "blocked", "reason": "blocked by tick meanwhile"})
        t = threading.Thread(target=block_meanwhile); t.start()
        body = self.refused("run_task", id=tid, cwd=self.repo)
        t.join()
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "completion-refused")
        self.assertEqual(report["queue"]["status"], "error")
        self.assertEqual(self.queue()[tid]["blocked_reason"], "blocked by tick meanwhile")

    def test_m7_signalled_runner_kills_worker_and_blocks_task(self):
        os.environ["FAKE_MODE"] = "hang"
        os.environ["SOOJOS_MINUTE_SECONDS"] = "20"
        self.server = importlib.reload(self.server); self.server._MODULES.clear()
        tid = self.add("signal", budget=1)
        out = self.ok("run_task", id=tid, cwd=self.repo, background=True)
        for _ in range(50):
            rec = self.ok("run_status", id=out["run_id"])["run"]
            if rec["state"] == "running" and rec.get("pid"):
                break
            time.sleep(0.1)
        time.sleep(0.5)
        os.kill(rec["pid"], 15)
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "killed")
        self.assertIn("SIGTERM", rec["note"])
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        self.assertIn("runner received SIGTERM", self.queue()[tid]["blocked_reason"])
        time.sleep(0.5)
        self.assertEqual(subprocess.run(["/usr/bin/pgrep", "-f", "^sleep 300$"], capture_output=True, text=True).stdout, "")

    def test_h3_escaped_pipe_holder_cannot_hang_the_runner(self):
        os.environ["FAKE_MODE"] = "hang-escape"
        try:
            started = time.time()
            body = self.refused("run_claude", task="x", cwd=self.tmp, budget_minutes=1)
            self.assertLess(time.time() - started, 25)
            report = json.loads(body.split("refused: ", 1)[1])
            self.assertEqual(report["status"], "timeout")
            self.assertIn("output unavailable", report["stderr"])
        finally:
            subprocess.run(["/usr/bin/pkill", "-f", "os.setsid\\(\\); time.sleep\\(300\\)"], capture_output=True)

    def test_m10_stale_unregistered_worktree_directory(self):
        tid = self.add("stale", budget=1)
        wt = self.worktree_of(tid)
        os.makedirs(wt)
        open(os.path.join(wt, "leftover.txt"), "w").close()
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("stale directory", body)
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        shutil.rmtree(wt)
        tid2 = self.add("empty-stale", budget=1)
        os.makedirs(self.worktree_of(tid2))  # empty and unregistered: healed by re-adding
        self.assertEqual(self.ok("run_task", id=tid2, cwd=self.repo)["status"], "done")

    def test_m11_launch_floor_refuses_doomed_launch(self):
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("floor", budget=15)  # closure 4.5s, floor min(1.5, 2.25)=1.5s
        self.ok("queue_claim", id=tid)
        self.set_task(tid, deadline=(utcnow() + dt.timedelta(seconds=5.5)).isoformat())  # remaining 1.0 < floor
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("launch floor", body)
        self.assertNoWorkerRun()
        self.assertEqual(self.queue()[tid]["status"], "blocked")

    def test_transient_ps_failure_does_not_mark_live_worker_lost(self):
        self.server.save_run({"run_id": "run-claude-psflake", "kind": "claude", "task_id": "t", "state": "running",
                              "pid": os.getpid(), "pid_start": self.server.proc_start(os.getpid()),
                              "started_at": utcnow().isoformat()})
        self.server.proc_start = lambda pid: None   # ps timed out this instant
        self.assertEqual(self.ok("run_status", id="run-claude-psflake")["run"]["state"], "running")

    def test_reserved_goes_stale_faster_than_spawned(self):
        old = (utcnow() - dt.timedelta(seconds=200)).isoformat()
        self.server.save_run({"run_id": "run-claude-res", "kind": "claude", "state": "reserved", "pid": os.getpid(), "reserved_at": old})
        self.server.save_run({"run_id": "run-claude-spn", "kind": "claude", "state": "spawned", "pid": os.getpid(), "spawned_at": old})
        states = {r["run_id"]: r["state"] for r in self.server.all_runs()}
        self.assertEqual(states["run-claude-res"], "lost")
        self.assertEqual(states["run-claude-spn"], "spawned")

    def test_m5_reused_pid_is_not_alive(self):
        self.server.save_run({"run_id": "run-claude-reused", "kind": "claude", "task_id": "t", "state": "running",
                              "pid": os.getpid(), "pid_start": "Mon Jan  1 00:00:00 2001", "started_at": utcnow().isoformat()})
        self.assertEqual(self.ok("run_status", id="run-claude-reused")["run"]["state"], "lost")
        self.assertTrue(self.server.pid_alive(os.getpid(), self.server.proc_start(os.getpid())))

    def test_m4_runner_owns_record_and_parent_write_precedes_popen(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1, background=True)
        self.assertEqual(out["state"], "spawned")
        rec = self.wait_run(out["run_id"])
        self.assertEqual(rec["state"], "done")
        self.assertTrue(rec.get("log") and rec.get("spec"))
        if self.server.proc_start(os.getpid()) is not None:   # hosts without ps fall back to pid-only liveness
            self.assertTrue(rec.get("pid_start"))
        else:
            self.assertIn("pid_start_note", rec)
        # a stale non-terminal write cannot follow the terminal one
        self.server.merge_run(out["run_id"], state="running")
        self.assertEqual(self.ok("run_status", id=out["run_id"])["run"]["state"], "done")


class TestReviewLows033(DeskTestCase):
    """Findings 13-17 of REVIEW-2026-09-18."""

    def test_13_outbox_notes_never_overwritten_even_within_one_second(self):
        frozen = utcnow()
        self.server.now_utc = lambda: frozen
        paths = {self.ok("outbox_write", id="same", report={"n": i})["written"] for i in range(4)}
        self.assertEqual(len(paths), 4)
        contents = sorted(json.load(open(p))["report"]["n"] for p in paths)
        self.assertEqual(contents, [0, 1, 2, 3])
        self.assertEqual(self.ok("outbox_read", id="same")["path"], max(paths, key=os.path.getmtime))

    def test_14_run_notes_are_private_and_trimmed_in_the_shared_outbox(self):
        out = self.ok("run_claude", task="p" * 1000, cwd=self.tmp, budget_minutes=1)
        shared = out["outbox_file"]
        self.assertEqual(os.stat(shared).st_mode & 0o777, 0o600)
        note = json.load(open(shared))["report"]
        self.assertLess(len(note["task"]), 400)
        self.assertTrue(note["full_note"].startswith(os.path.join(self.private, "runs")))
        full = json.load(open(note["full_note"]))["report"]
        self.assertEqual(len(full["task"]), 1000)
        self.assertEqual(os.stat(note["full_note"]).st_mode & 0o777, 0o600)
        free = self.ok("outbox_write", id="free-note", report={"x": 1})["written"]
        self.assertEqual(os.stat(free).st_mode & 0o777, 0o644)

    def test_15_corrupt_records_are_reported_not_fatal(self):
        runs = os.path.join(self.private, "runs")
        os.makedirs(runs, exist_ok=True)
        open(os.path.join(runs, "run-claude-empty.json"), "w").close()
        with open(os.path.join(runs, "run-claude-partial.json"), "w") as fh:
            fh.write('{"run_id": "run-claude-partial", "state": "runn')
        self.assertEqual(self.ok("run_claude", task="x", cwd=self.tmp, budget_minutes=1)["status"], "done")
        states = {r["run_id"]: r["state"] for r in self.ok("run_status")["runs"]}
        self.assertEqual(states["run-claude-empty"], "corrupt")
        self.assertEqual(states["run-claude-partial"], "corrupt")
        st = self.ok("desk_status")
        self.assertEqual({r["run_id"] for r in st["runs"] if r["state"] == "corrupt"}, {"run-claude-empty", "run-claude-partial"})
        self.assertIsNone(self.server.live_run_for("t"))
        self.assertEqual(self.server.load_json(os.path.join(runs, "run-claude-partial.json"), "dflt"), "dflt")
        tid = self.add("still-works", budget=1)
        self.assertEqual(self.ok("run_task", id=tid, cwd=self.repo)["status"], "done")

    def test_16_stop_appearing_mid_run_kills_worker_and_blocks_task(self):
        os.environ["FAKE_MODE"] = "hang"
        os.environ["SOOJOS_MINUTE_SECONDS"] = "30"
        self.server = importlib.reload(self.server); self.server._MODULES.clear()
        tid = self.add("stopme", budget=1)
        out = self.ok("run_task", id=tid, cwd=self.repo, background=True)
        for _ in range(50):
            if self.ok("run_status", id=out["run_id"])["run"]["state"] == "running":
                break
            time.sleep(0.1)
        time.sleep(0.5)
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        started = time.time()
        deadline = time.time() + 20
        while time.time() < deadline:  # tools refuse under STOP; read the record directly
            rec = self.server.load_json(self.server.run_record_path(out["run_id"]), {})
            if rec.get("state") not in self.server.LIVE_STATES:
                break
            time.sleep(0.2)
        self.assertLess(time.time() - started, 15)
        self.assertEqual(rec["state"], "stopped")
        self.assertTrue(rec.get("stop_seen_at"))
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        self.assertIn("STOP appeared", self.queue()[tid]["blocked_reason"])
        time.sleep(0.5)
        self.assertEqual(subprocess.run(["/usr/bin/pgrep", "-f", "^sleep 300$"], capture_output=True, text=True).stdout, "")

    def test_17_spec_removed_at_terminal_and_lock_scan_never_writes(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1)
        self.assertFalse(os.path.exists(os.path.join(self.private, "runs", out["run_id"] + ".spec.json")))
        self.assertTrue(os.path.exists(os.path.join(self.private, "runs", out["run_id"] + ".note.json")))
        path = self.server.run_record_path("run-claude-dead")
        self.server.save_run({"run_id": "run-claude-dead", "kind": "claude", "task_id": "t1", "state": "running",
                              "pid": 999999, "started_at": utcnow().isoformat()})
        before = os.stat(path).st_mtime_ns
        self.assertIsNone(self.server.live_run_for("t1"))       # sees it as not live...
        self.assertEqual(os.stat(path).st_mtime_ns, before)      # ...without touching the file
        self.assertEqual(json.load(open(path))["state"], "running")
        self.assertEqual(self.ok("run_status", id="run-claude-dead")["run"]["state"], "lost")  # marked outside the lock
        self.assertEqual(json.load(open(path))["state"], "lost")


class TestQuotaAndHostTolerance(DeskTestCase):
    def test_usage_limit_is_reported_as_quota(self):
        os.environ["FAKE_MODE"] = "quota"
        body = self.refused("run_codex", task="x", cwd=self.tmp, budget_minutes=1)
        report = json.loads(body.split("refused: ", 1)[1])
        self.assertEqual(report["status"], "quota")
        self.assertIn("usage limit reached", report["error"])
        tid = self.add("quota-task", assignee="codex", budget=1)
        self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("worker quota", self.queue()[tid]["blocked_reason"])

    def test_missing_ps_falls_back_to_pid_only(self):
        self.server.proc_start = lambda pid: None
        ident = self.server.self_identity()
        self.assertIsNone(ident["pid_start"])
        self.assertIn("pid_start_note", ident)
        self.assertTrue(self.server.pid_alive(os.getpid(), None))
        self.assertFalse(self.server.pid_alive(999999, None))


class TestTokenDiscipline035(DeskTestCase):
    def test_claude_worker_session_is_stripped_and_capped(self):
        argv = self.server.worker_command("claude", "x", self.tmp, None)
        self.assertIn("--strict-mcp-config", argv)
        self.assertEqual(argv[argv.index("--mcp-config") + 1], self.server.WORKER_MCP_CONFIG)
        self.assertEqual(json.load(open(self.server.WORKER_MCP_CONFIG)), {"mcpServers": {}})
        self.assertEqual(argv[argv.index("--max-turns") + 1], "8")     # policy claude_turns
        self.assertEqual(argv[argv.index("--model") + 1], "sonnet")   # default sonnet (CLI alias = latest)
        argv = self.server.worker_command("claude", "x", self.tmp, None, model="opus")
        self.assertEqual(argv[argv.index("--model") + 1], "opus")
        with self.assertRaises(self.server.ToolError):
            self.server.worker_command("claude", "x", self.tmp, None, model="gpt-6")
        self.assertNotIn("--model", self.server.worker_command("codex", "x", self.tmp, "/dev/null"))

    def test_queue_add_validates_model_and_run_task_uses_it(self):
        self.assertIn("approved set", self.refused("queue_add", project="soojos", task="x", assignee="claude",
                                                   budget_minutes=1, model="gpt-6"))
        self.assertIn("not supported for codex", self.refused("queue_add", project="soojos", task="x", assignee="codex",
                                                              budget_minutes=1, model="sonnet"))
        tid = self.ok("queue_add", project="soojos", task="haiku please", assignee="claude", budget_minutes=1,
                      model="haiku")["added"]["id"]
        self.assertEqual(self.queue()[tid]["worker_model"], "haiku")
        out = self.ok("run_task", id=tid, cwd=self.repo)
        self.assertEqual(out["model"], "haiku")
        self.assertEqual(out["command"][out["command"].index("--model") + 1], "haiku")
        codex_tid = self.add("codex inherits", assignee="codex", budget=1)
        self.assertIsNone(self.queue()[codex_tid]["worker_model"])

    def test_model_routes_by_action_kind_unless_named(self):
        verify = self.ok("queue_add", project="soojos", task="review it", assignee="claude", budget_minutes=1,
                         action_kind="verify")["added"]["id"]
        self.assertEqual(self.queue()[verify]["worker_model"], "fable")      # verdict-bearing work: strongest model
        code = self.ok("queue_add", project="soojos", task="write it", assignee="claude", budget_minutes=1,
                       action_kind="code")["added"]["id"]
        self.assertEqual(self.queue()[code]["worker_model"], "sonnet")      # production work: Sonnet, checked downstream
        named = self.ok("queue_add", project="soojos", task="cheap check", assignee="claude", budget_minutes=1,
                        action_kind="verify", model="haiku")["added"]["id"]
        self.assertEqual(self.queue()[named]["worker_model"], "haiku")      # an explicit model always wins
        self.assertEqual(self.server.resolve_model("claude", None, "retro"), "fable")
        self.assertEqual(self.server.resolve_model("claude", None, "research"), "sonnet")

    def test_token_split_is_recorded(self):
        out = self.ok("run_claude", task="ping", cwd=self.tmp, budget_minutes=1, model="sonnet")
        split = out["token_split"]
        self.assertEqual(split["actual_tokens"], 115)
        self.assertEqual(split["cache_creation_input_tokens"], 100)
        self.assertEqual(split["standing_context_per_turn"], 100)   # 1 turn, 100 created + 0 read
        self.assertEqual(out["model"], "sonnet")


class TestTwoStageReview038(DeskTestCase):
    def make_probe_file(self):
        path = os.path.join(self.repo, "probe.py")
        with open(path, "w") as fh:
            fh.write("".join("line %02d marker_%02d\n" % (i, i) for i in range(1, 61)))
        subprocess.run(["/usr/bin/git", "-C", self.repo, "add", "probe.py"], check=True, capture_output=True)
        subprocess.run(["/usr/bin/git", "-C", self.repo, "commit", "-q", "-m", "probe"], check=True, capture_output=True)

    def test_review_reads_only_hotspot_excerpts_and_sums_tokens(self):
        self.make_probe_file()
        tid = self.ok("queue_add", project="soojos", task="Review probe.py", assignee="claude", budget_minutes=2,
                      action_kind="verify")["added"]["id"]
        self.assertEqual(self.queue()[tid]["worker_model"], "fable")
        out = self.ok("run_review", id=tid, cwd=self.repo, files=["probe.py"], focus="lock ordering")
        self.assertEqual(out["status"], "done")
        rv = out["review"]
        self.assertEqual([h["start"] for h in rv["hotspots"]], [20])
        self.assertIsNone(rv["fallback"])
        self.assertEqual(rv["excerpt_lines"], 22)            # 20-25 padded by 8 each side: 12..33
        stages = out["stages"]
        self.assertEqual([st["model"] for st in stages], ["sonnet", "fable"])
        self.assertEqual(out["actual_tokens"], 645 + 115)     # triage 5+40+300+300, verdict fake 115
        full = json.load(open(os.path.join(self.private, "runs", out["run_id"] + ".note.json")))["report"]
        # the full private note carries the combined report; the stage-2 prompt lives in its own stage note
        s2 = json.load(open(os.path.join(self.private, "runs", out["run_id"] + "-s2.note.json")))["report"]["task"]
        self.assertIn("marker_22", s2)
        self.assertIn("marker_12", s2)
        self.assertNotIn("marker_50", s2)
        self.assertNotIn("marker_05", s2)
        self.assertEqual(full["review"]["review_model"], "fable")
        task = self.queue()[tid]
        self.assertEqual(task["status"], "done")
        self.assertEqual(task["actual_tokens"], 760)
        packet = json.load(open(task["result_path"]))["report"]
        self.assertIn("two-stage review: triage sonnet -> 1 hotspot(s), 22 excerpt line(s); verdict fable", packet["verification"])
        self.assertEqual(packet["token_split"]["actual_tokens"], 760)

    def test_review_falls_back_to_whole_files_when_triage_fails(self):
        self.make_probe_file()
        os.environ["FAKE_HOTSPOT_FILE"] = "not-a-requested-file.py"   # triage names a file outside the request
        tid = self.add("Review probe.py", budget=2)
        out = self.ok("run_review", id=tid, cwd=self.repo, files=["probe.py"])
        self.assertEqual(out["status"], "done")
        self.assertIn("no usable hotspots", out["review"]["fallback"])
        s2 = json.load(open(os.path.join(self.private, "runs", out["run_id"] + "-s2.note.json")))["report"]["task"]
        self.assertIn("Files to review: probe.py", s2)
        self.assertIn("fallback", json.load(open(self.queue()[tid]["result_path"]))["report"]["verification"])

    def test_review_validation(self):
        tid = self.add("x", budget=1)
        self.refused("run_review", id=tid, files=[])
        self.refused("run_review", id=tid, files=["/abs/path.py"])
        self.assertEqual(self.queue()[tid]["status"], "queued")   # refused before the claim
        body = self.refused("run_review", id=tid, cwd=self.repo, files=["missing.py"])
        self.assertIn("not found in the task worktree", body)
        self.assertEqual(self.queue()[tid]["status"], "blocked")   # refused after the claim: blocked with reason
        codex = self.add("x", assignee="codex", budget=1)
        self.assertIn("claude assignee", self.refused("run_review", id=codex, cwd=self.repo, files=["README.md"]))

    def test_acceptance_warning_when_commit_requested_but_head_unchanged(self):
        tid = self.add("Write the file and commit it with message x", budget=1)
        out = self.ok("run_task", id=tid, cwd=self.repo)          # fake does not commit
        packet = json.load(open(self.queue()[tid]["result_path"]))["report"]
        self.assertIn("ACCEPTANCE WARNING", packet["verification"])
        self.assertIn("HEAD did not change", packet["acceptance_warning"])
        os.environ["FAKE_COMMIT"] = "1"
        tid2 = self.add("Write the file and commit it", budget=1)
        self.ok("run_task", id=tid2, cwd=self.repo)
        self.assertNotIn("acceptance_warning", json.load(open(self.queue()[tid2]["result_path"]))["report"])

    def test_slug_resolution_stays_inside_the_fixture(self):
        tid = self.add("no cwd given", budget=1)
        out = self.ok("run_task", id=tid)
        self.assertTrue(out["worktree"].startswith(self.repo), out["worktree"])

    def test_heartbeat_gate_tool(self):
        import heartbeat_gate
        importlib.reload(heartbeat_gate).STATE_PATH  # module importable
        heartbeat_gate.STATE_PATH = os.path.join(self.private, "heartbeat-gate.json")
        heartbeat_gate.server = self.server
        first = self.ok("heartbeat_gate")
        self.assertEqual(first["verdict"], "ATTENTION")
        second = self.ok("heartbeat_gate", dry_run=True)
        self.assertIn(second["verdict"], ("UNCHANGED", "ATTENTION"))  # duty window may apply; must not error
        self.assertTrue(os.path.exists(heartbeat_gate.STATE_PATH))


class TestTwoStageReviewFindings(DeskTestCase):
    """High findings 1 and 2 of REVIEW-2026-09-25-two-stage.md."""

    def test_h1_parent_never_fails_a_spawned_record(self):
        original = self.server.wait_for_run
        def boom(run_id, budget):
            raise OSError("ps exploded while waiting")
        self.server.wait_for_run = boom
        tid = self.add("spawned then parent error", budget=1)
        body = self.refused("run_task", id=tid, cwd=self.repo)
        self.assertIn("runner", body)
        self.assertIn("owns the record", body)
        self.server.wait_for_run = original
        run_id = [r for r in self.server.all_runs(mark=False) if r.get("task_id") == tid][0]["run_id"]
        rec = self.wait_run(run_id)
        self.assertEqual(rec["state"], "done", "runner must finish normally; parent must not have failed it")
        self.assertEqual(self.queue()[tid]["status"], "done")

    def test_h2a_refused_running_transition_never_runs_a_worker(self):
        os.environ["FAKE_TOUCH"] = "ran"
        tid = self.add("refused", budget=1)
        self.ok("queue_claim", id=tid)
        record = self.server.reserve_run("claude", tid, "soojos")
        self.server.mark_lost(record["run_id"], "reserved", "simulated stale classification")
        spec = {"run_id": record["run_id"], "kind": "claude", "task": "x", "cwd": self.repo, "budget_minutes": 1,
                "task_id": tid, "project": "soojos", "background": True, "zero_cash": True}
        spec_path = os.path.join(self.private, "runs", record["run_id"] + ".spec.json")
        self.server.write_json_atomic(spec_path, spec)
        self.assertEqual(self.server.runner(spec_path), 4)
        self.assertNoWorkerRun()
        self.assertEqual(self.ok("run_status", id=record["run_id"])["run"]["state"], "lost")

    def test_h2b_lost_marking_is_compare_and_swap(self):
        rid = "run-claude-cas"
        self.server.save_run({"run_id": rid, "kind": "claude", "state": "running", "pid": 999999, "started_at": utcnow().isoformat()})
        # classification says lost, but the runner's final write lands first
        self.server.save_run({"run_id": rid, "kind": "claude", "state": "done", "pid": 999999, "finished_at": utcnow().isoformat()})
        self.assertEqual(self.server.mark_lost(rid, "running", "gone")["state"], "done")
        self.assertEqual(self.ok("run_status", id=rid)["run"]["state"], "done")
        rec = self.server.merge_run(rid, state="running")   # non-terminal after terminal is refused and reported
        self.assertEqual(rec["state"], "done")
        self.assertEqual(rec["refused_transition"], "running")


class TestInboxAndBoard039(DeskTestCase):
    def write_inbox(self, text):
        self.server.INBOX_PATH = os.path.join(self.desk_dir, "INBOX.md")
        self.server.BOARD_PATH = os.path.join(self.desk_dir, "BOARD.md")
        with open(self.server.INBOX_PATH, "w") as fh:
            fh.write(text)

    def test_inbox_sections_become_validated_queue_entries_with_markers(self):
        self.write_inbox("# Desk inbox\n\nintro text\n\n## Check the README\nproject: soojos\nbudget: 3\naction: verify\n"
                         "Read README.md and list outdated statements.\n\n## Bad one\nproject: not-a-project\nDo something.\n\n"
                         "## Already done\nproject: soojos\nqueued: 20260101-000000-claude-x at earlier\n")
        dry = self.ok("inbox_sync", dry_run=True)
        self.assertEqual(dry["new"], 2)
        self.assertEqual(self.ok("queue_list")["count"], 0)          # dry run queues nothing
        out = self.ok("inbox_sync")
        self.assertEqual(out["new"], 2)
        queued = [r for r in out["results"] if "queued" in r][0]
        refused = [r for r in out["results"] if "refused" in r][0]
        self.assertEqual(refused["title"], "Bad one")
        self.assertIn("outside approved scope", refused["refused"])
        task = self.queue()[queued["queued"]]
        self.assertEqual(task["budget_minutes"], 3)
        self.assertEqual(task["action_kind"], "verify")
        self.assertEqual(task["worker_model"], "fable")
        self.assertTrue(task["task"].startswith("Check the README\n"))
        text = open(self.server.INBOX_PATH).read()
        self.assertIn("queued: %s at " % queued["queued"], text)
        self.assertIn("queued: REFUSED", text)
        self.assertEqual(text.count("queued:"), 3)                     # one per processed section, none duplicated
        self.assertIn("Read README.md and list outdated statements.", text)  # author's words untouched
        again = self.ok("inbox_sync")
        self.assertEqual(again["new"], 0)                              # idempotent

    def test_board_renders_from_queue(self):
        self.write_inbox("# inbox\n")
        tid = self.add("Board me", budget=1)
        self.ok("queue_claim", id=tid)
        self.ok("queue_finish", id=tid, status="blocked", reason="waiting on Sayuj")
        out = self.ok("desk_board")
        board = open(self.server.BOARD_PATH).read()
        self.assertIn("## Blocked", board)
        self.assertIn("waiting on Sayuj", board)
        self.assertIn(tid, board)
        self.assertIn("the queue is the truth", board)
        self.assertEqual(out["board"], self.server.BOARD_PATH)


class TestInboxNotesRoutingScope040(DeskTestCase):
    def setUp(self):
        super().setUp()
        self.server.INBOX_PATH = os.path.join(self.desk_dir, "INBOX.md")
        self.server.BOARD_PATH = os.path.join(self.desk_dir, "BOARD.md")
        self.server.NOTES_DIR = os.path.join(self.desk_dir, "notes")

    def test_inbox_add_then_sync_note_reaches_worker_prompt(self):
        self.ok("inbox_add", kind="note", text="Prefer boring, well-tested code over clever code.", scope="all")
        self.ok("inbox_add", kind="note", text="Never touch core/ without asking me.", project="trading-bot")
        self.ok("inbox_add", text="Rename the helper", project="soojos", assignee="claude", budget=3, action="code")
        out = self.ok("inbox_sync", cwd=self.repo)
        kinds = sorted(k for r in out["results"] for k in r if k in ("noted", "queued"))
        self.assertEqual(kinds, ["noted", "noted", "queued"])
        text = open(self.server.INBOX_PATH).read()
        self.assertEqual(text.count("queued: noted in"), 2)
        self.assertTrue(os.path.exists(os.path.join(self.server.NOTES_DIR, "all.md")))
        self.assertTrue(os.path.exists(os.path.join(self.server.NOTES_DIR, "trading-bot.md")))
        tid = [r["queued"] for r in out["results"] if "queued" in r][0]
        task = self.queue()[tid]
        self.assertTrue(task["auto_dispatch"])
        prompt = self.server.compose_task_prompt(task, self.repo, None, None)
        self.assertIn("boring, well-tested", prompt)          # all-projects note reaches a soojos task
        self.assertNotIn("core/", prompt)                     # trading-bot note does not
        tb = dict(task, project="trading-bot")
        self.assertIn("core/", self.server.compose_task_prompt(tb, self.repo, None, None))

    def test_unrouted_section_is_routed_by_haiku_and_marked(self):
        self.ok("inbox_add", text="Make the login form remember the email address", assignee="claude", auto=True)
        out = self.ok("inbox_sync", cwd=self.repo)
        r = out["results"][0]
        self.assertEqual(r["routed_by_haiku"]["project"], "trading-bot")
        task = self.queue()[r["queued"]]
        self.assertEqual((task["project"], task["action_kind"], task["worker_model"], task["budget_minutes"]), ("trading-bot", "code", "sonnet", 6))
        self.assertIn("routed by haiku", open(self.server.INBOX_PATH).read())

    def test_unrouted_section_refused_when_cash_unknown(self):
        self.no_subscription()
        self.ok("inbox_add", text="Something vague")
        out = self.ok("inbox_sync", cwd=self.repo)
        self.assertIn("routing was not possible", out["results"][0]["refused"])
        self.assertIn("queued: REFUSED", open(self.server.INBOX_PATH).read())

    def test_auto_flag_defaults(self):
        tid = self.add("manual", budget=1)
        self.assertFalse(self.queue()[tid]["auto_dispatch"])
        self.ok("inbox_add", text="Explicitly manual", project="soojos", assignee="claude", auto=False)
        out = self.ok("inbox_sync", cwd=self.repo)
        self.assertFalse(self.queue()[out["results"][0]["queued"]]["auto_dispatch"])

    def test_inbox_defaults_to_codex_and_auto_unless_told_otherwise(self):
        self.ok("inbox_add", text="Do the thing", project="soojos")
        self.ok("inbox_add", text="Keep for a coordinator", project="soojos", assignee="codex", auto=False)
        self.ok("inbox_add", text="Claude please", project="soojos", assignee="claude")
        out = self.ok("inbox_sync", cwd=self.repo)
        rows = [self.queue()[r["queued"]] for r in out["results"]]
        self.assertEqual([(t["assignee"], t["auto_dispatch"]) for t in rows], [("codex", True), ("codex", False), ("claude", True)])

    def test_worker_that_changes_files_outside_its_project_folder_is_refused(self):
        os.makedirs(os.path.join(self.repo, "projects", "alpha"))
        os.makedirs(os.path.join(self.repo, "projects", "beta"))
        for p in ("alpha", "beta"):
            open(os.path.join(self.repo, "projects", p, "README.md"), "w").write(p + "\n")
        subprocess.run(["/usr/bin/git", "-C", self.repo, "add", "."], check=True, capture_output=True)
        subprocess.run(["/usr/bin/git", "-C", self.repo, "commit", "-q", "-m", "projects"], check=True, capture_output=True)
        with open(self.projects_path, "w") as fh:
            json.dump({"soojos": os.path.join(self.repo, "projects", "alpha")}, fh)
        os.environ["FAKE_TOUCH"] = "../beta/leak.txt"          # fake writes into the sibling project
        tid = self.add("stay in alpha", budget=1)
        body = self.refused("run_task", id=tid)
        self.assertIn("outside its project folder", body)
        self.assertIn("projects/beta/leak.txt", body)
        self.assertEqual(self.queue()[tid]["status"], "blocked")
        os.environ["FAKE_TOUCH"] = "inside.txt"                # inside alpha: accepted
        tid2 = self.add("stay in alpha again", budget=1)
        self.assertEqual(self.ok("run_task", id=tid2)["status"], "done")


class TestBeat040(DeskTestCase):
    def setUp(self):
        super().setUp()
        import desk_beat, heartbeat_gate
        self.gate = importlib.reload(heartbeat_gate); self.gate.server = self.server
        self.gate.STATE_PATH = os.path.join(self.private, "heartbeat-gate.json")
        self.beat = importlib.reload(desk_beat); self.beat.server = self.server; self.beat.heartbeat_gate = self.gate
        self.beat.LOG_PATH = os.path.join(self.private, "beat.log")
        self.server.INBOX_PATH = os.path.join(self.desk_dir, "INBOX.md")
        self.server.BOARD_PATH = os.path.join(self.desk_dir, "BOARD.md")
        self.server.NOTES_DIR = os.path.join(self.desk_dir, "notes")

    def test_unchanged_beat_does_nothing(self):
        self.beat.beat()
        rec = self.beat.beat()
        self.assertEqual(rec["gate"], "UNCHANGED")
        self.assertNotIn("dispatch", rec)

    def test_beat_dispatches_only_auto_tasks_with_fresh_evidence(self):
        manual = self.add("for Astra", assignee="codex", budget=1)          # not auto
        auto = self.ok("queue_add", project="soojos", task="auto me", assignee="claude", budget_minutes=1, auto=True)["added"]["id"]
        rec = self.beat.beat()
        self.assertEqual(rec["gate"], "ATTENTION")
        by_id = {d["id"]: d for d in rec["dispatch"] if "id" in d}
        self.assertIn("not marked for automatic dispatch", by_id[manual]["skipped"])
        self.assertTrue(by_id[auto].get("launched"))
        self.assertEqual(self.wait_run(by_id[auto]["launched"])["state"], "done")
        self.assertEqual(self.queue()[manual]["status"], "queued")
        self.write_billing(fresh=False)
        stale = self.ok("queue_add", project="soojos", task="stale evidence", assignee="claude", budget_minutes=1, auto=True)["added"]["id"]
        rec = self.beat.beat()
        self.assertIn("billing evidence not fresh", {d["id"]: d for d in rec["dispatch"] if "id" in d}[stale]["skipped"])
        self.assertEqual(self.queue()[stale]["status"], "queued")

    def test_beat_observes_before_dispatch_when_evidence_is_stale(self):
        os.environ["SOOJOS_OBSERVER_CMD"] = os.path.join(FAKES, "fake_observer")
        self.beat = importlib.reload(self.beat); self.beat.server = self.server; self.beat.heartbeat_gate = self.gate
        self.beat.LOG_PATH = os.path.join(self.private, "beat.log")
        self.write_billing(fresh=False)
        tid = self.ok("queue_add", project="soojos", task="needs fresh evidence", assignee="claude", budget_minutes=1, auto=True)["added"]["id"]
        rec = self.beat.beat()
        observed = [d["observe"] for d in rec["dispatch"] if "observe" in d]
        self.assertEqual(observed[0]["kind"], "claude")
        self.assertTrue(observed[0]["verified"])
        launched = [d for d in rec["dispatch"] if d.get("launched")]
        self.assertEqual(launched[0]["id"], tid)                 # refreshed evidence let the task launch
        self.wait_run(launched[0]["launched"])
        # observer cannot verify (session lapsed): evidence stays stale, task stays queued, board says why
        os.environ["FAKE_OBSERVE"] = "no"
        self.write_billing(fresh=False)
        tid2 = self.ok("queue_add", project="soojos", task="blocked by login", assignee="claude", budget_minutes=1, auto=True)["added"]["id"]
        self.server.write_json_atomic(os.path.join(self.private, "observe-status.json"),
                                      {"results": {"claude": {"verified": False, "reason": "not_logged_in"}}})
        rec = self.beat.beat()
        by_id = {d["id"]: d for d in rec["dispatch"] if "id" in d}
        self.assertIn("billing evidence not fresh", by_id[tid2]["skipped"])
        self.assertEqual(self.queue()[tid2]["status"], "queued")
        self.assertIn("Needs you", open(self.server.BOARD_PATH).read())
        self.assertFalse(self.ok("desk_status")["observer"]["results"]["claude"]["verified"])
        del os.environ["FAKE_OBSERVE"]; del os.environ["SOOJOS_OBSERVER_CMD"]

    def test_beat_under_stop_only_logs(self):
        self.add("x", budget=1)
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        rec = self.beat.beat()
        self.assertEqual(rec["gate"], "ATTENTION")
        self.assertTrue(rec.get("stop"))
        self.assertNotIn("dispatch", rec)


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
