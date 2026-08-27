# NOW - Alpaca Trading Bot

- **Control-140** (Aug 27 ~11:00 UTC): All 8 endpoints 200, 0 errors. HEALTHY code/deploy (2.6.0), DEGRADED external. Equity $98,519.70, ACTIVE, not blocked.
- 28 positions ALL strategy=swing, 0 unattributed, 0 daytrading. MV $9,383.32 (2.54x $3,700 cap, pre-existing fills). Swing cap enforcement confirmed. Re-tag stable since Control-126.
- 3 pending sells (720-722: AMD 0.28, LCID 209, NXPI 0.53) accepted/new, filled_qty=0, day orders for Aug 27 13:30 UTC open (2.5h away).
- 100 runs (3798-3897, Aug 26 22:31 - Aug 27 10:51 UTC): 0 errors, 0 CYCLE_LEASE_HELD, 0 gaps. 13+ hours clean since Aug 26 21:21 UTC. Reconcile ok every 10 min. Crypto :08/:38 fail-closed (bars stale 22h+, validTA=0).
- 3 null-strategy trades persistent (703 PLD, 648 NOW, 645 DUK — filled sells, known observability gap).
- Code 22b3dba unchanged, docs HEAD this commit (local only, push blocked github_pat). Worktree clean. No deploy needed.
- Paid-plan upgrade approved but not executed (remedy for historical run-log gaps). Sep 1 D1 enforcement monitoring continues.
