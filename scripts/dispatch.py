#!/usr/bin/env python3
"""
soojos dispatch — fire-and-poll Claude Code runs across multiple projects.

Stdlib only. Designed to be driven by an MCP tool (supervisor chat) rather
than by a human at a terminal.

State lives under ~/.soojos/:
    projects.json          project registry (you edit this)
    sessions/<project>     last session id, for --resume
    runs/<run_id>.json     raw claude -p output
    runs/<run_id>.done     exit code, written when the run finishes
    runs/<run_id>.meta     run metadata (pid, project, objective, started)

Usage:
    dispatch.py projects
    dispatch.py run <project> "<objective>" [--fresh] [--max-turns N]
    dispatch.py status <run_id>
    dispatch.py list [--project P] [--limit N]
    dispatch.py cancel <run_id>

projects.json shape:
{
  "trading-bot": {
    "cwd": "/Users/sayuj/code/trading-bot",
    "allowedTools": "Read,Grep,Glob,Edit,Bash(git diff:*),Bash(pytest:*)",
    "permissionMode": "acceptEdits",
    "maxTurns": 12
  },
  "soojos": { "cwd": "/Users/sayuj/code/soojos", "allowedTools": "Read,Grep,Glob" }
}
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

HOME = Path(os.environ.get("SOOJOS_HOME", Path.home() / ".soojos"))
REGISTRY = HOME / "projects.json"
SESSIONS = HOME / "sessions"
RUNS = HOME / "runs"

CLAUDE_BIN = os.environ.get("SOOJOS_CLAUDE_BIN", "claude")
DEFAULT_TOOLS = "Read,Grep,Glob"
DEFAULT_MAX_TURNS = 10


# --------------------------------------------------------------------------- #
# state helpers
# --------------------------------------------------------------------------- #

def ensure_dirs() -> None:
    for d in (HOME, SESSIONS, RUNS):
        d.mkdir(parents=True, exist_ok=True)


def load_registry() -> dict:
    if not REGISTRY.exists():
        die(
            f"no registry at {REGISTRY}\n"
            "create it with at least one project — see the docstring for the shape"
        )
    try:
        data = json.loads(REGISTRY.read_text())
    except json.JSONDecodeError as exc:
        die(f"registry is not valid json: {exc}")
    if not isinstance(data, dict) or not data:
        die("registry must be a non-empty object of project -> config")
    return data


def project_config(name: str) -> dict:
    reg = load_registry()
    if name not in reg:
        die(f"unknown project {name!r}. known: {', '.join(sorted(reg))}")
    cfg = reg[name]
    cwd = Path(cfg.get("cwd", "")).expanduser()
    if not cwd.is_dir():
        die(f"project {name!r} cwd does not exist: {cwd}")
    cfg["cwd"] = str(cwd)
    return cfg


def session_path(project: str) -> Path:
    return SESSIONS / project


def read_session(project: str) -> str | None:
    p = session_path(project)
    if p.exists():
        sid = p.read_text().strip()
        return sid or None
    return None


def write_session(project: str, session_id: str) -> None:
    session_path(project).write_text(session_id + "\n")


def die(msg: str) -> None:
    print(json.dumps({"ok": False, "error": msg}, indent=2))
    sys.exit(1)


def emit(payload: dict) -> None:
    print(json.dumps(payload, indent=2))


# --------------------------------------------------------------------------- #
# run
# --------------------------------------------------------------------------- #

def cmd_run(args: argparse.Namespace) -> None:
    ensure_dirs()
    cfg = project_config(args.project)

    run_id = f"{args.project}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    out_path = RUNS / f"{run_id}.json"
    err_path = RUNS / f"{run_id}.err"
    meta_path = RUNS / f"{run_id}.meta"

    cmd = [
        CLAUDE_BIN,
        "-p",
        args.objective,
        "--output-format",
        "json",
        "--allowedTools",
        cfg.get("allowedTools", DEFAULT_TOOLS),
        "--max-turns",
        str(args.max_turns or cfg.get("maxTurns", DEFAULT_MAX_TURNS)),
    ]

    if cfg.get("permissionMode"):
        cmd += ["--permission-mode", cfg["permissionMode"]]

    session_id = None if args.fresh else read_session(args.project)
    if session_id:
        cmd += ["--resume", session_id]

    done_path = RUNS / f"{run_id}.done"

    # Wrap in a shell so a completion marker is written even if claude crashes.
    # The marker is the authoritative "finished" signal; pid liveness is only a
    # fallback, since orphaned children can linger as zombies on some systems.
    shell_cmd = (
        f"{' '.join(shlex.quote(c) for c in cmd)} "
        f"> {shlex.quote(str(out_path))} 2> {shlex.quote(str(err_path))}; "
        f"printf %s $? > {shlex.quote(str(done_path))}"
    )

    proc = subprocess.Popen(
        ["/bin/sh", "-c", shell_cmd],
        cwd=cfg["cwd"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )

    meta = {
        "run_id": run_id,
        "project": args.project,
        "objective": args.objective,
        "cwd": cfg["cwd"],
        "resumed_session": session_id,
        "pid": proc.pid,
        "started_at": time.time(),
        "cmd": cmd,
    }
    meta_path.write_text(json.dumps(meta, indent=2))

    emit(
        {
            "ok": True,
            "run_id": run_id,
            "project": args.project,
            "state": "running",
            "note": "poll with: dispatch.py status " + run_id,
        }
    )


# --------------------------------------------------------------------------- #
# status
# --------------------------------------------------------------------------- #

def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def extract_result(blob: str) -> dict:
    """claude -p --output-format json emits one object. Be defensive about shape."""
    blob = blob.strip()
    if not blob:
        return {}
    try:
        obj = json.loads(blob)
    except json.JSONDecodeError:
        # tolerate a stream of objects; take the last parseable line
        obj = {}
        for line in reversed(blob.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
    if isinstance(obj, list):
        obj = obj[-1] if obj else {}
    return obj if isinstance(obj, dict) else {}


def cmd_status(args: argparse.Namespace) -> None:
    ensure_dirs()
    meta_path = RUNS / f"{args.run_id}.meta"
    if not meta_path.exists():
        die(f"no such run: {args.run_id}")

    meta = json.loads(meta_path.read_text())
    out_path = RUNS / f"{args.run_id}.json"
    err_path = RUNS / f"{args.run_id}.err"

    done_path = RUNS / f"{args.run_id}.done"
    elapsed = round(time.time() - meta["started_at"], 1)
    finished = done_path.exists()

    if not finished and pid_alive(meta["pid"]):
        emit(
            {
                "ok": True,
                "run_id": args.run_id,
                "project": meta["project"],
                "state": "running",
                "elapsed_s": elapsed,
                "objective": meta["objective"],
            }
        )
        return

    raw = out_path.read_text() if out_path.exists() else ""
    obj = extract_result(raw)
    stderr = err_path.read_text().strip() if err_path.exists() else ""
    exit_code = None
    if finished:
        try:
            exit_code = int(done_path.read_text().strip() or 0)
        except ValueError:
            exit_code = None

    session_id = obj.get("session_id")
    if session_id:
        write_session(meta["project"], session_id)

    result_text = obj.get("result") or obj.get("text") or ""
    failed = bool(obj.get("is_error")) or bool(exit_code) or not result_text

    emit(
        {
            "ok": not failed,
            "run_id": args.run_id,
            "project": meta["project"],
            "state": "failed" if failed else "done",
            "elapsed_s": elapsed,
            "objective": meta["objective"],
            "exit_code": exit_code,
            "session_id": session_id,
            "num_turns": obj.get("num_turns"),
            "cost_usd": obj.get("total_cost_usd") or obj.get("cost_usd"),
            "result": result_text,
            "stderr": stderr[-2000:] if stderr else None,
        }
    )


# --------------------------------------------------------------------------- #
# list / cancel
# --------------------------------------------------------------------------- #

def cmd_list(args: argparse.Namespace) -> None:
    ensure_dirs()
    metas = []
    for m in RUNS.glob("*.meta"):
        try:
            meta = json.loads(m.read_text())
        except json.JSONDecodeError:
            continue
        if args.project and meta.get("project") != args.project:
            continue
        metas.append(meta)

    metas.sort(key=lambda m: m.get("started_at", 0), reverse=True)
    metas = metas[: args.limit]

    emit(
        {
            "ok": True,
            "runs": [
                {
                    "run_id": m["run_id"],
                    "project": m["project"],
                    "state": "running"
                    if not (RUNS / f"{m['run_id']}.done").exists()
                    and pid_alive(m["pid"])
                    else "finished",
                    "elapsed_s": round(time.time() - m["started_at"], 1),
                    "objective": m["objective"][:120],
                }
                for m in metas
            ],
        }
    )


def cmd_cancel(args: argparse.Namespace) -> None:
    ensure_dirs()
    meta_path = RUNS / f"{args.run_id}.meta"
    if not meta_path.exists():
        die(f"no such run: {args.run_id}")
    meta = json.loads(meta_path.read_text())
    if not pid_alive(meta["pid"]):
        emit({"ok": True, "run_id": args.run_id, "state": "already_finished"})
        return
    try:
        os.killpg(os.getpgid(meta["pid"]), signal.SIGTERM)
    except Exception as exc:
        die(f"could not cancel: {exc}")
    emit({"ok": True, "run_id": args.run_id, "state": "cancelled"})


def cmd_projects(_args: argparse.Namespace) -> None:
    ensure_dirs()
    reg = load_registry()
    emit(
        {
            "ok": True,
            "projects": [
                {
                    "name": name,
                    "cwd": cfg.get("cwd"),
                    "allowedTools": cfg.get("allowedTools", DEFAULT_TOOLS),
                    "active_session": read_session(name),
                }
                for name, cfg in sorted(reg.items())
            ],
        }
    )


# --------------------------------------------------------------------------- #

def main() -> None:
    ap = argparse.ArgumentParser(prog="dispatch.py", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("projects", help="list registered projects")
    p.set_defaults(func=cmd_projects)

    p = sub.add_parser("run", help="start a Claude Code run in the background")
    p.add_argument("project")
    p.add_argument("objective")
    p.add_argument("--fresh", action="store_true", help="ignore saved session")
    p.add_argument("--max-turns", type=int)
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("status", help="poll a run")
    p.add_argument("run_id")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("list", help="recent runs")
    p.add_argument("--project")
    p.add_argument("--limit", type=int, default=10)
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("cancel", help="terminate a running job")
    p.add_argument("run_id")
    p.set_defaults(func=cmd_cancel)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
