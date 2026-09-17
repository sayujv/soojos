#!/usr/bin/env python3
"""soojos-desk: a minimal MCP server (stdio, JSON-RPC 2.0, Python stdlib only).

Tools
  queue_list, queue_add, queue_claim, queue_finish, queue_reap, desk_status
  outbox_read, outbox_write, git_status
  run_claude, run_codex, run_task, run_status

Every tool refuses when ~/.soojos/STOP exists (a dangling symlink counts).

State defaults to the canonical partnership desk:
  queue/outbox : /Users/sayuj/soojos/context/desk   (override: SOOJOS_DESK_DIR)
  private      : ~/.soojos                           (override: SOOJOS_HOME)
                 STOP, desk/coordinator.lock, desk/runs/<run-id>.json
Queue mutations take the same flock the existing desk coordinator uses and
replace queue.jsonl atomically.

Workers run non-interactively with full binary paths and a hard timeout:
  claude : -p --output-format json --permission-mode acceptEdits --no-session-persistence
           (override mode with SOOJOS_CLAUDE_PERMISSION_MODE)
  codex  : exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd
           (override sandbox with SOOJOS_CODEX_SANDBOX)
Unanswered permission prompts in these modes are denied, never granted.
The worker inherits this server's environment unchanged.

Background runs: `server.py --runner <spec.json>` is the detached runner the
server spawns in its own session; it survives the MCP client exiting.
"""
import datetime as _dt
import fcntl
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
import traceback

SERVER_NAME = "soojos-desk"
SERVER_VERSION = "0.2.0"
PROTOCOL_VERSION = "2025-06-18"
MINUTE = float(os.environ.get("SOOJOS_MINUTE_SECONDS", "60"))  # tests shrink this to exercise timeouts quickly

HERE = os.path.dirname(os.path.abspath(__file__))
SOOJOS_ROOT = "/Users/sayuj/soojos"
SOOJOS_HOME = os.environ.get("SOOJOS_HOME", os.path.expanduser("~/.soojos"))
DESK_DIR = os.environ.get("SOOJOS_DESK_DIR", os.path.join(SOOJOS_ROOT, "context", "desk"))
STOP_PATH = os.path.join(SOOJOS_HOME, "STOP")
LOCK_PATH = os.path.join(SOOJOS_HOME, "desk", "coordinator.lock")
RUNS_DIR = os.path.join(SOOJOS_HOME, "desk", "runs")
QUEUE_PATH = os.path.join(DESK_DIR, "queue.jsonl")
SCHEMA_PATH = os.path.join(DESK_DIR, "queue.schema.json")
POLICY_PATH = os.path.join(DESK_DIR, "policy.json")
OUTBOX_DIR = os.path.join(DESK_DIR, "outbox")
PROJECTS_PATH = os.path.join(HERE, "projects.json")

CLAUDE_BIN = os.environ.get("SOOJOS_CLAUDE_BIN", "/Users/sayuj/.local/bin/claude")
CODEX_BIN = os.environ.get("SOOJOS_CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex")
GIT_BIN = "/usr/bin/git"
CLAUDE_PERMISSION_MODE = os.environ.get("SOOJOS_CLAUDE_PERMISSION_MODE", "acceptEdits")
CODEX_SANDBOX = os.environ.get("SOOJOS_CODEX_SANDBOX", "workspace-write")

MAX_RETURN_CHARS = 20000     # per stream in the tool result
MAX_OUTBOX_CHARS = 200000    # per stream in the outbox file
REAP_GRACE_MINUTES = 2
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")


class ToolError(Exception):
    pass


# --------------------------------------------------------------------------- basics
def now_utc():
    return _dt.datetime.now(_dt.timezone.utc)


def iso(ts=None):
    return (ts or now_utc()).isoformat()


def parse_iso(text):
    try:
        return _dt.datetime.fromisoformat(text)
    except (TypeError, ValueError):
        return None


def stop_present():
    return os.path.lexists(STOP_PATH)


def stop_check():
    if stop_present():
        raise ToolError("STOP is present at %s; refusing. The desk never removes it." % STOP_PATH)


def load_json(path, default):
    try:
        with open(path) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


def write_json_atomic(path, payload, mode=0o600):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp.", dir=os.path.dirname(path))
    with os.fdopen(fd, "w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True, default=str)
        fh.write("\n")
    os.chmod(tmp, mode)
    os.replace(tmp, path)


def policy():
    return load_json(POLICY_PATH, {})


def schema_enum(field, fallback):
    schema = load_json(SCHEMA_PATH, {})
    return schema.get("properties", {}).get(field, {}).get("enum", fallback)


def slugify(text, limit=40):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:limit].strip("-") or "task"


def check_budget(budget_minutes):
    try:
        budget = int(budget_minutes)
    except (TypeError, ValueError):
        raise ToolError("budget_minutes must be an integer")
    cap = int(policy().get("task_minutes", 15))
    if budget < 1 or budget > cap:
        raise ToolError("budget_minutes must be between 1 and %d (policy task_minutes)" % cap)
    return budget


