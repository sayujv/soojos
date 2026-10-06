# Paste-ready prompts for the desk terminals

Written 2026-10-06 from the cloud session. Use when back at the Mac. Each desk runs in its own terminal, so paste one prompt into each. Both read the same brief from the soojos repo without switching branches.

Order of work in each terminal: **diagnose the 5 Oct failure first (read-only), report, then build the diary.** The diary is only worth building once the desk knows why it did nothing.

Before pasting, in any terminal:
```
cd /Users/sayuj/soojos && git fetch origin claude/daily-diary-brief
```

---

## Terminal 1: Equities desk (IBKR Build)

```
Read the brief: git -C /Users/sayuj/soojos show origin/claude/daily-diary-brief:projects/trading-bot/briefs/daily-diary.md

Context: on 2026-10-05 the equities desk placed 0 orders during a major rally. I'm extremely disappointed. From my Telegram alerts and the previous session, what I know:
- No live US equity quotes until about 23:55 AWST (error 10089, streaming entitlement was missing). Fixed by subscribing to the US Equity and Options Add-On Streaming Bundle (NP).
- TWS refused connections at 00:17 AWST (ibkr_session stale, Errno 61 on 127.0.0.1:7496).
- Neither committee produced a conclusion. Post-close summary showed AGENT_HALLUCINATION 88, CHECKPOINT_GAP 36, agent_error 3, sleep_gap 2, llm_budget_exhausted 1, cake_committee_error 1, ibkr_session_dropped.
- Build board: doctor 25/29, attempts 0/12. Failing: Bybit key (ignore), option snapshot 279h stale, event calendar overdue (cpi_release, employment), 1 unregistered artifact.
- News triage record was poor (fast model 3/25 right).
- Shakedown is on at 1 share per order, equity about $2,545.

Step 1, read-only, do not change anything yet: from the desk's own logs and ledger, tell me exactly why there were 0 orders. For each stage (data, signal, committee conclusion, risk gate, order) give counts and the blocker. Explain what AGENT_HALLUCINATION and CHECKPOINT_GAP are and why there were so many. Say how long TWS was down and what the desk did while it was. Tell me anything you are unsure of.

Also, Telegram is far too noisy and the real alerts get buried. In the brief's "Telegram" section, implement the three-tier alerting for this desk: interrupt now, one daily digest, and silent. Stop the news/options_flow unhealthy-recovered flapping, drop the "0 orders, nothing outstanding" 6-hour check, enforce dedupe, quiet hours and the daily cap, and never suppress tier 1. Before changing anything, report last week's Telegram messages grouped by type with counts and the tier each would get, so I can check nothing important gets silenced.

Step 2: after you report, build the daily diary described in the brief for this desk, with the trader's voice, the top-of-the-top benchmark, the execution proof (daily paper-account self-test and no-trade escalation), and notes/doctrine.md. Follow the brief's limits on what you may change yourself. Do not change caps, shakedown mode, the kill switch, arming switches or credentials. File any such change as a proposal for me to approve.

Verify with the brief's acceptance tests before saying it's done, including a dry run on 2026-10-05 data.
```

---

## Terminal 2: Crypto desk (ByBit Build)

```
Read the brief: git -C /Users/sayuj/soojos show origin/claude/daily-diary-brief:projects/trading-bot/briefs/daily-diary.md

Context: on 2026-10-05 the crypto desk placed no trades either. People can at least get their system to make a trade, profitable or not, so I treat this as a defect. What I know from the last report I saw (11:38 UTC on 5 Oct):
- The crypto loop was in paper mode, in a terminal tab. It stops if the Mac sleeps or the app closes.
- Only 3 of 17 specs validated positive (0bec1c911438 VWAP reversion SOL, 349e57c5cdcc VWAP reversion BTC, 0e3ec035b45d opening-range breakout SOL), trading 0.8, 0.1 and 0.1 times a day. Specs trading 3 or more times a day lost heavily.
- Mainnet key verified earlier (contract trade only, IP-restricted). Execution was unarmed and venue was Bybit testnet.
I have not seen logs after that report, so I don't know the real cause.

Step 1, read-only, do not change anything yet: from the logs, tell me exactly why there were no trades from 5 Oct to now. Was the loop running the whole time or did the Mac sleep or the tab close? Did any signal fire? If yes, where did it die (gate, sizing, order, venue)? If no, how many signals were expected and why zero? Tell me what you are unsure of.

Also, Telegram is far too noisy. In the brief's "Telegram" section, implement the three-tier alerting for this desk: interrupt now, one daily digest, and silent. Stop component flapping alerts, drop "nothing happened" checks, enforce dedupe, quiet hours and the daily cap, and never suppress tier 1. Before changing anything, report last week's Telegram messages from this desk grouped by type with counts and the tier each would get, so I can check nothing important gets silenced.

Step 2: after you report, build the daily diary described in the brief for this desk, with the trader's voice, the top-of-the-top benchmark, the execution proof (daily testnet self-test that places and closes one minimum-size order, plus no-trade escalation after 2 zero days), the always-on check, and notes/doctrine.md. Follow the brief's limits on what you may change yourself. Do not change risk or capital controls, arming switches, leverage or credentials. File any such change as a proposal for me to approve.

Also propose, as an action for me to approve, moving the loop from the terminal tab to launchd so a sleeping Mac or closed tab doesn't stop it.

Verify with the brief's acceptance tests before saying it's done, including a dry run on 2026-10-05 data.
```

