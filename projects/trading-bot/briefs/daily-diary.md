# Build brief: Daily Desk Diary

Status: proposed 2026-10-06, not yet built. Target: Equities Desk (IBKR Build).
Why: on 2026-10-05 the desk placed 0 orders through a major rally, and nothing in the system explained why until a human read Telegram alerts by hand. The desk must critique itself every day, without being asked.

## Requirement

After every US session, the desk writes one diary note about its own performance. It is automatic, critical, and at most one page. It ends with actions someone can execute.

- Runs inside the existing post-close pass (about 05:53 AWST). No human trigger.
- Output: `notes/diary/YYYY-MM-DD.md`, dated by the US session date. The header also shows the AWST timestamp it was written.
- One note per day. Re-running overwrites the same file (idempotent).
- Sends a Telegram message to Trading Bot Build Alerts with the one-line verdict, the top 3 actions, and the note path.

## Hard limits

- Maximum 60 lines and about 450 words. A validator enforces it. Over the limit means it fails and regenerates tighter. It is never truncated silently.
- Maximum 5 actions per day.

## Design rule: numbers come from code, words come from the LLM

The desk already logged 88 `AGENT_HALLUCINATION` events in one day. So:

1. A deterministic step computes a `metrics.json` for the day from the ledger, broker, and component logs. No LLM.
2. The LLM only writes critique and actions from `metrics.json`.
3. A validator rejects any figure in the note that is not in `metrics.json`, and any action that names no component.
4. If the LLM step fails or the LLM budget is exhausted, write a metrics-only note and send a Telegram alert. A failed diary is never silent.
5. Reserve LLM budget for the diary before other jobs spend it (`llm_budget_exhausted` was seen on 2026-10-05).

## Note structure (fixed order)

1. **Verdict** (2 lines). Day P&L in dollars and percent, and orders placed. Say plainly whether the day was good, bad, or a failure.
2. **Why only [X]** (about 6 lines). The critical core. Explain the P&L number: what drove it, what size it was and why (shakedown 1 share/order, exposure caps), and what it would have been under the desk's own rules had nothing blocked it.
3. **Gate funnel.** Candidates, then committee conclusions, then risk gate, then orders, with counts at each step and the reason at each drop. A zero-order day must name the exact stage and gate that blocked it.
4. **Missed opportunity.** Top movers in the screening universe that day (move %, time of move), and the desk's signal state on each when it moved. Compare against SPY/QQQ for the day.
5. **Component report card.** One line each, graded OK / DEGRADED / FAILED, with a number:
   - TWS / IBKR session: uptime, drops, minutes without live quotes.
   - Data feeds: price, news, options flow, fundamentals, event calendar, option snapshot freshness.
   - Committees (news, cake, thesis scout): conclusions produced, `agent_error`, `AGENT_HALLUCINATION`, `CHECKPOINT_GAP` counts.
   - Calibration and hit rate: news triage, analysts, and each signal's hit rate versus its stated confidence.
   - LLM: calls and budget used.
   - Risk and exposure: gross by layer vs caps, any kill-switch or stale-data halts.
6. **Actions** (maximum 5, ranked). Each has: component, the concrete change, why (cite the metric), and an acceptance test (how tomorrow's diary proves it worked).
7. **Carried over.** Yesterday's open actions, marked done / not done / worse. An action open for 3 diaries is flagged ESCALATE and moved to the top.

## Action tracking

- Write actions to `notes/diary/actions.jsonl` (id, date raised, component, text, acceptance test, status). The diary reads this file to fill "Carried over".
- Actions are proposals. The desk never applies them itself and never edits credentials or arming switches.

## Hard rules for the critique

- Critical, not defensive. No "market was difficult" without a number backing it.
- Every claim ties to a metric. Say "unknown" where data is missing, and list that as a data-gap action.
- Quiet days still get a diary. "0 orders" must be explained, not just stated.
- A day with unexplained zero orders is graded FAILED by default.

## Acceptance (verify before claiming done)

- Unit tests on fixture days: a profit day, a loss day, a zero-order day, and a day with TWS down. Each produces a valid note within the limits.
- Validator tests: reject an invented number, a note over the limit, and an action with no acceptance test.
- Failure test: force the LLM step to error and confirm a metrics-only note and a Telegram alert.
- Dry run on 2026-10-05 data. The note must identify the stale-data halt, the 00:17 TWS drop, and the committee failures as the reasons for 0 orders.
- Idempotency: running twice for one date leaves exactly one note.
- Scheduled run confirmed end-to-end once, with the Telegram message received.

## Out of scope

Auto-applying actions, changing strategy parameters, and arming or disarming the desk.
