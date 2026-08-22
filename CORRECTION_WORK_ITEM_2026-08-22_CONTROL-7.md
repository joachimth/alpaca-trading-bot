# Alpaca Control-7 correction work item: swing halt-reason observability

Date: 2026-08-22
Owner: Joachim
Disposition: FAIL/DEGRADED, not healthy

## Trigger

A review of the swing strategy found that the `RISK_HALTED` branch used `{ reason: riskManager.isTradingHalted() }`, causing structured skip context and the console message to expose the boolean halt flag instead of the actual kill-state reason. Crypto strategy already uses `riskManager.getKillState().reason` for this purpose.

The related production control also has unresolved live/provider evidence: `/health` reports `1.0.0`, `/api/config` reports `2.4.0`, the checked-in deployable source is `2.6.0`, and the latest strict GET-only control observed Alpaca account/positions HTTP 503 responses. Production therefore remains FAIL/DEGRADED.

## Scope and exact files

Changed in this work item:

- `src/swing-strategy.ts` — added the narrow `getSwingRiskHaltSkipContext` helper and changed the `RISK_HALTED` branch to pass/log `getKillState().reason`; no decision, order, schedule, cap, or state-mutation logic changed.
- `test/swing-risk-halt.test.ts` — focused regression proving the context contains the configured reason string and is never boolean.
- `test/audit-regressions.test.ts` — source-contract regression proving the branch uses the reason context and no longer uses the boolean expression.
- `README.md` — corrected stale Control-7 wording, recorded the local fix, validation/deployment disposition, and deferred crypto timing mismatch.
- `docs/OPERATIONS.md` — documented the fixed swing halt reason and preserved fail-closed crypto fee/edge behavior.
- `docs/DEPLOYMENT_RUNBOOK.md` — corrected the release decision from documentation-only to source fix plus tests, and documented deployment blocker and follow-up.
- `/workspace/NOW.md` — updated current workboard state, scope, deferred timing mismatch, and release blocker.
- `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-7.md` — this exact-file correction record.

## Rationale

The structured `RISK_HALTED` reason is operational evidence used to identify which risk control stopped swing entries. A boolean only proves that a halt exists and loses the actionable cause. Returning the kill-state reason aligns swing with crypto while preserving the existing fail-closed halt behavior and all trading boundaries.

## Preserved behavior and risks

- Four configured schedules remain unchanged.
- Capital caps remain exactly `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto.
- Broker positions remain authoritative; no D1 substitution or broker authority change was made.
- Edge gates, TIF, sizing, order behavior, lease boundaries, and mutation boundaries remain unchanged.
- The change is observability-only. The residual risk is deployment/source identity: local validation does not prove the live Worker contains this fix.
- The crypto fee-telemetry timing mismatch is explicitly deferred: observed runs are commonly around `:08/:38` versus configured `:07/:37`. Fee telemetry and calibrated-edge admission remain fail-closed when data is unavailable; this work item does not relax, retime, or reinterpret those gates.

## Validation record (August 22, 2026)

- Focused: `bun test test/swing-risk-halt.test.ts test/audit-regressions.test.ts` — **8 passed, 0 failed, 26 expect() calls**, exit 0.
- Full repository: `bun test` from `/workspace/alpaca-trading-bot` — **157 tests passed, 0 failed, 520 expect() calls**, exit 0.
- TypeScript: `bunx tsc --noEmit` — passed, exit 0.
- Whitespace: `git diff --check -- src/swing-strategy.ts test/swing-risk-halt.test.ts test/audit-regressions.test.ts README.md docs/OPERATIONS.md docs/DEPLOYMENT_RUNBOOK.md NOW.md CORRECTION_WORK_ITEM_2026-08-22_CONTROL-7.md` — passed, exit 0.
- Wrangler: `bunx wrangler deploy --dry-run --outdir /tmp/alpaca-trading-bot-control-7-dry-run` — passed, exit 0; bundle preview reported 281.66 KiB total upload / 63.96 KiB gzip and the configured D1 binding.
- Authentication: `bunx wrangler whoami` — `You are not authenticated. Please run \`wrangler login\`.`; normal deployment was blocked. No temporary preview was used.
- Live verification: not performed because no authenticated normal deployment was available. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

## Follow-up

1. Restore authenticated non-interactive Wrangler access and tie any normal deployment receipt to this exact validated artifact; do not use `wrangler deploy --temporary`.
2. If deployed, perform separate GET-only verification of `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus filtered run queries. Confirm source/version, broker position availability, caps, and no new errors.
3. Observe natural weekday daytrading and swing windows; do not manufacture evidence with triggers or broker mutations.
4. Resolve the deferred crypto timing/fee-telemetry mismatch separately while preserving fail-closed behavior, then close the remaining exact fill/lot accounting and calibrated-edge evidence gaps.

No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called for this work item.
