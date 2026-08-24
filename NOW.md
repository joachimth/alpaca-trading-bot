# Current focus
- Control-70 correction complete locally on 2026-08-24: broker-only reconciliation is structured BROKER_ONLY_RECONCILED, not a false runtime error.
- Broker authority, D1 reconciliation writes, caps 5000/3700/2000, schedules, and trading behavior unchanged.
- Local validation passed: focused 100/469 across 8 files, full 201/763 across 26 files, typecheck exit 0, and diff-check exit 0.
- Production remains OPEN FAIL/DEGRADED: live health/config 1.0.0/2.4.0 versus local 2.6.0.
- Live positions source=alpaca, equity down 98435.13 vs 98504.5039; no fresh Aug 24 swing run; prior subrequest exhaustion remains open.
- Exact per-fill economics and live filters/pagination/aliases/candidate counters remain unavailable or unproven.
- Crypto fee telemetry is labeled available but asOf is 2026-08-18, and conflicting swing exposure aggregates prevent read-only cap-enforcement certification.
- No deployment or broker mutation occurred; Wrangler is unauthenticated. Follow-up: secure auth, clean authorized deployment if needed, separate GET-only verification.