def clip(text, limit):
    if len(text) <= limit:
        return text
    return text[:limit // 2] + "\n...[%d chars omitted]...\n" % (len(text) - limit) + text[-limit // 2:]


# --------------------------------------------------------------------------- queue
def read_queue():
    tasks = []
    try:
        with open(QUEUE_PATH) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    tasks.append(json.loads(line))
    except FileNotFoundError:
        pass
    return tasks


def write_queue_atomic(tasks):
    os.makedirs(DESK_DIR, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".queue.", suffix=".jsonl", dir=DESK_DIR)
    try:
        with os.fdopen(fd, "w") as fh:
            for t in tasks:
                fh.write(json.dumps(t, sort_keys=True) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
        if os.path.exists(QUEUE_PATH):
            os.chmod(tmp, os.stat(QUEUE_PATH).st_mode & 0o777)
        else:
            os.chmod(tmp, 0o600)
        os.replace(tmp, QUEUE_PATH)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


class queue_lock:
    """Same flock the existing desk coordinator uses, so writers do not collide."""

    def __enter__(self):
        os.makedirs(os.path.dirname(LOCK_PATH), exist_ok=True)
        self.fh = open(LOCK_PATH, "a+")
        try:
            os.chmod(LOCK_PATH, 0o600)
        except OSError:
            pass
        fcntl.flock(self.fh, fcntl.LOCK_EX)
        return self

    def __exit__(self, *exc):
        fcntl.flock(self.fh, fcntl.LOCK_UN)
        self.fh.close()
        return False


def find_task(tasks, task_id):
    return next((t for t in tasks if t.get("id") == task_id), None)


def claim_locked(tasks, task_id):
    """Mutates tasks in place; caller holds the lock and writes."""
    target = find_task(tasks, task_id)
    if target is None:
        raise ToolError("no task with id %s" % task_id)
    if target.get("status") != "queued":
        raise ToolError("task %s is %s, not queued" % (task_id, target.get("status")))
    running = [t["id"] for t in tasks if t.get("status") == "running"]
    max_workers = int(policy().get("max_workers", 2))
    if len(running) >= max_workers:
        raise ToolError("max_workers=%d already running: %s" % (max_workers, ", ".join(running)))
    stamp = now_utc()
    budget = int(target.get("budget_minutes", 15))
    target["status"] = "running"
    target["started_at"] = iso(stamp)
    target["deadline"] = iso(stamp + _dt.timedelta(minutes=budget))
    target["claimed_by"] = SERVER_NAME
    return target


def finish_task(task_id, status, report, reason=None):
    """running -> done|blocked with accounting, plus an outbox entry. Returns the task."""
    if status not in ("done", "blocked"):
        raise ToolError("status must be done or blocked")
    if status == "blocked" and not reason:
        raise ToolError("blocked requires a reason")
    with queue_lock():
        tasks = read_queue()
        target = find_task(tasks, task_id)
        if target is None:
            raise ToolError("no task with id %s" % task_id)
        if target.get("status") not in ("running", "queued"):
            raise ToolError("task %s is %s; only running (or queued->blocked) can finish" % (task_id, target.get("status")))
        if target.get("status") == "queued" and status == "done":
            raise ToolError("task %s was never claimed; claim it before marking done" % task_id)
        stamp = now_utc()
        started = parse_iso(target.get("started_at"))
        target["status"] = status
        target["completed_at"] = iso(stamp)
        target["actual_minutes"] = round((stamp - started).total_seconds() / 60.0, 4) if started else None
        target.setdefault("actual_cost_aud", 0.0)
        target.setdefault("actual_tokens", None)
        target["blocked_reason"] = reason if status == "blocked" else None
        target["finished_by"] = SERVER_NAME
        report = dict(report or {})
        report.setdefault("status", status)
        if reason:
            report.setdefault("reason", reason)
        report.setdefault("actual_minutes", target["actual_minutes"])
        path = write_outbox(task_id, target.get("project"), report)
        target["outbox_file"] = path
        write_queue_atomic(tasks)
    return target


# --------------------------------------------------------------------------- outbox
def outbox_path_for(entry_id):
    """Files are <YYYY-MM-DD>-<id>[-HHMMSS].json; return newest match or None."""
    if not os.path.isdir(OUTBOX_DIR):
        return None
    pat = re.compile(r"^\d{4}-\d{2}-\d{2}-%s(-\d{6})?\.json$" % re.escape(entry_id))
    matches = [f for f in os.listdir(OUTBOX_DIR) if pat.match(f)]
    if not matches:
        return None
    matches.sort(key=lambda f: os.path.getmtime(os.path.join(OUTBOX_DIR, f)))
    return os.path.join(OUTBOX_DIR, matches[-1])


def write_outbox(entry_id, project, report):
    """Outbox entries are immutable: never overwrite an existing file."""
    os.makedirs(OUTBOX_DIR, exist_ok=True)
    stamp = now_utc()
    path = os.path.join(OUTBOX_DIR, "%s-%s.json" % (stamp.strftime("%Y-%m-%d"), entry_id))
    if os.path.exists(path):
        path = os.path.join(OUTBOX_DIR, "%s-%s-%s.json" % (stamp.strftime("%Y-%m-%d"), entry_id,
                                                          stamp.strftime("%H%M%S")))
    payload = {"at": iso(stamp), "id": entry_id, "project": project, "report": report,
               "writer": SERVER_NAME + "/" + SERVER_VERSION}
    write_json_atomic(path, payload, mode=0o644)
    return path


# --------------------------------------------------------------------------- projects / git
def resolve_project_dir(project):
    if not isinstance(project, str) or not project:
        raise ToolError("project is required (slug from projects.json or an absolute path)")
    if os.path.isabs(project):
        path = project
    else:
        mapping = load_json(PROJECTS_PATH, {})
        if project not in mapping:
            raise ToolError("unknown project %r; known: %s or an absolute path"
                            % (project, ", ".join(sorted(mapping))))
        path = mapping[project]
    if not os.path.isdir(path):
        raise ToolError("project directory does not exist: %s" % path)
    return path


def git(path, *args, timeout=60):
    r = subprocess.run([GIT_BIN, "-C", path] + list(args), capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def git_toplevel(path):
    code, top, _ = git(path, "rev-parse", "--show-toplevel")
    return top if code == 0 else None


def ensure_task_worktree(project_dir, task_id):
    """Create (or reuse) <toplevel>/.worktrees/task-<id> on branch desk/<id>.
    Returns (cwd_for_worker, worktree_root, branch) or (project_dir, None, None) for non-git."""
    top = git_toplevel(project_dir)
    if top is None:
        return project_dir, None, None
    worktree = os.path.join(top, ".worktrees", "task-%s" % task_id)
    branch = "desk/%s" % task_id
    if not os.path.isdir(worktree):
        os.makedirs(os.path.dirname(worktree), exist_ok=True)
        code, _, _ = git(top, "rev-parse", "--verify", "--quiet", "refs/heads/" + branch)
        if code == 0:
            code, out, err = git(top, "worktree", "add", worktree, branch)
        else:
            code, out, err = git(top, "worktree", "add", "-b", branch, worktree, "HEAD")
        if code != 0:
            raise ToolError("git worktree add failed: %s %s" % (out, err))
    rel = os.path.relpath(os.path.realpath(project_dir), os.path.realpath(top))
    cwd = worktree if rel == "." else os.path.join(worktree, rel)
    if not os.path.isdir(cwd):
        cwd = worktree
    return cwd, worktree, branch


# --------------------------------------------------------------------------- workers
def worker_command(kind, task, cwd, last_msg_file):
    if kind == "claude":
        if not os.path.exists(CLAUDE_BIN):
            raise ToolError("claude binary missing at %s" % CLAUDE_BIN)
        return [CLAUDE_BIN, "-p", task, "--output-format", "json",
                "--permission-mode", CLAUDE_PERMISSION_MODE, "--no-session-persistence"]
    if kind == "codex":
        if not os.path.exists(CODEX_BIN):
            raise ToolError("codex binary missing at %s" % CODEX_BIN)
        return [CODEX_BIN, "exec", "--sandbox", CODEX_SANDBOX, "--skip-git-repo-check", "--ephemeral",
                "-C", cwd, "-o", last_msg_file, task]
    raise ToolError("unknown worker kind %r" % kind)


def run_bounded(cmd, cwd, budget_minutes):
    """Run cmd in its own process group; kill the whole group on timeout."""
    timeout = budget_minutes * MINUTE
    started = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        for sig, wait in ((signal.SIGTERM, 10), (signal.SIGKILL, None)):
            try:
                os.killpg(proc.pid, sig)
            except ProcessLookupError:
                pass
            try:
                out, err = proc.communicate(timeout=wait)
                break
            except subprocess.TimeoutExpired:
                continue
    elapsed = time.monotonic() - started
    return {"exit_code": proc.returncode, "timed_out": timed_out, "elapsed_seconds": round(elapsed, 2),
            "stdout": out.decode("utf-8", "replace"), "stderr": err.decode("utf-8", "replace")}


def execute_worker(kind, task, cwd, budget, run_id, extra=None):
    """Synchronously run a worker and write its outbox entry. Returns the full report."""
    last_msg_file = None
    report = {"kind": kind, "task": task, "cwd": cwd, "budget_minutes": budget, "run_id": run_id,
              "started_at": iso(), "status": "failed"}
    report.update(extra or {})
    try:
        if kind == "codex":
            fd, last_msg_file = tempfile.mkstemp(prefix="codex-last-", suffix=".txt")
            os.close(fd)
        cmd = worker_command(kind, task, cwd, last_msg_file)
        report["command"] = cmd
        res = run_bounded(cmd, cwd, budget)
        report.update(res)
        if kind == "claude":
            try:
                parsed = json.loads(res["stdout"])
                report["result"] = parsed.get("result")
                for key in ("total_cost_usd", "usage", "num_turns", "duration_ms", "is_error",
                            "session_id", "subtype", "permission_denials"):
                    if key in parsed:
                        report[key] = parsed[key]
            except (ValueError, AttributeError):
                report["result"] = None
        else:
            try:
                with open(last_msg_file) as fh:
                    report["result"] = fh.read()
            except OSError:
                report["result"] = None
        if res["timed_out"]:
            report["status"] = "timeout"
        elif res["exit_code"] == 0 and not report.get("is_error"):
            report["status"] = "done"
        else:
            report["status"] = "failed"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = "%s: %s" % (type(exc).__name__, exc)
        report.setdefault("stdout", "")
        report.setdefault("stderr", "")
    finally:
        if last_msg_file:
            try:
                os.unlink(last_msg_file)
            except OSError:
                pass
        report["finished_at"] = iso()
    outbox_report = dict(report)
    outbox_report["stdout"] = clip(report.get("stdout", ""), MAX_OUTBOX_CHARS)
    outbox_report["stderr"] = clip(report.get("stderr", ""), MAX_OUTBOX_CHARS)
    report["outbox_file"] = write_outbox(run_id, report.get("project"), outbox_report)
    return report


def trimmed(report):
    result = dict(report)
    result["stdout"] = clip(report.get("stdout", ""), MAX_RETURN_CHARS)
    result["stderr"] = clip(report.get("stderr", ""), MAX_RETURN_CHARS)
    return result


def run_record_path(run_id):
    return os.path.join(RUNS_DIR, run_id + ".json")


def save_run(record):
    write_json_atomic(run_record_path(record["run_id"]), record)


def pid_alive(pid):
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def load_run(run_id):
    rec = load_json(run_record_path(run_id), None)
    if rec and rec.get("state") == "running" and not pid_alive(rec.get("pid")):
        rec["state"] = "lost"
        rec["note"] = "runner process is gone without a final record"
        save_run(rec)
    return rec


def complete_task_from_report(task_id, report):
    """Map a worker report onto queue accounting. Never raises on a missing task."""
    try:
        summary = {"run_id": report.get("run_id"), "worker": report.get("kind"), "worker_status": report.get("status"),
                   "exit_code": report.get("exit_code"), "timed_out": report.get("timed_out"),
                   "elapsed_seconds": report.get("elapsed_seconds"), "result": report.get("result"),
                   "worker_outbox_file": report.get("outbox_file"), "worktree": report.get("worktree"),
                   "branch": report.get("branch"), "total_cost_usd": report.get("total_cost_usd"),
                   "num_turns": report.get("num_turns")}
        if report.get("status") == "done":
            return finish_task(task_id, "done", summary)
        reason = "worker %s: %s" % (report.get("status"), report.get("error") or
                                    ("exit %s" % report.get("exit_code")))
        return finish_task(task_id, "blocked", summary, reason=reason)
    except ToolError as exc:
        return {"finish_error": str(exc)}


def run_spec(spec):
    """Shared by the foreground path and the detached runner."""
    stamp = now_utc()
    record = {"run_id": spec["run_id"], "kind": spec["kind"], "task_id": spec.get("task_id"),
              "project": spec.get("project"), "cwd": spec["cwd"], "budget_minutes": spec["budget_minutes"],
              "pid": os.getpid(), "state": "running", "started_at": iso(stamp), "background": spec.get("background", False)}
    save_run(record)
    extra = {k: spec.get(k) for k in ("task_id", "project", "worktree", "branch") if spec.get(k)}
    report = execute_worker(spec["kind"], spec["task"], spec["cwd"], spec["budget_minutes"], spec["run_id"], extra)
    if spec.get("task_id"):
        report["queue"] = complete_task_from_report(spec["task_id"], report)
    record.update({"state": report["status"], "finished_at": report["finished_at"], "exit_code": report.get("exit_code"),
                   "timed_out": report.get("timed_out"), "outbox_file": report.get("outbox_file"),
                   "result": clip(report.get("result") or "", 4000), "queue": report.get("queue")})
    save_run(record)
    return report


def spawn_background(spec):
    os.makedirs(RUNS_DIR, exist_ok=True)
    spec_path = os.path.join(RUNS_DIR, spec["run_id"] + ".spec.json")
    write_json_atomic(spec_path, spec)
    log_path = os.path.join(RUNS_DIR, spec["run_id"] + ".log")
    with open(log_path, "ab") as log:
        proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--runner", spec_path],
                                stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
                                cwd=spec["cwd"])
    record = {"run_id": spec["run_id"], "kind": spec["kind"], "task_id": spec.get("task_id"), "project": spec.get("project"),
              "cwd": spec["cwd"], "budget_minutes": spec["budget_minutes"], "pid": proc.pid, "state": "running",
              "started_at": iso(), "background": True, "log": log_path}
    save_run(record)
    return record


def launch(kind, task, cwd, budget_minutes, background=False, task_id=None, project=None, worktree=None, branch=None):
    if not isinstance(task, str) or not task.strip():
        raise ToolError("task must be a non-empty string")
    if not isinstance(cwd, str) or not os.path.isabs(cwd) or not os.path.isdir(cwd):
        raise ToolError("cwd must be an existing absolute directory")
    budget = check_budget(budget_minutes)
    worker_command(kind, "probe", cwd, "/dev/null")  # validates kind and binary presence early
    run_id = "run-%s-%s" % (kind, now_utc().strftime("%Y%m%d-%H%M%S-%f")[:-3])
    spec = {"run_id": run_id, "kind": kind, "task": task, "cwd": cwd, "budget_minutes": budget,
            "task_id": task_id, "project": project, "worktree": worktree, "branch": branch,
            "background": bool(background)}
    if background:
        rec = spawn_background(spec)
        return {"run_id": run_id, "state": "running", "pid": rec["pid"], "background": True,
                "poll": "run_status(id=%s); outbox_read(id=%s) when finished" % (run_id, run_id)}
    report = trimmed(run_spec(spec))
    report["run_id"] = run_id
    if report["status"] != "done":
        raise ToolError(json.dumps(report, indent=2, sort_keys=True, default=str))
    return report


# --------------------------------------------------------------------------- tools
def t_queue_list(args):
    status = args.get("status")
    tasks = read_queue()
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    keys = ("id", "project", "assignee", "status", "budget_minutes", "created_at", "deadline", "claimed_by", "task")
    summary = [{k: t.get(k) for k in keys if k in t} for t in tasks]
    for s in summary:
        if isinstance(s.get("task"), str) and len(s["task"]) > 200:
            s["task"] = s["task"][:200] + "..."
    return {"queue_path": QUEUE_PATH, "count": len(summary), "tasks": summary}


def t_queue_add(args):
    project = args.get("project")
    task = args.get("task")
    assignee = args.get("assignee")
    budget = check_budget(args.get("budget_minutes", 15))
    projects = schema_enum("project", sorted(load_json(PROJECTS_PATH, {})))
    assignees = schema_enum("assignee", ["codex", "claude"])
    if project not in projects:
        raise ToolError("project must be one of: %s" % ", ".join(projects))
    if assignee not in assignees:
        raise ToolError("assignee must be one of: %s" % ", ".join(assignees))
    if not isinstance(task, str) or not task.strip():
        raise ToolError("task must be a non-empty string")
    if len(task) > 12000:
        raise ToolError("task exceeds 12000 characters")
    stamp = now_utc()
    task_id = "%s-%s-%s" % (stamp.strftime("%Y%m%d-%H%M%S"), assignee, slugify(task))
    if not ID_RE.match(task_id):
        raise ToolError("generated id %r does not match the queue schema" % task_id)
    entry = {
        "id": task_id, "project": project, "task": task, "assignee": assignee,
        "inputs": args.get("inputs") or [], "constraints": args.get("constraints") or [],
        "priority": {"source": SERVER_NAME},
        "expected_return": {"basis": "Evidence required", "confidence": "unassessed", "currency": "AUD",
                            "horizon_days": 90, "net_low": None, "net_high": None},
        "created_at": iso(stamp), "status": "queued", "budget_tokens": None,
        "budget_minutes": budget, "budget_aud": 0, "chain_depth": 1, "parent_id": None,
        "attempts": [], "blocked_reason": None, "created_by": SERVER_NAME,
    }
    with queue_lock():
        tasks = read_queue()
        if find_task(tasks, task_id):
            raise ToolError("id collision: %s" % task_id)
        tasks.append(entry)
        write_queue_atomic(tasks)
    return {"added": entry, "queue_path": QUEUE_PATH}


def t_queue_claim(args):
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    with queue_lock():
        tasks = read_queue()
        target = claim_locked(tasks, task_id)
        write_queue_atomic(tasks)
    return {"claimed": target}


def t_queue_finish(args):
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    report = args.get("report") or {}
    if isinstance(report, str):
        try:
            report = json.loads(report)
        except ValueError:
            report = {"summary": report}
    if not isinstance(report, dict):
        raise ToolError("report must be a JSON object (or a string)")
    target = finish_task(task_id, args.get("status"), report, reason=args.get("reason"))
    return {"finished": target}


def t_queue_reap(args):
    """Block running tasks whose deadline passed with no live runner. Only tasks this server
    claimed unless all=true."""
    reap_all = bool(args.get("all", False))
    grace = _dt.timedelta(minutes=float(args.get("grace_minutes", REAP_GRACE_MINUTES)))
    now = now_utc()
    live_task_ids = set()
    if os.path.isdir(RUNS_DIR):
        for f in os.listdir(RUNS_DIR):
            if f.endswith(".json") and not f.endswith(".spec.json"):
                rec = load_run(f[:-5])
                if rec and rec.get("state") == "running" and rec.get("task_id"):
                    live_task_ids.add(rec["task_id"])
    reaped, skipped = [], []
    for t in read_queue():
        if t.get("status") != "running":
            continue
        deadline = parse_iso(t.get("deadline"))
        if deadline is None or now < deadline + grace:
            continue
        if not reap_all and t.get("claimed_by") != SERVER_NAME:
            skipped.append({"id": t["id"], "why": "claimed_by %s; pass all=true to reap" % t.get("claimed_by")})
            continue
        if t["id"] in live_task_ids:
            skipped.append({"id": t["id"], "why": "background runner still alive"})
            continue
        reason = "deadline %s exceeded by more than %s with no finish; reaped" % (t.get("deadline"), grace)
        finish_task(t["id"], "blocked", {"reaped_at": iso(now)}, reason=reason)
        reaped.append(t["id"])
    return {"reaped": reaped, "skipped": skipped}


def t_desk_status(args):
    tasks = read_queue()
    counts = {}
    for t in tasks:
        counts[t.get("status", "?")] = counts.get(t.get("status", "?"), 0) + 1
    now = now_utc()
    running = []
    for t in tasks:
        if t.get("status") == "running":
            deadline = parse_iso(t.get("deadline"))
            running.append({"id": t["id"], "project": t.get("project"), "assignee": t.get("assignee"),
                            "claimed_by": t.get("claimed_by"), "deadline": t.get("deadline"),
                            "overdue": bool(deadline and now > deadline)})
    runs = []
    if os.path.isdir(RUNS_DIR):
        for f in sorted(os.listdir(RUNS_DIR)):
            if f.endswith(".json") and not f.endswith(".spec.json"):
                rec = load_run(f[:-5])
                if rec and rec.get("state") in ("running", "lost"):
                    runs.append({k: rec.get(k) for k in ("run_id", "kind", "task_id", "state", "pid", "started_at")})
    pol = policy()
    return {"stop_present": stop_present(), "stop_path": STOP_PATH, "desk_dir": DESK_DIR, "queue_counts": counts,
            "running": running, "active_background_runs": runs,
            "policy": {k: pol.get(k) for k in ("version", "task_minutes", "max_workers", "max_chain_depth", "token_mode")},
            "workers": {"claude": {"bin": CLAUDE_BIN, "present": os.path.exists(CLAUDE_BIN), "permission_mode": CLAUDE_PERMISSION_MODE},
                        "codex": {"bin": CODEX_BIN, "present": os.path.exists(CODEX_BIN), "sandbox": CODEX_SANDBOX}},
            "server_version": SERVER_VERSION}


def t_outbox_read(args):
    entry_id = args.get("id")
    if not isinstance(entry_id, str) or not entry_id:
        raise ToolError("id is required")
    path = outbox_path_for(entry_id)
    if path is None:
        raise ToolError("no outbox entry for id %s under %s" % (entry_id, OUTBOX_DIR))
    with open(path) as fh:
        data = json.load(fh)
    return {"path": path, "entry": data}


def t_outbox_write(args):
    entry_id = args.get("id")
    report = args.get("report")
    if not isinstance(entry_id, str) or not ID_RE.match(entry_id):
        raise ToolError("id must match %s" % ID_RE.pattern)
    if isinstance(report, str):
        try:
            report = json.loads(report)
        except ValueError:
            report = {"summary": report}
    if not isinstance(report, dict):
        raise ToolError("report must be a JSON object (or a string)")
    task = find_task(read_queue(), entry_id)
    path = write_outbox(entry_id, task.get("project") if task else None, report)
    return {"written": path}


def t_git_status(args):
    path = resolve_project_dir(args.get("project"))
    code, top, err = git(path, "rev-parse", "--show-toplevel")
    if code != 0:
        return {"path": path, "is_git_repo": False, "error": err}
    _, branch, _ = git(path, "rev-parse", "--abbrev-ref", "HEAD")
    _, head, _ = git(path, "rev-parse", "--short", "HEAD")
    _, status, _ = git(path, "status", "--short", "--branch")
    _, log, _ = git(path, "log", "--oneline", "-5")
    _, worktrees, _ = git(path, "worktree", "list")
    return {"path": path, "is_git_repo": True, "toplevel": top, "branch": branch, "head": head,
            "status_short": status.splitlines(), "recent_commits": log.splitlines(),
            "worktrees": worktrees.splitlines()}


def t_run_claude(args):
    return launch("claude", args.get("task"), args.get("cwd"), args.get("budget_minutes", 15),
                  background=args.get("background", False))


def t_run_codex(args):
    return launch("codex", args.get("task"), args.get("cwd"), args.get("budget_minutes", 15),
                  background=args.get("background", False))


def compose_task_prompt(task, cwd, worktree, branch):
    lines = ["Partnership desk task %s for project %s." % (task["id"], task.get("project")),
             "Budget: %s minutes. Work only inside %s." % (task.get("budget_minutes"), cwd)]
    if worktree:
        lines.append("You are in an isolated git worktree (%s) on branch %s. Commit your work on that branch; "
                     "do not push, do not merge to main, do not touch other worktrees." % (worktree, branch))
    if task.get("constraints"):
        lines.append("Constraints:")
        lines.extend("- %s" % c for c in task["constraints"])
    if task.get("inputs"):
        lines.append("Inputs:")
        lines.extend("- %s" % i for i in task["inputs"])
    lines.append("Task:")
    lines.append(task["task"])
    lines.append("When finished, state exactly what you changed and what verification you actually ran.")
    return "\n".join(lines)


def t_run_task(args):
    """Claim (if needed), isolate in a worktree, run the assigned worker, finish with accounting."""
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    background = bool(args.get("background", False))
    use_worktree = args.get("use_worktree", True)
    with queue_lock():
        tasks = read_queue()
        target = find_task(tasks, task_id)
        if target is None:
            raise ToolError("no task with id %s" % task_id)
        if target.get("status") == "queued":
            target = claim_locked(tasks, task_id)
        elif target.get("status") == "running":
            if target.get("claimed_by") != SERVER_NAME:
                raise ToolError("task %s is running under %s" % (task_id, target.get("claimed_by")))
            live = any((load_run(f[:-5]) or {}).get("task_id") == task_id and load_run(f[:-5]).get("state") == "running"
                       for f in (os.listdir(RUNS_DIR) if os.path.isdir(RUNS_DIR) else [])
                       if f.endswith(".json") and not f.endswith(".spec.json"))
            if live:
                raise ToolError("task %s already has a live background run" % task_id)
        else:
            raise ToolError("task %s is %s" % (task_id, target.get("status")))
        kind = target.get("assignee")
        if kind not in ("claude", "codex"):
            raise ToolError("assignee %r is not a runnable worker" % kind)
        project_dir = args.get("cwd") or resolve_project_dir(target.get("project"))
        if not os.path.isdir(project_dir):
            raise ToolError("cwd does not exist: %s" % project_dir)
        if use_worktree:
            cwd, worktree, branch = ensure_task_worktree(project_dir, task_id)
        else:
            cwd, worktree, branch = project_dir, None, None
        target["worktree"] = worktree
        target["branch"] = branch
        target["cwd"] = cwd
        write_queue_atomic(tasks)
    prompt = compose_task_prompt(target, cwd, worktree, branch)
    try:
        out = launch(kind, prompt, cwd, target.get("budget_minutes", 15), background=background,
                     task_id=task_id, project=target.get("project"), worktree=worktree, branch=branch)
    except ToolError as exc:
        # launch() raised either a validation error (task still running: block it) or a failed worker
        # (already finished as blocked by run_spec). Distinguish by re-reading the queue.
        current = find_task(read_queue(), task_id)
        if current and current.get("status") == "running":
            finish_task(task_id, "blocked", {"error": str(exc)}, reason="launch failed: %s" % str(exc)[:300])
        raise
    out["task_id"] = task_id
    out["worktree"] = worktree
    out["branch"] = branch
    return out


def t_run_status(args):
    run_id = args.get("id")
    if run_id:
        rec = load_run(run_id)
        if rec is None:
            raise ToolError("no run record for %s" % run_id)
        return {"run": rec}
    recs = []
    if os.path.isdir(RUNS_DIR):
        for f in sorted(os.listdir(RUNS_DIR), reverse=True):
            if f.endswith(".json") and not f.endswith(".spec.json"):
                rec = load_run(f[:-5])
                if rec:
                    recs.append({k: rec.get(k) for k in ("run_id", "kind", "task_id", "state", "pid", "started_at", "finished_at")})
    limit = int(args.get("limit", 20))
    return {"runs": recs[:limit], "runs_dir": RUNS_DIR}


def _s(desc):
    return {"type": "string", "description": desc}


_BUDGET = {"type": "integer", "description": "Hard timeout in minutes (1..policy task_minutes, default cap 15)"}
_BG = {"type": "boolean", "description": "Detach and return a run_id immediately; poll run_status / outbox_read", "default": False}
_REPORT = {"type": ["object", "string"], "description": "Report object, or a JSON/plain string"}
RO = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
RW = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False}
EXEC = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True}

