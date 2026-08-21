## August 21, 2026 strict read-only Alpaca production control

Production is **DEGRADED, not healthy**. Latest captured deployment receipt: `47158569-968b-4bae-83ad-0c24134d42d2`, Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, created August 21, 2026 at 07:57:51 UTC; earlier receipts include `1b286e9a-6d2f-45b9-a439-72fd12654f9c` / `ced43daf-ed03-4add-ac07-1d8bf562b72c`. Source mapping and current live control-plane identity were not independently revalidated; the latest recorded local validation is 125 tests / 374 assertions.

Live GET-only evidence: all six endpoints returned 200; `/api/positions` is broker-authoritative (`source: alpaca`, 29 positions); equity is above last equity; schedules are wired; crypto runs arrive around :07/:37 UTC; reconciliation arrives about every 10 minutes; lease-held, error, and structured skip reasons are visible; caps remain 5000/3700/2000 USD.

Blocking gaps: repeated broker/internal quantity divergence; latest daytrading evidence is an error followed by lease-held skips; no swing run was observed; all six lifecycle timestamps are null across the sampled 50 trades; per-trade fee/gross/net fields are absent; fresh crypto skips include `FEE_DATA_UNAVAILABLE`; crypto edge-gate wiring is covered in source/tests but end-to-end live comparison is unverified. No code or deployment change was required; no mutating endpoint was called.
