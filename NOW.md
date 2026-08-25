# Current focus
- Control-82 reliability correction committed locally; production remains OPEN FAIL/DEGRADED.
- Alpaca HEAD: 1d14eb9f97c16012b54b7ef24e244513c1f3b0bf on fix/remove-premature-position-upsert-entryside, release 2.6.0.
- Live health/config remain 1.0.0/2.4.0; Wrangler auth blocks provenance/deployment.
- Positions remain broker-authoritative: source=alpaca, 21 rows; equity 98410.64 vs last_equity 98504.5039, down 93.8639.
- Caps 5000/3700/2000 USD and four schedules unchanged; observed crypto cadence remains :08/:38.
- Local fixes cover status semantics, bar freshness, equity fallback, and conservative unattributed swing exposure.
- Validation: 213 tests / 796 assertions, typecheck and diff-check pass; no deployment or broker mutation.
- Required next step: authenticated, authorized deployment only if approved, then separate GET-only live verification.
