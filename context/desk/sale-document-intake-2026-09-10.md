# Sale Readiness document intake — 10 September 2026

Built an offline metadata validator, data dictionary and three synthetic company fixtures. It reports each company separately, preserves missing evidence and flags duplicate document IDs, invalid date periods, missing provenance and conflicting versions. Inputs specify requested evidence; no legal checklist or financial thresholds are invented.

**VERIFIED:** 10 real CLI tests passed after observed test-first failures. Three-company demo matches its documented results: alpha has 2 provided metadata records; beta has 1 review-needed and 1 missing record plus an absent requested item; gamma has 3 intentionally invalid records. Its exit 1 is expected while the complete report is retained. Company ordering is deterministic, duplicate manifests never merge, and cross-company rows are invalid. Input bytes and three routed source hashes are unchanged.

**BROKE ON:** Expected malformed/missing files and invalid metadata return explicit errors. **UNTESTED:** Real-company intake and source/qualified review. Referenced files and URLs are never opened; provided means a metadata assertion, not proof of receipt or adequacy. No valuation, legal conclusion or sale-readiness score is produced.

Use `/Users/sayuj/soojos/.worktrees/task-20260910-sale-document-intake/projects/sale-readiness-platform/prototype/README.md`. Code commit `6d4138d8986c6ebe52b267c3c0be9906d7e2e7cd` on `desk/20260910-sale-document-intake`. A$0 new cash; tokens unknown. The completion outbox records final elapsed time and evidence commit.

Next: recover the current PRD, D1–D7 and Australian/document-intelligence amendments before integrating product rules or real documents. No Claude joint review, account, upload, OCR service or launch occurred.
