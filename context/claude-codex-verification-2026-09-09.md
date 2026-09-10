# Claude + Codex bridge verification
Checked: 2026-09-09 AWST.

- PASS: 24 installed instruction, context, research, decision and configuration files match the reviewed staging files byte for byte.
- PASS: all 14 skill links resolve to the expected original directories; SKILL.md contents match their live sources.
- PASS: eight AGENTS.md project/workspace routers point to an existing CLAUDE.md.
- PASS: both assistants' global instructions reference the shared workflow.
- PASS: Codex TOML parses. Removing the single added CLAUDE.md fallback key yields exactly the original parsed configuration.
- PASS: original SoojOS, Equities Desk and Momentum OS CLAUDE.md content hashes remain unchanged.
- PASS: the live video-research source uses the real watch path. The Equities Desk router reads the original instructions, including Qanat governance.
- PASS: the temporary guarded apply script compiled and completed; replaced files and copied skill directories are preserved at /Users/sayuj/.agents/bridge-backups/20260909, with applied.json as the recovery inventory.

This validates the saved local setup, not a fresh-session behavioral guarantee. Existing chats need a file refresh; start a new task/session or restart if skill/config changes are not visible. Claude-only connector authentication, imported hooks, live services, billing and model quotas were not tested.

A second Codex list_projects call still showed four missing individual projects: Momentum Orchestrator, Video Tools, Viewer and YouTube Build. Automatic-import settings could not be inspected because Computer Use disallows controlling Codex. No sidebar registrations or automatic-updates switch changes are claimed.

No application code, trading data, credentials, service configuration, publishing schedule or third-party package was changed. Existing unrelated working-tree edits were left untouched. These integration changes are not committed.
