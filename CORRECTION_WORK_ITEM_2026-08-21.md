# Alpaca production correction work item

- Opened: August 21, 2026 UTC during strict read-only production control.
- Defect: crypto runs at 19:38:03, 20:08:01, and 20:38:00 UTC failed with `D1_ERROR: too many SQL variables`.
- Correction: read-only `broker_fees` enrichment now batches order IDs in groups of 50. The correction was already deployed under the recorded 21:03:38 UTC release receipt.
- Validation: focused 9 tests / 76 assertions, full 154 tests / 488 assertions, typecheck, diff-check, and Wrangler dry-run all passed.
- Separate GET-only post-release evidence: crypto runs at 21:08:11, 21:38:05, 22:08:04, and 22:38:04 UTC completed with zero errors; no additional deployment was required.
- Scope preserved: no capital cap, schedule, threshold, sizing, strategy, broker authority, or trading behavior change.
- Remaining status: production remains FAIL/DEGRADED because fresh daytrading/swing success, exact active Worker identity, calibrated live rawEdgeBps evidence, and deterministic fill/lot gross/fee/net accounting remain unresolved.
- Final audit gaps: schedule captures are inconsistent (three vs four), current endpoint freshness is not independently timestamped, non-filled lifecycle states are absent from the 50-row page, daily change fields are zero despite equity fluctuation, and cap enforcement is configured but not directly proven for all strategies.
- Release-review follow-up: bounded reconciliation remains read-only, but historical live runs show total Worker subrequest exhaustion despite the page budget. Investigate further partitioning as a separate reliability correction; do not change caps or trading behavior, and do not deploy without focused/full regression and separate GET-only verification.
- Exact fill-lot matching remains intentionally unimplemented; keep per-trade gross/fee/net conservative nulls until deterministic attribution exists.

## Strict control follow-up, August 21, 2026

- Control result: **FAIL/DEGRADED, not healthy**. All six required production GET endpoints returned HTTP 200.
- Confirmed passing controls: broker-authoritative positions (`source: alpaca`, 29 rows), positive current-versus-last equity direction, unchanged caps `$5,000/$3,700/$2,000`, four source schedules, structured filtered run aliases, fresh reconciliation, post-correction crypto runs without renewed SQL-variable failure, conservative lifecycle/accounting fields, and crypto fail-closed edge-gate wiring.
- Remaining defects or unexplained gaps: no fresh successful daytrading or swing run, crypto `:08/:38` cadence jitter, historical lease/subrequest errors, null exact per-trade gross/fee/net accounting, incomplete non-crypto fee attribution, unattributed MSTR exposure, zero daily change fields despite equity movement, no live positive `rawEdgeBps` comparison, and unauthenticated Wrangler control-plane identity.
- Correction decision: no source/config/trading-behavior change was justified by this control. The existing reliability work item remains open for evidence and identity repair. Vital caps, schedules, thresholds, sizing, broker authority, and order behavior remain unchanged.
- Exact blocker: `bunx wrangler whoami` returned `You are not authenticated`; deployment/source identity cannot be independently verified. Required follow-up is authenticated read-only Cloudflare verification, then separate natural scheduled evidence and exact fill/lot accounting work. No broker mutation was used.

## Crypto edge-gate/TIF investigation, August 21, 2026

- Investigation result: **no new trading-code correction**. Repository source/history search found no production producer for calibrated `rawEdgeBps`; only the RiskManager input and a test fixture are present.
- Existing safety behavior is retained: crypto sets `requireCalibratedEdge: true`, supplies no raw edge, does not convert confidence to bps, and fails positive-edge BUYs closed as `EDGE_CALIBRATION_UNAVAILABLE`. This is the smallest safe behavior without inventing economics or weakening the configured gate.
- TIF result: source does not reproduce the reported mismatch. `src/crypto-strategy.ts` explicitly sends crypto BUYs with `time_in_force: 'gtc'`; the generic Alpaca client defaults to `day` only when omitted, and broker-returned TIF is persisted. Regression coverage confirms crypto GTC persistence.
- Required follow-up: capture read-only decision/order/client IDs, broker response TIF, persisted `trades.time_in_force`, and deployed source identity if a live `day` row appears. Do not change TIF or edge handling from an unlinked observation.
- Scope preserved: no caps, thresholds, sizing, schedules, trading behavior, migration, deployment, or broker mutation changed. Documentation-only disposition; deployment not required.

## Read-only trade-shape correction, August 22, 2026

- Defect: legacy `SELECT *` trade rows could omit lifecycle/accounting response keys when the underlying schema predated additive columns.
- Correction: normalize the read response to always expose `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, `replaced_at`, `gross`, `fee`, `net`, `accounting_status`, and `fee_attribution`; strengthen combined `/api/runs` filter coverage. This is read-only compatibility behavior and does not perform DDL.
- Source hygiene: `/workspace/alpaca-trading-bot` is the deployable repository. `/workspace/src` is a stale reference tree and is not used for build, validation, or release.
- Invariants: caps remain `$5,000/$3,700/$2,000`; all four schedules, broker-authoritative positions, crypto fee/calibrated-edge fail-closed behavior, crypto GTC behavior, sizing, thresholds, and trading behavior are unchanged.
- Validation: focused 24 tests / 126 assertions, full 156 tests / 511 assertions, TypeScript, diff-check, and Wrangler dry-run passed.
- Release decision: deployment is required to promote the API compatibility fix and is authorized by the standing reliability-maintenance rule. Follow with separate GET-only live verification; no trigger or broker-mutating endpoint is permitted.
- Remaining production status: FAIL/DEGRADED until source identity, fresh daytrading/swing delivery, direct cap-enforcement evidence, exact schedule state, historical subrequest/position-divergence follow-up, and deterministic fill-lot accounting are resolved.
