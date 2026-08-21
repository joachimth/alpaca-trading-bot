## August 21, 2026 Alpaca production control and lifecycle correction

Production is DEGRADED, not healthy. Lifecycle correction deployed as Cloudflare deployment 6ef8737a-85ca-4fbb-8886-c938237dc993, version 5ff1ee08-bdc1-46b7-9aa6-93962d25beb4, 100% traffic; remote D1 has all six timestamp columns.

Validation: 123 tests / 361 assertions, TypeScript, diff-check, dry-run; fresh post-deployment GET-only checks at 11:04:24–11:04:25 UTC returned HTTP 200 for all six endpoints, with four schedules, broker source, caps 5000/3700/2000, filtered runs, lifecycle fields, and gross/fee/net checks recorded.

Historical lifecycle timestamps are null until natural broker updates populate them. August 21 daytrading/swing delivery remains unverified; prior swing history has errors. Docs now identify the current source/deployment explicitly. No broker-mutating endpoint was called.
