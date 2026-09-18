# Control-717 push receipt (Sep 19 00:00 +02 / 22:00 UTC Fri Sep 18)

Strict read-only control: HEALTHY 2.7.0 (docs-only, NO deploy).

## Live evidence captured (GET-only)
- /health 200 2.7.0
- /api/account broker-direct equity $97,138.16, change_today +$21.29 POSITIVE, floor never touched
- /api/config 2.7.0 guards UNCHANGED (150/100/100, $97k floor, crypto disabled, caps 5000/3700/2000, min_conf 0.8 D1 / 0.7 FALLBACK FINDING 1)
- /api/dashboard fresh 22:00:22Z, positions source=alpaca / metadata=d1
- /api/positions broker-authoritative 11 swing + 0 daytrading + 0 crypto
- /api/runs 300-window 13659->13958: 0 id-gaps, 0 time-gaps>600s, 0 lease (beyond documented C-712/713 13899/13903/13906/13908), 1 error run 13878 WBD PQM (C-711, benign)
- /api/trades 300/300 filled, 0 pending/0 leaves/0 null, conservative filled_lot_exact_unavailable

## Headlines
1. Fri 22:00 swing fire (run 13960 @22:00:45, swing_cron) DELIVERED CLEAN: 25 decisions / 0 trades / 0 errors = 5th post-redeploy cadence test PASSED. CAPITAL_CAP (14, legacy swing book at cap) + HELD_POSITION (4) skips.
2. Independently reconfirmed the C-716 read-correction: full-day crypto slot audit Sep 18 = 43 observed / 44 expected, the 19:07 UTC slot MISSING (13900@18:37 -> 13912@19:37) during the C-712/713 freeze -> multi-schedule suppression, not daytrading-only. Self-resolved, crypto config-disabled (observability-only).
3. Docs push gap closed: Control-716 docs were committed (4269565) but NOT pushed at commit time; remote was 1 control behind at C-715 shas. This work item pushed C-716+C-717 docs via OAuth Contents API (-X PUT, file-body-from-file, sequential) and verified remote==local IN SYNC.

## Push verification (authenticated GitHub GET, authoritative)
- README: remote 814af2e17ca5b4f6a1c63ef4a447ed2f481a6f57 == local (git rev-parse HEAD:README.md) IN SYNC
- OPERATIONS: remote c384ec0d463e10404dd97f80075274517216edd1 == local IN SYNC
- RUNBOOK: remote 398570bcbe48d14da6ab0aa7f597328b3bcc9f59 == local IN SYNC

## Validation
- 241 tests / 893 assertions PASS (bun test), typecheck exit 0
- git diff 2fe9c5a -- src/ empty (ZERO src diff), bundle md5 e34318f5
- git diff --check clean

## Predicate
Escalate-again predicate STAYS ARMED (lowered threshold): ANY further suppression/slot-miss (Mon 22:00 swing fire = 6th post-redeploy cadence test, or any session) = ESCALATE as worsening CF platform instability.
