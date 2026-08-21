## August 21, 2026 swing-cap correction

Swing multi-entry cap enforcement is deployed and live-verified from commit d9c8ec6 as Cloudflare deployment 602cdd72-1a49-4db5-bd86-898efea14315, version 7b20c401-fe15-41e5-ac71-a8d798e8112d, 100% traffic.
115 tests / 340 assertions, TypeScript, diff-check, dry-run, all four schedules, and all six GET endpoints passed; caps remain 5000/3700/2000 USD.
Production remains DEGRADED, not healthy: crypto positive-edge BUYs fail closed without calibrated rawEdgeBps, lifecycle/P&L gaps remain, and fresh natural daytrading/swing success is pending.
No broker-mutating endpoint was called.
