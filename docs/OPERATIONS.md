# Operations and release notes

## Current release

The crypto correctness patch in the current worktree is not deployed as of August 9, 2026. No broker order, cancellation, close, or deployment mutation was used while applying or validating it. The deployment identifiers below refer to the prior documented release only.

- Source implementation commit: `fd8be3be647e0a4cdae8f79de89206f9a65172bb` (`Add read-only strategy capital cap cards`)
- Cloudflare deployment ID: `5088dbe0-31f9-4892-a149-a74702bbad4e`
- Cloudflare Worker version: `cb88271c-8712-42a8-88a9-de58c841d3ec`
- Traffic: `100%`
- Dashboard: GitHub Pages, calling only the Worker API
- Dashboard capital-cap source: read-only `capitalCaps` in `GET /api/dashboard`, resolved server-side from runtime-compatible configuration with `$5,000`, `$3,700`, and `$2,000` fallbacks
- Capital-cap failure semantics: missing runtime-compatible configuration overrides use the fallback; malformed, non-finite, negative, HTTP-failed, or otherwise unavailable API payloads display `Unavailable`. The UI never substitutes buying power, cash, equity, portfolio value, or positions.
- Live capital-cap evidence: `/api/dashboard` returned `{ daytrading: 5000, swing: 3700, crypto: 2000 }` with `positionsAvailable: true`; Pages contained exactly three capital-cap cards.
- Account: Alpaca paper trading
- Capital-cap release validation: `bunx tsc --noEmit` passed; 58 tests passed with 171 assertions; `git diff --check` passed; fresh Wrangler dry-run and inline dashboard-JavaScript syntax validation passed; all four Cloudflare schedules and read-only Worker endpoints were verified after deployment.

## Release verification

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

## Natural reconciliation verification

The first natural post-release check completed on August 8, 2026 using only live GET endpoints. `/api/runs` recorded 23 `reconcile_cron` entries between `2026-08-08 06:40:53` and `2026-08-08 10:30:51` UTC. Sixteen runs completed with `MAINTENANCE_ONLY`; seven recorded `CYCLE_LEASE_HELD`. `/api/trades` showed 19 rows with all five lifecycle fields populated: `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; the observed reconciliation window was `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

The maintenance run details reported `trades_executed: 0` and `imported: 0`, and source inspection shows reconciliation calls only Alpaca order reads (`getRecentOrders` and `getOrder`) before persisting D1 state. No reconciliation-caused broker mutation was observed or indicated. A categorical broker before/after conclusion is not available because the Worker exposes no read-only `/api/orders` route and no same-window order snapshot pair exists.

The August 9, 2026 audit found lease starvation: maintenance shared the strategy lease and repeated `CYCLE_LEASE_HELD` skips could block trading. The deployed fix uses separate `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, a 10-minute default TTL, and a 12-second timeout for each Alpaca HTTP request. A maintenance run may still be skipped by another maintenance run, but it must not block a strategy lease.

## Deferred-risk monitoring

The active weekly read-only review job `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`) runs Mondays at 10:00 Europe/Copenhagen. It reviews partial-fill/retry lifecycle, deterministic attribution, fill/FIFO accounting, swing peak-price state, and live integration coverage without triggering broker mutations.

## Known risks

- The crypto patch is local and uncommitted; the previously deployed Worker does not contain these fixes.
- Local validation currently passes: 65 tests, 183 assertions, TypeScript, diff-check, and Wrangler dry-run. No live deployment or broker mutation has been performed for this patch.
- `git diff --check` from the workspace root is contaminated by unrelated generated `/workspace/data` changes; the bot repository diff must be checked with `git -C /workspace/alpaca-trading-bot diff --check`.
- Wrangler dry-run remains validation-only and was not used as a deployment.


- Partial-fill retry/cancel lifecycle is incomplete; scheduled reconciliation is intentionally read-only and does not replace that future design.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; those rows remain excluded from strategy-attributed history unless deterministic attribution is available.
- Swing batch-bar and degraded-data safeguards have been verified in production; future changes should preserve the bounded request and completed-session checks.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- Some historical and broker-only trades still need stronger deterministic strategy attribution and lifecycle correlation.
- Automated coverage includes reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, fee attribution, quantity-aware costs, calibrated swing-edge behavior, and no-side-effect assertions, but not full live-broker integration.

## Next steps

1. Verify the first `reconcile_cron` run, lifecycle-field population, run-log evidence, and absence of broker mutations.
2. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
6. Finish swing trigger attribution and decision-row accounting consistency work.
