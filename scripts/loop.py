#!/usr/bin/env python3
"""
soojos loop — closes the planner/builder loop so you are not the transport layer.

Runs two headless Claude Code roles against the same repo:

    PLANNER  read-only. Reviews the last build, decides what happens next,
             emits a JSON verdict with the next instruction.
    BUILDER  read-write. Executes that one instruction. Nothing else.

Cycle:  planner -> builder -> verify -> commit -> planner -> ...

Stops when: planner says done, verify fails, planner reports the builder
failed to comply twice in a row, or a backstop cap trips.

Point it at ANY directory. No registry, no pre-registration. Subprojects work
the moment they exist.

Usage:
    loop.py <repo-path> "<goal>" [options]

Options:
    --branch NAME       work on a branch (created if absent). default: current
    --verify CMD        command that must exit 0 after each build.
                        auto-detected if omitted; --verify none to disable
    --max-cycles N      backstop. default 20. 0 disables
    --budget USD        backstop. default 15.0. 0 disables
    --detach            run in background, print a log path and exit
    --dry-run           show the resolved plan and exit

Everything lands in <repo>/.soojos-loop/<run_id>/
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time
import uuid
from pathlib import Path

CLAUDE_BIN = os.environ.get("SOOJOS_CLAUDE_BIN", "claude")

PLANNER_TOOLS = "Read,Grep,Glob,Bash(git log:*),Bash(git diff:*),Bash(git status:*)"
BUILDER_TOOLS = (
    "Read,Edit,Write,Grep,Glob,"
    "Bash(git status:*),Bash(git diff:*),"
    "Bash(npm:*),Bash(pytest:*),Bash(python3:*),Bash(node:*),Bash(make:*)"
)

# Files the builder must never touch, regardless of what the planner asks.
FORBIDDEN = re.compile(
    r"(^|/)(\.env|\.env\..*|.*\.pem|.*\.key|.*\.p12|.*\.keystore|credentials.*|secrets.*)$"
)

PLANNER_CONTRACT = """
You are the PLANNER in an autonomous build loop. You have READ-ONLY access.
You never edit files. A separate BUILDER executes exactly one instruction from
you per cycle, then a verification command runs, then you are called again.

The human is NOT reviewing these cycles. Be conservative: prefer small,
verifiable steps over large refactors. If you cannot make a step verifiable,
say so and stop.

Your entire reply must END with a single fenced json block, nothing after it:

```json
{
  "status": "continue" | "done" | "blocked",
  "builder_complied": true,
  "reason": "one sentence on the state of the work",
  "state": ["max 5 short bullets: what is DONE and what REMAINS"],
  "instruction": "the single next instruction for the builder"
}
```

Rules:
- "done": the goal is fully met and verified. "instruction" may be empty.
- "blocked": you need a human decision, or the work is unsafe to continue.
- "builder_complied": false if the previous cycle did not do what you asked.
  On cycle 1 always report true.
- "instruction": one concrete step. Name specific files. No multi-part plans.
- "state": your ONLY memory between cycles. You get a fresh context each time
  and will not recall this conversation. Carry forward everything that matters.
  Rewrite it fully each cycle; do not assume prior bullets survive.
- Never instruct the builder to touch secrets, credentials, .env files, or to
  execute live trades, send funds, or hit production endpoints.
