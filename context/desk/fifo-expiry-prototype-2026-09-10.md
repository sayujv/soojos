# FIFO expiry tracker — verified 10 September 2026

The first Digital Marketplace artifact is a working offline CLI at `/Users/sayuj/soojos/.worktrees/task-20260910-fifo-expiry-prototype/projects/digital-marketplace-business/prototype/tracker.py`, with synthetic examples and exact usage commands in its README. Implementation commit: `b34d43510a7f4cc13e8406427116f2774492332b` on `desk/20260910-fifo-expiry-prototype`. It uses Python’s standard library, with no install or external service.

It reads certificate labels and issue/expiry dates from CSV, calculates six explicit statuses against a supplied date, and exports deterministic JSON or CSV. Missing expiry remains unknown. Invalid dates, issue-after-expiry and duplicate identifiers are reported without silently fixing records. CSV round-trip preserves notes and recomputes all derived statuses. It refuses to overwrite existing files.

**VERIFIED:** All 11 real CLI tests passed. The documented synthetic example produced 1 expired, 1 expires_today, 2 due_soon, 1 current and 1 unknown. Tests and example also passed under a sandbox denying networking and writes outside the task worktree and its temporary verification directory; a loopback bind failed with EPERM before execution. Source input hashes are unchanged. Exact evidence is in `docs/fifo-offline-verification-2026-09-10.log` on the task branch.

**BROKE ON:** Before implementation, the test-first run failed because the CLI did not exist. The finished program correctly rejected malformed CSV, invalid arguments, missing files and overwrite attempts, and retained row-level validation failures for review. No unresolved functional failure was observed in the tested contract.

**UNTESTED:** Real-worker usage, qualified compliance wording review and buyer demand. The program does not assess certificate authenticity, certification validity, employer/site eligibility or compliance, and it has no reminder, account, storefront or payment integration. No Claude joint review has occurred yet.

Actual new cash: **A$0**. Token usage: **unknown**, recorded as null. No sale or return estimate is claimed. The completion outbox records final elapsed minutes and the final evidence commit.

Next: compare the usable artifact with the full FIFO source specification and qualified wording requirements, then run one scoped demand check before launch or capital deployment.
