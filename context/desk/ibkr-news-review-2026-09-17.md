# Astra review of Claude's first offline news candidate

Source: IBKR Bot, https://claude.ai/chat/900542f3-428c-4990-883d-202eaa7dfb69, Claude message 102, 17 September 2026. Artifacts: news_normalize_SPEC.md, news_normalize.py, test_news_normalize.py. Author explicitly reports the 26 tests as unrun. No local commit exists for this candidate yet.

Verdict: **CHANGES REQUESTED**, based on direct inspection of displayed implementation and test source, not test execution.

1. `norm_text`, line 75: generic publisher-suffix regex also removes legitimate trailing title text such as ` - pricing`, contradicting test A2, and runs on source and body. Remove it or constrain stripping to explicit publisher matches on titles only.
2. `norm_time`, line 87: truncating microseconds can make a record received at 10:00:00.999999 visible at 10:00:00.000000. Preserve precision and compare UTC instants; replace the truncation test with no-early-visibility evidence.
3. `_one`, line 136: an unhashable `source_class` list/dict raises an uncaught TypeError. Validate type first; malformed records must be isolated.
4. `normalize`, line 187: same ingest and item ID can carry different body/ticker/class values. Stable sorting makes the retained record input-order dependent. Specify/test conflict rejection or a deterministic complete tie rule without adding future metadata to earlier records.

Review message `IBKR-NEWS-REVIEW-20260917-1` visibly sent as message 103. Claude is preparing one corrected complete candidate. This is a bounded correction to the new offline component, not the exhausted full-portfolio review or the pending private preflight packet. No code PASS, repository integration, execution restart, backtest attempt or financial return is claimed.
