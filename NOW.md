## August 22, 2026 Control-3 production control

Status: **FAIL/DEGRADED**, not healthy. All six required GET endpoints returned HTTP 200, positions remain broker-authoritative (`source: alpaca`, 29 rows), equity is 98,504.50 versus last_equity 98,270.0927 (+234.4073), and caps remain $5,000/$3,700/$2,000.

Fresh live evidence: reconciliation runs through 05:01:02 UTC are MAINTENANCE_ONLY skips; crypto runs through 04:38:03 UTC recur near :08/:38 with fail-closed fee/confidence skips; no fresh daytrading or swing success is proven, with historical lease-held, risk-halt, divergence, and runtime errors. Sampled trades expose lifecycle fields, but gross/fee/net remain null with unavailable_fill_lot_exact.

Local reliability correction remains validated: focused 26 tests/154 assertions, full 157/518, typecheck, diff-check, and Wrangler dry-run pass. Secure deployment retry produced no usable receipt, and separate GET-only verification still reports live /health 1.0.0 and /api/config 2.4.0 versus local release 2.6.0. Follow-up: restore/verify Cloudflare deployment receipt and deploy the exact validated correction, then repeat separate GET-only verification; do not change caps or trading behavior.