"""


# --------------------------------------------------------------------------- #
# shell helpers
# --------------------------------------------------------------------------- #

def run(cmd: list[str], cwd: Path, timeout: int | None = None) -> tuple[int, str, str]:
    p = subprocess.run(
        cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout
    )
    return p.returncode, p.stdout, p.stderr


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def git(cwd: Path, *args: str) -> tuple[int, str, str]:
    return run(["git", *args], cwd)


# --------------------------------------------------------------------------- #
# preflight
# --------------------------------------------------------------------------- #

def detect_verify(repo: Path) -> str | None:
    if (repo / "pytest.ini").exists() or (repo / "tests").is_dir():
        return "python3 -m pytest -q"
    pkg = repo / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            if "test" in data.get("scripts", {}):
                return "npm test --silent"
        except json.JSONDecodeError:
            pass
    if (repo / "Makefile").exists():
        return "make test"
    return None


def preflight(repo: Path, branch: str | None) -> None:
    if not repo.is_dir():
        die(f"not a directory: {repo}")

    code, _, _ = git(repo, "rev-parse", "--git-dir")
    if code != 0:
        die(
            f"{repo} is not a git repository.\n"
            "This loop auto-commits every cycle and relies on git to make runs\n"
            "revertable. Run: git init && git add -A && git commit -m baseline"
        )

    code, out, _ = git(repo, "status", "--porcelain")
    if out.strip():
        die(
            "working tree is dirty. Commit or stash first — the loop needs a\n"
            "clean baseline so each cycle's diff is attributable."
        )

    if branch:
        code, _, _ = git(repo, "rev-parse", "--verify", branch)
        if code != 0:
            git(repo, "checkout", "-b", branch)
        else:
            git(repo, "checkout", branch)


# --------------------------------------------------------------------------- #
# claude invocation
# --------------------------------------------------------------------------- #

def call_claude(
    repo: Path,
    prompt: str,
    tools: str,
    session: str | None,
    permission_mode: str,
    max_turns: int,
    model: str | None = None,
) -> dict:
    cmd = [
        CLAUDE_BIN,
        "-p",
        prompt,
        "--output-format",
        "json",
        "--allowedTools",
        tools,
        "--permission-mode",
        permission_mode,
        "--max-turns",
        str(max_turns),
    ]
    if model:
        cmd += ["--model", model]
    if session:
        cmd += ["--resume", session]

    p = subprocess.run(cmd, cwd=str(repo), capture_output=True, text=True)
    raw = p.stdout.strip()

    obj: dict = {}
    if raw:
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            for line in reversed(raw.splitlines()):
                try:
                    obj = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue
    if not isinstance(obj, dict):
        obj = {}

    return {
        "text": obj.get("result") or obj.get("text") or "",
        "session_id": obj.get("session_id"),
        "cost": float(obj.get("total_cost_usd") or obj.get("cost_usd") or 0.0),
        "is_error": bool(obj.get("is_error")) or p.returncode != 0,
        "stderr": p.stderr.strip(),
    }


def parse_verdict(text: str) -> dict | None:
    """Pull the trailing ```json block. Fall back to the last {...} in the text."""
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not blocks:
        blocks = re.findall(r"(\{[^{}]*\"status\"[^{}]*\})", text, re.DOTALL)
    for block in reversed(blocks):
        try:
            obj = json.loads(block)
            if isinstance(obj, dict) and "status" in obj:
                return obj
        except json.JSONDecodeError:
            continue
    return None


# --------------------------------------------------------------------------- #
# loop
# --------------------------------------------------------------------------- #

class Transcript:
    def __init__(self, path: Path, goal: str, repo: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.write(f"# Loop run\n\n**Goal:** {goal}\n\n**Repo:** `{repo}`\n\n**Started:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n---\n")

    def write(self, s: str) -> None:
        with open(self.path, "a") as f:
            f.write(s + "\n")
            f.flush()


def loop(args: argparse.Namespace) -> int:
    repo = Path(args.repo).expanduser().resolve()
    preflight(repo, args.branch)

    verify = args.verify
    if verify is None:
        verify = detect_verify(repo)
    if verify in ("none", ""):
        verify = None

    run_id = f"{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    run_dir = repo / ".soojos-loop" / run_id
    t = Transcript(run_dir / "transcript.md", args.goal, repo)

    t.write(f"**Models:** planner `{args.planner_model}` / builder `{args.builder_model}`\n")
    if verify:
        t.write(f"**Verify:** `{verify}`\n")
    else:
        t.write("**Verify:** none — the failing-test stop condition is INACTIVE.\n")

    carried_state: list[str] = []
    last_instruction = "(none yet)"
    last_verify = "not yet run"
    spent = 0.0
    noncompliance = 0
    cycle = 0
    exit_reason = "unknown"

    last_build = "(no builds yet — this is cycle 1)"

    while True:
        cycle += 1

        if args.max_cycles and cycle > args.max_cycles:
            exit_reason = f"backstop: cycle cap ({args.max_cycles}) reached"
            break
        if args.budget and spent >= args.budget:
            exit_reason = f"backstop: budget cap (${args.budget:.2f}) reached"
            break

        t.write(f"\n## Cycle {cycle}\n")

        # ---------------- planner ----------------
        if cycle == 1:
            prompt = (
                f"{PLANNER_CONTRACT}\n\nGOAL:\n{args.goal}\n\n"
                "This is cycle 1. Inspect the repository and decide the first "
                "instruction."
            )
        else:
            _, commits, _ = git(repo, "log", "--oneline", "-8")
            state_block = "\n".join(f"- {b}" for b in carried_state) or "- (none)"
            prompt = (
                f"{PLANNER_CONTRACT}\n\nGOAL:\n{args.goal}\n\n"
                f"You are on cycle {cycle}. You have NO memory of prior cycles.\n"
                f"Everything you know is below. Re-read files to verify.\n\n"
                f"STATE CARRIED FORWARD FROM LAST CYCLE:\n{state_block}\n\n"
                f"RECENT COMMITS:\n{commits.strip()}\n\n"
                f"LAST INSTRUCTION GIVEN:\n{last_instruction}\n\n"
                f"LAST BUILDER REPORT:\n{last_build[:1500]}\n\n"
                f"VERIFICATION: {last_verify}\n\n"
                "Inspect the current state and decide the next instruction."
            )

        # Fresh context every cycle. The digest above is the memory, not a
        # resumed session -- resuming grows context without bound and drives
        # the run into the expensive >150k band.
        p = call_claude(repo, prompt, PLANNER_TOOLS, None, "plan", 8,
                        args.planner_model)
        spent += p["cost"]

        if p["is_error"]:
            t.write(f"**Planner failed.**\n\n```\n{p['stderr'][-1500:]}\n```")
            exit_reason = "planner invocation failed"
            break

        verdict = parse_verdict(p["text"])
        if not verdict:
            t.write(f"**Planner returned no parseable verdict.**\n\n{p['text'][-1500:]}")
            exit_reason = "planner contract violated (no json verdict)"
            break

        status = verdict.get("status", "blocked")
        reason = verdict.get("reason", "")
        instruction = (verdict.get("instruction") or "").strip()

        new_state = verdict.get("state") or []
        if isinstance(new_state, list) and new_state:
            carried_state = [str(x) for x in new_state][:5]

        t.write(f"**Planner:** `{status}` — {reason}\n")

        if not verdict.get("builder_complied", True):
            noncompliance += 1
            t.write(f"> Non-compliance flagged ({noncompliance}/2)\n")
        else:
            noncompliance = 0

        if noncompliance >= 2:
            exit_reason = "planner and builder disagreed twice in a row"
            break
        if status == "done":
            exit_reason = "planner reported goal complete"
            break
        if status == "blocked":
            exit_reason = f"planner blocked: {reason}"
            break
        if not instruction:
            exit_reason = "planner said continue but gave no instruction"
            break

        if FORBIDDEN.search(instruction) or re.search(
            r"\b(live trade|send funds|withdraw|production api)\b", instruction, re.I
        ):
            t.write(f"**Refused instruction:** {instruction}")
            exit_reason = "planner emitted an instruction touching secrets or live money"
            break

        if carried_state:
            t.write("\n**State:** " + "; ".join(carried_state) + "\n")
        t.write(f"\n**Instruction:** {instruction}\n")
        last_instruction = instruction

        # ---------------- builder ----------------
        b = call_claude(
            repo,
            f"Execute exactly this one instruction and nothing more:\n\n{instruction}",
            BUILDER_TOOLS,
            None,
            "acceptEdits",
            args.builder_turns,
            args.builder_model,
        )
        spent += b["cost"]
        last_build = b["text"] or "(builder produced no output)"

        if b["is_error"]:
            t.write(f"**Builder failed.**\n\n```\n{b['stderr'][-1500:]}\n```")
            exit_reason = "builder invocation failed"
            break

        t.write(f"\n**Builder:**\n\n{last_build[:2000]}\n")

        # ---------------- verify ----------------
        if verify:
            code, out, err = run(["/bin/sh", "-c", verify], repo, timeout=900)
            last_verify = f"`{verify}` exited {code}"
            t.write(f"\n**Verify:** {last_verify}\n")
            if code != 0:
                tail = (out + "\n" + err).strip()[-2000:]
                t.write(f"\n```\n{tail}\n```\n")
                git(repo, "add", "-A")
                git(repo, "commit", "-m", f"loop cycle {cycle} (FAILING): {instruction[:60]}")
                exit_reason = "verification failed — stopping as configured"
                break
        else:
            last_verify = "not configured"

        # ---------------- commit ----------------
        code, out, _ = git(repo, "status", "--porcelain")
        if out.strip():
            git(repo, "add", "-A")
            git(repo, "commit", "-m", f"loop cycle {cycle}: {instruction[:60]}")
            _, sha, _ = git(repo, "rev-parse", "--short", "HEAD")
            t.write(f"\n**Committed:** `{sha.strip()}`\n")
        else:
            t.write("\n**No changes to commit.**\n")

        t.write(f"\n*Spent so far: ${spent:.2f}*\n")

    t.write(
        f"\n---\n\n## Stopped\n\n**Reason:** {exit_reason}\n\n"
        f"**Cycles:** {cycle}  \n**Spent:** ${spent:.2f}\n"
    )

    print(
        json.dumps(
            {
                "ok": exit_reason.startswith("planner reported goal complete"),
                "run_id": run_id,
                "cycles": cycle,
                "spent_usd": round(spent, 4),
                "stopped_because": exit_reason,
                "transcript": str(run_dir / "transcript.md"),
            },
            indent=2,
        )
    )
    return 0


# --------------------------------------------------------------------------- #

def main() -> None:
    ap = argparse.ArgumentParser(prog="loop.py")
    ap.add_argument("repo")
    ap.add_argument("goal")
    ap.add_argument("--branch")
    ap.add_argument("--verify", default=None)
    ap.add_argument("--max-cycles", type=int, default=20)
    ap.add_argument("--budget", type=float, default=15.0)
    ap.add_argument("--builder-turns", type=int, default=8)
    ap.add_argument("--planner-model", default="opus",
                    help="judgment role. default opus")
    ap.add_argument("--builder-model", default="sonnet",
                    help="execution role. default sonnet (~40%% of opus cost)")
    ap.add_argument("--detach", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    repo = Path(args.repo).expanduser().resolve()

    if args.dry_run:
        preflight(repo, None)
        v = args.verify if args.verify is not None else detect_verify(repo)
        print(
            json.dumps(
                {
                    "repo": str(repo),
                    "goal": args.goal,
                    "verify": v or "none (failing-test stop INACTIVE)",
                    "branch": args.branch or "current",
                    "planner_model": args.planner_model,
                    "builder_model": args.builder_model,
                    "max_cycles": args.max_cycles or "disabled",
                    "budget_usd": args.budget or "disabled",
                },
                indent=2,
            )
        )
        return

    if args.detach:
        log = repo / ".soojos-loop" / f"detached-{time.strftime('%Y%m%d-%H%M%S')}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        inner = [sys.executable, os.path.abspath(__file__)] + [
            a for a in sys.argv[1:] if a != "--detach"
        ]
        with open(log, "wb") as f:
            subprocess.Popen(
                inner, stdout=f, stderr=f, stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
        print(json.dumps({"ok": True, "detached": True, "log": str(log)}, indent=2))
        return

    sys.exit(loop(args))


if __name__ == "__main__":
    main()
