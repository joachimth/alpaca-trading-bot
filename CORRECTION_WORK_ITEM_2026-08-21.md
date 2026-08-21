# Alpaca production correction work item

- Opened: August 21, 2026 UTC during strict read-only production control.
- Defect: crypto runs at 19:38:03, 20:08:01, and 20:38:00 UTC failed with `D1_ERROR: too many SQL variables`.
- Correction: read-only `broker_fees` enrichment now batches order IDs in groups of 50. The correction was already deployed under the recorded 21:03:38 UTC release receipt.
- Validation: focused 9 tests / 76 assertions, full 154 tests / 488 assertions, typecheck, diff-check, and Wrangler dry-run all passed.
- Separate GET-only post-release evidence: crypto runs at 21:08:11, 21:38:05, 22:08:04, and 22:38:04 UTC completed with zero errors; no additional deployment was required.
- Scope preserved: no capital cap, schedule, threshold, sizing, strategy, broker authority, or trading behavior change.
- Remaining status: production remains FAIL/DEGRADED because fresh daytrading/swing success, exact active Worker identity, calibrated live rawEdgeBps evidence, and deterministic fill/lot gross/fee/net accounting remain unresolved.
- Final audit gaps: schedule captures are inconsistent (three vs four), current endpoint freshness is not independently timestamped, non-filled lifecycle states are absent from the 50-row page, daily change fields are zero despite equity fluctuation, and cap enforcement is configured but not directly proven for all strategies.
