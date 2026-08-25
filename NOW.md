# Current focus
- Control-86 complete: strict GET-only production control; production remains OPEN FAIL/DEGRADED.
- Exact code-bearing checkout: branch fix/remove-premature-position-upsert-entryside, HEAD ce58d018585200af00032e5d624d6c989c2178fe, release 2.6.0.
- This commit contains the current reliability source/tests; later commits are docs/status only.
- Live health/config remain 1.0.0/2.4.0; Wrangler auth blocker: You are not authenticated. Please run `wrangler login`.
- Positions broker-authoritative: source=alpaca, 21 rows; final recheck equity 98462.83 vs last_equity 98386.6243, up 76.2057; snapshot 98463.06 at 2026-08-25 08:08:13 UTC.
- Caps unchanged at 5000/3700/2000 USD; four local schedules unchanged; crypto live completions around :08/:38, exact :07/:37 unproven.
- Live filters/pagination and exact per-fill accounting remain degraded; local crypto gate is fail-closed but rawEdgeBps has no normal producer found.
- Local reliability fixes: API equity fallback, maintenance lease release, structured schema-gate skip, dashboard accounting visibility, and known-crypto position-symbol normalization.
- Docs corrected; no cap/schedule/strategy-behavior change, no deployment, no broker mutation. Follow-up: authenticated source-tied deployment proof and separate GET-only post-release verification.
