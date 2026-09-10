# Shop economics calculator — 10 September 2026

Built an offline, single-unit AUD order calculator using exact Decimal cents. All eight price/cost inputs are explicit; missing/null/blank costs leave every calculation unknown. Invalid negative/fractional/nonfinite inputs are rejected. Negative contribution and advertising allowance are preserved.

**VERIFIED:** 10 real CLI tests passed after observed test-first failures. Hand-checked synthetic values produce A$23.45 non-ad costs, A$31.34 total variable costs, A$18.61 contribution and A$26.50 advertising allowance. Lowering the sample price gives −A$21.34 contribution and −A$13.45 allowance. Missing costs and zero price behave as documented. Large exact values and JSON decimal numbers avoid binary-float/context rounding; four documented scenarios and unchanged input bytes verified. Three original source hashes remain unchanged.

**BROKE ON:** Expected invalid input cases fail clearly; no unresolved tested-contract failure observed. **UNTESTED:** Supplier/traffic assumptions, customer demand or any real store. Outputs explicitly mean contribution before overhead/tax, not profit or an approved advertising budget.

Use `/Users/sayuj/soojos/.worktrees/task-20260910-shop-economics-prototype/projects/online-shops/prototype/README.md`. Code commit `31589929bb44bb99c330b42ea4c62e62495fe6fd` on `desk/20260910-shop-economics-prototype`. A$0 new cash; token usage unknown. Completion outbox records final elapsed time and evidence commit. No live financial activity, account, order, purchase, research claim or Claude joint review occurred.

Next: gather actual candidate-product costs and traffic evidence before selecting a store or proposing capital.
