## August 21, 2026 Alpaca production control and lifecycle correction

Production is DEGRADED, not healthy. Lifecycle correction deployed as Cloudflare deployment 6ef8737a-85ca-4fbb-8886-c938237dc993, version 5ff1ee08-bdc1-46b7-9aa6-93962d25beb4, 100% traffic; remote D1 has all six timestamp columns.

Validation: 123 tests / 361 assertions, TypeScript, diff-check, dry-run; six GET endpoints, four schedules, broker source, caps 5000/3700/2000, filtered runs, lifecycle field presence, and gross/fee/net checks passed.

Historical lifecycle timestamps are null until natural broker updates populate them. August 21 daytrading/swing delivery remains unverified; prior swing history has errors. No broker-mutating endpoint was called.
