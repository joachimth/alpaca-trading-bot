# Current focus
- Control-74 correction complete locally; production remains OPEN FAIL/DEGRADED, not healthy.
- Live GET-only endpoints all returned 200; health/config are 1.0.0/2.4.0 versus local 2.6.0 at cef5a4d.
- Positions source=alpaca with 21 broker rows; equity 98395.25 versus last_equity 98504.5039, down 109.2539.
- Caps unchanged at 5000/3700/2000 USD; four schedules unchanged, crypto near :07/:37 UTC.
- Fresh daytrading/crypto/reconciliation delivery observed; latest swing is stale/error run 3182 with subrequest exhaustion; no live lease-held proof.
- Live run aliases/candidate fields and run filters/pagination remain defective or unverified; trade page offsets repeat.
- Filled gross/fee/net remain conservatively null; aggregate gross-fee-net recomputes, exact per-fill economics unavailable; crypto fee timestamp stale.
- Focused 86/362 and full 204/775 passed, typecheck/diff-check/dry-run passed; no source or broker mutation.
- Deployment blocker: bunx wrangler whoami -> You are not authenticated. Restore secure auth, establish provenance/authorization, deploy only if authorized, then separate GET-only verification.
