# Build brief: Daily Desk Diary

Status: proposed 2026-10-06 (revised same day), not yet built. Targets: Equities Desk (IBKR Build) and Crypto Desk (ByBit Build). Each desk writes its own diary and doctrine; the spec below applies to both.

## Why

On 2026-10-05 neither desk placed a single order. The equities desk sat out a major rally and nothing explained why until a human read Telegram alerts by hand. The crypto desk also took no trades. A trading system that cannot place even one trade, profitable or not, is not yet a trading system. The desks need a daily diary that reads like a trader's journal, not a system self-audit, and they need a proven path from signal to filled order.

### What the 5 Oct record shows for each desk

- **Equities (IBKR):** no live US equity quotes until about 23:55 AWST (error 10089, missing streaming entitlement), TWS refused connections at 00:17, and the committees produced no conclusion (88 `AGENT_HALLUCINATION`, 36 `CHECKPOINT_GAP`). 0 orders in the 6-hour check.
- **Crypto (ByBit):** per the last ByBit Build report I could read (11:38 UTC on 5 Oct), the loop was in paper mode and ran in a terminal tab, so it stops if the Mac sleeps or the app closes. Only 3 of 17 specs validated positive, and those trade 0.1 to 0.8 times per day, so a day with no signal was a likely outcome by design. I have not seen the ByBit logs after that report, so the actual cause of 0 trades is unconfirmed. The diary's first job on that desk is to find out.

## Voice and perspective

The diary is written from the point of view of an experienced trader who has been investing continuously for years and wants returns. It is the trader's own end-of-day journal, first person ("I", "we"), blunt and unsentimental.

It is not a checklist graded against the desk's own criteria. The question it answers is "did we make money, and what would the best traders in the world have done with this day?" It does not ask "did each component meet its spec?"

### The benchmark: the top of the top

The desk is not aiming to be a competent discretionary trader. The standard is the best discretionary traders on Wall Street: the elite who compound large returns with controlled drawdowns, size up hard on their best ideas, cut losers fast, and are rarely flat through a major move in markets they cover. The desk should hold itself to that bar, not to its own previous results or to "good enough".

The diary must not pretend to know what any named person did. It uses measurable proxies for that standard:
- Return per unit of risk (daily and rolling Sharpe/Sortino-style), max drawdown, and return versus SPY/QQQ.
- Win rate and, more importantly, average win versus average loss (payoff ratio) and expectancy per trade.
- Capture: the share of the day's tradable move in our universe that we actually captured.
- Concentration: did we size up on our highest-conviction ideas, or spread thin?
- Time in market versus the opportunities available.
- Loss discipline: how fast losers were cut, and whether any loss exceeded plan.

Always judged against these yardsticks, in this order:
1. **Dollars and percent made or lost today**, and the running week and month.
2. **What cash in the market would have done**: SPY/QQQ and the best movers in what we screen. Sitting out a rally is a loss, and the diary says so in money terms.
3. **What a top-tier discretionary trader would have done** with the same information: which trades they would have taken, at what conviction and size, and why the desk didn't. Where the desk's account size or caps make the dollar figure small, the diary also states the result in percent of equity, which is the comparable number.

## Automation

- Runs inside the existing post-close pass (about 05:53 AWST). No human trigger.
- Output: `notes/diary/YYYY-MM-DD.md`, named for the US session date, with the AWST write time in the header. One note per day, idempotent on re-run.
- Sends the verdict and top 3 actions to Trading Bot Build Alerts on Telegram.

## Hard limits

- Maximum 60 lines and about 450 words. A validator enforces it, regenerating tighter and never truncating silently.
- Maximum 5 actions per day.

## Note structure (fixed order)

