Control-749 (Sun Sep 20 03:00 UTC) - strict read-only production control - HEALTHY 2.8.1
docs+evidence only. NO deploy, NO code change, NO correction needed.
Deployed src 2ea5e9d, repo HEAD 06107c4 (prior), now +this entry (Control-749).
git diff 2ea5e9d -- src/ = ZERO diff (deployed code matches reviewed commit).

Evidence files (all valid JSON):
  health.json                     - /health ok 2.8.1
  config.json                     - /api/config release_version 2.8.1, min_conf 0.8,
                                      caps 5000/3700/2000, guards 150/100/100 + 97000,
                                      crypto disabled, edge-gate 8, eod_flatten true
  dashboard.json                  - /api/dashboard equity 97135.81 POSITIVE,
                                      current_state_source=alpaca (fresh 03:01:24Z),
                                      11 swing + 0 daytrading + 0 crypto, MV 4767.86
  positions.json                  - /api/positions 11 swing, metadata_source=d1
  account.json                    - /api/account broker-direct equity 97135.81, cash 92367.95
  runs500.json                    - /api/runs?limit=500 14038->14537 id-contiguous 500/500,
                                      0 error, 0 lease, 0 gap>15m; crypto :07/:37 50/50 EXACT;
                                      reconcile */10 150 EXACT; daytrading single 20.1min gap
                                      = already-escalated C-739 (14156->14159)
  trades200.json                  - /api/trades?limit=200 200/200 filled, 0 pending, 0 leaves,
                                      0 null-strategy, conservative accounting, high-water 1616
  analytics.json                  - /api/analytics analysisVersion 1.0.0
  analytics-crypto.json           - /api/analytics?strategy=crypto (crypto third strategy present)
  analytics-daytrading.json       - /api/analytics?strategy=daytrading
  analytics-swing.json            - /api/analytics?strategy=swing
  strategy-comparison.json        - /api/strategy-comparison strategies swing/crypto/daytrading
  schedules.json                  - CF live-schedules GET 200, all 4 crons modified 2026-09-19T07:57:53Z

Validation: typecheck exit 0, git diff --check clean, 263 tests / 969 assertions PASS.
ONLY GET calls issued (no trigger/submit/cancel/close/replace/retry/migration/mutation).
