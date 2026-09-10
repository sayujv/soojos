# YouTube offline validation — 10 September 2026

VERIFIED: the current working-source copy passes all three existing offline checks. `node test/e2e-mock.js` reports **19 checks passed**; `node test/mock-run.js` and `node test/metrics.test.js` from `trends/` both report all assertions passed. Exact commands, outputs, elapsed times and source hashes are in the adjacent JSON and logs.

Tests ran in `/private/tmp/soojos-youtube-offline-20260910/source` using Node 20.20.2 and existing dependencies. An explicit macOS sandbox denied network access and writes outside the temporary validation folder; a loopback bind probe returned EPERM before the tests ran. Child processes received only an explicit non-secret environment. No .env was read or copied, and no dependency was installed.

Adversarial cases exercised include malformed compliance verdicts, unresolved [VERIFY] tokens despite a passing model verdict, missing ElevenLabs connection ID, insufficient/refuted claims, missing override sources, quota exhaustion and repeated collection. The current tests preserved the expected blocking behavior.

BROKE ON: the initial attempt could not apply a nested macOS sandbox (exit71, sandbox_apply Operation not permitted). The same restrictive profile was then applied through an approved execution, and all three suites passed. No application failure was observed in these checks.

Side effects were limited to the isolated validation folder: a mock review queue, SVG/PNG-marker thumbnail outputs and temporary synthetic SQLite stores. All **81 included source files** were hash-checked against the original after execution, and the original Git status remained identical. The copy intentionally excluded credentials, Git metadata, installed dependencies, binary data, logs and prior outputs; dependencies were used read-only through NODE_PATH. No original project file was changed.

UNTESTED: live LLM/research calls, actual JSON2Video/ElevenLabs rendering, real thumbnail rasterization, upload OAuth, YouTube publishing, deployed n8n workflow, live trend collection, Notion cache synchronization, analytics and monetization. The mock video URL is a placeholder, not a produced video. Local workflow scheduling/render stages remain disabled and upload/analytics stages remain stubs.

## Documentation reconciliation and next step

The root README's 17-check claim is stale: the current test now passes 19. Its Notion-setup checkbox conflicts with the August5 cache-reconciliation commit; offline cache tests pass, but this does not resolve the live database setup state. Do not change that checkbox without a current read-only source check.

The next useful implementation unit is to reconcile current Notion claims configuration/evidence and specify the smallest approved real-render experiment, including its cost and required human claim approvals. That unit has not been started by this verification. Revenue and time-to-first-dollar remain unassessed.
