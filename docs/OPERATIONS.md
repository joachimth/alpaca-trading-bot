## August 21, 2026 swing-cap correction

The confirmed swing admission gap is corrected locally. Swing BUY checks now carry approved cycle-level entry notional into subsequent checks, so current broker-backed swing exposure plus planned entries cannot exceed the unchanged **$3,700** cap; exhausted headroom is recorded as structured `CAPITAL_CAP` observability. Exits, protective behavior, thresholds, turnover/minimum-size behavior, daytrading, crypto, and all vital caps remain unchanged.

Validation passed on August 21, 2026: focused swing/risk/cap/skip tests, full suite **115 tests / 340 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. The correction is deployed and separately read-only verified. Commit `d9c8ec6fd0315980549078169c3e2d69986700d0` is live as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic. All four schedules and all six GET endpoints passed; no broker-mutating endpoint was used.

Known remaining gaps remain explicit: crypto positive-edge BUYs fail closed as `EDGE_CALIBRATION_UNAVAILABLE` because no production caller supplies calibrated `rawEdgeBps`; several broker lifecycle timestamps and crypto GTC `time_in_force` are not fully persisted; P&L remains model/gross-style plus conservative attributed fees rather than fill/lot-exact accounting; and fresh natural post-release strategy/reconciliation success is still required before health can be declared.

## August 21, 2026 targeted swing-cap correction — local validation status

The confirmed swing capital-cap enforcement gap is corrected locally. Swing cycle entry admission now carries approved BUY notional from earlier proposals into each subsequent `checkEntry` call, enforcing the existing **$3,700** cap across the complete proposal batch despite unchanged broker positions. This is an entry-admission reliability fix only: turnover limits, minimum trade size, confidence/edge thresholds, all strategy caps, exits, and protective exits remain unchanged.

Release validation requirements are: focused swing risk regressions, full `bun test`, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Validation must remain local/read-only; never trigger a strategy cycle or call submit, close, cancel, replace, retry, or another broker-mutating endpoint. After any authorized release, require natural swing-cycle evidence that proposed and submitted BUY notional remains at or below **$3,700**.

## August 21, 2026 strict read-only production control, 08:02:29 UTC

Control result: **DEGRADED**. All six GET endpoints returned HTTP 200. Broker positions remained authoritative (`/api/positions`: 29 positions, `source: "alpaca"`), equity direction was positive (`$98,439.92` versus `$98,270.0927` last equity), and caps remained `$5,000/$3,700/$2,000`.

The checked-in and dispatched schedules are daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. Crypto delivered a fresh `2026-08-21 07:37:34` UTC run with 7 decisions, 0 trades, 0 errors, and structured skips; reconciliation delivered `MAINTENANCE_ONLY` runs through `08:00:31` UTC and exposed a `CYCLE_LEASE_HELD` skip at `07:20:24`. No current-window August 21 daytrading or swing success is yet available, and the historical swing record includes an error at `2026-08-18 22:00:36` UTC, so the control is not healthy.

Filtered run observability, trade lifecycle completeness, gross/net/fee arithmetic, and crypto edge-gate source/test wiring passed. The historical August 10 daytrading exposure of `$5,679.878` remains an explicit prior-release follow-up; no current cap breach was found. This check required documentation/status correction only, not deployment, and used no broker-mutating endpoint.

## Bounded entry-identity fix — August 18, 2026 (deployed and live-verified)

A bounded, non-vital fix removes `Date.now()` from stock/swing entry identity and makes retry duplicate protection deterministic. It does **not** alter the vital caps (daytrading **$5,000**, swing **$3,700**, crypto **$2,000**), confidence gates, max-trade limits, strategy universes, or risk parameters, and it does **not** change the exit decision-correlation gap or the running crypto reservation semantics.

- Daytrading and swing BUY submissions now use a deterministic `client_order_id` derived from the decision ID and symbol (`bot_<decisionId>_<symbol>` / `swing_<decisionId>_<symbol>`) instead of `Date.now()`. This matches the existing crypto pattern (`crypto_<decisionId>_<symbol>`) so every entry has stable retry identity.
- Those BUY submissions now persist immediately through `db.logOrderTrade(order, …)` (the same order-shaped path crypto already uses) rather than a hand-mapped `logTrade` shape, so broker fields, fill state, and timestamps are recorded from the broker response.
- A new reusable `Database.findNonTerminalTradeByClientOrderId(clientOrderId)` detects an existing non-terminal trade before a stock/swing BUY is submitted, so a retry/duplicate of the same decision is skipped before reaching the broker with an auditable `DUPLICATE_ORDER_PREVENTED` skip reason and a decision-status note. Terminal rows (`rejected`/`canceled`/`expired`/`done_for_day`/`stopped`/`replaced`) do **not** block a retry, because they prove the prior order no longer leads to an open position. The lookup orders by `COALESCE(broker_updated_at, timestamp)` then `id` so ties are deterministic.
- Crypto fee telemetry is now routed through the canonical `feeTelemetryFromAggregate` gate with an explicit freshness `maxAgeMs` of **60,000 ms**: telemetry older than the max age fails closed to `unavailable`, sub-threshold samples return `insufficient`, and a failed ledger sync or missing summary returns `unavailable` so an unproven rate is never used for new-entry cost estimation. `getBrokerFeeSummary` now also exposes `cryptoUsdRecent` (the seven-day curated CFEE window) so the aggregate's computed rate matches the existing recent-window rate.

