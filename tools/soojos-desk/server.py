#!/usr/bin/env python3
"""soojos-desk: a minimal MCP server (stdio, JSON-RPC 2.0, Python stdlib only).

Tools
  read-only : desk_status, queue_list, outbox_read, git_status, run_status
  queue     : queue_add, queue_claim, queue_finish, desk_tick, outbox_write
  workers   : run_claude, run_codex, run_task

Every tool refuses when ~/.soojos/STOP exists (a dangling symlink counts).

Queue admission and completion are delegated to the canonical Desk class in the
approved harness (policy.json "code_root"/scripts/desk_core.py): enqueue
validation, claim admission (max_workers, finance, pauses), done validation
(verification, evidence, known cash, minutes within budget, before deadline),
blocked accounting, the immutable {task_id, project, at, report} outbox packet
and tick recovery. This server does not keep a second lifecycle schema. If the
canonical code is unavailable the mutating tools refuse; read-only tools work.

Workers run non-interactively with full binary paths and a hard timeout that is
the smaller of the budget and the persisted task deadline minus a closure
reserve. A run identity is reserved exclusively under the desk lock before any
launch, so one task cannot be launched twice. Zero incremental cash is only
recorded when native subscription auth and fresh usage-credit evidence (same
rule as the canonical worker) are verified before launch; otherwise the launch
is refused and the task is blocked with the reason.

Background runs: `server.py --runner <spec.json>` is the detached runner the
server spawns in its own session; it survives the MCP client exiting.
"""
import datetime as _dt
import importlib
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path

SERVER_NAME = "soojos-desk"
SERVER_VERSION = "0.3.0"
PROTOCOL_VERSION = "2025-06-18"
MINUTE = float(os.environ.get("SOOJOS_MINUTE_SECONDS", "60"))  # tests shrink this to exercise timeouts quickly

HERE = os.path.dirname(os.path.abspath(__file__))
SOOJOS_ROOT = "/Users/sayuj/soojos"
SOOJOS_HOME = os.environ.get("SOOJOS_HOME", os.path.expanduser("~/.soojos"))
DESK_DIR = os.environ.get("SOOJOS_DESK_DIR", os.path.join(SOOJOS_ROOT, "context", "desk"))
PRIVATE_DIR = os.path.join(SOOJOS_HOME, "desk")
STOP_PATH = os.path.join(SOOJOS_HOME, "STOP")
RUNS_DIR = os.path.join(PRIVATE_DIR, "runs")
QUEUE_PATH = os.path.join(DESK_DIR, "queue.jsonl")
POLICY_PATH = os.path.join(DESK_DIR, "policy.json")
BILLING_PATHS = {"claude": os.path.join(PRIVATE_DIR, "subscription-billing.json"),   # canonical private evidence
                 "codex": os.path.join(PRIVATE_DIR, "codex-billing.json")}            # same shape, this server's addition
OUTBOX_DIR = os.path.join(DESK_DIR, "outbox")
PROJECTS_PATH = os.path.join(HERE, "projects.json")

CLAUDE_BIN = os.environ.get("SOOJOS_CLAUDE_BIN", "/Users/sayuj/.local/bin/claude")
CODEX_BIN = os.environ.get("SOOJOS_CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex")
GIT_BIN = "/usr/bin/git"
CLAUDE_PERMISSION_MODE = os.environ.get("SOOJOS_CLAUDE_PERMISSION_MODE", "acceptEdits")
# Local git only, so a worker can commit on its task branch; no push, no other commands.
CLAUDE_ALLOWED_TOOLS = os.environ.get(
    "SOOJOS_CLAUDE_ALLOWED_TOOLS",
    "Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(git add:*) Bash(git commit:*) Bash(git branch:*)")
CODEX_SANDBOX = os.environ.get("SOOJOS_CODEX_SANDBOX", "workspace-write")

MAX_RETURN_CHARS = 20000     # per stream in the tool result
MAX_OUTBOX_CHARS = 200000    # per stream in the outbox file
CLOSURE_FRACTION = 0.2       # share of the budget kept back for completion accounting
CLOSURE_MAX_SECONDS = 180.0
RESERVATION_TTL_SECONDS = 600.0   # a reservation that never started is stale after this
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
UUID_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")


class ToolError(Exception):
    pass


# --------------------------------------------------------------------------- basics
def now_utc():
    return _dt.datetime.now(_dt.timezone.utc)


def iso(ts=None):
    return (ts or now_utc()).isoformat()


def parse_iso(text):
    try:
        value = _dt.datetime.fromisoformat(str(text).replace("Z", "+00:00"))
        return value if value.tzinfo is not None else None
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


def slugify(text, limit=40):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:limit].strip("-") or "task"


def check_budget(budget_minutes):
    if isinstance(budget_minutes, bool):
        raise ToolError("budget_minutes must be an integer")
    try:
        budget = int(budget_minutes)
    except (TypeError, ValueError):
        raise ToolError("budget_minutes must be an integer")
    cap = int(policy().get("task_minutes", 15))
    if budget < 1 or budget > cap:
        raise ToolError("budget_minutes must be between 1 and %d (policy task_minutes)" % cap)
    return budget


