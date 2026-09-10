# IBKR Equities Track — Pre-flight Investigation Findings

Date: 2026-08-27 (03:16–03:27 UTC / 11:16–11:27 AWST)
Investigator environment: local Mac (`/Users/sayuj/soojos`). Sections 4.1, 4.2, 4.6 and the Section 6 verification were run **on the VPS** (`root@5.223.60.162`, hostname `ubuntu-4gb-sin-1`, Hetzner Singapore) over SSH with read-only commands. Sections 4.3–4.5 are web research, run from the Mac.

No files were created, modified or deleted anywhere except this report. Nothing was installed. No orders, no account connections, no new units.

---

## 0. Section 6 verification — PASSED (read this first)

| Check | Start (03:17 UTC) | End (03:25 UTC) | Result |
| --- | --- | --- | --- |
| `momentum-os.service` | active, MainPID 4157082, NRestarts=0, started 2026-08-25 14:32 UTC | same PID, NRestarts=0, same start time | unchanged |
| `orderflow-capture.service` | active, MainPID 3426892, NRestarts=0 | same PID, NRestarts=0 | unchanged |
| momentum-os RSS | 1,296 MB (ps) / 1,376 MB (cgroup) | 1,384 MB (cgroup) | normal drift (+8 MB in 8 min; see 4.1 leak note) |
| orderflow-capture RSS | 55 MB (ps); cgroup 537 MB | 51 MB (ps); cgroup 64 MB | RSS unchanged; the cgroup figure dropped because its page cache was reclaimed — not a restart |
| `/opt/momentum-os` files modified since 03:16 UTC, excluding `data/ logs/ runtime/` | — | **0 files** (`find -newermt`) | no modification by me |
| `/opt/momentum-os` file-tree hash (path+size+mtime, excl. logs/data/journal) | `014326a7…` | `31b00747…` — **differs**; traced to exactly one file: `runtime/orderflow_alerts.jsonl` (3.6 MB, mtime 03:22:18), written by Momentum's own capture service. Hash excluding `runtime/` is stable across the session. | explained, not mine |
| venv `pip list` package count | 111 | 111 | unchanged |
| system `pip3 list` count / `dpkg -l` count | 88 / 672 | 88 / 672 | unchanged |
| `/etc/systemd/system/*.service` + `*.timer` | 9 files | 9 files | unchanged |
| root crontab | 3 entries (`pre_session_brief.py`) | same md5 | unchanged |
| `/etc/cron.d` | `e2scrub_all` only | same | unchanged |

Load average never exceeded 0.70 during the session (2 vCPU).

---

## Flags — worse than expected / materially changes feasibility

1. **Momentum OS has a memory leak and is being OOM-killed roughly every 4 days.** Kernel/systemd log for August: OOM kills on **Aug 2** (3.2 G peak), **Aug 10** (3.4 G peak), **Aug 15** (3.2 G peak); a clean restart Aug 6 (2.8 G peak). Each kill is `momentum-os.service` itself, ~4 days after start, with `Restart=always` bringing it back in 10 s. Current process: 1.38 GB after 37 h. Nobody set up the IBKR stack yet and the box is already exhausting itself. **This changes the answer to 4.1 from "marginal" to "no, not until this is fixed or the box is resized."** (Aug 15–24 the process peaked at only 1.8 G over 9 days — something changed around Aug 24 (`config/regime_map.py`, `config/monitor_params.py` were edited 2026-08-24); whether the leak is gone or slower is unknown.)
2. **No swap.** `SwapTotal: 0`. Every memory overrun goes straight to the OOM killer, which selects the largest anon-RSS process — today that is Momentum OS, and with a 1–2 GB JVM alongside it would be a coin-flip between the two.
3. **`ib-insync 0.9.86` is already installed in the Momentum OS venv** (`requirements.txt:35`, "Phase 5 — IBKR broker connectivity"), and Momentum OS contains three IBKR adapter modules (`core/brokers/ibkr_adapter.py` 718 lines, `ibkr_live_adapter.py` 624, `ibkr_market_data.py` 299). ib_insync is archived (author died Mar 2024). Not a problem for this investigation, but the new project must not share that venv, and the prior IBKR work is a precedent worth reading before writing a spec.
4. **IBC — the standard headless auto-login supervisor for IB Gateway — is being retired on 1 September 2026** (4 days from now); 3.24.2 (2026-08-21) is the final line, no further development. Any headless design must either accept an unmaintained IBC, use a Docker image that vendors it (`gnzsnz/ib-gateway-docker`), or go the Web API / OAuth route.
5. **TWS/Gateway 10.48+ moved from Java 17 to Java 25** and IBKR's own recommendation for API users is a 4000 MB heap. Docker images default the Gateway heap to 768 MB. Measured RSS figures for a running Gateway were not found anywhere; the 1–2 GB assumption in the brief is plausible but unverified.
6. **A TWS instance was installed and run on this Mac** (`~/Jts/`, launcher.log dated 2026-06-03, installer 4.128). Not read further; noting existence only. The VPS has no Java, Xvfb, or IB software installed (`dpkg` grep negative).
7. **FINRA's PDT $25k rule is being phased out** (effective 2026-06-04, transition to 2027-10-20); IBKR says accounts "may still be subject to existing PDT rules during the transition". `DayTradesRemaining` semantics may shift mid-project — do not hardcode 3.

