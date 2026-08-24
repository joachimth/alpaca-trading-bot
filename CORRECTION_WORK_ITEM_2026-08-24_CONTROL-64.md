# Correction work item: Control-64 strict read-only production control

**Date:** Monday, August 24, 2026, approximately 11:00 UTC  
**Disposition:** **OPEN FAIL/DEGRADED**, not healthy. This is a documentation/status-only correction. No deployment, endpoint call, trigger, cycle, order action, migration, or broker-state mutation was performed for Control-64.

## Scope and safety boundary

This record uses the supplied live evidence from a prior strict read-only control and local repository inspection. It does not authorize or perform deployment, Wrangler authentication, endpoint access, cycle triggering, order submission/cancellation/close/replace/retry, schema migration, or any broker mutation. Do not change caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, or trading behavior.

## Exact supplied live evidence

- All six GET endpoints returned **HTTP 200**: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.
- Live `/health` reports version **1.0.0** and `/api/config` reports **2.4.0**; local release is **2.6.0**. Active source-to-artifact provenance is unresolved, so the disposition is **OPEN FAIL/DEGRADED**, not healthy.
- `/api/positions` reports `source=alpaca`, `positionsAvailable=true`, and **29 rows**. Alpaca/broker positions remain authoritative; no D1 fallback is accepted as live state.
- `/api/dashboard` reports account equity **98474.26** versus `last_equity=98504.5039`; the latest equity snapshot is **98494.79**. Broker daily fields are **zero** and are not substituted for the current-vs-last comparison.
- Capital caps are unchanged at **5000 USD** daytrading, **3700 USD** swing, and **2000 USD** crypto.
- Local source retains four crons and their current dispatch: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`. Current crypto delivery remains near `:07/:37 UTC`, and reconciliation delivery remains current near the ten-minute cadence.
- At this approximately 11:00 UTC Monday capture, there is no current Monday daytrading or swing run yet because those schedules do not begin until **13:00 UTC** and **22:00 UTC**, respectively. This is schedule timing, not proof of a missed run. Historical swing run **3182** recorded Cloudflare **subrequest exhaustion** (`Too many subrequests by single Worker invocation`).
- Live filtered rows omit `trigger_alias`/aliases and analyzed/filtered candidate counts. Code/search/status filters and trade pagination are not proven or are ignored on the old artifact; local filter/pagination corrections are not live-proven.
- Trade lifecycle fields are present. Sampled filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact fill-lot economics remain unavailable and must not be inferred.
- Local crypto edge admission is fail-closed when calibrated edge is unavailable and is regression-tested, but this behavior is **not live-proven** on the older artifact. Existing fee freshness remains suppressive; do not loosen it.
- Exact Wrangler blocker: **`You are not authenticated. Please run \`wrangler login\`.`** No deployment is required or possible from this unauthenticated, source-unresolved state. No deployment or broker mutation occurred.

## Correction decision

The local runtime already contains the filter/pagination and crypto fail-closed corrections. No additional safe runtime defect is established by this evidence, so Control-64 deliberately changes documentation/status only. Preserve the existing four schedules, caps, thresholds, sizing, fee freshness, edge policy, order semantics, broker authority, and trading behavior. Keep production **OPEN FAIL/DEGRADED** until authenticated source provenance, a clean immutable artifact, and separate GET-only post-release verification prove the validated local release and the complete control matrix.

## Validation receipts

The focused regressions cover dashboard/read-only behavior, release version, broker-authoritative positions, order reconciliation, risk/fee behavior, and crypto runtime. Receipts are saved under `/workspace/alpaca_control_64_*.txt`:

- Focused: `bun test test/dashboard-readonly.test.ts test/release-version.test.ts test/entry-position-authority.test.ts test/order-reconciliation.test.ts test/risk-fee-aware.test.ts crypto-runtime.test.ts` — **73 passed / 0 failed / 350 assertions across 6 files**; `/workspace/alpaca_control_64_focused.txt`
- Full: `bun test` — **198 passed / 0 failed / 743 assertions across 26 files**; `/workspace/alpaca_control_64_full.txt`
- Typecheck: `bun run typecheck` — **exit 0**; `/workspace/alpaca_control_64_typecheck.txt`
- Diff check: `git diff --check` — **exit 0**; `/workspace/alpaca_control_64_diff_check.txt`

No deployment, Wrangler authentication, endpoint call, trigger, cycle, order action, migration, or broker mutation is part of this validation.
