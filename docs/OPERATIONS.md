## Lifecycle hardening candidate — August 10, 2026

The hardening candidate keeps broker positions authoritative and keeps GET/read-only reconciliation free of broker mutations. Current-position rows are created or updated only from broker snapshots; requested quantities are never written as filled positions. Decision metadata converges from broker order status, including pending, partial, filled, and terminal rejection states.

Daytrading admission now carries approved entry notional across the current cycle so the existing **$5,000** cap cannot be exceeded by multiple individually valid entries. Swing entries retain immutable decision linkage and newly filled positions are included in the post-submit broker sync. Crypto reservation state is persistent across cycles and fail-closed: active/committed reservation notional is included in the **$2,000** cap calculation, live orders keep reservations beyond the short rate window, unknown post-submit outcomes retain reservations, and terminal broker evidence releases them.

Committed crypto reservations are never released by local TTL alone; only terminal broker evidence releases them. Crypto BUYs below **$10** estimated notional are skipped before reservation/submission with an auditable `MIN_ORDER_NOTIONAL` reason. ATR stop/target intent is stored with the crypto entry trade and used to reconstruct missing position protection after broker-confirmed sync.

Validation receipt: 92 tests, 273 assertions, typecheck, and diff-check passed locally on August 10, 2026. No broker mutation was used. Remote D1 schema verification is complete for the reservation table/index and both trade intent columns. Remaining release gates are Worker deployment/version/traffic verification and natural paper-session observation proving no cap breach or live-order reservation expiry.

# Operations and release notes

## Dashboard 1102 hotfix — August 10, 2026

The deployed dashboard hotfix makes all GET/read-only `Database` instances skip runtime schema-repair DDL, `ALTER TABLE`, index creation, and schema checks. Trading and write paths retain the existing schema-readiness process, and the Worker `fetch` path has no unconditional `ALTER TABLE positions` repair.

Dashboard fan-out is reduced by removing duplicate per-strategy history queries and bounding performance and category history to 90 rows per series. Current positions remain Alpaca-authoritative; broker position failure returns an unavailable state and never falls back to D1 positions.

Release evidence: commit `4261009` is pushed to `origin/main`; read-only Worker verification at 13:43:32-13:43:35 UTC on August 10, 2026 confirmed `/health`, `/api/runs`, `/api/trades`, `/api/positions`, `/`, and `/api/config` returned HTTP 200, with positions broker-backed from Alpaca. Cloudflare deployment/version/traffic/schedules were not freshly verified because Wrangler was unauthenticated and Cloudflare API requests returned HTTP 403; the documented `24b7df43`/`d304d14c` pair conflicts with a later `5088dbe0`/`cb88271c` artifact. Remote D1 contains `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry`; 85 tests/257 assertions, typecheck, diff-check, and dry-run passed; no broker mutation was used.

## Current release

The crypto correctness and dashboard read-only hardening are documented as deployed as of August 10, 2026, but the current Cloudflare deployment identity was not freshly verified. No broker order, cancellation, close, or manual trading trigger was used during release validation.

- Release source commit: `4261009` (`Bound dashboard reads and remove GET schema mutations`), including crypto hardening `8280696`
- Documented deployment candidate: `24b7df43-a710-479a-96f8-46b879fc9171`
- Documented Worker version candidate: `d304d14c-c6ea-45ca-97ce-47fd6d350c33`
- Cloudflare control-plane verification: unavailable on August 10, 2026; Wrangler was unauthenticated and Cloudflare API requests returned HTTP 403
- Conflicting later artifact remains unresolved: deployment `5088dbe0-31f9-4892-a149-a74702bbad4e`, version `cb88271c-8712-42a8-88a9-de58c841d3ec`, 100%
- Documented traffic candidate: `100%` (not freshly verified)
- Dashboard: GitHub Pages, calling only the Worker API
- Dashboard capital-cap source: read-only `capitalCaps` in `GET /api/dashboard`, resolved server-side from runtime-compatible configuration with `$5,000`, `$3,700`, and `$2,000` fallbacks
- Capital-cap failure semantics: missing runtime-compatible configuration overrides use the fallback; malformed, non-finite, negative, HTTP-failed, or otherwise unavailable API payloads display `Unavailable`. The UI never substitutes buying power, cash, equity, portfolio value, or positions.
- Live capital-cap evidence: `/api/dashboard` returned `{ daytrading: 5000, swing: 3700, crypto: 2000 }` with `positionsAvailable: true`; Pages contained exactly three capital-cap cards.
- Account: Alpaca paper trading
- Capital-cap release validation: `bunx tsc --noEmit` passed; 58 tests passed with 171 assertions; `git diff --check` passed; fresh Wrangler dry-run and inline dashboard-JavaScript syntax validation passed; all four Cloudflare schedules and read-only Worker endpoints were verified after deployment.

