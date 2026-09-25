#!/Users/sayuj/.local/share/uv/tools/scrapling/bin/python
"""Automated observation of the zero-cash evidence (Sayuj, 25 Sep 2026: "we should automate the observation").

Reads the two account pages in a dedicated, persistent, signed-in Chromium profile and records evidence
ONLY when it actually sees the state the policy requires. It never signs in, never changes a setting,
and writes nothing when it cannot verify. Runs on the Playwright bundled with the local Scrapling tool.

    observe_billing.py --login          open a visible window on both sites; sign in yourself; close it
    observe_billing.py [--only claude|codex] [--json]
                                         headless observation; writes ~/.soojos/desk/{subscription,codex}-billing.json
                                         when verified; always writes ~/.soojos/desk/observe-status.json

Profile: ~/.soojos/desk/browser-profile (0700). If a session lapses the observation reports
not_logged_in, evidence goes stale, launches stop, and BOARD.md says so: run --login again.
"""
import datetime as dt
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402

PROFILE = os.path.join(server.PRIVATE_DIR, "browser-profile")
STATUS_PATH = os.path.join(server.PRIVATE_DIR, "observe-status.json")
CLAUDE_URL = "https://claude.ai/settings/usage"
CODEX_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage"
TIMEOUT_MS = 25000


def now():
    return dt.datetime.now(dt.timezone.utc)


def claude_org():
    r = subprocess.run([server.CLAUDE_BIN, "--restricted", "--safe-mode", "auth", "status", "--json"],
                       capture_output=True, text=True, timeout=15)
    d = json.loads(r.stdout)
    ok = d.get("loggedIn") and d.get("authMethod") == "claude.ai" and d.get("subscriptionType") in ("pro", "max")
    return d.get("orgId") if ok else None


