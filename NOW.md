## August 21, 2026 Alpaca correction deployed, production degraded

Cloudflare version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55` serves source commit `30b605ff4bbbb86a60d67a9fb4f4a58d0cbb0be1`; direct upload was required because Wrangler returned a false-positive deployment exit.

GET-only verification passed all six endpoints, broker-authoritative positions (`source: alpaca`, 29 rows), caps `5000/3700/2000`, all four schedules, filtered run aliases, dashboard market value consistency, and snapshot count `29`.

Production remains **DEGRADED, not healthy**: no fresh successful daytrading/swing run, sampled lifecycle timestamps remain null, per-trade gross/fee/net is absent, fee telemetry is unavailable in crypto skips, quantity divergence remains, one crypto cadence gap was observed, and calibrated crypto-edge comparison is unproven. No broker-mutating endpoint was called.
