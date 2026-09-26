# Desk inbox

Write a task as a section. Plain words. The next beat turns it into a queue entry and writes
`queued: <id>` under the heading (or `queued: REFUSED <reason>`), so this file shows what
happened to your words. The queue is the source of truth; this is the human way in.

Optional lines under a heading:
- `project:` one of trading-bot, prediction-betting, sale-readiness-platform, youtube-business,
  digital-marketplace-business, online-shops, business-search, ugc, fan-accounts, soojos (required)
- `assignee:` codex (Astra, the default) or claude; name claude only when Claude/Fable/Opus is wanted
- `budget:` minutes, 1 to 15 (default 10)
- `action:` research, analysis, code, verify, harness, retro (default research; verify and retro
  run on Fable, the rest on Sonnet unless `model:` says otherwise)
- `model:` sonnet, haiku, opus or fable (Claude assignees only)
- `inputs:` and `constraints:` semicolon-separated
- `auto: no` to keep the task for a coordinator session instead of the 5-minute beat (default: auto for both assignees)
- `route: auto` to let Haiku propose the missing fields; leaving `project:` out does the same

A note instead of a task: `type: note` with `project:` or `scope: all`. It is appended to
notes/<project>.md and reaches every later worker prompt for that project.

Status view: BOARD.md next to this file. Evidence: the outbox folder.

## Example (already processed; copy the shape, not this section)
project: soojos
assignee: claude
budget: 5
action: research
Say what you want done, what "done" looks like, and what must not happen.
queued: example-only

## Astra: review the equities-desk autonomous layer at 9bdf648 before arming
queued: 20260926-051223-codex-astra-review-the-equities-desk-autonomou at 2026-09-26T05:12:23.330312+00:00
project: trading-bot
assignee: codex
budget: 15
action: verify
inputs: /Users/sayuj/soojos/context/desk/equities-autonomous-layer-review-pending.md; /Users/sayuj/AI/Claude/equities-desk at commit 9bdf648bb8f3b2ed53aa06c5141ed7a38c37bfa0 (base ec22b777efbc61730bbe36fe6174b6266857abd4)
constraints: No push, merge, arming, .env read or edit, credential or policy change; no broker connection or order tool; change the equities repo only by adding the verdict artifact through core/artifacts.py; a verdict applies to 9bdf648 only
Independent reciprocal review (decision 0006) of Claude's execution and news-committee changes, which equities decision 0007 requires before Sayuj arms the desk. Start with tier 1 of the request file (the order path) and answer its eight questions. Done looks like a verdict file under equities-desk artifacts/reports/ with PASS, CHANGES REQUESTED or BLOCKED, findings with file and line, and the commands actually run; plus an appended entry in context/handoff.md. If 15 minutes is not enough, record what was covered and what remains; do not imply approval.