TOOLS = [
    {"name": "queue_list", "fn": t_queue_list, "annotations": RO,
     "description": "List desk queue tasks, optionally filtered by status (queued|running|done|blocked).",
     "inputSchema": {"type": "object", "properties": {"status": _s("Optional status filter")}}},
    {"name": "queue_add", "fn": t_queue_add, "annotations": RW,
     "description": "Append a queued task to the desk queue with schema-conformant defaults.",
     "inputSchema": {"type": "object", "required": ["project", "task", "assignee", "budget_minutes"],
                     "properties": {"project": _s("Project slug from queue.schema.json"),
                                    "task": _s("Task text (<=12000 chars)"),
                                    "assignee": _s("codex or claude"),
                                    "budget_minutes": _BUDGET,
                                    "inputs": {"type": "array", "items": {"type": "string"}},
                                    "constraints": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "queue_claim", "fn": t_queue_claim, "annotations": RW,
     "description": "Mark a queued task running with started_at and deadline; respects policy max_workers.",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task id")}}},
    {"name": "queue_finish", "fn": t_queue_finish, "annotations": RW,
     "description": "Finish a running task as done or blocked with accounting (completed_at, actual_minutes) and an outbox entry.",
     "inputSchema": {"type": "object", "required": ["id", "status"],
                     "properties": {"id": _s("Task id"), "status": {"type": "string", "enum": ["done", "blocked"]},
                                    "reason": _s("Required when blocked"), "report": _REPORT}}},
    {"name": "queue_reap", "fn": t_queue_reap, "annotations": RW,
     "description": "Block running tasks whose deadline passed (plus grace) with no live background runner. "
                    "Only tasks claimed by this server unless all=true.",
     "inputSchema": {"type": "object", "properties": {"all": {"type": "boolean", "default": False},
                                                      "grace_minutes": {"type": "number", "default": REAP_GRACE_MINUTES}}}},
    {"name": "desk_status", "fn": t_desk_status, "annotations": RO,
     "description": "STOP state, queue counts, running tasks with overdue flags, active background runs, policy and worker binaries.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "outbox_read", "fn": t_outbox_read, "annotations": RO,
     "description": "Read the newest outbox entry for a task or run id (files are <date>-<id>.json).",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task or run id")}}},
    {"name": "outbox_write", "fn": t_outbox_write, "annotations": RW,
     "description": "Write an immutable outbox entry {at, id, project, report} for an id.",
     "inputSchema": {"type": "object", "required": ["id", "report"],
                     "properties": {"id": _s("Task or run id"), "report": _REPORT}}},
    {"name": "git_status", "fn": t_git_status, "annotations": RO,
     "description": "Branch, HEAD, short status, last 5 commits and worktrees for a project slug (projects.json) or absolute path.",
     "inputSchema": {"type": "object", "required": ["project"],
                     "properties": {"project": _s("Project slug or absolute path")}}},
    {"name": "run_claude", "fn": t_run_claude, "annotations": EXEC,
     "description": "Run Claude Code non-interactively (-p, permission mode %s) on a task in cwd with a hard "
                    "timeout; captures stdout/stderr and writes an outbox entry." % CLAUDE_PERMISSION_MODE,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"), "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET, "background": _BG}}},
    {"name": "run_codex", "fn": t_run_codex, "annotations": EXEC,
     "description": "Run Codex non-interactively (codex exec, sandbox %s) on a task in cwd with a hard "
                    "timeout; captures stdout/stderr and writes an outbox entry." % CODEX_SANDBOX,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"), "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET, "background": _BG}}},
    {"name": "run_task", "fn": t_run_task, "annotations": EXEC,
     "description": "End to end: claim a queued task, create/reuse .worktrees/task-<id> on branch desk/<id>, run the "
                    "assigned worker with the task budget, write the outbox entry and finish it done or blocked.",
     "inputSchema": {"type": "object", "required": ["id"],
                     "properties": {"id": _s("Task id"), "background": _BG,
                                    "use_worktree": {"type": "boolean", "default": True},
                                    "cwd": _s("Optional absolute directory overriding the project mapping")}}},
    {"name": "run_status", "fn": t_run_status, "annotations": RO,
     "description": "State of one background run (id) or the most recent runs; detects runners that died.",
     "inputSchema": {"type": "object", "properties": {"id": _s("run id"), "limit": {"type": "integer", "default": 20}}}},
]
TOOL_MAP = {t["name"]: t for t in TOOLS}