---

## 4.1 Memory and resource headroom (VPS)

Hetzner CX22-class: 2 vCPU, 3.7 GiB RAM, 75 GB disk, Ubuntu (systemd 259, kernel 7.0.0-15), Python 3.14.4 system.

| Metric | Value (03:17 UTC) |
| --- | --- |
| MemTotal | 3,900,688 kB (3.72 GiB) |
| Used / Free / Available | 1.8 GiB / 299 MiB / **1.9 GiB** |
| Cached | 1.74 GiB (mostly orderflow data page cache — reclaimable) |
| Swap | **none configured**; swappiness 60 (irrelevant) |
| Load average | 0.60 / 0.41 / 0.36 on 2 CPU; top snapshot 22.7% us, 0% steal |
| Disk | 9.1 G used / 63 G free of 75 G |

**Per-process resident memory:**

| Process | Unit | RSS | cgroup MemoryCurrent | cgroup MemoryPeak (this run) |
| --- | --- | --- | --- | --- |
| `uvicorn dashboard_v2.backend.main:app` (the trading bot) | momentum-os.service | 1,296 MB | 1,376 MB | 1,376 MB (started 37 h ago) |
| `scripts/run_orderflow_capture.py` | orderflow-capture.service | 55 MB | 537 MB (page cache under a 512 M `MemoryMax`) | 539 MB |
| `monitor_collect.py` (oneshot every 5 min) | monitor-collect.timer | transient | — | — |
| `pre_session_brief.py` (cron ×3/day) | cron | transient | — | — |

**Historical peaks (systemd accounting, exists):** momentum-os.service memory peak per run — 3.2 G (ended Aug 2, OOM), 2.8 G (Aug 6), 3.4 G (Aug 10, OOM), 3.2 G (Aug 15, OOM), 1.8 G (Aug 24), 1.0 G (Aug 25). orderflow-capture peaks 513 M / 512.8 M / 405 M — it lives at its 512 M ceiling (page cache), with real RSS ~55 MB.

**sar daily minimum MemAvailable (last 9 days):** 1408, 1523, 1608, 1611, 1521, 1334, **816** (Aug 25), 1066, 1468 MB. The floor in the last week was 816 MB available.

**Orderflow capture growth:** `data/storage/orderflow/` = 3.4 GB; **~121 MB/day**, very steady (Aug 20–26 each 120.7–122.0 MB). At 63 GB free that is ~1.4 years of disk, so disk is not the constraint.

**Verdict — is there room for a 1–2 GB Java process plus a Python app?**
**No.** Numbers: usable RAM ≈ 3.7 GiB. Momentum OS has demonstrated a working set that climbs from ~1 GB to 3.2–3.4 GB over four days before the kernel kills it. Even at its current 1.4 GB, adding a Gateway at the brief's own 1–2 GB estimate plus ~200–400 MB for a Python app leaves 0–1.1 GB, and the observed weekly floor of 816 MB available would go negative. With zero swap, the first overrun is an OOM kill whose victim is whichever process is largest at that moment — Momentum OS with open Bybit positions is a likely target. The only configuration with any margin is: Momentum OS leak fixed (steady ≤1.5 GB) **and** Gateway heap pinned ≤768 MB **and** a hard `MemoryMax` on the IBKR slice — and even that is a ~500 MB margin on a 4 GB box. A separate VPS or a 8 GB resize is the honest answer.

