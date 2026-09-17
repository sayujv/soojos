#!/usr/bin/env python3
"""soojos-desk: a minimal MCP server (stdio, JSON-RPC 2.0, Python stdlib only).

Tools: queue_list, queue_add, queue_claim, outbox_read, outbox_write,
git_status, run_claude, run_codex.  Every tool refuses when ~/.soojos/STOP
exists (a dangling symlink counts, per the desk's STOP convention).

State defaults to the canonical partnership desk:
  queue/outbox : /Users/sayuj/soojos/context/desk   (override: SOOJOS_DESK_DIR)
  private      : ~/.soojos                           (override: SOOJOS_HOME)
Queue mutations take the same flock the existing desk coordinator uses
(~/.soojos/desk/coordinator.lock) and replace queue.jsonl atomically.

Workers run non-interactively with full binary paths and a hard timeout:
  claude : -p --output-format json --permission-mode acceptEdits --no-session-persistence
           (override mode with SOOJOS_CLAUDE_PERMISSION_MODE)
  codex  : exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C cwd
           (override sandbox with SOOJOS_CODEX_SANDBOX)
Unanswered permission prompts in these modes are denied, never granted.
The worker inherits this server's environment unchanged.
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
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2025-06-18"

HERE = os.path.dirname(os.path.abspath(__file__))
SOOJOS_ROOT = "/Users/sayuj/soojos"
SOOJOS_HOME = os.environ.get("SOOJOS_HOME", os.path.expanduser("~/.soojos"))
DESK_DIR = os.environ.get("SOOJOS_DESK_DIR", os.path.join(SOOJOS_ROOT, "context", "desk"))
STOP_PATH = os.path.join(SOOJOS_HOME, "STOP")
LOCK_PATH = os.path.join(SOOJOS_HOME, "desk", "coordinator.lock")
QUEUE_PATH = os.path.join(DESK_DIR, "queue.jsonl")
SCHEMA_PATH = os.path.join(DESK_DIR, "queue.schema.json")
POLICY_PATH = os.path.join(DESK_DIR, "policy.json")
OUTBOX_DIR = os.path.join(DESK_DIR, "outbox")
PROJECTS_PATH = os.path.join(HERE, "projects.json")

CLAUDE_BIN = "/Users/sayuj/.local/bin/claude"
CODEX_BIN = "/Applications/ChatGPT.app/Contents/Resources/codex"
GIT_BIN = "/usr/bin/git"
CLAUDE_PERMISSION_MODE = os.environ.get("SOOJOS_CLAUDE_PERMISSION_MODE", "acceptEdits")
CODEX_SANDBOX = os.environ.get("SOOJOS_CODEX_SANDBOX", "workspace-write")

MAX_RETURN_CHARS = 20000     # per stream in the tool result
MAX_OUTBOX_CHARS = 200000    # per stream in the outbox file
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")


class ToolError(Exception):
    pass


# --------------------------------------------------------------------------- helpers
def now_utc():
    return _dt.datetime.now(_dt.timezone.utc)


def iso(ts=None):
    return (ts or now_utc()).isoformat()


def stop_check():
    if os.path.lexists(STOP_PATH):
        raise ToolError("STOP is present at %s; refusing. The desk never removes it." % STOP_PATH)


def load_json(path, default):
    try:
        with open(path) as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


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


def schema_enum(field, fallback):
    schema = load_json(SCHEMA_PATH, {})
    return schema.get("properties", {}).get(field, {}).get("enum", fallback)


def policy():
    return load_json(POLICY_PATH, {})


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


def outbox_path_for(entry_id):
    """Existing files are named <YYYY-MM-DD>-<id>.json; return newest match or None."""
    if not os.path.isdir(OUTBOX_DIR):
        return None
    matches = [f for f in os.listdir(OUTBOX_DIR)
               if f.endswith("-%s.json" % entry_id) and re.match(r"^\d{4}-\d{2}-\d{2}-", f)]
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
    fd, tmp = tempfile.mkstemp(prefix=".outbox.", suffix=".json", dir=OUTBOX_DIR)
    with os.fdopen(fd, "w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)
    return path


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


def run_bounded(cmd, cwd, budget_minutes):
    """Run cmd in its own process group; kill the whole group on timeout."""
    timeout = budget_minutes * 60
    started = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    timed_out = False
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            out, err = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            out, err = proc.communicate()
    elapsed = time.monotonic() - started
    return {"exit_code": proc.returncode, "timed_out": timed_out, "elapsed_seconds": round(elapsed, 2),
            "stdout": out.decode("utf-8", "replace"), "stderr": err.decode("utf-8", "replace")}


def clip(text, limit):
    if len(text) <= limit:
        return text
    return text[:limit // 2] + "\n...[%d chars omitted]...\n" % (len(text) - limit) + text[-limit // 2:]


def run_worker(kind, task, cwd, budget_minutes):
    if not isinstance(task, str) or not task.strip():
        raise ToolError("task must be a non-empty string")
    if not isinstance(cwd, str) or not os.path.isabs(cwd) or not os.path.isdir(cwd):
        raise ToolError("cwd must be an existing absolute directory")
    budget = check_budget(budget_minutes)
    stamp = now_utc()
    run_id = "run-%s-%s" % (kind, stamp.strftime("%Y%m%d-%H%M%S"))
    last_msg_file = None
    if kind == "claude":
        if not os.path.exists(CLAUDE_BIN):
            raise ToolError("claude binary missing at %s" % CLAUDE_BIN)
        cmd = [CLAUDE_BIN, "-p", task, "--output-format", "json",
               "--permission-mode", CLAUDE_PERMISSION_MODE, "--no-session-persistence"]
    else:
        if not os.path.exists(CODEX_BIN):
            raise ToolError("codex binary missing at %s" % CODEX_BIN)
        fd, last_msg_file = tempfile.mkstemp(prefix="codex-last-", suffix=".txt")
        os.close(fd)
        cmd = [CODEX_BIN, "exec", "--sandbox", CODEX_SANDBOX, "--skip-git-repo-check", "--ephemeral",
               "-C", cwd, "-o", last_msg_file, task]
    report = {"kind": kind, "task": task, "cwd": cwd, "budget_minutes": budget, "command": cmd,
              "started_at": iso(stamp), "status": "failed"}
    try:
        res = run_bounded(cmd, cwd, budget)
        report.update(res)
        if kind == "claude":
            try:
                parsed = json.loads(res["stdout"])
                report["result"] = parsed.get("result")
                for key in ("total_cost_usd", "usage", "num_turns", "duration_ms", "is_error",
                            "session_id", "subtype"):
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
    except Exception as exc:  # launch failure etc.
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
    outbox_file = write_outbox(run_id, None, outbox_report)
    result = dict(report)
    result["stdout"] = clip(report.get("stdout", ""), MAX_RETURN_CHARS)
    result["stderr"] = clip(report.get("stderr", ""), MAX_RETURN_CHARS)
    result["outbox_id"] = run_id
    result["outbox_file"] = outbox_file
    if result["status"] != "done":
        raise ToolError(json.dumps(result, indent=2, sort_keys=True))
    return result


# --------------------------------------------------------------------------- tools
def t_queue_list(args):
    status = args.get("status")
    tasks = read_queue()
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    keys = ("id", "project", "assignee", "status", "budget_minutes", "created_at", "task")
    summary = [{k: t.get(k) for k in keys} for t in tasks]
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
        if any(t.get("id") == task_id for t in tasks):
            raise ToolError("id collision: %s" % task_id)
        tasks.append(entry)
        write_queue_atomic(tasks)
    return {"added": entry, "queue_path": QUEUE_PATH}


def t_queue_claim(args):
    task_id = args.get("id")
    if not isinstance(task_id, str) or not task_id:
        raise ToolError("id is required")
    max_workers = int(policy().get("max_workers", 2))
    with queue_lock():
        tasks = read_queue()
        target = next((t for t in tasks if t.get("id") == task_id), None)
        if target is None:
            raise ToolError("no task with id %s" % task_id)
        if target.get("status") != "queued":
            raise ToolError("task %s is %s, not queued" % (task_id, target.get("status")))
        running = [t["id"] for t in tasks if t.get("status") == "running"]
        if len(running) >= max_workers:
            raise ToolError("max_workers=%d already running: %s" % (max_workers, ", ".join(running)))
        stamp = now_utc()
        budget = int(target.get("budget_minutes", 15))
        target["status"] = "running"
        target["started_at"] = iso(stamp)
        target["deadline"] = iso(stamp + _dt.timedelta(minutes=budget))
        target["claimed_by"] = SERVER_NAME
        write_queue_atomic(tasks)
    return {"claimed": target}


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
    project = next((t.get("project") for t in read_queue() if t.get("id") == entry_id), None)
    path = write_outbox(entry_id, project, report)
    return {"written": path}


def t_git_status(args):
    path = resolve_project_dir(args.get("project"))

    def git(*a):
        r = subprocess.run([GIT_BIN, "-C", path] + list(a), capture_output=True, text=True, timeout=30)
        return r.returncode, r.stdout.strip(), r.stderr.strip()

    code, top, err = git("rev-parse", "--show-toplevel")
    if code != 0:
        return {"path": path, "is_git_repo": False, "error": err}
    _, branch, _ = git("rev-parse", "--abbrev-ref", "HEAD")
    _, head, _ = git("rev-parse", "--short", "HEAD")
    _, status, _ = git("status", "--short", "--branch")
    _, log, _ = git("log", "--oneline", "-5")
    return {"path": path, "is_git_repo": True, "toplevel": top, "branch": branch, "head": head,
            "status_short": status.splitlines(), "recent_commits": log.splitlines()}


def t_run_claude(args):
    return run_worker("claude", args.get("task"), args.get("cwd"), args.get("budget_minutes", 15))


def t_run_codex(args):
    return run_worker("codex", args.get("task"), args.get("cwd"), args.get("budget_minutes", 15))


def _s(desc):
    return {"type": "string", "description": desc}


_BUDGET = {"type": "integer", "description": "Hard timeout in minutes (1..policy task_minutes, default cap 15)"}

TOOLS = [
    {"name": "queue_list", "fn": t_queue_list,
     "description": "List desk queue tasks, optionally filtered by status (queued|running|done|blocked).",
     "inputSchema": {"type": "object", "properties": {"status": _s("Optional status filter")}}},
    {"name": "queue_add", "fn": t_queue_add,
     "description": "Append a queued task to the desk queue with schema-conformant defaults.",
     "inputSchema": {"type": "object", "required": ["project", "task", "assignee", "budget_minutes"],
                     "properties": {"project": _s("Project slug from queue.schema.json"),
                                    "task": _s("Task text (<=12000 chars)"),
                                    "assignee": _s("codex or claude"),
                                    "budget_minutes": _BUDGET,
                                    "inputs": {"type": "array", "items": {"type": "string"}},
                                    "constraints": {"type": "array", "items": {"type": "string"}}}}},
    {"name": "queue_claim", "fn": t_queue_claim,
     "description": "Mark a queued task running with started_at and deadline; respects policy max_workers.",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task id")}}},
    {"name": "outbox_read", "fn": t_outbox_read,
     "description": "Read the newest outbox entry for an id (files are <date>-<id>.json).",
     "inputSchema": {"type": "object", "required": ["id"], "properties": {"id": _s("Task or run id")}}},
    {"name": "outbox_write", "fn": t_outbox_write,
     "description": "Write an immutable outbox entry {at, id, project, report} for an id.",
     "inputSchema": {"type": "object", "required": ["id", "report"],
                     "properties": {"id": _s("Task or run id"),
                                    "report": {"type": ["object", "string"],
                                               "description": "Report object, or a JSON/plain string"}}}},
    {"name": "git_status", "fn": t_git_status,
     "description": "Branch, HEAD, short status and last 5 commits for a project slug (projects.json) or absolute path.",
     "inputSchema": {"type": "object", "required": ["project"],
                     "properties": {"project": _s("Project slug or absolute path")}}},
    {"name": "run_claude", "fn": t_run_claude,
     "description": "Run Claude Code non-interactively (-p, permission mode %s) on a task in cwd with a hard "
                    "timeout; captures stdout/stderr and writes an outbox entry." % CLAUDE_PERMISSION_MODE,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"),
                                    "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET}}},
    {"name": "run_codex", "fn": t_run_codex,
     "description": "Run Codex non-interactively (codex exec, sandbox %s) on a task in cwd with a hard "
                    "timeout; captures stdout/stderr and writes an outbox entry." % CODEX_SANDBOX,
     "inputSchema": {"type": "object", "required": ["task", "cwd", "budget_minutes"],
                     "properties": {"task": _s("Prompt for the worker"),
                                    "cwd": _s("Absolute working directory"),
                                    "budget_minutes": _BUDGET}}},
]
TOOL_MAP = {t["name"]: t for t in TOOLS}


# --------------------------------------------------------------------------- JSON-RPC over stdio
def send(msg):
    sys.stdout.write(json.dumps(msg, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def reply(req_id, result):
    send({"jsonrpc": "2.0", "id": req_id, "result": result})


def reply_error(req_id, code, message):
    send({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})


def tool_result(text, is_error=False):
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def handle(msg):
    method = msg.get("method") or ""
    req_id = msg.get("id")
    params = msg.get("params") or {}
    if method == "initialize":
        reply(req_id, {"protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION,
                       "capabilities": {"tools": {"listChanged": False}},
                       "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                       "instructions": "Partnership desk tools. All tools refuse while %s exists." % STOP_PATH})
    elif method.startswith("notifications/"):
        return
    elif method == "ping":
        reply(req_id, {})
    elif method == "tools/list":
        reply(req_id, {"tools": [{"name": t["name"], "description": t["description"],
                                  "inputSchema": t["inputSchema"]} for t in TOOLS]})
    elif method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = TOOL_MAP.get(name)
        if tool is None:
            reply_error(req_id, -32602, "Unknown tool: %s" % name)
            return
        try:
            stop_check()
            out = tool["fn"](args)
            reply(req_id, tool_result(json.dumps(out, indent=2, sort_keys=True, default=str)))
        except ToolError as exc:
            reply(req_id, tool_result("%s refused: %s" % (name, exc), is_error=True))
        except Exception as exc:
            reply(req_id, tool_result("%s failed: %s\n%s" % (name, exc, traceback.format_exc()), is_error=True))
    elif method == "resources/list":
        reply(req_id, {"resources": []})
    elif method == "prompts/list":
        reply(req_id, {"prompts": []})
    elif req_id is not None:
        reply_error(req_id, -32601, "Method not found: %s" % method)


def main():
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


if __name__ == "__main__":
    main()
