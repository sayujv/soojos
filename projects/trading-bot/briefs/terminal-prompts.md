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

Step 2: after you report, build the daily diary described in the brief for this desk, with the trader's voice, the top-of-the-top benchmark, the execution proof (daily testnet self-test that places and closes one minimum-size order, plus no-trade escalation after 2 zero days), the always-on check, and notes/doctrine.md. Follow the brief's limits on what you may change yourself. Do not change risk or capital controls, arming switches, leverage or credentials. File any such change as a proposal for me to approve.

Also propose, as an action for me to approve, moving the loop from the terminal tab to launchd so a sleeping Mac or closed tab doesn't stop it.

Verify with the brief's acceptance tests before saying it's done, including a dry run on 2026-10-05 data.
```

---

## Notes for you (not for the terminals)

- The brief lives on branch `claude/daily-diary-brief` in `sayujv/soojos`. If the Mac's soojos checkout is behind, the `git fetch` line above is what pulls it.
- If a terminal can't reach `/Users/sayuj/soojos`, paste the brief's contents directly after the prompt.
- Live-money anything stays your decision. The prompts only allow paper/testnet self-tests.
