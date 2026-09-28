# NOW

- **Control-895 (Sep 28 08:00z Mon) — WEEKLY REVIEW: OPERATIONALLY HEALTHY, docs-only fix, NO deploy.** 2.8.2 live (src 092b84b, repo HEAD == origin/main). All 7 GETs 200, equity $97,208.84 POSITIVE, run-log contiguous 0 suppression, cadence exact, crypto fail-closed, no order duplicates/retries, gross-fee==net clean, D1↔broker quantities correlated.
- **DOCS DEFECT FIXED:** Control-894 README entry was duplicated AND never committed (origin stuck at Control-891). Deduped, CONTROL_STATUS.txt scratch removed, this review prepended to README/OPERATIONS/RUNBOOK, NOW.md refreshed. 278 tests / 1006 assertions PASS.
- **C-864 fill-watch TODAY Mon 13:30z (top gate):** 7 swing orders (TXN sell + FCEL/INTU/ORCL/SIRI/ADBE/UPS buys) still unfilled pre-open; over-cap ($3,756-3,879 vs $3,700 cost-basis) materializes ONLY on fill. DECISION-GATED for Joachim — likely swing selldown or accept-and-note. NO auto-fix.
- Pending Joachim: C-864 cap semantics (MV vs cost-basis), D1 paid-tier. D1 late-UTC 22:00-00:00z watch daily.
