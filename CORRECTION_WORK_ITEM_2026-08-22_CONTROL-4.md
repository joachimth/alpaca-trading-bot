# Alpaca production control correction work item: Control-4

- **Opened:** August 22, 2026 UTC, during strict read-only production control.
- **Disposition:** **FAIL/DEGRADED**, not healthy.
- **Scope:** reliability and observability only. No cap, sizing, threshold, schedule expression, broker authority, order behavior, or trading semantics changes are authorized by this work item.

## Confirmed live evidence

- All six required GET endpoints returned HTTP 200: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.
- Release identity is failed: live `/health` reports `1.0.0` and live `/api/config` reports `2.4.0`; local deployable source/package/schema/dashboard report `2.6.0`.
- Positions are currently broker-authoritative: `/api/positions` reports `positionsAvailable: true`, `source: alpaca`, and 29 rows. D1 metadata is not being treated as live position state.
- Equity direction is currently upward by `234.4073` (`equity 98504.50` versus `last_equity 98270.0927`), but daily direction is not independently proven because live `change_today` and daily P/L fields are zero.
- Configured caps remain unchanged at `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto. Direct cap-denial/enforcement evidence for every strategy is not available.
- Reconciliation delivery is fresh and structured as `reconcile_cron` / `MAINTENANCE_ONLY`; crypto delivery is present near expected `:07/:37` UTC but records approximately `:08/:38` jitter. Category history is populated through `2026-08-22 06:37:57`, but no fresh successful daytrading or swing strategy run is proven: recent daytrading rows are repeated `CYCLE_LEASE_HELD` skips through `2026-08-20 21:55:24`, while the latest available swing row is an error at `2026-08-18 22:00:36` with position divergence and `RISK_HALTED`.
- Lease-held, error, divergence, and runtime skip/error history remains relevant evidence. Historical crypto failures include `D1_ERROR: too many SQL variables` and `Too many subrequests`; later crypto runs recovered with structured skips. Structured skip details are visible, but analyzed/filtered candidate counts are not persisted in `run_log`.
- Trade lifecycle fields are exposed and current sampled rows are filled with submitted/filled timestamps and inapplicable terminal timestamps null. Sampled `gross`, `fee`, and `net` are all null with `accounting_status: unavailable_fill_lot_exact` and `fee_attribution: none-recorded`; aggregate strategy gross/net is conservative but broker-snapshot/position based, not fill-lot exact.
- Crypto edge wiring is fail-closed in local source and tests, but no production `rawEdgeBps` producer exists; current fee telemetry includes `FEE_DATA_UNAVAILABLE` skips. Run-log schema persists execution/error fields but not analyzed or filtered candidate counts; those counts are console-only. Daily direction is also not independently validated because live daily change and daily P/L fields are zero.

## Local evidence

- `wrangler.toml` and `src/index.ts` contain all four UTC schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`.
- Local source contains broker-authoritative position projection, filtered run predicates and aliases, structured lease/error skips, conservative fee handling, unchanged caps, and fail-closed crypto edge gates.
- Existing focused/full regressions, typecheck, diff-check, and Wrangler dry-run are recorded as passing for the prior reliability correction; this control has not changed code.

## Required correction

1. Complete `alpaca-release-deploy-audit` and `alpaca-missing-cron-run-investigation` to establish whether the live defect is deployment/source drift or scheduler drift.
2. If the exact validated local artifact is deployable under the standing maintenance rule, deploy only that reliability/observability correction after proving its source identity and four schedules. Do not invoke any broker-mutating endpoint or migration.
3. If deployment credentials or source identity remain unresolved, record the exact blocker and leave an explicit follow-up rather than claiming deployment.
4. After any authorized deployment, run separate GET-only verification of release identity, all six endpoints, filtered `/api/runs`, broker-authoritative positions, equity direction, all four schedules, fresh run delivery, trade lifecycle, fees/gross/net, caps, and crypto edge-gate observability.
5. Keep production **FAIL/DEGRADED** until release identity converges, live schedule identity is proven, and the remaining evidence gaps are explicitly closed or accepted by decision.

## Safety boundary

No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint may be called for this work item.

## Execution result

- Focused regressions: **26 passed / 154 assertions**.
- Full regressions: **157 passed / 518 assertions**.
- TypeScript, `git diff --check`, and Wrangler dry-run passed; dry-run upload preview was 281.23 KiB.
- Deployment was attempted under the standing maintenance rule, but Wrangler stopped **before upload** with the exact blocker: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The stored vault credential was supplied through the secure process path, but Wrangler did not receive it; no temporary claim deployment was used.
- Separate post-attempt GET-only verification still shows `/health` version `1.0.0` and `/api/config` version `2.4.0`; positions remain `source: alpaca`, caps remain `5000/3700/2000`, and all six endpoints remain HTTP 200. Fresh canonical and alias run probes currently return matching rows, but older saved captures show empty alias results; alias behavior is therefore not conclusively established. The correction is not live-proven.

## Explicit follow-up

- **Release-control disposition:** **FAIL**. **Live operations disposition:** **DEGRADED**, not healthy.
- **Owner:** Joachim. **Trigger:** restored authenticated Cloudflare/Wrangler deployment access.
- **Acceptance criteria:** deploy only the exact validated 2.6.0 artifact; tie the authenticated receipt to the checked-out source commit and all four UTC schedules; verify matching 2.6.0 across `/health`, `/api/config`, and local release markers; then perform separate GET-only checks for all six endpoints, filtered run predicates and aliases, broker-authoritative positions/source, equity direction, fresh structured terminal records for daytrading/swing/crypto/reconciliation or documented no-op/skip, lifecycle fields, conservative fee/gross/net consistency, crypto edge observability, and unchanged `$5,000/$3,700/$2,000` caps.
- If credentials remain unavailable, retain this exact blocker and leave the follow-up open. Keep release control **FAIL** and live operations **DEGRADED** until acceptance succeeds. The unresolved run-count persistence, alias-capture contradiction, daily-direction gap, and absent production raw-edge producer require explicit acceptance or separate reliability work items before closure. Do not use trigger, submit, cancel, close, replace, retry, migration, or any broker-mutating endpoint.

## Final retry result: August 22, 2026 08:02 UTC

- The committed artifact is `6bbc315b8069962340ef2b338934b108ff88c3ff`; it contains the validated reliability documentation correction and the fixed read-only smoke-test command.
- Focused tests remain **26/154**, full tests **157/518**, typecheck, diff-check, and Wrangler dry-run pass.
- Authorized Wrangler deployment with the stored Cloudflare credential again stopped before upload with the exact error: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` No temporary deployment was used.
- The live Worker therefore remains uncorrected and unverified at `/health` `1.0.0` and `/api/config` `2.4.0`; retain **FAIL/DEGRADED**. Follow-up owner remains Joachim, triggered by a Wrangler-compatible authenticated Cloudflare deployment path.