---

## Notes for you (not for the terminals)

- The brief lives on branch `claude/daily-diary-brief` in `sayujv/soojos`. If the Mac's soojos checkout is behind, the `git fetch` line above is what pulls it.
- If a terminal can't reach `/Users/sayuj/soojos`, paste the brief's contents directly after the prompt.
- Live-money anything stays your decision. The prompts only allow paper/testnet self-tests.

---

## Paste FIRST in each terminal (added 2026-10-06, before the prompts above)

These were written in the cloud chat after the prompts above and are the priority for tonight. Paste the matching block, then the prompt above, then the working rules at the bottom.

### Equities (IBKR) priority zero

```
Priority zero, before anything else, before the diary: make sure the desk is ready for tonight's US open at 21:30 AWST. Do not change caps, shakedown mode, the kill switch, arming switches or credentials. Report each item as PASS or FAIL with evidence:

1. TWS is logged in and the API port 7496 accepts a connection right now.
2. Live quotes are flowing (marketDataType 1) for a handful of symbols from our universe, not just AAPL and NVDA. No error 10089.
3. The desk process is running, and has been continuously since the last restart.
4. The Mac will not sleep during the session (I am running caffeinate -dimsu myself).
5. The order path works end to end without risk: send an IBKR what-if order for 1 share (no real order) and show the response, or a paper-account order if that can be done without disrupting the live TWS session. Show every stage: signal, risk gate, order build, broker response.
6. Telegram works: send one test message.
7. Kill switch is clear, and say exactly what the arming switches are set to.
8. Both committees run now on a sample input and produce a conclusion. If either still produces AGENT_HALLUCINATION or CHECKPOINT_GAP, show the error and the cause.
9. The event calendar dates (cpi_release, employment) and the option snapshot are fresh, or tell me what's blocking them.

Then add an automatic pre-open check that runs at 21:00 AWST every trading day and sends ONE Telegram message: all-clear, or exactly what's broken. This is a tier 1 message and is never suppressed. Fix anything FAIL that is within your limits, and list anything you can't fix or need my approval for.
```

### Crypto (ByBit) priority zero

```
Priority zero, before the diary: confirm this desk is actually running and able to trade right now, and tell me whether it was broken or simply had no signals since 5 Oct. Do not change risk or capital controls, arming switches, leverage or credentials. Report each item PASS or FAIL with evidence:

1. The crypto loop is running now. Say whether it is in a terminal tab or under launchd, when it last restarted, and any gaps since 5 Oct caused by the Mac sleeping or the tab closing.
2. Both data feeds are live and fresh for all 19 coins, with the timestamp of the latest data for each.
3. API access works: the testnet key connects, and the mainnet key (contract trade only, IP-restricted) still authenticates from THIS machine's current network. If my IP has changed since the key was restricted, tell me, because the mainnet key will fail from here and I need to update the allowlist myself.
4. Order path works end to end on testnet: place the smallest possible order, confirm the fill, close it, and show every stage (signal, sizing, risk gate, order build, exchange response, fill, close) with timings. If any stage fails, show the error.
5. Replay the last 24 hours and every day since 5 Oct of real candle data through the 3 validated specs (0bec1c911438, 349e57c5cdcc, 0e3ec035b45d). Tell me whether each would have fired, when, and what the paper P&L would have been. This answers whether zero trades was normal or a fault.
6. State exactly what the execution mode and arming switches are set to (paper, testnet, or live). Do not change them. If the desk is not going to place any real trade in its current mode, say so plainly.
7. Telegram works: send one test message.

Then add two automatic checks that run daily and send ONE Telegram message each, tier 1, never suppressed:
- A readiness check at 07:00 AWST: all-clear, or exactly what is broken.
- A watchdog: if the loop or either data feed is down for more than 10 minutes, alert immediately, then alert once on recovery.

Also propose, for my approval, moving the loop from the terminal tab to launchd with keep-alive, so a closed tab or crash restarts it. Fix any FAIL that is within your limits and list what you can't fix.
```

### Working rules (paste last, in both terminals)

```
Working rules for this session:
- Report results plainly. If something fails, say it failed and show the output. Do not call anything done until you have run it and shown me the evidence. "Untested" is not "working".
- Where you are unsure of a cause, say "unknown" and tell me what you'd check to find out. Do not guess and then build on the guess.
- Reserve LLM budget for the pre-open check and the diary before anything else spends it (llm_budget_exhausted fired on 5 Oct).
- If a committee is still failing, do not quietly patch around it. Show me the cause and give me 2 or 3 options with the trade-offs and what each would have meant on 5 Oct. I'll choose.
- Commit your work in small steps. Before this session's context gets large or I close it, write a handoff (what's done, what's broken, what's next, what needs my approval) so the next session starts from it.
- Never edit credential files. If one needs changing, tell me exactly what to change and I'll do it.
```
