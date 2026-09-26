#!/usr/bin/env python3
"""Record operator-attested zero-cash evidence for the soojos-desk launch gate.

The gate refuses every worker launch unless usage credits are verified OFF within the last hour
(the canonical worker's rule). This script only writes what an operator attests to having observed;
it never observes anything itself and never changes an account setting.

    /usr/bin/python3 record_billing_evidence.py claude --observed "claude.ai Settings > Usage: 'Usage credits' switch off, plan Max (5x)"
    /usr/bin/python3 record_billing_evidence.py codex  --observed "chatgpt.com Codex Analytics: credits remaining 0, auto-reload not enabled"
    /usr/bin/python3 record_billing_evidence.py both   --observed-claude "..." --observed-codex "..."

Where to look: Claude → https://claude.ai/settings/usage (the 'Usage credits' switch must be off).
Codex → https://chatgpt.com/codex/cloud/settings/analytics#usage (credits remaining, and the
Auto-reload settings dialog must still offer 'Turn on auto-reload', meaning it is off).

Writes ~/.soojos/desk/subscription-billing.json (Claude) and/or ~/.soojos/desk/codex-billing.json,
mode 0600, with verified_at = now, the org id from `claude auth status --json`, and your text as
`source`. Keeps a .bak of the previous file. Then prints desk_status's view of the evidence.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402


def claude_org():
    r = subprocess.run([server.CLAUDE_BIN, "--restricted", "--safe-mode", "auth", "status", "--json"],
                       capture_output=True, text=True, timeout=15)
    data = json.loads(r.stdout)
    if not (data.get("loggedIn") and data.get("authMethod") == "claude.ai" and data.get("subscriptionType") in ("pro", "max")):
        raise SystemExit("claude auth status does not show a first-party Pro/Max login: %s" % {k: data.get(k) for k in ("loggedIn", "authMethod", "subscriptionType")})
    return data["orgId"]


def write(kind, observed, org, now):
    path = server.BILLING_PATHS[kind]
    if os.path.exists(path):
        shutil.copy2(path, path + ".bak")
    payload = {"usage_credits_disabled": True, "verified_at": now.isoformat(), "org_id": org,
               "source": "%s Operator-attested via record_billing_evidence.py at %s UTC; no setting changed."
                         % (observed.strip(), now.strftime("%Y-%m-%d %H:%M"))}
    if kind == "codex":
        payload["note"] = "org_id copied from the Claude organisation for shape compatibility with the canonical checker."
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)
    os.chmod(path, 0o600)
    print("wrote", path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=["claude", "codex", "both"])
    ap.add_argument("--observed", help="what you saw, for claude or codex")
    ap.add_argument("--observed-claude")
    ap.add_argument("--observed-codex")
    args = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    org = claude_org()
    if args.kind in ("claude", "both"):
        text = args.observed_claude or args.observed
        if not text or "off" not in text.lower() and "disabled" not in text.lower():
            raise SystemExit("--observed for claude must describe the 'Usage credits' switch being off/disabled; nothing written")
        write("claude", text, org, now)
    if args.kind in ("codex", "both"):
        text = args.observed_codex or args.observed
        if not text or ("auto-reload" not in text.lower() and "autoreload" not in text.lower()):
            raise SystemExit("--observed for codex must mention the auto-reload state you saw; nothing written")
        write("codex", text, org, now)
    text, is_error = server.call_tool("desk_status", {})
    if not is_error:
        print(json.dumps(json.loads(text)["billing_evidence"], indent=1))
    else:
        print(text)


if __name__ == "__main__":
    main()
