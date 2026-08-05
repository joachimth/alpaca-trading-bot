# NOW

## 2026-08-05 08:29 CEST - Category performance deployed
- Commit `fa8a37e` pushed to GitHub; Cloudflare version 48 (`ebfe01d1`) active at 100% traffic.
- Live API now exposes category `dailyPl`, `portfolioValue`, `categoryHistory`, and `categoryHistoryAvailable`.
- Account equity/cash remain account-level; category value is broker-marked position value only.
- Current live verification: Alpaca account ACTIVE, positions source `alpaca`, 2 broker positions available.
- Category history is intentionally empty until deployed cycles record at least two snapshots per category.
- Cron schedules unchanged; no trading cycle or broker order was started during deployment.

## Open
- Verify the next daytrading and crypto cycles populate `category_snapshots`; swing remains dependent on its scheduled run.
- Partial fills, TypeScript errors, duplicate warning, and limited integration tests remain open.
