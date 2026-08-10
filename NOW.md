# NOW
## 2026-08-09
- `0e5036d` remains local `HEAD`, one commit ahead of origin/main; this worktree is uncommitted, with no push, deploy, remote migration, or broker mutation.
- Added explicit idempotent `crypto-entry-reservations-migration.sql` plus local/remote apply and read-only verification commands; runtime no longer self-creates the reservation table, so a missing table fails closed before any crypto BUY.
- Added atomic D1/SQLite crypto entry reservations with owner/idempotency, retry release, expiry boundaries, and fail-closed database errors.
- Integrated reservations into crypto BUY submission and preserved valid zero config values.
- Added real `schema.sql` seeded config fixtures for camelCase/snake_case, precedence, zero, malformed, and missing values.
- Validation: full suite 83 passing / 248 assertions; targeted migration/reservation/schema/runtime suite 23 passing / 74 assertions; typecheck and diff-check pass.
- Remaining gaps: no live Alpaca duplicate-submit test, no live D1 concurrency proof, and no deployment verification.
