# Current focus
- Control-71 strict GET-only production control is OPEN FAIL/DEGRADED, not healthy.
- Live health/config 1.0.0/2.4.0 versus local release 2.6.0; Wrangler unauthenticated.
- Positions source=alpaca; equity is down versus last_equity; caps remain 5000/3700/2000.
- Daytrading/reconcile/crypto delivery observed; no fresh swing proof or lease-held evidence.
- Live PLUG minimum-order 403, subrequest exhaustion, mismatches, stale fee signal, and cap/accounting gaps remain.
- Narrow local fix complete: daytrading BUY broker-minimum preflight with MIN_ORDER_SIZE observability.
- No deployment or broker mutation; focused/full tests, typecheck, diff-check, and separate GET-only recheck complete.
