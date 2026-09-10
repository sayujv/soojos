# Partnership desk

Sayuj approved the nine-project pilot and the preflight limits with “confirm and implement” on 10 September 2026. `approval.json` records that authorization separately from the charter. `policy.json` is the approved control configuration; changing a protected limit requires a new explicit approval.

Later on 10 September, Sayuj explicitly amended the local charter: Claude and Astra share responsibility as operating partners, and Sayuj is the shareholder approving capital deployment. Either partner may initiate work and use agents, MCPs, CLIs or other models within the current authority. Sayuj then requested support for builds that use millions of tokens. A v2 implementation uses `token_mode: report_only` and `task_tokens: null`, with no token-based dispatch or descendant ceiling. Sayuj explicitly confirmed this no-cap choice with “commence”. Migration completed at 14:37 AWST on 10 September; policy v2 is active. Exact v1 policy/approval/queue backups are preserved in token-reporting-migration.json. The accepted change is in `dispatch-control-proposal.md`.

The implementation is isolated in `/Users/sayuj/soojos/.worktrees/20260910-harness`, branch `desk/20260910-harness`. Its operations guide is `docs/desk-operations.md`. No merge or push to main is authorized.

Active state: this folder's `queue.jsonl`, `queue.schema.json`, and dated `outbox/`. Private finance, notification acknowledgements, locks and sync receipts are in `/Users/sayuj/.soojos/desk`. Never commit that private state. Read the latest entry at the end of `/Users/sayuj/soojos/context/handoff.md` when switching assistants.

Current operating controls:

- Policy v2 admits read-only Claude research/review through the native subscription, with paid usage credits verified off for the matching organization within one hour. API/provider billing is refused. Two live reviews completed through this path, including a correction exchange: 131,063 reported tokens, about 2.57 minutes and A$0 incremental cash. The policy-context fix passed 121 tests and independent review. Exact reports and remaining financial gaps are recorded in activation.json and the outbox. This adapter does not meter the coordinator's entire Codex conversation.
- Signed-in Chrome can access Spend & Revenue. Its default view displayed no transactions and the filter menu showed no active conditions on 10 September. This observation is not proof of a complete 30-day financial baseline. Paid admissions remain blocked.
- Notion API credentials and a complete mapping to the actual Item/Amount/Category/Date/Notes/Project/Recurrence/Type schema have not been configured. No automatic ledger sync is claimed. Local pending transactions remain private until acknowledged by Notion.
- Telegram and scheduler activation evidence will be recorded in `activation.json` after verification. Until that file confirms success, do not infer that either is active.
- `~/.soojos/STOP`, including a dangling symlink at that path, blocks new dispatch and notifications. The desk never removes it or automatically resumes a financial pause.

Scope: trading-bot, prediction-betting, sale-readiness-platform, youtube-business, digital-marketplace-business, online-shops, business-search, ugc, fan-accounts (disclosed personas only). SoojOS is harness overhead. Current local project instructions and registry paths still govern; a scope entry does not establish a ready repository.

Historical queue note: `20260910-reel-joint-review` preserves its pre-v2 blocked outcome; its hard-token reason no longer describes current policy. The source-specific reel review remains unfinished and needs a distinct documented successor when ready. `20260910-comparative-readiness` is the agreed next zero-cash work unit, queued at depth three with an eight-minute allocation.


## Latest portfolio checkpoint — 10 September2026, 17:24 AWST

All25 project names aligned across ChatGPT/Codex; all10 in-scope continuity instructions saved/reopened after specific approvals. The nine first business builds are done on isolated tested branches: see [current catalogue](portfolio-builds-2026-09-10.md). Earlier queued next-step text above is historical; current queue and latest handoff govern. The approved full Claude review returned exit1 without structured output, and this depth-three family is stopped. The concise status handoff was delivered and acknowledged. No joint code/business sign-off or production/revenue claim. Read claude-portfolio-review-outcome-2026-09-10.md for the evidenced diagnostic gap before proposing any successor. Notion log transfer currently awaits its specific payload approval; exact note is retained locally.