def clip(text, limit):
    text = text or ""
    if len(text) <= limit:
        return text
    return text[:limit // 2] + "\n...[%d chars omitted]...\n" % (len(text) - limit) + text[-limit // 2:]


# --------------------------------------------------------------------------- canonical desk
_MODULES = {}


def desk_modules():
    """Import desk_core/desk_worker from the approved harness named in policy.json. Cached."""
    if "core" in _MODULES:
        return _MODULES
    code_root = policy().get("code_root")
    if not code_root:
        raise ToolError("policy.json has no code_root; canonical desk unavailable, mutating tools refused")
    scripts = os.path.join(code_root, "scripts")
    if not os.path.isfile(os.path.join(scripts, "desk_core.py")):
        raise ToolError("canonical desk_core.py not found under %s; mutating tools refused" % scripts)
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    try:
        core = importlib.import_module("desk_core")
        worker = importlib.import_module("desk_worker")
    except Exception as exc:
        raise ToolError("cannot import canonical desk modules from %s: %s" % (scripts, exc))
    _MODULES.update(core=core, worker=worker, scripts=scripts)
    return _MODULES


def desk():
    core = desk_modules()["core"]
    return core.Desk(DESK_DIR, PRIVATE_DIR, STOP_PATH)


def desk_call(fn, *args, **kwargs):
    """Run a canonical Desk method, converting its refusal into a tool refusal."""
    core = desk_modules()["core"]
    try:
        return fn(*args, **kwargs)
    except core.DeskError as exc:
        raise ToolError("desk refused: %s" % exc)


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


def find_task(tasks, task_id):
    return next((t for t in tasks if t.get("id") == task_id), None)


def current_task(task_id):
    task = find_task(read_queue(), task_id)
    if task is None:
        raise ToolError("no task with id %s" % task_id)
    return task


# --------------------------------------------------------------------------- outbox (run records only)
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


def write_outbox(entry_id, project, report, task_id=None):
    """Immutable note for a run id or free id. Task completion packets are written only by
    the canonical Desk (finish/block); this never writes a packet a task would recover from."""
    os.makedirs(OUTBOX_DIR, exist_ok=True)
    stamp = now_utc()
    path = os.path.join(OUTBOX_DIR, "%s-%s.json" % (stamp.strftime("%Y-%m-%d"), entry_id))
    if os.path.exists(path):
        path = os.path.join(OUTBOX_DIR, "%s-%s-%s.json" % (stamp.strftime("%Y-%m-%d"), entry_id,
                                                          stamp.strftime("%H%M%S")))
    payload = {"at": iso(stamp), "id": entry_id, "task_id": task_id, "project": project, "report": report,
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


def git_snapshot(path):
    """Facts a completion report can cite: HEAD, branch, dirtiness."""
    if not path or git_toplevel(path) is None:
        return None
    _, head, _ = git(path, "rev-parse", "HEAD")
    _, branch, _ = git(path, "rev-parse", "--abbrev-ref", "HEAD")
    _, status, _ = git(path, "status", "--short")
    return {"head": head, "branch": branch, "dirty_paths": len(status.splitlines())}


# --------------------------------------------------------------------------- zero-cash evidence
def zero_cash_evidence(kind, cwd):
    """Same rule as the canonical worker: native subscription auth now, plus usage-credit-disabled
    evidence less than an hour old in worker-capabilities.json. Anything else is unknown cash."""
    mods = desk_modules()
    evidence = load_json(BILLING_PATHS[kind], {})
    checked_at = iso()
    if kind == "claude":
        auth = mods["worker"].subscription_auth(CLAUDE_BIN, Path(cwd), Path(STOP_PATH))
        reason = None if auth.get("subscription_verified") else (auth.get("reason") or "subscription not verified")
        if reason is None:
            reason = mods["worker"]._billing_evidence_reason({"subscription_billing": evidence})
        if reason is None and auth.get("org_id") != evidence.get("org_id"):
            reason = "Usage-credit evidence organization does not match the authenticated organization"
        detail = {"metadata": auth.get("metadata"), "org_id": auth.get("org_id")}
    else:
        try:
            r = subprocess.run([CODEX_BIN, "login", "status"], capture_output=True, text=True, timeout=10, cwd=cwd)
            text = (r.stdout + r.stderr).strip()
        except (OSError, subprocess.TimeoutExpired) as exc:
            r, text = None, "%s" % exc
        logged_in = r is not None and r.returncode == 0 and "Logged in using ChatGPT" in text
        reason = None if logged_in else "Codex is not logged in with a ChatGPT subscription (%s)" % clip(text, 200)
        if reason is None:
            reason = mods["worker"]._billing_evidence_reason({"subscription_billing": evidence})
            if reason:
                reason = "codex-billing.json: " + reason
        detail = {"login_status": clip(text, 200)}
    return {"zero_cash": reason is None, "reason": reason, "checked_at": checked_at, "kind": kind, "detail": detail}


# --------------------------------------------------------------------------- run records
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
    if rec is None:
        return None
    if rec.get("state") == "running" and not pid_alive(rec.get("pid")):
        rec["state"] = "lost"
        rec["note"] = "runner process is gone without a final record"
        save_run(rec)
    elif rec.get("state") == "reserved":
        reserved = parse_iso(rec.get("reserved_at"))
        stale = reserved is None or (now_utc() - reserved).total_seconds() > RESERVATION_TTL_SECONDS
        if stale or not pid_alive(rec.get("pid")):
            rec["state"] = "lost"
            rec["note"] = "reservation never started"
            save_run(rec)
    return rec


def all_runs():
    if not os.path.isdir(RUNS_DIR):
        return []
    out = []
    for f in sorted(os.listdir(RUNS_DIR), reverse=True):
        if f.endswith(".json") and not f.endswith(".spec.json"):
            rec = load_run(f[:-5])
            if rec:
                out.append(rec)
    return out


def live_run_for(task_id):
    return next((r for r in all_runs() if r.get("task_id") == task_id and r.get("state") in ("reserved", "running")), None)


def reserve_run(kind, task_id=None, project=None):
    """Exclusive creation of a run record; collision-resistant id; never replaces another run."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    for _ in range(20):
        run_id = "run-%s-%s-%s" % (kind, now_utc().strftime("%Y%m%d-%H%M%S"), secrets.token_hex(4))
        path = run_record_path(run_id)
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            continue
        record = {"run_id": run_id, "kind": kind, "task_id": task_id, "project": project, "state": "reserved",
                  "reserved_at": iso(), "pid": os.getpid()}
        with os.fdopen(fd, "w") as fh:
            json.dump(record, fh, indent=2, sort_keys=True)
            fh.write("\n")
        return record
    raise ToolError("could not reserve a unique run id")


def fail_run(record, reason):
    record.update(state="failed", note=reason, finished_at=iso())
    save_run(record)


# --------------------------------------------------------------------------- workers
def worker_command(kind, task, cwd, last_msg_file):
    if kind == "claude":
        if not os.path.exists(CLAUDE_BIN):
            raise ToolError("claude binary missing at %s" % CLAUDE_BIN)
        cmd = [CLAUDE_BIN, "-p", task, "--output-format", "json",
               "--permission-mode", CLAUDE_PERMISSION_MODE, "--no-session-persistence"]
        if CLAUDE_ALLOWED_TOOLS.strip():
            cmd += ["--allowedTools", CLAUDE_ALLOWED_TOOLS]
        return cmd
    if kind == "codex":
        if not os.path.exists(CODEX_BIN):
            raise ToolError("codex binary missing at %s" % CODEX_BIN)
        return [CODEX_BIN, "exec", "--sandbox", CODEX_SANDBOX, "--skip-git-repo-check", "--ephemeral",
                "-C", cwd, "-o", last_msg_file, task]
    raise ToolError("unknown worker kind %r" % kind)


def closure_seconds(budget_minutes):
    return min(CLOSURE_MAX_SECONDS, budget_minutes * MINUTE * CLOSURE_FRACTION)


def remaining_seconds(task):
    """Seconds a worker may still use before the persisted deadline, keeping the closure reserve."""
    deadline = parse_iso(task.get("deadline"))
    if deadline is None:
        raise ToolError("task %s has no valid timezone-aware deadline" % task.get("id"))
    budget = int(task.get("budget_minutes", 15))
    return (deadline - now_utc()).total_seconds() - closure_seconds(budget)


def run_bounded(cmd, cwd, timeout_seconds):
    """Run cmd in its own process group; kill the whole group on timeout."""
    started = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        out, err = proc.communicate(timeout=timeout_seconds)
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


def parse_claude_output(report, stdout):
    try:
        parsed = json.loads(stdout)
    except ValueError:
        report["result"] = None
        return
    if not isinstance(parsed, dict):
        report["result"] = None
        return
    report["result"] = parsed.get("result")
    for key in ("total_cost_usd", "usage", "num_turns", "duration_ms", "is_error", "session_id", "subtype",
                "permission_denials"):
        if key in parsed:
            report[key] = parsed[key]
    usage = parsed.get("usage") or {}
    total = 0
    known = False
    for key in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"):
        v = usage.get(key)
        if type(v) is int and v >= 0:
            total += v
            known = True
    report["actual_tokens"] = total if known else None


def parse_codex_output(report, stderr, last_msg_file):
    try:
        with open(last_msg_file) as fh:
            report["result"] = fh.read()
    except OSError:
        report["result"] = None
    m = re.search(r"tokens used\s+([\d,]+)", stderr or "")
    report["actual_tokens"] = int(m.group(1).replace(",", "")) if m else None


def execute_worker(spec, timeout_seconds):
    """Synchronously run a worker and write its run outbox note. Returns the full report."""
    kind, task, cwd = spec["kind"], spec["task"], spec["cwd"]
    last_msg_file = None
    report = {"kind": kind, "task": task, "cwd": cwd, "budget_minutes": spec["budget_minutes"],
              "timeout_seconds": round(timeout_seconds, 2), "run_id": spec["run_id"], "task_id": spec.get("task_id"),
              "project": spec.get("project"), "worktree": spec.get("worktree"), "branch": spec.get("branch"),
              "started_at": iso(), "status": "failed", "actual_tokens": None}
    try:
        if kind == "codex":
            fd, last_msg_file = tempfile.mkstemp(prefix="codex-last-", suffix=".txt")
            os.close(fd)
        cmd = worker_command(kind, task, cwd, last_msg_file)
        report["command"] = cmd
        report["git_before"] = git_snapshot(cwd)
        res = run_bounded(cmd, cwd, timeout_seconds)
        report.update(res)
        if kind == "claude":
            parse_claude_output(report, res["stdout"])
        else:
            parse_codex_output(report, res["stderr"], last_msg_file)
        report["git_after"] = git_snapshot(cwd)
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
    note = dict(report)
    note["stdout"] = clip(report.get("stdout", ""), MAX_OUTBOX_CHARS)
    note["stderr"] = clip(report.get("stderr", ""), MAX_OUTBOX_CHARS)
    report["outbox_file"] = write_outbox(spec["run_id"], spec.get("project"), note, task_id=spec.get("task_id"))
    return report


def trimmed(report):
    result = dict(report)
    result["stdout"] = clip(report.get("stdout", ""), MAX_RETURN_CHARS)
    result["stderr"] = clip(report.get("stderr", ""), MAX_RETURN_CHARS)
    return result


def blocked_fields(reason, run_id, kind, status):
    return {"reason": reason,
            "attempts": ["%s worker run %s ended %s" % (kind, run_id, status)],
            "alternatives_checked": ["No alternative within this task's allocation"],
            "next_attempt": "Inspect outbox run %s and the task worktree; requeue explicitly only if justified" % run_id}


def accounting_for(task, report, spec):
    """Blocked accounting the canonical desk accepts: known zero cash only with verified subscription."""
    started = parse_iso(task.get("started_at"))
    minutes = round((now_utc() - started).total_seconds() / 60.0, 4) if started else None
    acc = {"actual_minutes": minutes, "actual_tokens": report.get("actual_tokens")}
    if spec.get("zero_cash") and not task.get("budget_aud"):
        acc["actual_cost_aud"] = 0
        acc["billing_mode"] = "existing_subscription"
    return acc, minutes


def complete_task_from_report(spec, report):
    """Map a worker report onto the canonical completion API. Never raises."""
    task_id, run_id, kind = spec["task_id"], spec["run_id"], spec["kind"]
    try:
        d = desk()
        core = desk_modules()["core"]
        task = current_task(task_id)
        acc, minutes = accounting_for(task, report, spec)
        after = report.get("git_after") or {}
        before = report.get("git_before") or {}
        if report.get("status") == "done":
            verification = ("%s exited 0 in %ss within a %ss timeout; worktree HEAD %s on %s (was %s); %d uncommitted path(s); "
                            "no tests were run by soojos-desk itself"
                            % (kind, report.get("elapsed_seconds"), report.get("timeout_seconds"), after.get("head"),
                               after.get("branch"), before.get("head"), after.get("dirty_paths") or 0))
            evidence = [report.get("outbox_file"), spec.get("worktree") or spec.get("cwd"),
                        "HEAD %s" % after.get("head") if after.get("head") else "no git snapshot"]
            done = {"status": "done", "summary": clip(report.get("result") or "", 4000), "verification": verification,
                    "evidence": [e for e in evidence if e], "actual_minutes": minutes,
                    "actual_tokens": report.get("actual_tokens"), "actual_cost_aud": acc.get("actual_cost_aud"),
                    "billing_mode": acc.get("billing_mode"), "run_id": run_id}
            try:
                return {"status": "done", "task": desk_call(d.finish, task_id, done)}
            except ToolError as exc:
                reason = "worker finished but completion was refused: %s" % exc
                fields = blocked_fields(reason, run_id, kind, "done")
        else:
            reason = "worker %s: %s" % (report.get("status"), report.get("error") or "exit %s" % report.get("exit_code"))
            fields = blocked_fields(reason, run_id, kind, report.get("status"))
        blocked = desk_call(d.block, task_id, fields["reason"], fields["attempts"], fields["alternatives_checked"],
                            fields["next_attempt"], acc)
        return {"status": "blocked", "task": blocked}
    except Exception as exc:
        return {"status": "error", "error": "%s: %s" % (type(exc).__name__, exc)}


def run_spec(spec, record):
    """Shared by the foreground path and the detached runner. record is the reserved run record."""
    record.update(state="running", pid=os.getpid(), started_at=iso(), cwd=spec["cwd"],
                  budget_minutes=spec["budget_minutes"], background=spec.get("background", False))
    save_run(record)
    timeout = spec["budget_minutes"] * MINUTE
    if spec.get("task_id"):
        try:
            task = current_task(spec["task_id"])
            remaining = remaining_seconds(task)
        except ToolError as exc:
            remaining, task = -1, None
            spec["deadline_error"] = str(exc)
        if remaining <= 0:
            report = {"kind": spec["kind"], "run_id": spec["run_id"], "task_id": spec["task_id"], "status": "failed",
                      "error": spec.get("deadline_error") or "task deadline reached before launch (closure reserve kept)",
                      "started_at": iso(), "finished_at": iso(), "actual_tokens": None, "stdout": "", "stderr": ""}
            report["outbox_file"] = write_outbox(spec["run_id"], spec.get("project"), report, task_id=spec["task_id"])
            report["queue"] = complete_task_from_report(spec, report)
            record.update(state="failed", finished_at=report["finished_at"], note=report["error"], queue=report["queue"])
            save_run(record)
            return report
        timeout = min(timeout, remaining)
    report = execute_worker(spec, timeout)
    if spec.get("task_id"):
        report["queue"] = complete_task_from_report(spec, report)
    record.update(state=report["status"], finished_at=report["finished_at"], exit_code=report.get("exit_code"),
                  timed_out=report.get("timed_out"), outbox_file=report.get("outbox_file"),
                  result=clip(report.get("result") or "", 4000), queue=report.get("queue"),
                  actual_tokens=report.get("actual_tokens"))
    save_run(record)
    return report


def spawn_background(spec, record):
    spec_path = os.path.join(RUNS_DIR, spec["run_id"] + ".spec.json")
    fd = os.open(spec_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)  # never replace another run's spec
    with os.fdopen(fd, "w") as fh:
        json.dump(spec, fh, indent=2, sort_keys=True)
    log_path = os.path.join(RUNS_DIR, spec["run_id"] + ".log")
    with open(log_path, "ab") as log:
        proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--runner", spec_path],
                                stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True,
                                cwd=spec["cwd"])
    record.update(state="running", pid=proc.pid, started_at=iso(), background=True, log=log_path, cwd=spec["cwd"],
                  budget_minutes=spec["budget_minutes"])
    save_run(record)
    return record


def launch(kind, task, cwd, budget_minutes, background=False, task_id=None, project=None, worktree=None,
           branch=None, record=None):
    """Validate, verify zero cash, reserve (if not already reserved), and run or detach."""
    if not isinstance(task, str) or not task.strip():
        raise ToolError("task must be a non-empty string")
    if not isinstance(cwd, str) or not os.path.isabs(cwd) or not os.path.isdir(cwd):
        raise ToolError("cwd must be an existing absolute directory")
    budget = check_budget(budget_minutes)
    worker_command(kind, "probe", cwd, "/dev/null")  # validates kind and binary presence early
    cash = zero_cash_evidence(kind, cwd)
    if not cash["zero_cash"]:
        raise ToolError("zero incremental cash not established for %s; launch refused: %s" % (kind, cash["reason"]))
    if record is None:
        record = reserve_run(kind, task_id, project)
    spec = {"run_id": record["run_id"], "kind": kind, "task": task, "cwd": cwd, "budget_minutes": budget,
            "task_id": task_id, "project": project, "worktree": worktree, "branch": branch,
            "background": bool(background), "zero_cash": True, "cash_evidence": cash}
    if background:
        rec = spawn_background(spec, record)
        return {"run_id": rec["run_id"], "state": "running", "pid": rec["pid"], "background": True,
                "poll": "run_status(id=%s); outbox_read(id=%s) when finished" % (rec["run_id"], rec["run_id"])}
    report = trimmed(run_spec(spec, record))
    if report["status"] != "done":
        raise ToolError(json.dumps(report, indent=2, sort_keys=True, default=str))
    return report


# --------------------------------------------------------------------------- tools
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
                            "deadline": t.get("deadline"), "overdue": bool(deadline and now > deadline)})
    live = [{k: r.get(k) for k in ("run_id", "kind", "task_id", "state", "pid", "started_at", "reserved_at")}
            for r in all_runs() if r.get("state") in ("reserved", "running", "lost")]
    pol = policy()
    try:
        desk_modules()
        canonical = {"available": True, "scripts": _MODULES["scripts"]}
    except ToolError as exc:
        canonical = {"available": False, "reason": str(exc)}
    billing = {}
    for kind, path in BILLING_PATHS.items():
        ev = load_json(path, {})
        verified = parse_iso(ev.get("verified_at")) if ev else None
        age = (now - verified).total_seconds() if verified else None
        billing[kind] = {"path": path, "present": bool(ev), "verified_at": ev.get("verified_at"),
                         "usage_credits_disabled": ev.get("usage_credits_disabled"),
                         "fresh_within_hour": bool(age is not None and 0 <= age <= 3600)}
    return {"stop_present": stop_present(), "stop_path": STOP_PATH, "desk_dir": DESK_DIR, "queue_counts": counts,
            "running": running, "runs": live, "canonical_desk": canonical, "billing_evidence": billing,
            "policy": {k: pol.get(k) for k in ("version", "task_minutes", "max_workers", "max_chain_depth", "token_mode", "code_root")},
            "workers": {"claude": {"bin": CLAUDE_BIN, "present": os.path.exists(CLAUDE_BIN),
                                   "permission_mode": CLAUDE_PERMISSION_MODE, "allowed_tools": CLAUDE_ALLOWED_TOOLS},
                        "codex": {"bin": CODEX_BIN, "present": os.path.exists(CODEX_BIN), "sandbox": CODEX_SANDBOX}},
            "server_version": SERVER_VERSION}


def t_queue_list(args):
    status = args.get("status")
    tasks = read_queue()
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    keys = ("id", "project", "assignee", "status", "budget_minutes", "created_at", "deadline", "action_kind", "task")
    summary = [{k: t.get(k) for k in keys if k in t} for t in tasks]
    for s in summary:
        if isinstance(s.get("task"), str) and len(s["task"]) > 200:
            s["task"] = s["task"][:200] + "..."
    return {"queue_path": QUEUE_PATH, "count": len(summary), "tasks": summary}


def t_queue_add(args):
    core = desk_modules()["core"]
    project, task, assignee = args.get("project"), args.get("task"), args.get("assignee")
    budget = check_budget(args.get("budget_minutes", 15))
    if not isinstance(task, str) or not task.strip():
        raise ToolError("task must be a non-empty string")
    if assignee not in ("codex", "claude"):
        raise ToolError("assignee must be codex or claude")
    stamp = now_utc()
    task_id = "%s-%s-%s" % (stamp.strftime("%Y%m%d-%H%M%S"), assignee, slugify(task))
    entry = core.make_task(task_id, project, task, assignee=assignee, budget_tokens=None)
    entry["budget_minutes"] = budget
    entry["inputs"] = list(args.get("inputs") or [])
    entry["constraints"] = list(args.get("constraints") or entry["constraints"])
    entry["action_kind"] = args.get("action_kind", "research")
    entry["priority"] = {"rank": 1, "reason": "Queued via %s" % SERVER_NAME}
    stored = desk_call(desk().enqueue, entry)  # canonical validation: scope, budgets, branch, ancestry
    return {"added": stored, "queue_path": QUEUE_PATH}


def t_queue_claim(args):
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    task = current_task(task_id)
    claimed = desk_call(desk().claim, task_id, task.get("assignee"))
    return {"claimed": claimed}


def t_queue_finish(args):
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    status = args.get("status")
    report = args.get("report") or {}
    if isinstance(report, str):
        try:
            report = json.loads(report)
        except ValueError:
            report = {"summary": report}
    if not isinstance(report, dict):
        raise ToolError("report must be a JSON object")
    d = desk()
    task = current_task(task_id)
    if status == "done":
        done = dict(report)
        done["status"] = "done"
        if done.get("actual_minutes") is None:
            started = parse_iso(task.get("started_at"))
            done["actual_minutes"] = round((now_utc() - started).total_seconds() / 60.0, 4) if started else None
        done.setdefault("actual_tokens", None)
        done.setdefault("actual_cost_aud", None)  # unknown stays unknown; the desk refuses done without it
        return {"finished": desk_call(d.finish, task_id, done)}
    if status == "blocked":
        reason = args.get("reason") or report.get("reason")
        if not reason:
            raise ToolError("blocked requires a reason")
        attempts = report.get("attempts") or [reason]
        alternatives = report.get("alternatives_checked") or ["None recorded"]
        next_attempt = report.get("next_attempt") or "Explicit reconsideration required before any retry"
        accounting = report.get("accounting")
        return {"finished": desk_call(d.block, task_id, reason, attempts, alternatives, next_attempt, accounting)}
    raise ToolError("status must be done or blocked")


def t_desk_tick(args):
    """Canonical recovery: apply persisted completions, block overdue running tasks with desk accounting."""
    snap = desk_call(desk().tick)
    tasks = snap.get("tasks", []) if isinstance(snap, dict) else []
    counts = {}
    for t in tasks:
        counts[t.get("status", "?")] = counts.get(t.get("status", "?"), 0) + 1
    return {"queue_counts": counts,
            "blocked": [{"id": t["id"], "reason": t.get("blocked_reason")} for t in tasks if t.get("status") == "blocked"][-10:],
            "pauses": snap.get("pauses") if isinstance(snap, dict) else None,
            "lost_runs": [r["run_id"] for r in all_runs() if r.get("state") == "lost"]}


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
    """Free-form note. Refuses ids that name a queue task: task packets belong to the canonical desk."""
    entry_id = args.get("id")
    report = args.get("report")
    if not isinstance(entry_id, str) or not ID_RE.match(entry_id):
        raise ToolError("id must match %s" % ID_RE.pattern)
    if find_task(read_queue(), entry_id):
        raise ToolError("%s is a queue task id; use queue_finish so the canonical desk writes its packet" % entry_id)
    if isinstance(report, str):
        try:
            report = json.loads(report)
        except ValueError:
            report = {"summary": report}
    if not isinstance(report, dict):
        raise ToolError("report must be a JSON object (or a string)")
    return {"written": write_outbox(entry_id, None, report)}


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
    """Claim (if queued), reserve one run identity under the desk lock, isolate in a worktree,
    check the persisted deadline, verify zero cash, run the assignee, complete through the desk."""
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    background = bool(args.get("background", False))
    use_worktree = args.get("use_worktree", True)
    d = desk()
    task = current_task(task_id)
    kind = task.get("assignee")
    if kind not in ("claude", "codex"):
        raise ToolError("assignee %r is not a runnable worker" % kind)
    if task.get("status") == "queued":
        task = desk_call(d.claim, task_id, kind)  # canonical admission; only one caller can win this
    elif task.get("status") != "running":
        raise ToolError("task %s is %s" % (task_id, task.get("status")))
    # Exclusive run reservation under the same lock the desk uses, so two callers that both
    # observe a running task without a live run cannot both launch.
    core = desk_modules()["core"]
    try:
        with d.locked():
            live = live_run_for(task_id)
            if live:
                raise ToolError("task %s already has a live run: %s" % (task_id, live["run_id"]))
            record = reserve_run(kind, task_id, task.get("project"))
    except core.DeskError as exc:
        raise ToolError("desk refused: %s" % exc)
    try:
        remaining = remaining_seconds(task)
        if remaining <= 0:
            raise ToolError("task %s deadline %s reached (closure reserve %ss kept); not launching"
                            % (task_id, task.get("deadline"), int(closure_seconds(int(task.get("budget_minutes", 15))))))
        project_dir = args.get("cwd") or resolve_project_dir(task.get("project"))
        if not os.path.isdir(project_dir):
            raise ToolError("cwd does not exist: %s" % project_dir)
        if use_worktree:
            cwd, worktree, branch = ensure_task_worktree(project_dir, task_id)
        else:
            cwd, worktree, branch = project_dir, None, None
        prompt = compose_task_prompt(task, cwd, worktree, branch)
        out = launch(kind, prompt, cwd, task.get("budget_minutes", 15), background=background, task_id=task_id,
                     project=task.get("project"), worktree=worktree, branch=branch, record=record)
    except ToolError as exc:
        # Pre-launch refusal (deadline, worktree, cash) or a failed foreground worker. A failed worker
        # has already been completed through the desk by run_spec; a pre-launch refusal has not.
        rec = load_run(record["run_id"]) or record
        if rec.get("state") == "reserved":
            fail_run(rec, str(exc)[:500])
            fields = blocked_fields("launch refused: %s" % str(exc)[:400], record["run_id"], kind, "not launched")
            try:
                desk_call(d.block, task_id, fields["reason"], fields["attempts"], fields["alternatives_checked"],
                          fields["next_attempt"], None)
            except ToolError as block_exc:
                raise ToolError("%s; additionally the desk refused to block the task: %s" % (exc, block_exc))
        raise
    out["task_id"] = task_id
    out["worktree"] = worktree
    out["branch"] = branch
    out["run_id"] = record["run_id"]
    return out


def t_run_status(args):
    run_id = args.get("id")
    if run_id:
        rec = load_run(run_id)
        if rec is None:
            raise ToolError("no run record for %s" % run_id)
        return {"run": rec}
    limit = int(args.get("limit", 20))
    keys = ("run_id", "kind", "task_id", "state", "pid", "reserved_at", "started_at", "finished_at")
    return {"runs": [{k: r.get(k) for k in keys} for r in all_runs()[:limit]], "runs_dir": RUNS_DIR}


def _s(desc):
    return {"type": "string", "description": desc}


_BUDGET = {"type": "integer", "description": "Hard timeout in minutes (1..policy task_minutes, default cap 15)"}
_BG = {"type": "boolean", "description": "Detach and return a run_id immediately; poll run_status / outbox_read", "default": False}
_REPORT = {"type": ["object", "string"], "description": "Report object, or a JSON/plain string"}
RO = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
RW = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False}
EXEC = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True}

TOOLS = [
    {"name": "desk_status", "fn": t_desk_status, "annotations": RO,
     "description": "STOP state, queue counts, running tasks with overdue flags, live/lost runs, canonical desk "
                    "availability, billing evidence freshness, policy and worker binaries.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "queue_list", "fn": t_queue_list, "annotations": RO,
     "description": "List desk queue tasks, optionally filtered by status (queued|running|done|blocked).",
     "inputSchema": {"type": "object", "properties": {"status": _s("Optional status filter")}}},
    {"name": "queue_add", "fn": t_queue_add, "annotations": RW,
     "description": "Enqueue a task through the canonical desk (scope, budget, branch and ancestry validation).",
     "inputSchema": {"type": "object", "required": ["project", "task", "assignee", "budget_minutes"],
                     "properties": {"project": _s("Approved project slug from policy.json"),
                                    "task": _s("Task text (<=12000 chars)"),
                                    "assignee": _s("codex or claude"),
                                    "budget_minutes": _BUDGET,
                                    "action_kind": {"type": "string", "enum": ["research", "analysis", "code", "verify", "harness", "retro"], "default": "research"},
                                    "inputs": {"type": "array", "items": {"type": "string"}},
                                    "constraints": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "queue_claim", "fn": t_queue_claim, "annotations": RW,
     "description": "Canonical claim: queued -> running with started_at/deadline; refuses on max_workers, finance "
                    "pauses, pending completion, STOP.",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task id")}}},
    {"name": "queue_finish", "fn": t_queue_finish, "annotations": RW,
     "description": "Canonical completion. done needs report.verification, report.evidence, known actual_cost_aud "
                    "and in-budget actual_minutes before the deadline; blocked needs reason (attempts, "
                    "alternatives_checked, next_attempt, accounting optional).",
     "inputSchema": {"type": "object", "required": ["id", "status"],
                     "properties": {"id": _s("Task id"), "status": {"type": "string", "enum": ["done", "blocked"]},
                                    "reason": _s("Required when blocked"), "report": _REPORT}}},
    {"name": "desk_tick", "fn": t_desk_tick, "annotations": RW,
     "description": "Canonical recovery: apply persisted completion packets and block running tasks past their "
                    "deadline with desk accounting; also reports lost runs.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "outbox_read", "fn": t_outbox_read, "annotations": RO,
     "description": "Read the newest outbox entry for a task or run id (files are <date>-<id>.json).",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task or run id")}}},
    {"name": "outbox_write", "fn": t_outbox_write, "annotations": RW,
     "description": "Write an immutable free-form outbox note for a non-task id (task packets come from queue_finish).",
     "inputSchema": {"type": "object", "required": ["id", "report"],
                     "properties": {"id": _s("Note id (not a queue task id)"), "report": _REPORT}}},
    {"name": "git_status", "fn": t_git_status, "annotations": RO,
     "description": "Branch, HEAD, short status, last 5 commits and worktrees for a project slug (projects.json) or absolute path.",
     "inputSchema": {"type": "object", "required": ["project"],
                     "properties": {"project": _s("Project slug or absolute path")}}},
    {"name": "run_claude", "fn": t_run_claude, "annotations": EXEC,
     "description": "Run Claude Code non-interactively (-p, permission mode %s) on a task in cwd with a hard timeout; "
                    "requires verified zero-cash subscription evidence; writes a run outbox note." % CLAUDE_PERMISSION_MODE,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"), "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET, "background": _BG}}},
    {"name": "run_codex", "fn": t_run_codex, "annotations": EXEC,
     "description": "Run Codex non-interactively (codex exec, sandbox %s) on a task in cwd with a hard timeout; "
                    "requires verified zero-cash subscription evidence; writes a run outbox note." % CODEX_SANDBOX,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"), "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET, "background": _BG}}},
    {"name": "run_task", "fn": t_run_task, "annotations": EXEC,
     "description": "End to end through the canonical desk: claim, exclusive run reservation, .worktrees/task-<id> on "
                    "desk/<id>, deadline check with closure reserve, zero-cash check, run the assignee, finish done "
                    "or blocked with desk accounting.",
     "inputSchema": {"type": "object", "required": ["id"],
                     "properties": {"id": _s("Task id"), "background": _BG,
                                    "use_worktree": {"type": "boolean", "default": True},
                                    "cwd": _s("Optional absolute directory overriding the project mapping")}}},
    {"name": "run_status", "fn": t_run_status, "annotations": RO,
     "description": "State of one run (id) or the most recent runs; reserved/running records whose process is gone are marked lost.",
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
                       "instructions": "Partnership desk tools. All tools refuse while %s exists. Call desk_status "
                                       "first, desk_tick to recover, then run_task(id, background=true) and poll "
                                       "run_status; completion goes through the canonical desk." % STOP_PATH})
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
    record = load_json(run_record_path(spec["run_id"]), None) or {"run_id": spec["run_id"], "kind": spec["kind"],
                                                                     "task_id": spec.get("task_id")}
    if stop_present():
        # STOP appeared between dispatch and start: record it and release the task truthfully.
        record.update(state="failed", note="STOP present at runner start", finished_at=iso(), background=True)
        save_run(record)
        if spec.get("task_id"):
            report = {"status": "failed", "error": "STOP present at runner start", "run_id": spec["run_id"],
                      "kind": spec["kind"], "actual_tokens": None}
            record["queue"] = complete_task_from_report(spec, report)
            save_run(record)
        return 3
    report = run_spec(spec, record)
    return 0 if report["status"] == "done" else 1


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--runner":
        sys.exit(runner(sys.argv[2]))
    if len(sys.argv) >= 2 and sys.argv[1] == "--version":
        print(SERVER_VERSION)
        sys.exit(0)
    serve()
