## August 21, 2026 trade observability correction deployed

Commit `71aad14` is live as Cloudflare deployment `061b8e22-184d-4c46-8f54-2bf0c4682dc8`, version `07c901cc-d936-4bb8-a7e9-8dc6689b0fa3`, 100% traffic. `/api/trades` now exposes conservative gross/fee/net metadata and persisted broker TIF; ledger truncation is top-level degraded. Validation: 153 tests / 483 assertions, typecheck, diff-check, dry-run; separate GET-only verification passed. Production remains FAIL/DEGRADED because fresh daytrading/swing delivery, lifecycle population, calibrated crypto edge, complete cap attribution, and fill/lot-exact accounting remain open.

## August 21, 2026 trade observability correction

Code correction implemented locally: broker `time_in_force` is now persisted, `/api/trades` exposes conservative `gross`/`fee`/`net` fields with explicit fill-lot-unavailable status, and bounded ledger truncation is top-level `degraded`. Focused validation passed: 19 tests / 37 assertions. Full validation and authorized deployment remain pending; production stays FAIL/DEGRADED with no broker mutation performed.

## August 21, 2026 bounded broker-ledger subrequest correction — deployed and post-release verified

The confirmed failing path is addressed: scheduled `syncBrokerLedger` now uses `getAccountActivitiesBounded` with an explicit **5-page / 500-activity request budget** instead of the prior 30-page loop. A page-budget hit returns `truncated: true, degraded: true`, emits structured `BROKER_LEDGER_DEGRADED` observability in scheduled run details, and relies on the existing 3-day overlap plus idempotent activity IDs so later schedules converge without broker mutation. Pending read-only `getOrder` reconciliation lookups remain capped at 8 per invocation. All four schedules, trading decisions, order behavior, and caps $5,000/$3,700/$2,000 are unchanged.

Focused entry-authority, bounded ledger/activity, and reconciliation validation passed: **24 tests / 90 assertions**. Full `bun test` passed with **149 tests / 470 assertions**; `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run` also passed. Direct upload of commit `656cefd1b647c4127e01ddfbebaa8a451e80bd0b` produced deployment `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b`, version `a23c13a1-6b61-4c03-aae9-738d35118af9`, at 100% traffic. The first post-release reconciliation at `2026-08-21 17:21:00 UTC` succeeded with one ledger page within the five-page budget and no degradation. Production remains **DEGRADED, not healthy**: daytrading/swing success, populated lifecycle fields, per-trade gross/fee/net, and live cap enforcement remain incomplete. Post-release crypto delivery was verified at `2026-08-21 17:38:12 UTC` as a structured skip with no subrequest error (`NO_POSITION_TO_EXIT`, `DECISION_HOLD`). No trigger or broker-mutating endpoint was called.

## August 21, 2026 Alpaca correction deployed, production degraded

Cloudflare version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55` serves source commit `30b605ff4bbbb86a60d67a9fb4f4a58d0cbb0be1`; direct upload was required because Wrangler returned a false-positive deployment exit.

GET-only verification passed all six endpoints, broker-authoritative positions (`source: alpaca`, 29 rows), caps `5000/3700/2000`, all four schedules, filtered run aliases, dashboard market value consistency, and snapshot count `29`.

Production remains **DEGRADED, not healthy**: no fresh successful daytrading/swing run, sampled lifecycle timestamps remain null, per-trade gross/fee/net is absent, fee telemetry is unavailable in crypto skips, quantity divergence remains, one crypto cadence gap was observed, and calibrated crypto-edge comparison is unproven. No broker-mutating endpoint was called.
