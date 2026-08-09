# NOW
## 2026-08-09
- Lease-starvation fix committed as `32ea4b9bb5655a40cc0a603e589831a58f660f0b` and deployed: Worker version `ea7314de-e651-46a3-82b3-2c06e724e4b8`, deployment `a11e9bfe-5839-4a96-9157-c21d7d03bc40`, 100% traffic.
- Root cause: maintenance shared the global lease; fix isolates maintenance/daytrading/swing/crypto leases, uses 10-minute TTL, and 12-second Alpaca request timeout.
- Validation: 54 tests/156 assertions, typecheck, diff-check, dry-run; read-only `/health`, `/api/runs`, `/api/trades`, `/api/positions` returned HTTP 200.
- All four Cloudflare schedules were verified; no broker mutation was used.
- Monday Aug 10, 15:40 Europe/Copenhagen read-only session verification is scheduled; Friday Aug 7 delivery gap remains separately unproven.
