# Operations and release notes

## Current release

- Commit: `ee17068`
- Cloudflare Worker version: `43`
- Traffic: `100%`
- Dashboard: GitHub Pages, calling only the Worker API
- Account: Alpaca paper trading

## Release verification

1. Run `bun test` and confirm the broker projection tests pass.
2. Run `bunx wrangler deploy --dry-run`.
3. Upload/deploy the Worker.
4. Verify the active Cloudflare version and traffic percentage. A successful upload alone is not sufficient.
5. Query `/api/dashboard` and `/api/positions` through the Worker URL.
6. Confirm `positionsAvailable: true`, `source: "alpaca"`, and broker-matching symbols.
7. Confirm GitHub Pages contains the Worker URL and no direct Alpaca URL.
8. Never use trading triggers or close endpoints as deployment tests.

## Position-state contract

Alpaca supplies current symbol, quantity, side, prices, market value, and unrealized P&L. D1 supplies matching strategy, stop, timestamp, and historical metadata only. D1-only rows are excluded from current API positions. Broker-only symbols are `unattributed` until ownership is established. A broker-fetch failure is surfaced as unavailable; D1 is never used as a silent live fallback.

## Schedules

- Daytrading: `*/5 13-21 * * 1-5` UTC, gated by Alpaca's market clock.
- Swing: `0 22 * * 1-5` UTC.
- Crypto: `7-59/30 * * * *` UTC, at approximately `:07` and `:37`, 24/7.

## Known risks

- Partial-fill retry/cancel lifecycle is incomplete.
- 91 legacy trades have `strategy IS NULL` and are excluded from strategy-attributed history.
- Swing trigger/logging and decision-row accounting need cleanup before the first real swing run.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- `reconcileOrders` imports sell-side orders only and derives strategy from positions rather than decisions.
- Existing TypeScript errors and the duplicate `isTradingHalted` warning remain.
- Automated coverage currently consists of two deterministic projection tests, not full API, cron, isolation, or partial-fill integration tests.
