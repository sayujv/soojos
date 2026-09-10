> Historical preparation record. Sayuj subsequently confirmed the exact no-cap question with “commence”; policy v2 activated at 14:37 AWST on 10 September 2026. Consult the accepted dispatch control and latest activation evidence for current state.

# Token reporting preparation — 10 September 2026

Status: prepared implementation; live activation blocked pending explicit no-ceiling confirmation.

Sayuj requested support for builds using millions of tokens. The prepared v2 removes token admission/completion/descendant ceilings altogether and records actual usage, including unknown usage. It retains the existing 15-minute deadline, eight Claude turns, two workers, chain depth three and all STOP and financial controls. It does not increase provider subscription limits.

## Exact approval still needed

Confirm that token usage should be reporting-only, with no hard token ceiling, while all current time, turn, concurrency, chain and financial limits remain.

Automatic approval review rejected the live migration command: it considered the message about million-token builds ambiguous between a higher ceiling and no ceiling. The rejected command did not execute. No migration journal was created; live policy remains version 1 with task_tokens 20000. Do not activate through another command or tool without that explicit confirmation.

## Prepared changes

- Recoverable policy/approval/queue migration with exact original file backups and fail-closed interrupted-state recovery.
- V2 accounting accepts million-token totals and unknown usage without imposing a token ceiling.
- Subscription-only Claude research/review dispatch, using current shared context, an isolated task worktree and no tools.
- Fresh disabled-usage-credit evidence bound to the same native Claude organization. API/provider billing is refused; no credentials are changed.
- Authentication time included in the supervised deadline. Actual usage and structured review evidence recorded separately from API-equivalent cost estimates.

## Read-only live observations

Claude Code 2.1.263 is authenticated through claude.ai, firstParty, Max. Browser Settings showed Max (5x), existing session allowance remaining and paid Usage credits disabled. Browser and CLI organization IDs matched. These observations are not a model request and will need refreshing immediately before any later live trial. No Claude setting changed and no new cash spend occurred.

The local charter remains SHA256 950f381a466ea1d61c679892c1c515cd38664d79a29870cdb74248a5f9bf39c8. The existing heartbeat and blocked queue outcomes remain unchanged. Financial opening coverage and Notion API synchronization remain unresolved independently of token policy.

## Validation

Final independent verification: `python3 -m unittest discover -s tests -p 'test_desk*.py'` passed all 120 tests in 7.273 seconds. `git diff --check` passed. Independent review found and verified fixes for auth-time accounting, matching-organization billing, zero estimates, approved turn limits, expired claims, excluded-project inputs and blocked-task usage persistence/recovery. A final-journal crash/recovery fixture preserved a completed 3,000,001-token task. An initial timing-sensitive test was made deterministic; production behavior did not change for that test correction. No remaining actionable review finding; no live Claude review has run.

## Resume after explicit approval

Refresh the current shared handoff and Git state. Verify the completed test/review record, then call Desk.migrate_reporting_policy with a fresh timestamp and the explicit authorization text. Regenerate canonical queue.schema.json from the migrated policy using the CLI schema output, mirror the accepted governance documents, refresh matching-account billing evidence and run one new zero-cash Claude review task (do not reopen the immutable old blocked task). Record actual output/usage before enabling the existing heartbeat to dispatch. Do not use API fallback or paid usage credits. Keep the financial gate until sourced coverage is established.
