# Control-705 RECEIPT (Sep 18 2026 ~13:00 UTC)
Strict read-only control — HEALTHY 2.7.0, docs-only, NO deploy, no defect.
- /health HTTP 200 ok 2.7.0
- /api/account HTTP 200 broker-direct (equity $97,125.57, +$8.70)
- /api/config HTTP 200 (risk guards 150/100/100, floor 97000, crypto disabled, caps 5000/3700/2000, min_conf 0.8 nominal/0.7 fallback FINDING-1)
- /api/dashboard HTTP 200 (current_state_source=alpaca, 11 swing MV $4,814.83)
- /api/positions HTTP 200 (source=alpaca, 11 swing)
- /api/runs?limit=300 HTTP 200 (13491->13790, 0 gaps/err/lease; crypto 30/30 :07/:37)
- /api/trades?limit=500 HTTP 200 (500/500 filled, 0 pending/leaves/null, conservative accounting)
Captured 13:00-13:06 UTC. All GET-only, no mutation.