## Release verification

Before any deployment that can submit crypto BUY orders, an authorized operator must apply the idempotent reservation migration and complete the read-only verification. The August 10 hardening release recorded that the migration was applied and verified in remote D1; these commands remain the reproducible release gate for future deployments:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
```

The verification must return both `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry`; the trade-intent verification must return `intent_stop_loss_price` and `intent_take_profit_price`. Do not substitute a Worker-triggered CREATE TABLE for this gate. If the table is absent, crypto BUY reservation calls fail closed and no BUY may proceed.

1. Run `git diff --check`, `bunx tsc --noEmit`, `bun test`, and `bunx wrangler deploy --dry-run`.
2. Commit and push to `origin/main`; confirm local `HEAD` equals `git ls-remote origin refs/heads/main`.
3. Build a fresh explicit bundle with `bunx wrangler deploy --dry-run --outdir <new-directory>`.
4. Upload that exact bundle through the direct Cloudflare multipart API. In this proxy environment, do not trust a successful `wrangler deploy` exit code as proof of a new version.
5. Verify the newest Cloudflare deployment has a new version at `100%` traffic.
6. Verify all four schedules, including the read-only `*/10 * * * *` maintenance schedule.
7. Query `/health`, `/api/dashboard`, `/api/trades`, and `/api/runs`; expect HTTP 200. Confirm `/api/dashboard.capitalCaps` contains only finite, non-negative numbers or `null`, and confirm each strategy tab shows either a USD cap or `Unavailable` without using account metrics as a fallback.
8. Query `/api/positions` when checking broker availability and confirm `positionsAvailable: true`, `source: "alpaca"`, and broker-matching symbols.
9. Confirm GitHub Pages contains the Worker URL and no direct Alpaca URL.
10. Never use trading triggers, cycle endpoints, order endpoints, or close endpoints as deployment tests.

See [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) for exact commands and the direct-upload procedure.

## Documentation rule

Documentation is a release requirement. Every source, configuration, schema, migration, test, or operational change must update the relevant README, operations/runbook, release receipt, and next-step status in the same work item. Work is not complete until documented behavior, validation results, deployment state, known risks, and remaining follow-ups match reality.

## Fee-aware P&L and decision policy

- Strategy comparison exposes `grossTotalPl`, `feesUsd`, `netTotalPl`, and `feeAttribution` for each row.
- CFEE is defensibly attributed to crypto. Orderless/regulatory FEE remains account-level and is exposed as `accountLevelFeesUsd`; it is not fabricated into daytrading or swing.
- Current category snapshots and historical cumulative curves remain gross-only. The fee ledger uses a bounded three-day import overlap, while the crypto entry fee-rate uses only positive curated-universe samples from the most recent seven days; all-time net P&L is not yet a fill-exact accounting statement.
- Daytrading and crypto BUY decisions use quantity/notional-aware estimated costs. Crypto entries default to one per cycle and discretionary signal SELL/CLOSE actions default to a separate two-exit budget; protective exits bypass both budgets and the fee gate. Loss-reducing, EOD, and manual closes bypass the discretionary fee gate.
- Swing logs round-trip spread/slippage/fee costs with explicit bps units. `expectedEdgeBps` defaults to zero, so swing BUY is not rejected from an invented z-score-to-bps conversion; configure a calibrated edge before enabling rejection.
- All fee-gate skips must retain the estimated costs and reason in decision/run observability.

## Position-state contract

Alpaca supplies current symbol, quantity, side, prices, market value, and unrealized P&L. D1 supplies matching strategy, stop, timestamp, and historical metadata only. D1-only rows are excluded from current API positions. Broker-only symbols are `unattributed` until ownership is established. A broker-fetch failure is surfaced as unavailable; D1 is never used as a silent live fallback.

## Schedules

- Daytrading: `*/5 13-21 * * 1-5` UTC, gated by Alpaca's market clock.
- Swing: `0 22 * * 1-5` UTC.
- Crypto: `7-59/30 * * * *` UTC, at approximately `:07` and `:37`, 24/7.
- Maintenance/reconciliation: `*/10 * * * *` UTC, read-only broker/order reconciliation under a separate `maintenance` lease. Daytrading, swing, and crypto use isolated leases; each lease expires after 10 minutes so a stalled broker call cannot block unrelated strategies indefinitely.

## Prior-release natural reconciliation evidence

The prior-release natural reconciliation check completed on August 8, 2026 using only live GET endpoints. `/api/runs` recorded 23 `reconcile_cron` entries between `2026-08-08 06:40:53` and `2026-08-08 10:30:51` UTC. Sixteen runs completed with `MAINTENANCE_ONLY`; seven recorded `CYCLE_LEASE_HELD`. `/api/trades` showed 19 rows with all five lifecycle fields populated: `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; the observed reconciliation window was `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

The maintenance run details reported `trades_executed: 0` and `imported: 0`, and source inspection shows reconciliation calls only Alpaca order reads (`getRecentOrders` and `getOrder`) before persisting D1 state. No reconciliation-caused broker mutation was observed or indicated. A categorical broker before/after conclusion is not available because the Worker exposes no read-only `/api/orders` route and no same-window order snapshot pair exists.

The August 9, 2026 audit found lease starvation: maintenance shared the strategy lease and repeated `CYCLE_LEASE_HELD` skips could block trading. The deployed fix uses separate `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, a 10-minute default TTL, and a 12-second timeout for each Alpaca HTTP request. Source inspection confirms distinct `maintenance` and `daytrading` lease keys. Available D1 artifacts do not reconstruct exact historical lease ownership for each skipped invocation, so the verification confirms the design and current evidence boundary, not a complete historical ownership timeline. A maintenance run may still be skipped by another maintenance run, but it must not block a strategy lease.