## 4.2 Isolation mechanisms (VPS)

- **cgroup v2 in use:** `/sys/fs/cgroup` is `cgroup2fs`; controllers enabled: `cpuset cpu io memory hugetlb pids rdma misc dmem`. systemd 259.
- **systemd resource control is available and functional:** `orderflow-capture.service` already runs with `MemoryMax=512M` and `Nice=5`, and the cgroup reports `memory.peak` = 538 MB with the process pinned just under the cap — proof the limit is enforced (the app also self-caps RSS per the unit's comment).
- **Momentum OS supervision:** plain systemd, `Type=simple`, `User=root`, `Restart=always`, `RestartSec=10`, `WorkingDirectory=/opt/momentum-os`, `Environment=PATH=/opt/momentum-os/venv/bin`. **No resource limits at all** on `momentum-os.service` (`MemoryHigh=infinity`, `MemoryMax=infinity`, no CPUQuota). No `OOMScoreAdjust`. Companion units: `orderflow-capture.service` (512 M cap), `monitor-collect.service`+`.timer` (oneshot, every 5 min, `Nice=10`). Cron: three `pre_session_brief.py` runs/day as root. Unit files are in `/etc/systemd/system/`; source copies in `/opt/momentum-os/deploy/`.
- **What a second, hard-capped service would need:** a unit under `/etc/systemd/system/` with `MemoryMax=` (hard, OOM-kills the *service's own* cgroup only, not Momentum OS), optionally `MemoryHigh=` for throttling before the kill, `OOMScoreAdjust=500`+ so the global OOM killer prefers it over Momentum OS, `CPUWeight=`/`Nice=` to yield CPU, its own venv, its own user. For IB Gateway specifically: an X display (Xvfb) inside the same unit or a companion unit, and the JVM heap (`-Xmx`) set *below* `MemoryMax` or the JVM will be killed mid-GC. Note the inverse is not yet true — Momentum OS itself has no `OOMScoreAdjust=-…` protection; giving it one is a change to a live unit and out of scope here.

## 4.3 IBKR connectivity requirements (web research, 2026-08-27)

Sourcing caveat: `interactivebrokers.com` and `ibkrcampus.com` returned HTTP 403 to fetches; quotes from them are from search snippets. `interactivebrokers.github.io/tws-api/` (deprecated mirror, still live), GitHub, PyPI and readthedocs were fetched directly.

**Python access options**

| Option | Version / date | Maintenance | Notes |
| --- | --- | --- | --- |
| Official `ibapi` (TWS API) | Stable **10.45** (2026-03-30), Latest **10.50** (2026-08-26) — https://interactivebrokers.github.io/ | Active. 10.49+ open-sourced under GPL at github.com/InteractiveBrokers/tws-api-public (per IBKR changelog snippet; licence file not fetched) | PyPI `ibapi` is **stale (9.81.1, 2020)** — do not use. Distributed as installer/zip only. A "synchronous wrapper" ships from 10.40. |
| `ib_insync` | 0.9.86, 2024-01-10 | **Archived 2024-03-14** (author deceased) | What Momentum OS uses. |
| `ib_async` (ib-api-reloaded) | **2.1.0, 2025-12-08**, Python ≥3.10, CI includes 3.14 | Community; last commit 2025-12-06 — ~8 months quiet; single maintainer | Drop-in rename of ib_insync. |
| IBKR Web API (Client Portal, REST+WS) | current | Official | For individuals the official page says **Client Portal Gateway (Java)** is required; OAuth 1.0a for individuals is community-documented (Self-Service Portal) but not confirmed on a page I could read. No official Python client. |
| `ibind` | 0.1.24, 2026-07-25 | Active, "beta" | Web API 1.0 client; advertises headless OAuth 1.0a. Companion `ibeam` automates CP Gateway login. |
| `ib-fundamental` | 0.0.5 | unknown | `reqFundamentalData` → pandas. |

Sources: https://pypi.org/pypi/ib-async/json · https://github.com/ib-api-reloaded/ib_async · https://github.com/erdewit/ib_insync · https://pypi.org/project/ibapi/ · https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/ · https://pypi.org/project/ibind/

**Gateway/TWS requirement and headless**
- TWS API is a socket API to a running TWS/Gateway; no gateway-free mode (https://interactivebrokers.github.io/tws-api/connection.html). Up to 32 clients per session.
- Headless on Linux: `DISPLAY` required → Xvfb; `xterm` needed by IBC; **IBC 3.24.2 (2026-08-21)** supports 10.48+, notes Java 17→**Java 25** retarget, **retires 1 Sep 2026** (https://github.com/IbcAlpha/IBC, userguide.md). Requires the *offline* installer; installers expire after ~12 weeks (hartza-capital/docker-ib-gateway).
- Footprint: `gnzsnz/ib-gateway-docker` (Gateway 10.45.1j/10.50.1e, IBC 3.24.2, Ubuntu 24.04, Xvfb+x11vnc) defaults `JAVA_HEAP_SIZE=768` MB and recommends ~2 GB total; IBKR recommends 4000 MB for API users. **No measured RSS figure found.**

**Session lifecycle**
- Gateway has Auto Log Off Time *or* Auto Restart Time (daily, no re-auth). Weekly hard boundary: security tokens invalidated **Sunday 01:00 ET**; first login after that needs full 2FA (IB Key push). IBC's `AutoRestartTime` gives "one login per week". Daily auto-restart normally doesn't prompt 2FA; a crash does, and IBC cannot answer 2FA for you — push must be acknowledged within ~3 min or login fails (`ReloginAfterSecondFactorAuthenticationTimeout`, `TWOFA_TIMEOUT_ACTION=restart` re-trigger it). Sources: https://www.ibkrguides.com/traderworkstation/auto-restart-considerations.htm, IBC userguide.
- Reconnection: `nextValidId` on connect signals ready (messages sent immediately after may be dropped — resend). Order ids persist across sessions; `reqIds` to resync. Errors: **326** clientId in use; **1100** IB↔TWS lost; **1101** restored, data lost (resubscribe); **1102** restored, data kept; **502/504** not connected. (message_codes.html)

**Startup account verification**
- `reqManagedAccts` → `managedAccounts` (comma list; also pushed on connect). Prefixes are *not* in the API docs: **U** = live individual, **DU** = paper (same digits as live), **F** = FA master — from IBKR Campus/third-party pages. Ports: TWS 7496 live / 7497 paper; Gateway **4001 live / 4002 paper** (initial_setup.html + Campus). Read-Only API is on by default. Practical assertion: reject if `managedAccounts` has no `DU…` when on port 4002, and vice-versa — Momentum OS's live adapter does *not* do this today (it only asserts the env var is non-blank; see 4.6).

**Order state** (order_submission.html, executions_commissions.html, error_handling.html)
- `orderStatus` values: ApiPending, PendingSubmit, PendingCancel, PreSubmitted, Submitted, ApiCancelled, Cancelled, Filled, Inactive.
- Partial fill: `orderStatus(filled, remaining, avgFillPrice)` + one `execDetails` per execution + `commissionReport`; docs warn `orderStatus` is not guaranteed for every change — monitor `execDetails`. `reqExecutions` returns today's executions (7 days if TWS setting changed).
- Rejection: `error(orderId, code, msg)` — **201** rejected, **202** cancelled (e.g. price check), 110 tick size, 200 no security definition, 321 validation, 10148 can't cancel in state; status goes Inactive/Cancelled. 10147 (order to cancel not found) is community-documented only.
- Across a drop: orders live on IB servers. `reqOpenOrders` = same clientId; `reqAllOpenOrders` = all API clients (no binding); client 0 + `reqAutoOpenOrders` binds manual TWS orders; Master Client ID receives all clients' status. Only the submitting clientId can modify an order. `transmit=False` stages without sending.

Could not determine: official individual OAuth 1.0a eligibility; measured Gateway RSS; bundled Java version from an IBKR page; 10147 official text; release dates of 10.48/10.49.

## 4.4 Account introspection (web research)

| Need | Call / field | Mode | Notes |
| --- | --- | --- | --- |
| Equity, buying power | `reqAccountSummary(reqId, "All", tags)` → `accountSummary`; tags `NetLiquidation, BuyingPower, AvailableFunds, ExcessLiquidity, EquityWithLoanValue, Cushion, Leverage, InitMarginReq, MaintMarginReq, SMA, $LEDGER[:CCY|:ALL]` | **Subscription** — full set then deltas every 3 min; max **2** active summary subscriptions per client | Alternative `reqAccountUpdates(True, acct)` → `updateAccountValue` (one account at a time; keys suffixed `-S`/`-C`). ib_async: `ib.accountValues()` populated automatically on connect; `ib.accountSummary()` lazily subscribes. https://interactivebrokers.github.io/tws-api/account_summary.html |
| PDT / day trades | tags `DayTradesRemaining`, `DayTradesRemainingT+1…T+4` | same subscription | `-1` = unlimited (i.e. not PDT-constrained). **No documented "is flagged PDT" boolean**; only the count and order-time rejection text. FINRA phase-out 2026-06 → 2027-10 may change semantics. |
| Reg T vs Portfolio Margin | **No documented field.** `AccountType` exists but its values are unpublished; `RegTEquity/RegTMargin/SMA` appear for all account types. | — | Only heuristics (compare `InitMarginReq` to 50% of `GrossPositionValue`). Must be treated as operator-supplied config, verified by heuristic, not read. |
| Market data lines | **No call returns allocation or in-use.** Only signal is error **101** "Max number of tickers has been reached" (legacy table; 10190 mapping not confirmed). | — | Allocation: 100 lines minimum; after month 1, max(commissions/8, equity×100/1M); Quote Booster USD 30/mo per +100 lines (max 10). Snapshot `reqMktData(snapshot=True)` doesn't hold a line; `regulatorySnapshot` costs USD 0.01 each; `reqMarketDataType(3)` = free 15–20 min delayed. https://www.interactivebrokers.com/en/pricing/research-news-marketdata.php |

Paper accounts share the live user's market-data subscriptions (one paper per live; enable in Client Portal; not simultaneously). US L1 non-pro: free Cboe One/IEX non-consolidated stream; "US Securities Snapshot and Futures Value Bundle" USD 10/mo waived at ≥USD 30 commissions; consolidated Network A/B/C priced separately (page 403 — prices not captured). TWS API requires IBKR Pro (Lite excluded, per third-party comparison).

Could not determine: `AccountType` values; any margin-regime or PDT-flag field; 10190 mapping; Network A/B/C prices; behaviour of `DayTradesRemaining` during the FINRA transition.

## 4.5 Tier trigger data availability (web research)

**Trigger 1 — news volume vs 20-day median**
- IBKR: `reqNewsProviders`; `reqHistoricalNews(conId, "BRFG+BRFUPDN+DJNL", start, end, totalResults≤300)`; streaming `reqMktData(genericTickList="292:…")`. The three free feeds are **sparse** (~a dozen headlines/quarter for a mega-cap in a worked example) — poor for a count-based trigger. Benzinga via API ~USD 35/mo; DJ/Reuters API prices not found. Historical look-back limit undocumented. https://interactivebrokers.github.io/tws-api/news.html
- yfinance 1.4.1 (present in Momentum venv): `Ticker.get_news(count=…)` — **no date filter, no history**; would need daily polling + own store. Rate-limit fragility documented through 2025.
- Free with date-bounded per-ticker lists: **Finnhub** `/company-news?from&to` (60 calls/min, ~1 yr history — look-back not verified on official docs) and **Alpaca** `/v1beta1/news` (Benzinga-sourced, free tier, 15-min lag, 50/page). Alpha Vantage NEWS_SENTIMENT: 25 req/day free — too few. GDELT: free, keyword-based, 15-min cadence, noisy.
- Latency: streaming real-time on IBKR/Benzinga; minutes for Finnhub/Alpaca; daily polling for yfinance.

**Trigger 2 — earnings within 5 trading days**
- IBKR: `reqWshMetaData` / `reqWshEventData` — requires Wall Street Horizon subscription (snippet: USD 149/mo institutional; non-pro price **not found**; free trial exists). `reqFundamentalData(…, "CalendarReport")` — subscription requirement not determined (403). https://interactivebrokers.github.io/tws-api/wshe_filters.html
- yfinance: `Ticker.calendar["Earnings Date"]`, `get_earnings_dates()` — free; **estimates**, no confirmed flag; known off-by-one-day and missing-future-date bugs (issues #2371, #2559, #2566, #2594).
- Other free: Nasdaq unofficial `api.nasdaq.com/api/calendar/earnings?date=` (whole market per call, no ToS); Finnhub `/calendar/earnings` (free tier); Alpha Vantage `EARNINGS_CALENDAR` CSV (one call covers all — fits 25/day). EDGAR 8-K Item 2.02 is backward-looking only.
- Latency: daily is adequate.

**Trigger 3 — volume >2× 20d avg on a >3% day**
- IBKR: `reqHistoricalData(… "30 D", "1 day", "TRADES")` — **requires a Level 1 streaming subscription even for daily bars** (unlike TWS charts); pacing **60 requests/10 min**, 50 open — a 600-name universe refresh is ~100 min unless you keep a local store and fetch increments. Tick 21 via generic tick 165 gives a **90-day** average volume (not 20). `reqScannerSubscription` (`HOT_BY_VOLUME`, `TOP_PERC_GAIN`, `avgVolumeAbove` filter) needs no data subscription but caps at **50 rows / 10 scans** and its ratio definition is undocumented. Delayed type 3 does not unlock history. https://interactivebrokers.github.io/tws-api/historical_limitations.html
- yfinance: `yf.download(list, period="2mo", interval="1d")` — free, bulk, EOD; the cheapest path; unofficial, blocking episodes in 2025.
- Others: Massive/Polygon Stocks Basic free (5 calls/min, EOD, grouped-daily endpoint returns whole market in one call; Starter USD 29/mo); Alpaca free (IEX-only volume — **biased for a volume-ratio trigger**; Plus USD 99/mo SIP); Tiingo free (500 symbols/month, 50 req/hr).
- Latency: EOD for free sources; IBKR intraday with subscription.

**Trigger 4 — supplier/customer relationship (hardest)**
- yfinance and IBKR expose **nothing**: no `Ticker` attribute; `reqFundamentalData` types are ReportSnapshot/ReportsFinSummary/ReportRatios/ReportsFinStatements/RESC/CalendarReport (no relationship report; XML not sampled).
- (a) SEC filings: EDGAR full-text search (`efts.sec.gov/LATEST/search-index`, free, 10 req/s, UA header) finds every 10-K *mentioning* a name — needs a classification pass. XBRL `ConcentrationRiskPercentage1` is dimensioned by `MajorCustomersAxis` with company-specific members often literally "Customer A"; ASC 280 requires disclosing ≥10% customers' revenue but **not their identity**; there is **no supplier equivalent**. So: customer links recoverable only when the customer is ≥10% of the supplier's revenue; who supplies a Core name is almost never structured. Effort (assessment): days to build, hours of compute, skewed coverage.
- (b) Free/academic: Compustat Segment customer file and FactSet Supply Chain academic copies are institution-licensed only; every Kaggle/GitHub "supply chain" dataset found is synthetic logistics data, not listed-company graphs; Wikidata not evaluated.
- (c) Paid: **FactSet Supply Chain Relationships API** (ex-Revere; customer/supplier/partner/competitor, both directions; price on contract only); Bloomberg SPLC (terminal ~USD 32k/yr); S&P Panjiva / ImportGenius (bill-of-lading only — physical imports; ImportGenius USD 125–899/mo); **Finnhub `/stock/supply-chain`** (premium; module ~USD 50/mo per third-party pricing, exact module/price **not determined**); EODHD/FMP — no relationship endpoint confirmed.
- (d) LLM extraction from 10-K Item 1/1A and transcripts: published RAG pipelines exist (J. Oper. Res. Soc., Jan 2026; Int. J. Prod. Res., Nov 2025); no precision/recall against FactSet ground truth published; direction (supplier vs customer vs partner) is the main error class; cost is tokens over the universe's 10-Ks plus entity resolution.

Could not determine (4.5): WSH non-pro price; DJ/Reuters/FLY/Briefing API prices; `reqHistoricalNews` look-back; WSH confirmed/projected flag; which `reqFundamentalData` reports need Refinitiv; US L1 prices; Finnhub free look-back and supply-chain module price; Alpha Vantage gating; Polygon free news; FactSet price; EODHD/FMP relationship endpoints.

## 4.6 Reusable patterns in Momentum OS (VPS, read-only)

| Pattern | Path | What it does |
| --- | --- | --- |
| **Event log (JSONL)** | `core/events/event_log.py` | `append(event_type, data)` writes one JSON line to `data/storage/events.jsonl`, open/close per call (POSIX append atomicity). **Exact fields:** `timestamp_awst` (naive `datetime.now().strftime("%Y-%m-%dT%H:%M:%S")` — see tz note), `type`, `event_type` (compat duplicate added 2026-06-11, both written), `data` (dict). Never raises; failures → stderr. `read_recent(n)` tolerant parser. Thin `EventLog` class wrapper. |
| **Atomic JSON write** | `core/atomic_io.py` | `atomic_write_json(path, data, indent=2)`: `tempfile.NamedTemporaryFile(dir=same dir, suffix=".tmp")` + `os.replace`; unlinks temp on failure. Used for `orders.json / open_positions.json / suggestions.json / journal.json`. |
| **Journal schemas** | `journal/schema.py`, `journal/trade_log.py`, `journal/session_log.py` | Dataclasses `TradeLog` / `SessionLog` with `validate()` / `to_dict()`, enumerated vocab (`VALID_MARKETS = ["crypto","us_equity"]`, `VALID_SESSION_WINDOWS`, `VALID_REGIME_STATES`, `VALID_AGGRESSION_LEVELS`, `VALID_SETUP_TYPES`, `VALID_EXIT_REASONS`, quality/conviction/extension/vwap enums). Storage is a flat JSON array (`JOURNAL_PATH` from `config/settings.py`) loaded/rewritten whole via `_load_all/_save_all`. No-trade sessions are logged deliberately. |
| **Telegram** | `core/alerts/telegram.py` | `send_alert(message)`: raw `requests.post` to `https://api.telegram.org/bot{token}/sendMessage`, json `{chat_id, text}`, 5 s timeout, no SDK. Token/chat from env `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`; gate `TELEGRAM_PUSH_ENABLED` in `config/phase3_params.py`. **Never raises**; always appends a `telegram_alert` event `{message, sent}`; disabled mode logs without sending (useful for dry runs). |
| **Config / secrets loading** | `config/settings.py:12-14` (`from dotenv import load_dotenv; load_dotenv()`), `config/phase5_params.py:20`, `scripts/monitor_collect.py` | `.env` at repo root (`.env.example` documents keys incl. `IBKR_PAPER_HOST/PORT`, `IBKR_CLIENT_ID`, `IBKR_LIVE_HOST/PORT`, `IBKR_LIVE_ACCOUNT_ID`). Lesson recorded in `monitor_collect.py`: standalone scripts that skip the config import silently lose env vars — every entrypoint must `load_dotenv()`. Not read: `.env` itself. |
| **Timezone** | no `now_awst()` helper exists. `config/settings.py:26 OPERATOR_TIMEZONE = "Australia/Perth"`; **`AWST = timezone(timedelta(hours=8))` is re-declared locally in ≥9 modules** (`core/brokers/bybit_market_data.py:38`, `core/alerts/alert_summary.py:24`, `core/cowork/market_context.py:17`, `core/cowork/cowork_reviewer.py:25`, `core/execution/session_close.py:23`, `trade_manager.py:380`, `demo_executor.py:286`, `risk_engine.py:315`, `dashboard_v2/backend/routers/orderflow.py:18`); usage pattern `moment_utc.astimezone(AWST).date()`. `event_log.py` uses **naive `datetime.now()`** — and the VPS clock is **Etc/UTC**, so `timestamp_awst` in events.jsonl is actually UTC-labelled-AWST. Copy the fixed-offset idea (Perth has no DST), but as one helper, and never naive. |
| **systemd unit structure** | `/etc/systemd/system/momentum-os.service`, `orderflow-capture.service`, `monitor-collect.service`+`.timer`; sources in `deploy/` | Shape: `Type=simple`, `WorkingDirectory=/opt/<app>`, `Environment=PATH=/opt/<app>/venv/bin`, `ExecStart=<venv python> …`, `Restart=always|on-failure`, `RestartSec=5-10`, `WantedBy=multi-user.target`; capture unit adds `After/Wants=network-online.target`, `MemoryMax=512M`, `Nice=5` and a header comment explaining separation ("a capture crash never touches trading"). Monitoring is a `oneshot` + timer (`OnBootSec=2min`, `OnUnitActiveSec=5min`), writing `data/monitor/vps_snapshot.json`, explicitly outside the trading process. |
| **Python / venv** | `/opt/momentum-os/venv` (`pyvenv.cfg`: Python **3.14.4**, `/usr/bin/python3.14`, `include-system-site-packages=false`) | Single venv, 111 packages incl. `ib-insync 0.9.86`, `yfinance 1.4.1`, `pandas 3.0.3`, `numpy 2.4.6`, `fastapi 0.136.3`, `uvicorn 0.49.0`, `httpx`, `aiohttp`, `websockets 16.0`, `requests`. `requirements.txt`, `requirements_v2.txt`, `requirements-dev.txt`. System python also 3.14.4. Note: ib_async 2.1.0 lists CI on 3.14 but 3.14 support of the wider stack should be checked at build time. |
| **Startup verification** | `dashboard_v2/backend/main.py:98 startup_event()` → `start_market_data_feed()` (exactly one feed per process), `core/execution/reconciliation.run_startup_reconciliation()` — reconciles local live state against the exchange **before** the scheduler starts; on mismatch writes `reconcile_block.flag` which blocks new live entries until clean run or operator ack; never raises. | Direct IBKR analogue: reconcile local order/position store against `reqPositions` / `reqAllOpenOrders` / `reqExecutions` at connect, gate trading on a flag file. |
| **Execution-safety assertions** | `core/brokers/bybit_live_adapter.py:96 validate_execution_mode()` (10+ `ExecutionSafetyError` checks), `:1093 _require_mainnet_credentials()`; `core/brokers/ibkr_live_adapter.py:77 validate_execution_mode()`, `:607 _require_live_account_id()` (the *only* reader of `IBKR_LIVE_ACCOUNT_ID`; raises on blank; re-checked per call; account id stamped on every order `ib_order.account = self._account_id` line 298), `connect()` lines 176-207 (live port 4001, clientId 3; paper 4002/1; market-data clientId 2). | Pattern to copy: single-reader env var, raise-on-blank, re-validate at call time, separate live/paper classes that don't call `super()`. **Gap to close in the new project:** no check that `managedAccounts` actually contains the configured account / a `DU` prefix on the paper port — the existing adapter trusts the env var. Bybit adapter's key-scope check is the closest "API key scope verification" analogue; IBKR has no key scopes, the equivalent is Read-Only-API setting + account-prefix + port assertion. |

Not read: `.env`, `data/`, `journal/*.json` contents, `session/`.

---

## Could not determine (consolidated)

- Measured RSS of a running IB Gateway 10.4x/10.5x on Linux (only heap defaults/recommendations found) — the 1–2 GB figure remains an assumption.
- Whether the Momentum OS leak persists after the Aug 24 changes (only 37 h of the current run observed; too early).
- IBKR pricing details behind 403'd pages: WSH non-pro, DJ/Reuters/Benzinga API, Network A/B/C, Lite-vs-Pro API row.
- Any API field for Reg T vs Portfolio Margin, PDT-flag, or market-data-line usage — likely none exist.
- Official individual eligibility for Web API OAuth 1.0a.

## Not done (by design)

No architecture, no code, no installs, no copies. Report delivered for operator review before any build specification.
