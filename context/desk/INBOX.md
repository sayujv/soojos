# Desk inbox

Write a task as a section. Plain words. The next beat turns it into a queue entry and writes
`queued: <id>` under the heading (or `queued: REFUSED <reason>`), so this file shows what
happened to your words. The queue is the source of truth; this is the human way in.

Optional lines under a heading:
- `project:` one of trading-bot, prediction-betting, sale-readiness-platform, youtube-business,
  digital-marketplace-business, online-shops, business-search, ugc, fan-accounts, soojos (required)
- `assignee:` claude or codex (default claude)
- `budget:` minutes, 1 to 15 (default 10)
- `action:` research, analysis, code, verify, harness, retro (default research; verify and retro
  run on Fable, the rest on Sonnet unless `model:` says otherwise)
- `model:` sonnet, haiku, opus or fable (Claude assignees only)
- `inputs:` and `constraints:` semicolon-separated
- `auto: no` to keep the task for the coordinator instead of the 5-minute beat (default: auto)
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
