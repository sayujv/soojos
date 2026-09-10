# Acquisition intake normalizer — 10 September 2026

Built a standalone Python standard-library CLI for explicit local listing metadata. It groups ordinary tracking-link duplicates, retains every original source URL and observation, and keeps distinct listing paths, identity queries and hash routes separate. Conflicting prices/location text stay unresolved. Missing price is unknown; the A$1.5M preference only produces a review flag. Location/sector suitability remains needs_review. Vendor finance is an unverified supplied seller claim with its quote, or unknown; financing approval stays null and no deposit estimate is calculated.

VERIFIED: Nine actual CLI tests passed on Python 3.9.6. The entirely synthetic example normalizes four observations to three groups with one duplicate, showing within-preference, above-preference and unknown prices. A network-denied run returned byte-identical example output. Tests checked source preservation, deterministic output, URL identity boundaries, missing/zero/conflicting prices, unsupported finance claims and malformed inputs. All three inspected source-file hashes remain unchanged.

BROKE ON: Malformed JSON, duplicate object keys, invalid schema/URL/timestamp/price, missing file and invalid arguments correctly return exit 2 with a clear JSON error and no partial success output. Conflicting duplicate prices and locations remain null with preserved observations/review reasons; they are not silently resolved. Empty batches are explicitly flagged.

UNTESTED: Production Notion integration, current schedule/schema, live listing retrieval, seller authenticity, financing capacity, deal terms and received revenue. No authoritative local production repository has been mapped. This prototype does not activate or replace the existing acquisition pipeline.

Worktree: `/Users/sayuj/soojos/.worktrees/task-20260910-acquisition-intake-normalizer`

Branch: `desk/20260910-acquisition-intake-normalizer`; base `8169dd4ac629e3b33deb8e2159d5736063a0afd3`. Final commit and measured elapsed minutes are in `context/desk/outbox/2026-09-10-20260910-acquisition-intake-normalizer.json`.

Run `python3 projects/business-search/prototype/test_normalize.py -v` from the worktree. The prototype README describes the explicit input/normalization contract. `examples/listings.synthetic.json` and `examples/normalized.synthetic.json` show real generated input/output. The JSON report records exact hashes and commands.

Incremental cash: A$0 under the existing subscription. Tokens unknown. No capital, outreach, live scrape, schedule, account, cloud instruction, push or main merge action occurred. Root handles the consolidated Claude handoff.

Next: jointly review this contract against the current existing Notion pipeline and its schedule/schema before integrating. Conservative URL matching can miss cross-site duplicates, and quote containment never proves the seller's claim.