1. **The day in money** (2 to 3 lines). Day P&L in dollars and percent, week and month to date, equity, cash idle versus deployed. One honest sentence: good, bad, or a miss.
2. **What the market gave us.** The day's best opportunities in our screened universe: biggest movers, the moves that were tradable (not just hindsight), and what an in-and-out trader would have made on them. This is the opportunity cost in dollars at our actual size and at a reasonable size.
3. **Why we only made [X] / lost [X].** The core of the note, in plain trader language. Cover:
   - Conviction and sizing: why we were small or flat, and whether that was right given the setup.
   - Entries and exits we did take: good or bad timing, slippage, what we'd change.
   - Trades we should have taken and didn't, and the specific reason we didn't (no data, a gate that blocked, no conclusion produced, risk cap).
   - Risk taken for the return earned. Was the reward worth the exposure?
4. **What's costing us money.** Not a component scorecard. A ranked list of the blockers and leaks behind today's result, each with its estimated dollar impact for the day. Examples: TWS down for N minutes during the move, a committee that produced nothing, a stale feed, a cap that was too tight. Components appear only where they hurt returns. Healthy components are not mentioned.
5. **Signals that earned their keep.** Which sources (news, options flow, price action, insider, earnings) actually pointed the right way today and which misled us, using hit rate against stated confidence. Keep what pays, cut what doesn't.
6. **Doctrine check** (2 to 3 lines). Which belief or limitation in `notes/doctrine.md` did today prove wrong, too timid, or unexamined? Say which entry, and propose the rewrite. If nothing was challenged, say so.
7. **Actions** (maximum 5, ranked by expected return gained). Each has: the concrete change, the dollars it would have added or saved (from the numbers above), and a check tomorrow that shows whether it worked.
8. **Carried over.** Yesterday's open actions, marked done, not done, or worse. Anything open for 3 diaries is flagged ESCALATE and placed first.

## Tone rules

- Critical of results, not of the process in the abstract. "We left about $X on the table" is the right register. "Component Y failed its check" is not.
- Always in dollars first, then the cause.
- No excuses without a number. "The market was hard" must be backed by what others in the universe made.
- A quiet day still gets a diary. A zero-trade day is a failure to explain in money terms: what the desk could have made, and what stopped it.
- Say "unknown" where data is missing, and make the missing data an action.

## Prove the desk can trade: execution proof and no-trade escalation

Zero trades is treated as a defect to explain, not a result to report. Both desks get:

1. **Pipeline self-test (daily, automatic).** Each day, before the session, the desk places and closes one minimum-size order through the real execution path in a safe venue: IBKR paper account for equities, Bybit testnet for crypto. It records signal, order, fill, and exit, and times each step. If any step fails, that is the first line of the diary and a Telegram alert. This proves the plumbing works regardless of whether the strategy found an edge that day.
2. **Live proof is a human decision.** A minimum-size live order (1 share, or the smallest contract) is allowed only if you enable it once, and it stays inside every existing cap and the kill switch. The desk may propose it in `notes/doctrine-proposals.md`. It never turns it on itself.
3. **No-trade accounting.** Every day with 0 live or paper strategy orders, the diary must say, with counts, at which stage the flow died: no data, no signal, no conclusion, rejected by a gate, or an order that failed. "No signal fired" is only acceptable if the diary also states how many signals the strategy is expected to fire per day (for example 0.1 to 0.8 for the validated crypto specs) and why zero was or wasn't normal.
4. **Escalation.** 2 consecutive days with no strategy order is flagged ESCALATE and sent to Telegram. The diary then states the single most likely blocker and the fix.
5. **Always-on.** Each diary reports whether the desk was actually running through the whole session (Mac sleep, terminal tab closed, TWS dropped, process crashed) and how many minutes of the session it was blind or stopped. A desk that wasn't running cannot be said to have declined to trade.

## The desk rewrites its own understanding and limitations

The desk currently treats its caps, gates and shakedown settings as fixed facts. They are not. They are assumptions made while the desk was unproven, and the desk should now challenge them against the elite benchmark above.

**`notes/doctrine.md`** is a living document the desk owns. Seed it on first run, then keep it current. It holds:
1. **The standard**: the top-of-the-top benchmark and the proxy metrics above, in the desk's own words.
2. **What I believe**: the desk's working beliefs about markets, signals and its own edge, each with the evidence for it and a confidence level.
3. **My limitations**: each constraint it operates under (position-size caps, shakedown 1 share/order, gating thresholds, committee quality, data coverage, LLM budget), who set it, why it exists, what it costs in returns, and what evidence would justify loosening it.
4. **Open questions** it is trying to answer.