Local validation on August 18, 2026: **101 tests, 294 assertions**, TypeScript typecheck and diff-check passed. Deployment and live verification completed from source commit `f122287703087ab959768d02ec931e21d85319a3`: Cloudflare deployment `03e3ef01-bb25-4010-b4b3-03829e7c09d5`, Worker version `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`, 100% traffic, all four schedules, HTTP 200 read-only endpoints, `/api/positions` source `alpaca` with 38 broker positions, and `/api/dashboard` caps `5000/3700/2000`. Remote D1 reservation/lifecycle schema verification passed. No trading trigger, order, cancellation, close, replace, retry, or other broker mutation was used.

## Lifecycle hardening candidate — August 10, 2026

The hardening candidate keeps broker positions authoritative and keeps GET/read-only reconciliation free of broker mutations. Current-position rows are created or updated only from broker snapshots; requested quantities are never written as filled positions. Decision metadata converges from broker order status, including pending, partial, filled, and terminal rejection states.

Daytrading admission now carries approved entry notional across the current cycle so the existing **$5,000** cap cannot be exceeded by multiple individually valid entries. Swing entries retain immutable decision linkage and newly filled positions are included in the post-submit broker sync. Crypto reservation state is persistent across cycles and fail-closed: active/committed reservation notional is included in the **$2,000** cap calculation, live orders keep reservations beyond the short rate window, unknown post-submit outcomes retain reservations, and terminal broker evidence releases them.

Committed crypto reservations are never released by local TTL alone; only terminal broker evidence releases them. Crypto BUYs below **$10** estimated notional are skipped before reservation/submission with an auditable `MIN_ORDER_NOTIONAL` reason. ATR stop/target intent is stored with the crypto entry trade and used to reconstruct missing position protection after broker-confirmed sync.

Validation receipt: 92 tests, 273 assertions, typecheck, and diff-check passed locally on August 10, 2026. No broker mutation was used. Remote D1 schema verification is complete for the reservation table/index and both trade intent columns. Live deployment is verified: deployment `32fdaa9c-0609-4be1-b16c-6369af4dfc8e`, Worker version `dff3e198-1cb3-49d1-ac5d-706a7d292258`, 100% traffic, all four schedules, and read-only endpoint checks passed. Natural paper-session observation remains the follow-up gate for proving no cap breach or live-order reservation expiry under real post-release cycles.

# Operations and release notes

## August 21, 2026 crypto edge-gate correction

Crypto BUYs now fail closed when `minEdgeAfterCosts` is positive but no calibrated `rawEdgeBps` is available. Confidence is never converted to basis points. The rejection is exposed as `EDGE_CALIBRATION_UNAVAILABLE`, so the missing economics calibration is visible in `run_log.error_details` and dashboard run details instead of being silently treated as a generic risk decision. Daytrading and swing callers do not opt into this gate.

Validation passed with 111 tests and 330 assertions, typecheck, diff-check, and Wrangler dry-run. The correction is deployed as Cloudflare deployment `47158569-968b-4bae-83ad-0c24134d42d2`, Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, at 100% traffic; all four schedules are present. Read-only live checks confirmed `/health`, `/api/config`, `/api/positions`, and `/api/dashboard` returned HTTP 200, with broker-authoritative positions still available. The filtered `/api/runs?trigger=crypto_cron&limit=1` probe returned the latest natural pre-release crypto run at `2026-08-21 07:37:34` CPH with 7 decisions, 0 trades, 0 errors, and explicit skip details. No broker-mutating endpoint was used. A natural post-release crypto run remains pending, and the system must not be called healthy until it confirms the new `EDGE_CALIBRATION_UNAVAILABLE` detail.

Vital caps remain daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`.

## August 21, 2026 reliability correction candidate

The August 21 reliability correction is deployed and live-verified. It aligns legacy strategy `totalPl` with `netTotalPl` while preserving `grossTotalPl`, adds bounded `/api/runs` pagination/filter observability, persists broker-authoritative quantity corrections while retaining the current-cycle BUY safety block, and adds non-terminal stock/swing exit guards with structured `PENDING_EXIT_EXISTS` fields. The final August 21 correction includes mismatch-count context in the cycle event and direct regression coverage; it does not change trading behavior. Caps remain daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`.

Final release receipt: source commit `dab504cb091b2bf20120d9f8d3fd2d18ca61a4dc`; follow-up Cloudflare deployment `b1c1bc11ce6a451da97a8325a70f89bb` accepted after base deployment `07615065-0302-41c6-8a22-4203ea38b5c9`; all four schedules remain present. Local validation passed with 109 tests/321 assertions, TypeScript, diff-check, and dry-run. Separate final GET-only checks passed for health, config, dashboard, positions, runs, and trades.

