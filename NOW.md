# NOW
- Alpaca Control-5 is FAIL/DEGRADED: live run aliases return empty while canonical filters return rows.
- Live release identity remains unresolved: health 1.0.0/config 2.4.0 versus tested local 2.6.0.
- Broker positions remain authoritative: source alpaca, 29 rows; caps unchanged at 5000/3700/2000 USD.
- Fresh reconciliation and crypto delivery exist; daytrading is stale/lease-held and swing is stale/risk-halted.
- Crypto runs are around :08/:38 UTC; fee telemetry and exact fill-lot gross/net remain unavailable.
- Control-5 patch adds response-only trigger_alias without changing canonical history or trading behavior.
- Validation passed locally; authenticated Wrangler deployment is blocked by missing CLOUDFLARE_API_TOKEN.
- Next gate: restore Wrangler auth, deploy exact commit 57a4efb, then repeat separate GET-only verification.