Each diary compares the day against doctrine and proposes specific rewrites: a belief confirmed or killed, a limitation it now thinks is too tight or too loose, backed by numbers. Rewrites are committed to `notes/doctrine.md` with the date and the evidence, so the history of its thinking is readable.

### Who can change what

- **The desk may rewrite on its own:** beliefs, hypotheses, the open-questions list, descriptions of its weaknesses, signal weighting views, and the wording and structure of the doctrine itself.
- **A human must approve before it takes effect:** any change to a risk or capital control. That means position and exposure caps, shakedown mode, stop and loss limits, leverage or margin, the kill switch, the arming and execution switches, and anything touching credentials or the broker. The desk files these as proposals in `notes/doctrine-proposals.md` with the evidence and the expected return gain, and sends them to Telegram for a yes or no. It never applies them itself.
- Raising its own ambition is encouraged. Quietly lifting its own guardrails is not allowed. The two are kept separate on purpose: a desk aiming at the best traders needs the same loss discipline they have.

## Design rule: numbers come from code, words from the LLM

The desk logged 88 `AGENT_HALLUCINATION` events in one day, so the diary must not invent figures.

1. A deterministic step builds `metrics.json` for the day: P&L, fills, equity, benchmark and universe moves, the gate funnel counts, component downtime, signal hit rates. No LLM.
2. The LLM writes the diary in the trader's voice from `metrics.json` only.
3. A validator rejects any figure not in `metrics.json`, any action without a dollar estimate and a next-day check, and a note over the limit.
4. If the LLM step fails or the budget runs out, write a metrics-only note and send a Telegram alert. A failed diary is never silent.
5. Reserve LLM budget for the diary before other jobs spend it (`llm_budget_exhausted` was seen on 2026-10-05).

## Action tracking

- Actions go to `notes/diary/actions.jsonl` (id, date raised, text, estimated dollar impact, next-day check, status). Tomorrow's diary reads it to fill "Carried over".
- Actions are proposals. The desk never applies them itself, and never edits credentials or arming switches. Doctrine rewrites follow the permissions in "Who can change what".

## Acceptance (verify before claiming done)

- Fixture days: a profit day, a loss day, a zero-order day during a rally, and a day with TWS down. Each produces a valid note within the limits and in the first-person trader voice, with money first.
- Validator tests: reject an invented number, a note over the limit, and an action with no dollar estimate.
- Failure test: force the LLM step to error and confirm a metrics-only note and a Telegram alert.
- Dry run on 2026-10-05 data. The equities note must say we made $0 in a rally, estimate what was left on the table, and trace it to the late live data, the 00:17 TWS drop, and the committees producing nothing. The crypto note must say why there were no trades (paper mode, loop not running, or no signals) with counts, and say whether the desk was running all session.
- Self-test: with the venue forced to fail at each stage (data, signal, order, fill), the self-test reports the right stage. On success it leaves a closed paper/testnet trade in the record, and a failure sends a Telegram alert.
- No-trade accounting: a fixture zero-order day produces a funnel with counts and a named blocking stage, and a second consecutive zero day triggers ESCALATE.
- Always-on: a fixture where the process was down for part of the session shows the blind minutes in the note.
- Both desks: the equities and crypto desks each produce their own diary and doctrine from the same code path.
- Doctrine: first run seeds `notes/doctrine.md` with all four parts. A test confirms the desk can rewrite a belief on its own, and that an attempted change to a cap, shakedown mode, kill switch or arming switch is written to `notes/doctrine-proposals.md` and not applied.
- Benchmark: the note reports the proxy metrics (payoff ratio, capture, drawdown, return vs SPY/QQQ). It never claims what a named trader did.
- Idempotency: running twice for one date leaves exactly one note.
- One scheduled run confirmed end to end, with the Telegram message received.

## Out of scope

Auto-applying actions, changing risk or capital controls without human approval, and arming or disarming the desk.
