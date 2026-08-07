# Operations and release notes

## Current release

- Commit: `86def4f22ecdb30fdc919b74f84115a112b3bd17` (`clean up TypeScript errors`)
- Cloudflare deployment ID: `da419696-2fb6-498c-86f4-d659f4bac8f3`
- Cloudflare Worker version: `0f05e645-b33c-4335-92d9-68b8237eb62a`
- Traffic: `100%`
- Dashboard: GitHub Pages, calling only the Worker API
- Account: Alpaca paper trading
- Validation: TypeScript passed; 46 tests passed; read-only smoke endpoints returned HTTP 200

## Release verification

1. Run `git diff --check`, `bunx tsc --noEmit`, `bun test`, and `bunx wrangler deploy --dry-run`.
2. Commit and push to `origin/main`; confirm local `HEAD` equals `git ls-remote origin refs/heads/main`.
3. Build a fresh explicit bundle with `bunx wrangler deploy --dry-run --outdir <new-directory>`.
4. Upload that exact bundle through the direct Cloudflare multipart API. In this proxy environment, do not trust a successful `wrangler deploy` exit code as proof of a new version.
5. Verify the newest Cloudflare deployment has a new version at `100%` traffic.
6. Verify all four schedules, including the read-only `*/10 * * * *` maintenance schedule.
7. Query `/health`, `/api/dashboard`, `/api/trades`, and `/api/runs`; expect HTTP 200.
8. Query `/api/positions` when checking broker availability and confirm `positionsAvailable: true`, `source: "alpaca"`, and broker-matching symbols.
9. Confirm GitHub Pages contains the Worker URL and no direct Alpaca URL.
10. Never use trading triggers, cycle endpoints, order endpoints, or close endpoints as deployment tests.

See [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) for exact commands and the direct-upload procedure.

## Position-state contract

Alpaca supplies current symbol, quantity, side, prices, market value, and unrealized P&L. D1 supplies matching strategy, stop, timestamp, and historical metadata only. D1-only rows are excluded from current API positions. Broker-only symbols are `unattributed` until ownership is established. A broker-fetch failure is surfaced as unavailable; D1 is never used as a silent live fallback.

## Schedules

- Daytrading: `*/5 13-21 * * 1-5` UTC, gated by Alpaca's market clock.
- Swing: `0 22 * * 1-5` UTC.
- Crypto: `7-59/30 * * * *` UTC, at approximately `:07` and `:37`, 24/7.
- Maintenance/reconciliation: `*/10 * * * *` UTC, read-only broker/order reconciliation under the global lease.

## Known risks

- Partial-fill retry/cancel lifecycle is incomplete.
- Historical trades with `strategy IS NULL` remain excluded from strategy-attributed history unless deterministic attribution is available.
- Swing batch-bar and degraded-data safeguards have been verified in production; future changes should preserve the bounded request and completed-session checks.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- Scheduled reconciliation is intentionally read-only: it never submits, cancels, closes, replaces, or retries broker orders.
- Partial-fill retry/cancel lifecycle is still incomplete beyond reconciliation and requires separate design/test work.
- Automated coverage includes reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, and no-side-effect assertions, but not full live-broker integration.