## Deferred-risk monitoring

The active weekly read-only review job `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`) runs Mondays at 10:00 Europe/Copenhagen. It reviews partial-fill/retry lifecycle, deterministic attribution, fill/FIFO accounting, swing peak-price state, and live integration coverage without triggering broker mutations.

## Known risks

- The crypto patch is deployed, but Cloudflare deployment artifacts do not embed the Git SHA; the release bundle-to-commit mapping is recorded by the release process.
- Validation and live evidence: 85 tests, 257 assertions, TypeScript, diff-check, and dry-run passed; remote reservation schema was applied and verified; all read-only smoke endpoints returned HTTP 200; no broker mutation was used.
- `git diff --check` from the workspace root is contaminated by unrelated generated `/workspace/data` changes; the bot repository diff must be checked with `git -C /workspace/alpaca-trading-bot diff --check`.
- Wrangler dry-run remains validation-only and was not used as a deployment.


- Partial-fill/retry/cancel lifecycle has a confirmed defect: August 6 live evidence showed repeated partial-filled exits and quantity mismatches. Daytrading and swing lack a pending-exit guard, and partial/failed closes can be submitted again on a later cycle.
- Daytrading and swing BUY paths create full D1 positions from requested quantity/decision price before broker fills are confirmed. Partial or pending BUYs can inflate internal quantity; deterministic client IDs are also missing because daytrading/swing IDs use `Date.now()`, so retry duplicate protection is incomplete. Scheduled reconciliation remains read-only and does not repair this lifecycle. Crypto has a pending-exit guard and deterministic client IDs, but no complete broker retry/cancel/replace lifecycle.
- Order-to-decision correlation is incomplete: swing BUYs use `decision_id: null` and time-based client IDs, while swing exits omit the originating decision ID. Historical swing rows therefore cannot reliably support deterministic lifecycle attribution.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; those rows remain excluded from strategy-attributed history unless deterministic attribution is available.
- Swing batch-bar and degraded-data safeguards have been verified in production; future changes should preserve the bounded request and completed-session checks.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- Some historical and broker-only trades still need stronger deterministic strategy attribution and lifecycle correlation.
- Automated coverage includes reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, fee attribution, quantity-aware costs, calibrated swing-edge behavior, and no-side-effect assertions, but not full live-broker integration.

## Next steps

1. Verify a completed post-August 10 `reconcile_cron` run, lifecycle-field population, run-log evidence, and absence of broker mutations without triggering reconciliation; the 07:10, 07:30, and 07:50 UTC runs were skipped, and no completed maintenance run was confirmed in the checked window.
2. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
6. Revalidate the current Cloudflare deployment identity when read-only credentials are available; captured artifacts currently conflict with the documented deployment.
