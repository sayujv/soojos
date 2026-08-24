---
name: risk-check
description: Check that any code or strategy which can move real money has position limits, loss limits and a kill switch before it is allowed to run live. Use this whenever work touches trading, betting, order placement, staking, broker or exchange APIs, or whenever the user talks about going live, running with real capital, or turning a bot on.
---

# Risk Check

Purpose: the difference between paper and live is one flag, and that flag deserves a checklist.

## Blocking checks

Nothing goes live until all six are true and named in the code, not merely intended:

1. **Position cap** — a hard maximum per position, enforced in code, not by convention.
2. **Daily loss limit** — a number that halts trading for the day when breached. Halt means stop, not reduce size.
3. **Kill switch** — one command or file flag that stops everything, testable without the market being open.
4. **Paper/live separation** — live mode requires an explicit, deliberate flag. It is never the default and never inherited from a config file that also drives paper runs.
5. **Credential scope** — the API key can trade the intended instrument and nothing else. Withdrawal permission is never enabled.
6. **Failure default** — on disconnect, exception, or unexpected state, the system stops. It does not retry into the market.

## Process

Check each against the actual code. Report:

```
PASS   <check> — <where it's enforced, file:line>
FAIL   <check> — <what's missing>
```

## Rules

- Any `FAIL` means the answer to "can this go live" is no. State that plainly.
- Do not accept "I'll add it before going live" as a pass. Write the check now or record it as a blocker.
- Never write, modify or read credential files. Say what needs to change and let the user do it.
- This skill does not give financial advice and does not evaluate whether a strategy is worth trading — only whether the machinery around it is safe to switch on.
