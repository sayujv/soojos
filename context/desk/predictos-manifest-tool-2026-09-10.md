# PredictOS source comparator — 10 September 2026

Built a read-only CLI with a fixed 13-path source allowlist. Actual comparison of the two known copies found **3 equal files and 10 mismatches**. All 26 source hashes remained unchanged across repeated reads; both run.py hashes match the earlier scope report. **Canonical source remains unresolved.**

**VERIFIED:** 8 real CLI tests passed after observed test-first failures. Equal/mismatched/one-sided/absent paths, stable output, target text that must not execute, linked files/directories/roots/ancestors, dangling links, FIFOs and report write confinement/non-overwrite were exercised. Saved actual evidence survived the output tests unchanged. No-follow descriptor traversal protects each path component; source descriptors are read-only.

**BROKE ON:** Unsafe/missing roots and invalid/existing output destinations are rejected. Excluded or unreadable source paths are explicitly not comparable. **UNTESTED:** Which copy is authoritative, project correctness or any broker/strategy behavior. No target module import/execution, credential/config/database/archive/log content read, source write or source selection occurred.

Use `/Users/sayuj/soojos/.worktrees/task-20260910-predictos-manifest-tool/projects/prediction-betting/prototype/README.md`; exact hashes are in `reports/candidates-2026-09-10.json`. Code commit `1c502fab4a1c8687e284c68c3040e69095a18284` on `desk/20260910-predictos-manifest-tool`. A$0 new cash; tokens unknown. Final evidence commit/accounting is in the completion outbox.

Next: obtain authoritative folder/version confirmation before source edits. Do not run run.py status, which earlier inspection shows opens a broker connection. No Claude joint review or trading-readiness conclusion is claimed.
