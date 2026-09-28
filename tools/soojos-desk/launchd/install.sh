#!/bin/sh
# Install (or reinstall) the 5-minute desk beat as a user launch agent. Remove with:  sh install.sh --remove
set -e
LABEL=com.soojos.desk-beat
SRC="$(cd "$(dirname "$0")" && pwd)/$LABEL.plist"
DST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "$1" = "--remove" ]; then rm -f "$DST"; echo "removed $LABEL"; exit 0; fi
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SRC" "$DST"
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl print "gui/$(id -u)/$LABEL" | grep -E 'state|interval|program' | head -4
echo "installed $LABEL: every 300 s, log ~/.soojos/desk/beat.log"
