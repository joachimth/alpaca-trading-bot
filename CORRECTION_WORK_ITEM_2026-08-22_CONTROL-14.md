# Correction work item: Control-14 strict read-only production control

- Date: August 22, 2026
- Control timestamp: 2026-08-22 19:02:10 UTC
- Status: **OPEN - FAIL/DEGRADED**
- Scope: release identity, read-only observability evidence, and deployment follow-up
- Repository: `alpaca-trading-bot`
- Branch: `fix/remove-premature-position-upsert-entryside`
- HEAD at review: `6ba657e` (`docs: clarify trades executed full-fill semantics`)

## Findings

1. All six required production endpoints returned HTTP 200 through GET-only requests.
2. Live `/health` reports `1.0.0` and persisted `/api/config.version` reports `2.4.0`; checked-out deployable source is `2.6.0`. The active Worker/source identity is therefore unresolved.
3. `/api/positions` is currently broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. Dashboard equity is `98,504.50` versus `last_equity=98,504.5039`, a `-0.0039` current-minus-last delta; with `change_today=0`, material equity direction is **CANNOT VERIFY** from this snapshot.
4. Local source retains all four UTC schedules and unchanged caps: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`; caps are `$5,000/$3,700/$2,000`.
5. Live reconciliation is delivering structured `MAINTENANCE_ONLY` skips near ten-minute cadence. Crypto runs are present around `:07/:37` with minute-level jitter. Saturday does not provide fresh weekday daytrading or swing delivery proof. Historical lease-held/error skips remain auditable.
6. Alias filters return canonical `cron` and `reconcile_cron` rows, but live responses omit the locally validated response-only `trigger_alias` field, so the correction is not live-proven.
7. Sampled filled trades expose lifecycle fields, but 50 sampled rows retain `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`. This is conservative, but exact per-fill gross/fee/net consistency is not proven.
8. No new code defect was isolated. Repository source/tests preserve broker authority, schedule wiring, structured skip/error observability, leases, filtered-run predicates, lifecycle semantics, conservative fee handling, and fail-closed crypto fee/calibrated-edge gates.

## Correction and decision

This work item applies synchronized documentation/status updates only. No cap, schedule, threshold, sizing, order behavior, edge gate, broker authority, or mutation boundary changes are justified by the evidence. Production remains **FAIL/DEGRADED** and must not be labeled healthy.

## Validation

- Focused: `bun test test/dashboard-readonly.test.ts test/release-version.test.ts test/risk-fee-aware.test.ts test/crypto-schema-config.test.ts test/trades-executed-semantics.test.ts test/entry-position-authority.test.ts test/order-reconciliation.test.ts` - **54 passed, 0 failed, 263 assertions**.
- Full: `bun test` - **168 passed, 0 failed, 584 assertions**.
- TypeScript: `bun run typecheck` - **passed**.
- Diff: `git diff --check` - **passed**.
- Deployment auth: `bunx wrangler whoami` - **blocked**, exact response `You are not authenticated`.

The crypto runtime coverage is at repository root (`crypto-runtime.test.ts`); there is no `test/crypto-runtime.test.ts` file. No deployment, temporary preview, trigger, or broker-mutating endpoint was used.

## Deployment blocker and follow-up

`bunx wrangler whoami` returned **`You are not authenticated`**. No deployment or temporary preview was attempted. Restore authenticated access and obtain separate deployment authorization, then deploy only the validated artifact if still required. Perform separate GET-only live verification of release identity, all six endpoints, filtered runs, broker source, equity direction, four schedules, caps, natural weekday strategy delivery, crypto cadence, skips/errors/leases, lifecycle fields, and conservative accounting. If acceptance fails, roll back to the last known-good authenticated deployment and repeat the same checks.

No trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoint was called.
