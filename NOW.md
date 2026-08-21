## August 21, 2026 bounded broker-ledger subrequest correction — local validation complete, deployment required

The confirmed failing path is addressed: scheduled `syncBrokerLedger` now uses `getAccountActivitiesBounded` with an explicit **5-page / 500-activity request budget** instead of the prior 30-page loop. A page-budget hit returns `truncated: true, degraded: true`, emits structured `BROKER_LEDGER_DEGRADED` observability in scheduled run details, and relies on the existing 3-day overlap plus idempotent activity IDs so later schedules converge without broker mutation. Pending read-only `getOrder` reconciliation lookups also remain capped at 8 per invocation. All four schedules, trading decisions, order behavior, and caps $5,000/$3,700/$2,000 are unchanged.

Focused entry-authority, bounded ledger/activity, and reconciliation validation passed: **24 tests / 90 assertions**. Full `bun test` passed with **149 tests / 470 assertions**; `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run` also passed. **Deployment: REQUIRED because Worker source changed; authorized Cloudflare credential is available in the secure vault; current state: NOT DEPLOYED.** Production remains **DEGRADED, not healthy** pending deployment and natural scheduled evidence; no trigger or broker-mutating endpoint was called.

## August 21, 2026 Alpaca correction deployed, production degraded

Cloudflare version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55` serves source commit `30b605ff4bbbb86a60d67a9fb4f4a58d0cbb0be1`; direct upload was required because Wrangler returned a false-positive deployment exit.

GET-only verification passed all six endpoints, broker-authoritative positions (`source: alpaca`, 29 rows), caps `5000/3700/2000`, all four schedules, filtered run aliases, dashboard market value consistency, and snapshot count `29`.

Production remains **DEGRADED, not healthy**: no fresh successful daytrading/swing run, sampled lifecycle timestamps remain null, per-trade gross/fee/net is absent, fee telemetry is unavailable in crypto skips, quantity divergence remains, one crypto cadence gap was observed, and calibrated crypto-edge comparison is unproven. No broker-mutating endpoint was called.