# --------------------------------------------------------------------------- JSON-RPC over stdio
def send(msg):
    sys.stdout.write(json.dumps(msg, separators=(",", ":"), default=str) + "\n")
    sys.stdout.flush()


def reply(req_id, result):
    send({"jsonrpc": "2.0", "id": req_id, "result": result})


def reply_error(req_id, code, message):
    send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def tool_result(text, is_error=False):
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def call_tool(name, args):
    """Returns (text, is_error). Shared by the stdio server and the tests."""
    tool = TOOL_MAP.get(name)
    if tool is None:
        raise KeyError(name)
    try:
        stop_check()
        out = tool["fn"](args or {})
        return json.dumps(out, indent=2, sort_keys=True, default=str), False
    except ToolError as exc:
        return "%s refused: %s" % (name, exc), True
    except Exception as exc:
        return "%s failed: %s\n%s" % (name, exc, traceback.format_exc()), True


def handle(msg):
    method = msg.get("method") or ""
    req_id = msg.get("id")
    params = msg.get("params") or {}
    if method == "initialize":
        reply(req_id, {"protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION,
                       "capabilities": {"tools": {"listChanged": False}},
                       "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                       "instructions": "Partnership desk tools. All tools refuse while %s exists. "
                                       "Use run_task(id, background=true) for worker runs longer than a minute "
                                       "and poll run_status; results land in the outbox." % STOP_PATH})
    elif method.startswith("notifications/"):
        return
    elif method == "ping":
        reply(req_id, {})
    elif method == "tools/list":
        reply(req_id, {"tools": [{"name": t["name"], "description": t["description"],
                                  "inputSchema": t["inputSchema"], "annotations": t["annotations"]} for t in TOOLS]})
    elif method == "tools/call":
        name = params.get("name")
        try:
            text, is_error = call_tool(name, params.get("arguments"))
        except KeyError:
            reply_error(req_id, -32602, "Unknown tool: %s" % name)
            return
        reply(req_id, tool_result(text, is_error))
    elif method == "resources/list":
        reply(req_id, {"resources": []})
    elif method == "prompts/list":
        reply(req_id, {"prompts": []})
    elif req_id is not None:
        reply_error(req_id, -32601, "Method not found: %s" % method)


def serve():
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except ValueError:
            reply_error(None, -32700, "Parse error")
            continue
        try:
            handle(msg)
        except Exception as exc:
            if msg.get("id") is not None:
                reply_error(msg.get("id"), -32603, "Internal error: %s" % exc)


def runner(spec_path):
    spec = load_json(spec_path, None)
    if spec is None:
        sys.stderr.write("runner: missing spec %s\n" % spec_path)
        return 2
    if stop_present():
        # STOP appeared between dispatch and start: record it and release the task truthfully.
        rec = {"run_id": spec["run_id"], "kind": spec["kind"], "task_id": spec.get("task_id"), "state": "failed",
               "note": "STOP present at runner start", "started_at": iso(), "finished_at": iso(), "background": True}
        save_run(rec)
        if spec.get("task_id"):
            complete_task_from_report(spec["task_id"], {"status": "failed", "error": "STOP present at runner start",
                                                        "run_id": spec["run_id"], "kind": spec["kind"]})
        return 3
    report = run_spec(spec)
    return 0 if report["status"] == "done" else 1


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--runner":
        sys.exit(runner(sys.argv[2]))
    serve()
