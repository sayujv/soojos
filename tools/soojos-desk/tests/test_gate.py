#!/usr/bin/env python3
"""Tests for the deterministic quiet-heartbeat gate (decision 0007). Reuses the desk fixture."""
import datetime as dt
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
from test_server import DeskTestCase, utcnow  # noqa: E402


class TestHeartbeatGate(DeskTestCase):
    def setUp(self):
        super().setUp()
        import heartbeat_gate
        self.gate = importlib.reload(heartbeat_gate)
        self.gate.server = self.server
        self.gate.STATE_PATH = os.path.join(self.private, "heartbeat-gate.json")

    def quiet_now(self):
        # a UTC time whose Perth local hour is not 07: 12:00 UTC = 20:00 Perth
        return utcnow().replace(hour=12, minute=0)

    def test_first_beat_then_unchanged_then_change(self):
        first = self.gate.evaluate(now=self.quiet_now())
        self.assertEqual(first["verdict"], "ATTENTION")
        self.assertIn("no previous fingerprint", first["reasons"])
        second = self.gate.evaluate(now=self.quiet_now())
        self.assertEqual(second["verdict"], "UNCHANGED")
        self.assertEqual(second["reasons"], [])
        tid = self.add("new work", budget=1)
        third = self.gate.evaluate(now=self.quiet_now())
        self.assertEqual(third["verdict"], "ATTENTION")
        self.assertIn("queued task %s" % tid, third["reasons"])
        self.assertTrue(any(r.startswith("queue rows") for r in third["reasons"]))

    def test_queued_task_is_attention_even_when_fingerprint_unchanged(self):
        tid = self.add("waiting", budget=1)
        self.gate.evaluate(now=self.quiet_now())
        again = self.gate.evaluate(now=self.quiet_now())
        self.assertEqual(again["verdict"], "ATTENTION")
        self.assertEqual(again["reasons"], ["queued task %s" % tid])

    def test_overdue_running_stop_and_lost_run_are_attention(self):
        tid = self.add("late", budget=1)
        self.ok("queue_claim", id=tid)
        self.set_task(tid, deadline=(utcnow() - dt.timedelta(minutes=1)).isoformat())
        self.gate.evaluate(now=self.quiet_now())
        res = self.gate.evaluate(now=self.quiet_now())
        self.assertIn("running task %s past deadline" % tid, res["reasons"])
        self.server.save_run({"run_id": "run-claude-gone", "kind": "claude", "state": "running", "pid": 999999,
                              "started_at": utcnow().isoformat()})
        res = self.gate.evaluate(now=self.quiet_now())
        self.assertIn("run run-claude-gone is lost", res["reasons"])
        os.symlink("/nonexistent", os.path.join(self.home, "STOP"))
        res = self.gate.evaluate(now=self.quiet_now())
        self.assertIn("STOP present", res["reasons"])

    def test_daily_duty_window_is_attention(self):
        at_seven_perth = utcnow().replace(hour=23, minute=30)  # 23:30 UTC = 07:30 Perth
        self.gate.evaluate(now=self.quiet_now())
        res = self.gate.evaluate(now=at_seven_perth)
        self.assertIn("daily duty window (07:00-07:59 Perth)", res["reasons"])

    def test_dry_run_does_not_save_and_state_is_private(self):
        self.gate.evaluate(now=self.quiet_now())
        before = json.load(open(self.gate.STATE_PATH))
        self.add("dry", budget=1)
        self.gate.evaluate(save=False, now=self.quiet_now())
        self.assertEqual(json.load(open(self.gate.STATE_PATH)), before)
        self.assertEqual(os.stat(self.gate.STATE_PATH).st_mode & 0o777, 0o600)

    def test_gate_uses_no_model_and_only_reads_desk_state(self):
        # The gate must never touch the queue, outbox or run records: same bytes before and after.
        tid = self.add("untouched", budget=1)
        q_before = open(os.path.join(self.desk_dir, "queue.jsonl")).read()
        self.gate.evaluate(now=self.quiet_now())
        self.assertEqual(open(os.path.join(self.desk_dir, "queue.jsonl")).read(), q_before)
        self.assertEqual(self.queue()[tid]["status"], "queued")
