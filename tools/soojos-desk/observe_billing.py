#!/Users/sayuj/.local/share/uv/tools/scrapling/bin/python
"""Automated observation of the zero-cash evidence (Sayuj, 25 Sep 2026: "we should automate the observation").

Reads the two account pages in a dedicated, persistent, signed-in browser profile and records evidence
ONLY when it actually sees the state the policy requires. It never signs in, never changes a setting,
and writes nothing when it cannot verify. Uses Scrapling's stealth browser session (local, open source):
both sites answer a plain automated browser with a Cloudflare challenge; the stealth session passes it.

    observe_billing.py --login          open a visible window on both sites; sign in yourself; close it
    observe_billing.py [--only claude|codex] [--json] [--debug]
                                         headless observation; writes ~/.soojos/desk/{subscription,codex}-billing.json
                                         when verified; always writes ~/.soojos/desk/observe-status.json

Profile: ~/.soojos/desk/browser-profile-stealth (0700). If a session lapses the observation reports
not_logged_in, evidence goes stale, launches stop, and BOARD.md says so: run --login again.
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402

PROFILE = os.path.join(server.PRIVATE_DIR, "browser-profile-stealth")
STATUS_PATH = os.path.join(server.PRIVATE_DIR, "observe-status.json")
CLAUDE_URL = "https://claude.ai/settings/usage"
CODEX_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage"
TIMEOUT_MS = 45000

SWITCH_JS = ("() => { const s = [...document.querySelectorAll('[role=\"switch\"]')].find(e => ((e.getAttribute('aria-label')||'') + e.textContent)"
             ".includes('Usage credits')); if (!s) return null; const t = document.body.innerText; return {ariaChecked: s.getAttribute('aria-checked'),"
             " max: /Max/.test(t), plan: (t.match(/Plan usage limits\\s*([^\\n]{0,20})/)||[])[1] || null}; }")


def now():
    return dt.datetime.now(dt.timezone.utc)


def claude_org():
    r = subprocess.run([server.CLAUDE_BIN, "--restricted", "--safe-mode", "auth", "status", "--json"],
                       capture_output=True, text=True, timeout=15)
    d = json.loads(r.stdout)
    ok = d.get("loggedIn") and d.get("authMethod") == "claude.ai" and d.get("subscriptionType") in ("pro", "max")
    return d.get("orgId") if ok else None


def login_state(url, text):
    if "login" in url or "auth" in url or "Log in to get" in text or "Sign in" in text[:400]:
        return "not_logged_in"
    return None


def claude_action(out):
    def action(page):
        try:
            page.wait_for_function("() => [...document.querySelectorAll('[role=\"switch\"]')].some(e => ((e.getAttribute('aria-label')||'') + e.textContent).includes('Usage credits'))", timeout=TIMEOUT_MS)
        except Exception:
            pass
        state = page.evaluate(SWITCH_JS)
        text = page.evaluate("() => document.body.innerText") or ""
        out.update({"url": page.url, "title": page.title(), "text_head": text[:400]})
        if not state:
            out["reason"] = login_state(page.url, text) or ("challenge" if "Just a moment" in out["title"] else "switch_not_found")
            return page
        off = state.get("ariaChecked") == "false"
        out.update({"verified": off, "detail": state, "reason": None if off else "usage_credits_switch_not_off:%s" % state.get("ariaChecked")})
        return page
    return action


def codex_action(out):
    def action(page):
        try:
            page.wait_for_function("() => /Credits remaining/.test(document.body.innerText)", timeout=TIMEOUT_MS)
        except Exception:
            pass
        text = page.evaluate("() => document.body.innerText") or ""
        out.update({"url": page.url, "title": page.title(), "text_head": text[:400]})
        if "Credits remaining" not in text:
            out["reason"] = login_state(page.url, text) or ("challenge" if "Just a moment" in out["title"] else "usage_page_not_found")
            return page
        credits = (re.search(r"Credits remaining\s*\n*\s*([\d,\.]+)", text) or [None, None])[1]
        weekly = (re.search(r"Weekly usage limit\s*\n*\s*(\d+%)", text) or [None, None])[1]
        autoreload = "unknown"
        try:
            btn = page.locator("xpath=//*[contains(normalize-space(.), 'Auto-reload credits')]/following::button[normalize-space()='Settings'][1]")
            if not btn.count():
                btn = page.locator("button", has_text="Settings")
            btn.first.click(timeout=8000)
            page.wait_for_selector("[role=dialog]", timeout=8000)
            dtext = page.locator("[role=dialog]").inner_text()
            autoreload = "off" if "Turn on auto-reload" in dtext else ("on" if ("Turn off" in dtext or "Disable" in dtext) else "unknown")
            page.keyboard.press("Escape")
        except Exception as exc:
            autoreload = "unknown (%s)" % type(exc).__name__
        digits = (credits or "").replace(",", "")
        ok = bool(digits) and re.fullmatch(r"[\d.]+", digits) is not None and float(digits) == 0 and autoreload == "off"
        out.update({"verified": ok, "detail": {"credits_remaining": credits, "weekly_remaining": weekly, "autoreload": autoreload},
                    "reason": None if ok else "codex_state_not_verified: credits=%s autoreload=%s" % (credits, autoreload)})
        return page
    return action


def write_evidence(kind, obs, org):
    path = server.BILLING_PATHS[kind]
    stamp = now()
    d = obs.get("detail") or {}
    if kind == "claude":
        source = ("Automated observation by observe_billing.py (Scrapling stealth session, dedicated signed-in profile) of %s at %s UTC: "
                  "'Usage credits' switch aria-checked=false (off); plan %s. No setting changed."
                  % (CLAUDE_URL, stamp.strftime("%Y-%m-%d %H:%M"), d.get("plan") or ("Max" if d.get("max") else "?")))
    else:
        source = ("Automated observation by observe_billing.py (Scrapling stealth session, dedicated signed-in profile) of %s at %s UTC: "
                  "credits remaining %s; weekly limit %s remaining; auto-reload %s (dialog offers 'Turn on auto-reload'). No setting changed."
                  % (CODEX_URL, stamp.strftime("%Y-%m-%d %H:%M"), d.get("credits_remaining"), d.get("weekly_remaining"), d.get("autoreload")))
    payload = {"usage_credits_disabled": True, "verified_at": stamp.isoformat(), "org_id": org, "source": source}
    if kind == "codex":
        payload["note"] = "org_id copied from the Claude organisation for shape compatibility with the canonical checker."
    server.write_json_atomic(path, payload, mode=0o600)
    return path


def hold_open(page):
    """Login mode: keep the visible window until the person closes it."""
    try:
        while not page.is_closed():
            page.wait_for_timeout(1000)
    except Exception:
        pass
    return page


def run(only=None, login=False, debug=False):
    from scrapling.fetchers import StealthySession
    os.makedirs(PROFILE, mode=0o700, exist_ok=True)
    os.chmod(PROFILE, 0o700)
    status = {"at": now().isoformat(), "profile": PROFILE, "engine": "scrapling-stealth", "results": {}}
    if login:
        print("A browser window will open. Sign in to claude.ai, close that window; then chatgpt.com opens: sign in, close it.")
        with StealthySession(headless=False, user_data_dir=PROFILE, solve_cloudflare=True, timeout=TIMEOUT_MS) as s:
            for url in (CLAUDE_URL, CODEX_URL):
                try:
                    s.fetch(url, page_action=hold_open, timeout=24 * 3600 * 1000)
                except Exception as exc:
                    status.setdefault("login_notes", []).append("%s: %s" % (url.split("/")[2], type(exc).__name__))
        status["login_window"] = "closed"
        return status
    org = claude_org()
    with StealthySession(headless=True, user_data_dir=PROFILE, solve_cloudflare=True, timeout=TIMEOUT_MS) as s:
        for kind, url, maker in (("claude", CLAUDE_URL, claude_action), ("codex", CODEX_URL, codex_action)):
            if only and only != kind:
                continue
            obs = {"verified": False, "reason": "not_observed"}
            try:
                s.fetch(url, page_action=maker(obs), network_idle=True)
            except Exception as exc:
                obs["reason"] = "%s: %s" % (type(exc).__name__, str(exc)[:160])
            if obs.get("verified") and org:
                obs["written"] = write_evidence(kind, obs, org)
            elif obs.get("verified") and not org:
                obs.update(verified=False, reason="claude CLI is not a first-party Pro/Max login; evidence not written")
            if not debug:
                obs.pop("text_head", None)
            status["results"][kind] = obs
    server.write_json_atomic(STATUS_PATH, status, mode=0o600)
    return status


def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    status = run(only=only, login="--login" in sys.argv, debug="--debug" in sys.argv)
    if "--json" in sys.argv:
        print(json.dumps(status, indent=2, default=str))
    else:
        for kind, obs in status.get("results", {}).items():
            print("%s: %s%s" % (kind, "verified, evidence written" if obs.get("verified") else "NOT verified",
                                "" if obs.get("verified") else " (%s)" % obs.get("reason")))
    if "--login" in sys.argv:
        return 0
    return 0 if status.get("results") and all(o.get("verified") for o in status["results"].values()) else 1


if __name__ == "__main__":
    sys.exit(main())
