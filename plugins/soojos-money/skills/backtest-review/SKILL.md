---
name: backtest-review
description: Pressure-test backtest results for overfitting and methodology errors before any strategy is trusted or traded. Use this whenever backtest output, win rates, equity curves, Sharpe ratios or strategy performance numbers appear, whenever a strategy is described as profitable, and whenever the user shares results from a video, course or third party claiming an edge.
---

# Backtest Review

Purpose: most backtest results are noise wearing a suit. Find out which this is.

## Checks, in order

1. **Multiple comparisons.** How many variants were tested? If hundreds or thousands were tried on one dataset, the best result is expected to look good by chance alone. Ask for the number tested and the distribution of all results, not just the winner. A winner that isn't a clear outlier against its own cohort is noise.
2. **Out-of-sample.** Was there a genuine holdout period, untouched during development? A holdout looked at more than once is no longer a holdout.
3. **Walk-forward.** Do parameters re-fit on a rolling basis, and does performance survive it? In-sample-only results are not evidence.
4. **Look-ahead bias.** Does any signal use data unavailable at decision time — same-bar close, restated fundamentals, survivorship-filtered universe?
5. **Costs.** Are spread, commission, slippage and funding modelled? A strategy profitable only at zero cost is not a strategy. Check whether fills assume mid-price.
6. **Sample size.** How many trades? Fewer than a few hundred and the result is not statistically distinguishable from luck, whatever the win rate says.
7. **Regime dependence.** Which market conditions produced the profit, and what happens in the periods excluded from the test?

## Output

```
VERDICT   noise | unproven | worth walk-forward testing
WHY       <the single most damaging finding>
NEXT      <the one test that would resolve it>
```

## Rules

- Be blunt when the answer is noise. A polite review of an overfit strategy costs real money.
- Distinguish clearly between "this result is untrustworthy" and "this idea is bad" — the parameterisation may be worth keeping even when the numbers aren't.
- This is a methodology review, not financial advice, and never a recommendation to trade.