Remaining degraded follow-up: no post-release successful strategy/reconciliation run is visible yet; the latest reconciliation at `2026-08-21 07:20:24` UTC was `CYCLE_LEASE_HELD`. The unresolved historical partial-exit/mismatch lifecycle remains monitored.

## Dashboard 1102 hotfix — August 10, 2026

The deployed dashboard hotfix makes all GET/read-only `Database` instances skip runtime schema-repair DDL, `ALTER TABLE`, index creation, and schema checks. Trading and write paths retain the existing schema-readiness process, and the Worker `fetch` path has no unconditional `ALTER TABLE positions` repair.

Dashboard fan-out is reduced by removing duplicate per-strategy history queries and bounding performance and category history to 90 rows per series. Current positions remain Alpaca-authoritative; broker position failure returns an unavailable state and never falls back to D1 positions.

Historical August 10 evidence, superseded by the August 18 release below: source commit `4261009` was pushed to `origin/main`; read-only Worker endpoints returned HTTP 200 with broker-backed positions, while Cloudflare identity was not then verifiable because Wrangler was unauthenticated and API requests returned HTTP 403. Remote D1 contained the reservation table/index; 85 tests/257 assertions, typecheck, diff-check, and dry-run passed; no broker mutation was used.

## Current release

The August 18 bounded entry-identity release is live on the Alpaca paper-trading Worker and was read-only verified after deployment. No broker order, cancellation, close, or manual trading trigger was used during release validation.

- Release source commit: `f122287703087ab959768d02ec931e21d85319a3` (`fix: deterministic entry identity and retry guard`)
- Cloudflare deployment: `03e3ef01-bb25-4010-b4b3-03829e7c09d5`
- Worker version: `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`
- Cloudflare control-plane verification: completed August 18, 2026; 100% traffic and all four schedules confirmed
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
2. Commit and push to the active release branch; for this release line use `origin/fix/remove-premature-position-upsert-entryside`, then confirm local `HEAD` equals `git ls-remote origin refs/heads/fix/remove-premature-position-upsert-entryside`.
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
- Current validation and live evidence: 101 tests, 294 assertions, TypeScript, diff-check, and fresh dry-run passed; source commit `f122287703087ab959768d02ec931e21d85319a3` is live as deployment `03e3ef01-bb25-4010-b4b3-03829e7c09d5` / Worker version `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69` at 100%; all read-only smoke endpoints returned HTTP 200; remote reservation/lifecycle schema passed; no broker mutation was used.
- `git diff --check` from the workspace root is contaminated by unrelated generated `/workspace/data` changes; the bot repository diff must be checked with `git -C /workspace/alpaca-trading-bot diff --check`.
- Wrangler dry-run remains validation-only and was not used as a deployment.


- August 6 live evidence showed repeated partial-filled exits and quantity mismatches. This local correction adds the pending non-terminal SELL guard for stock/swing and retains broker-authoritative mismatch protection; paper-session evidence is still required after deployment.
- Partial/fill lifecycle on the entry side: the August 18 release gives stock/swing BUYs deterministic `client_order_id` values and pre-submit `DUPLICATE_ORDER_PREVENTED` guards against retrying a non-terminal order. The August 21 local correction now guards stock/swing SELL/CLOSE paths against repeat non-terminal exits with `PENDING_EXIT_EXISTS`; it does not cancel, replace, retry, or weaken broker authority. Broader partial-fill/cancel/replace lifecycle and paper-session evidence remain follow-ups. Crypto has its own pending-exit guard and deterministic client IDs, but no complete broker retry/cancel/replace lifecycle.
- Order-to-decision correlation: as of the August 18 source candidate, daytrading/swing BUY entries carry a deterministic decision-derived `client_order_id`, and the local generic entry path persists `logOrderTrade` with the decision ID. It remains incomplete that stock/swing **exits** still do not carry a decision-derived deterministic ID, so exit correlation and historical attribution need completion and paper-session evidence. Historical swing/crypto rows without stable attribution remain excluded from deterministic lifecycle attribution.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; those rows remain excluded from strategy-attributed history unless deterministic attribution is available.
- Swing batch-bar and degraded-data safeguards have been verified in production; future changes should preserve the bounded request and completed-session checks.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- Some historical and broker-only trades still need stronger deterministic strategy attribution and lifecycle correlation.
- Automated coverage includes reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, fee attribution, quantity-aware costs, calibrated swing-edge behavior, and no-side-effect assertions, but not full live-broker integration.

## Next steps

1. Observe the first natural paper-session behavior of the deployed deterministic entry identity and retry guard without manually triggering a cycle.
2. Verify the remaining partial-fill, cancel, replace, and retry lifecycle under a paper session, separate from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
6. Keep the documented source-to-deployment mapping synchronized on every future release; Cloudflare artifacts do not embed the Git SHA.
