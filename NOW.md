# NOW

- **Sep 30 20:05 CEST Control-998 (18:00z, strict read-only):** Alpaca **OPEN DEGRADED - D1 free-tier READ limit exhausted MID-SESSION, 4th consecutive control (2nd UTC day)**. `/`+`/health`+`/api/account` 200, dashboard/trades/runs 500, positions 503 fail-correct, `/api/config` flapping. NOT deploy-fixable; resets 00:00z. Equity $97,113.27 POSITIVE (~$113 above the $97,000 floor, never touched). No deploy, no mutation, no cap/risk change.
- Captured before the block: run log 500/500 id-contiguous 18847->19346, occ-27 STANDS (sole 320.2 min all-trigger gap 19050 18:41:01z->19051 00:01:12z); today daytrading 177/177 slots, reconcile 89 all on */10 grid, crypto 30 runs :07/:37 fail-closed, zero lease holds, 7 benign POSITION_QTY_MISMATCH runs, zero swing_cron rows.
- Positions (broker read 18:15z, source=alpaca, 23 rows): 15 swing cost $3,647.88, 6 daytrading cost $4,706.38 (< $5,000), 2 unattributed MS/RUN $246.82. Swing-intended cost $3,894.70 = +$194.70 over the $3,700 cap (MV basis $3,565.80 = $134 under).
- **CANNOT VERIFY:** /api/trades + /api/dashboard zero successes across ~700 retries - trade/fill lifecycle and fee/net rows carried from C-986..C-992; re-attempt after the 00:00z reset.
- Identity PASS content-hash: live index.js sha256 7e8d4507... (364,154 B) == bun build; CF 4c96049f @100%; 4/4 schedules modified_on 2026-09-28T20:04:34Z. 281 tests/1016 assertions, typecheck 0. Docs HEAD-identity FAIL fixed (real HEAD 3d455c6), docs commit 7a5eaa9 pushed == origin/main.
- **C-864 OPEN** (+$194.70 over swing cap on cost basis; F selldown candidate cost $2,256.81) and **C-896-A OPEN** (MS/RUN unattributed) - decision-gated, NO auto-fix.
- **Wed Sep 30 22:00z (CF DOW=4) = first real swing-dispatch test since Sep 28** - watch tonight; verify via run log after the 00:00z D1 reset.
- Escalation predicate: occ-27 FIRED/NOT CLEARED. D1 read exhaust 4 controls running (C-992..C-998) strengthens the paid-tier case - still Joachim's decision.
- Open items: RTS udbud frist 16.10, Elbilmessen Herning 2.-4. okt, InstantCall demo 5/10 11:30, Gert RSVP frist 2/10, di-teknik termorapporter udloeb 9/10, 7. praktikansoegning (Emil Knudsen).