def observe_claude(page):
    page.goto(CLAUDE_URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
    try:
        page.wait_for_function(
            "() => [...document.querySelectorAll('[role=\"switch\"]')].some(e => ((e.getAttribute('aria-label')||'') + e.textContent).includes('Usage credits'))",
            timeout=TIMEOUT_MS)
    except Exception:
        url = page.url
        return {"verified": False, "reason": "not_logged_in" if "login" in url or "auth" in url else "switch_not_found", "url": url}
    state = page.evaluate(
        "() => { const s = [...document.querySelectorAll('[role=\"switch\"]')].find(e => ((e.getAttribute('aria-label')||'') + e.textContent).includes('Usage credits'));"
        " const t = document.body.innerText; return {ariaChecked: s.getAttribute('aria-checked'), max: /Max/.test(t), plan: (t.match(/Plan usage limits\\s*([^\\n]{0,20})/)||[])[1]}; }")
    off = state.get("ariaChecked") == "false"
    return {"verified": off, "reason": None if off else "usage_credits_switch_not_off:%s" % state.get("ariaChecked"),
            "detail": state}


def observe_codex(page):
    page.goto(CODEX_URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
    try:
        page.wait_for_function("() => /Credits remaining/.test(document.body.innerText)", timeout=TIMEOUT_MS)
    except Exception:
        url = page.url
        return {"verified": False, "reason": "not_logged_in" if "auth" in url or "login" in url else "usage_page_not_found", "url": url}
    text = page.evaluate("() => document.body.innerText")
    import re
    credits = (re.search(r"Credits remaining\s*\n*\s*([\d,\.]+)", text) or [None, None])[1]
    weekly = (re.search(r"Weekly usage limit\s*\n*\s*(\d+%)", text) or [None, None])[1]
    # Auto-reload state: the settings dialog offers "Turn on auto-reload" only while it is off.
    autoreload = "unknown"
    try:
        btn = page.locator("button", has_text="Settings").filter(has=page.locator("text=Settings")).last
        # find the Settings button that sits in the Auto-reload card
        cards = page.locator("text=Auto-reload credits")
        if cards.count():
            card_btn = page.locator("xpath=//*[contains(., 'Auto-reload credits')]/following::button[normalize-space()='Settings'][1]")
            (card_btn if card_btn.count() else btn).first.click(timeout=8000)
            page.wait_for_selector("[role=dialog]", timeout=8000)
            dtext = page.locator("[role=dialog]").inner_text()
            autoreload = "off" if "Turn on auto-reload" in dtext else ("on" if "Turn off" in dtext or "Disable" in dtext else "unknown")
            page.keyboard.press("Escape")
    except Exception as exc:
        autoreload = "unknown (%s)" % type(exc).__name__
    ok = credits is not None and credits.replace(",", "").replace(".", "0").isdigit() and float(credits.replace(",", "")) == 0 and autoreload == "off"
    return {"verified": ok, "reason": None if ok else "codex_state_not_verified: credits=%s autoreload=%s" % (credits, autoreload),
            "detail": {"credits_remaining": credits, "weekly_remaining": weekly, "autoreload": autoreload}}


def write_evidence(kind, obs, org):
    path = server.BILLING_PATHS[kind]
    stamp = now()
    if kind == "claude":
        source = ("Automated observation by observe_billing.py (Playwright, dedicated signed-in profile) of %s at %s UTC: "
                  "'Usage credits' switch aria-checked=false (off); plan %s. No setting changed." % (CLAUDE_URL, stamp.strftime("%Y-%m-%d %H:%M"), obs["detail"].get("plan") or ("Max" if obs["detail"].get("max") else "?")))
    else:
        d = obs["detail"]
        source = ("Automated observation by observe_billing.py (Playwright, dedicated signed-in profile) of %s at %s UTC: "
                  "credits remaining %s; weekly limit %s remaining; auto-reload %s (dialog offers 'Turn on auto-reload'). No setting changed."
                  % (CODEX_URL, stamp.strftime("%Y-%m-%d %H:%M"), d.get("credits_remaining"), d.get("weekly_remaining"), d.get("autoreload")))
    payload = {"usage_credits_disabled": True, "verified_at": stamp.isoformat(), "org_id": org, "source": source}
    if kind == "codex":
        payload["note"] = "org_id copied from the Claude organisation for shape compatibility with the canonical checker."
    server.write_json_atomic(path, payload, mode=0o600)
    return path


def run(only=None, login=False):
    from playwright.sync_api import sync_playwright
    os.makedirs(PROFILE, mode=0o700, exist_ok=True)
    os.chmod(PROFILE, 0o700)
    status = {"at": now().isoformat(), "profile": PROFILE, "results": {}}
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(PROFILE, headless=not login, viewport={"width": 1280, "height": 900})
        try:
            if login:
                p1 = ctx.new_page(); p1.goto(CLAUDE_URL)
                p2 = ctx.new_page(); p2.goto(CODEX_URL)
                print("Sign in to both sites in the window that opened, then close the window (or press Ctrl-C here).")
                try:
                    while len(ctx.pages):
                        ctx.pages[0].wait_for_timeout(1000)
                except Exception:
                    pass
                status["login_window"] = "closed"
                return status
            org = claude_org()
            for kind, fn in (("claude", observe_claude), ("codex", observe_codex)):
                if only and only != kind:
                    continue
                page = ctx.new_page()
                try:
                    obs = fn(page)
                except Exception as exc:
                    obs = {"verified": False, "reason": "%s: %s" % (type(exc).__name__, str(exc)[:160])}
                finally:
                    page.close()
                if obs.get("verified") and org:
                    obs["written"] = write_evidence(kind, obs, org)
                elif obs.get("verified") and not org:
                    obs["verified"] = False
                    obs["reason"] = "claude CLI is not a first-party Pro/Max login; evidence not written"
                status["results"][kind] = obs
        finally:
            ctx.close()
    server.write_json_atomic(STATUS_PATH, status, mode=0o600)
    return status


def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    status = run(only=only, login="--login" in sys.argv)
    if "--json" in sys.argv:
        print(json.dumps(status, indent=2, default=str))
    else:
        for kind, obs in status.get("results", {}).items():
            print("%s: %s%s" % (kind, "verified, evidence written" if obs.get("verified") else "NOT verified", "" if obs.get("verified") else " (%s)" % obs.get("reason")))
    return 0 if status.get("results") and all(o.get("verified") for o in status["results"].values()) else (0 if "--login" in sys.argv else 1)


if __name__ == "__main__":
    sys.exit(main())
