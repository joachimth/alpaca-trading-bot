# Control-696 (Sep 18 ~04:00 UTC Fri) - Strict read-only control - HEALTHY

- /health: ok 2.7.0
- /api/config: 2.7.0, guards 150/100/100, floor $97000, caps 5000/3700/2000, crypto disabled, min_conf 0.8 nominal / 0.7 FALLBACK (FINDING 1)
- /api/dashboard: source=alpaca broker-auth, equity $97,131.59 change_today +$49.84 POSITIVE
- /api/positions: source=alpaca, 11 swing (cost $4,992.42, MV $4,820.85), 0 daytrading, 0 crypto
- /api/runs300: 13311->13610 0 id-gaps; post-redeploy>=20:07:07Z 160 runs (13451->13610) 0 err/0 lease/0 time-gaps>360s; newest 13610 04:00:29 reconcile ok
- 2 error runs (13402/13408): DOCUMENTED pre-redeploy C-685 recurrence PQM, cleared by EOD-flatten 13444
- crypto :07/:37 exact post-redeploy 16/16 CRYPTO_DISABLED_BY_CONFIG
- reconcile 13610 04:00:29 dur 2781ms fresh
- swing fire 13489 22:00:44 skipped clean (documented C-690)
- trades 50/50 filled, 0 pending, 0 leaves, 0 null-strategy, filled_lot_exact_unavailable (conservative)
- 241 tests / 893 asserts PASS, typecheck 0, git diff --check clean, zero src diff 2fe9c5a
- Repo HEAD 52c7938 (C-695), docs convention refs prior commit
