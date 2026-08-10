# NOW
## 2026-08-10 19:49 CEST
- Hardening release is live: commit 1f354e9, deployment 32fdaa9c-0609-4be1-b16c-6369af4dfc8e, Worker version dff3e198-1cb3-49d1-ac5d-706a7d292258, 100% traffic.
- Remote D1 verified: crypto reservations table/index plus both trade intent columns exist.
- All four schedules and read-only health/config/positions/trades/runs endpoints passed; no broker mutation was used.
- Local validation remains 92 tests / 273 assertions, TypeScript and diff-check passed.
- Vital parameters unchanged: daytrading $5,000, swing $3,700, crypto $2,000; confidence gates and universes unchanged.
- Follow-up: observe natural paper sessions for cap compliance, pending-order convergence, reservation retention, fee/net attribution, and remaining orphan sell attribution.
