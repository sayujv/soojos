# Comparative readiness — Equities Desk and YouTube Build

Observed 2026-09-10 15:09 AWST by Astra. This is the approved SoojOS comparison task, not a project build or live-service inspection. Both project repositories were read only. Exact source hashes and Git observations are in `comparative-readiness-2026-09-10.json`.

| Evidence | Equities Desk | YouTube Build |
|---|---|---|
| Checkout | `main`, `34ae039f3357771c8ec247da3a431cea265ab864`, clean | `main`, `abb2d8bb1e538784f84c957fe4c93f7206fc45cb`; 8 modified tracked paths and 5 untracked entries, including the trends subtree |
| Latest continuity | Handoff written 10 September, 10:33 AWST | `context/handoff.md` absent; current code/config changes are not captured in a shared checkpoint |
| Saved validation | 8 September Qanat adoption report records 269 passing pytest tests; its SHA matches the artifact manifest. Later commits touch adapters/docs/research, not core trading code | README reports 17 mock checks and older live script/editor validation; stored output files date to 30–31 July. The current uncommitted test/render/workflow changes have not been freshly validated in this inspection |
| Operational evidence | Latest handoff says nothing running, no launchd agents, strategy work paused by operator; infrastructure questions remain unanswered. This is dated documentary evidence, not a live process check | Local export has `active: false`, 66 nodes, disabled schedule triggers and render/poll HTTP nodes; upload and analytics are NoOp stubs. A deployed n8n instance was not inspected |
| Preserved gates | Execution disabled by project instructions; no arming, broker calls, new backtests, deployment or dormant-service restart | Human claim approval, compliance and finished-video review gates remain; no render, upload, scheduled publishing or live API calls |
| Shared tool access | Current Codex inventory has no callable IBKR connector; a Claude skill/README reference does not provide that connector here | Declared MCP/API integrations were not launched or authenticated; configuration declarations are not runtime verification |

## What the evidence supports

Equities Desk has stronger recent local continuity and saved test provenance. Its latest [handoff](/Users/sayuj/AI/Claude/equities-desk/artifacts/reports/context/handoff.md) explicitly pauses strategy work and leaves infrastructure choices open. [Decision 0005](/Users/sayuj/AI/Claude/equities-desk/artifacts/reports/decisions/0005-qanat-signal-substrate.md) keeps Qanat as a governed signal source, retains the desk pricing engine and defers Q8; no new attempt or engine retirement is justified by this inspection. The root README's Phase 1 framing and backlog contain older status; use the latest dated handoff for the current pause. Broker state, current balances, live data freshness and process status are unverified.

YouTube Build contains substantial pipeline/editor work and current unfinished changes. Its [local workflow](</Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build/workflow/pipeline.n8n.json>) confirms disabled production scheduling/rendering and unfinished upload/analytics nodes. The [README](</Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build/README.md>) still lists Notion claims setup as pending, while the August 5 commit says the cache was reconciled with the live Notion database: a concrete documentation/current-state discrepancy to resolve. Existing output file timestamps do not prove that today's working tree passes. No publication, channel analytics, monetization or revenue was verified.

## One recommended next work unit

Preserve YouTube's existing changes, capture their exact provenance, and run its offline mock verification in an isolated copy containing the current working tree. The [mock test](</Users/sayuj/Downloads/Projects/Youtube Build/Youtube Build/test/e2e-mock.js>) writes `review/queue.json`, so running it directly in the original folder would violate this comparison's read-only scope. Reconcile the observed result with README/setup claims and write a shared checkpoint. Completion means a captured true test exit/result, unchanged original working tree, and a dated list of concrete remaining stages. No LLM API, render, upload, credential edit or publishing activation belongs in that step.

This is a recommendation based on readiness and zero-cash testability, not a forecast that YouTube earns more or sooner. Sourced ROI, time-to-first-dollar, operating-cost coverage and financial opening balances remain unknown for both projects.

## Verification and limits

Actually performed: original instruction reads, Git branch/HEAD/status/recent-history checks, source hashes, workflow JSON parsing, relevant decision and adoption-report inspection, test-output metadata inspection and available-tool inventory check. No project tests or live commands ran; project instructions prohibiting secrets/arming were preserved. The SoojOS claims query returned only general process claims, not project readiness evidence; direct original artifacts supplied the comparison. Cloud chats, external services and accounts were not refreshed in this bounded local task. These findings have not yet received Claude review. This is depth three: stop/report here rather than create another family step.
