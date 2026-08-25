# Control-81 strict read-only production control

Disposition: OPEN FAIL/DEGRADED for live production; LOCAL VALIDATED.

Only the six approved GET endpoints and same-endpoint GET filter/pagination probes were used. All six returned HTTP 200. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was called.

Exact source identity: `/workspace/alpaca-trading-bot`, HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, branch `fix/remove-premature-position-upsert-entryside`, release `2.6.0`. Live `/health` is `1.0.0`, live config is `2.4.0`, and Wrangler authentication is unavailable: `You are not authenticated. Please run wrangler login.`

Live positions are broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 21 rows). Equity is `98410.64` versus `last_equity=98504.5039`, down `93.8639`; latest snapshot equity is `98390.96`. Caps are `5000/3700/2000 USD`. Local schedules are `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`.

Live defects remain: swing run 3409 failed on Cloudflare subrequest exhaustion, reconciliation is repeatedly lease-held, crypto timestamps are around `:08/:38`, exact per-fill gross/fee/net is unavailable, and live filter/pagination probes repeat unfiltered/first-page data. Local fail-closed crypto edge wiring and reliability regressions pass; full suite result is `204 tests / 775 assertions`, with typecheck and diff-check passing.

No code/config correction or deployment was performed. Follow-up is required for authenticated provenance, authorized clean deployment if still needed, separate GET-only post-release verification, swing/subrequest remediation, cadence, observability, accounting, cap semantics, and fee/edge proof. No cap or trading-behavior changes are authorized.
