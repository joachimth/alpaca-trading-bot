# CORRECTION WORK ITEM: Control-44

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - reliability-only source correction; deployment blocked**.

## Exact defect

`src/order-reconciliation.ts` already counted individual read-only `getOrder` lookup exceptions as `lookupFailures` and continued safely without broker mutation. `runScheduledMaintenance` in `src/index.ts` only console-logged the returned reconciliation object: it omitted `pendingLookups` and `lookupFailures` from durable `MAINTENANCE_ONLY` run context and did not elevate a nonzero lookup-failure count to the existing degraded/error status convention. Consequently, a maintenance run could be recorded as `skipped` while unresolved broker-order lookups were present.

## Smallest fix

- Preserve the existing bounded, read-only reconciliation path and `MAX_ORDER_LOOKUPS_PER_INVOCATION` cap.
- Add `pendingLookups` and `lookupFailures` to the durable `MAINTENANCE_ONLY` context.
- When `lookupFailures > 0`, add one bounded structured `BROKER_ORDER_LOOKUP_DEGRADED` reconciliation detail with the lookup counts and set the maintenance run status to `degraded` unless an independent maintenance error already makes it `error`.
- Keep existing severity ordering: `error` wins over `degraded`; degraded wins over skip-only status.
- No order submission, cancellation, close, replace, retry, migration, schedule, sizing, cap, trading, broker-authority, or reconciliation-read semantics changed.

## Regression coverage

`test/maintenance-reconciliation.test.ts` uses a seeded local D1-shaped SQLite database and a broker mock that permits only GET-style recent-order, individual-order, and account-activity reads. It forces one `getOrder` 404, verifies the durable run row contains `lookupFailures: 1` in both `MAINTENANCE_ONLY` context and `BROKER_ORDER_LOOKUP_DEGRADED`, verifies `status=degraded` and `errors=0`, and asserts that no broker mutation method or mutation endpoint was called.

Focused test log: `/workspace/alpaca_control_44_focused_tests.txt`.

## Validation

Required validation for this correction:

- Focused reconciliation/status tests: `bun test test/order-reconciliation.test.ts test/maintenance-reconciliation.test.ts test/skip-reasons.test.ts`
- Full suite: `bun test`
- Typecheck: `bun run typecheck`
- Diff check: `git diff --check`
- Wrangler authentication check: `wrangler whoami`

Logs are saved under `/workspace/alpaca_control_44_*.txt`.

## Deployment and authorization blocker

No deployment was attempted. The requested `wrangler whoami` check is expected to establish whether the local Wrangler session is authenticated; an unauthenticated result blocks deployment and live release/provenance verification. No trigger, submit, cancel, close, replace, retry, migration, preview, or other mutating endpoint is authorized or used for this work item.

## Follow-up

1. Restore authenticated Wrangler access and bind the active Worker, bundle, source SHA, release identity, traffic, and schedule provenance.
2. After an explicitly authorized deployment decision, deploy only the validated artifact and capture the deployment receipt/rollback identity.
3. Repeat separate GET-only verification of maintenance run status and run details, confirming lookup failures are visible as degraded/error according to severity and that broker state remains authoritative.
4. Keep production **OPEN FAIL/DEGRADED** until local source identity is bound to the active deployment and the correction is live-proven.
