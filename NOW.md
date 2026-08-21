## August 21, 2026 Alpaca status
Production remains **FAIL/DEGRADED**, not healthy.
Correction `f5fddcbe` deployed as `f181f9c3` / Worker `84069389` at 100% on 2026-08-21 21:03:38 UTC.
First natural post-release crypto run at 2026-08-21 21:08:11 UTC had 5 decisions, 0 errors, and structured skips; D1 variable failure did not recur.
Focused 9/76 and full 154/488 regressions, typecheck, diff-check, and dry-run passed.
Final GET-only checks: six endpoints 200, positions source alpaca with 29 rows, equity above last_equity, caps $5,000/$3,700/$2,000.
Open gaps: daytrading lease/error skips, no fresh swing success, cadence jitter, lifecycle/accounting gaps, unattributed exposure, and no live rawEdgeBps comparison.
No trigger or broker mutation was used.
