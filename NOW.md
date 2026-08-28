# Alpaca Trading Bot - Status

**Current control:** Control-175 (Aug 28, 2026 ~20:01 UTC / 22:01 +02)
**Verdict:** HEALTHY (code/deploy 2.6.0), DEGRADED (external)
**Code:** 79583d8 (Control-172, unchanged)
**Docs HEAD:** a99e2d0 (Control-174 docs-only commit; this Control-175 commit pending)
**Tests:** 224 pass / 845 assertions, typecheck clean

## Live state
- Market CLOSED (closed 20:00 UTC). EOD flatten active: 5 daytrading positions flattened to 0.
- 23 positions all swing, MV $8,273 (2.24x $3,700 cap, normalizing). Daytrading MV $0, crypto MV $0.
- Equity $98,236.62, -$237.65 today (-0.24%), ACTIVE, not PDT. Cash $89,963.62 (91.5%).
- 768 total trades, 768 executed. All 50 visible filled trades gross/fee/net=null (conservative).
- Run 4182 ERROR at 19:47: Cloudflare subrequest ceiling exceeded despite Workers Paid; self-recovered.
- New cron dispatch gaps 19:01-19:31: 4 missed daytrading, 2 missed reconcile. Clean window ended at 18:57.
- Crypto :07/:37 cadence confirmed across 17 runs (08:37-19:38), all fail-closed at CRYPTO_BARS_STALE/UNAVAILABLE.
- Edge producer wired (technical-analysis.ts:604) but gate not reached. Fee telemetry stale (Aug 19).
- EQUITY_DIRECTION_FALLBACK active (broker change_today_pct=0 during runs).
- Four schedules: 1-59/5 * * * *, 0 22 * * 1-5, 7-59/30 * * * *, */10 * * * *
- Caps 5000/3700/2000 USD unchanged. Push BLOCKED: github_pat not in vault.
- Follow-ups: subrequest ceiling recurrence, cron dispatch stability, crypto bar/fee freshness, D1 read limit (Sep 1), github_pat blocker.
