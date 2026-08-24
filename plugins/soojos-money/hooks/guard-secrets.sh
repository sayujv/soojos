#!/usr/bin/env bash
# SoojOS guard: refuse writes to credential and live-config files.
# Exit 0 = allow. Exit 2 = block, with the reason sent back to Claude.
set -uo pipefail

payload="$(cat)"

extract_path() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(d.get("tool_input", {}).get("file_path", ""))' 2>/dev/null
  else
    printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  fi
}

path="$(extract_path)"
[ -z "$path" ] && exit 0

base="$(basename "$path")"

case "$base" in
  .env|.env.*|*.pem|*.key|*.p12|credentials|credentials.*|secrets.*|*.keystore)
    echo "SoojOS guard: refusing to modify '$base'. Credential files are edited by hand, never by an agent. If a key needs to change, tell the user which key and let them do it." >&2
    exit 2
    ;;
esac

case "$path" in
  *live_config*|*production.*|*prod.env*)
    echo "SoojOS guard: refusing to modify '$path'. Live/production config is out of scope for an agent write. Propose the change as a diff instead." >&2
    exit 2
    ;;
esac

exit 0
