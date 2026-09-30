# Deployment runbook

This is the canonical release procedure for `alpaca-trading-bot`.

## Important environment fact

In the current proxy environment, `bunx wrangler deploy` can exit successfully without creating a new Cloudflare Worker version. Treat Wrangler's exit code and console output as a build/upload attempt, not as proof of a live deployment.

For this Worker, the authoritative proof is the Cloudflare API deployment list showing a new version at 100% traffic, followed by read-only HTTP smoke tests.

## 1. Review and test locally

Run from the repository root:

```bash
cd /workspace/alpaca-trading-bot
git status --short
git diff --check
bunx tsc --noEmit
bun test
bunx wrangler deploy --dry-run
```

Expected current baseline:

- TypeScript check passes.
- 224 tests pass, 0 fail, 845 assertions, including fee-aware risk, strategy-comparison, reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, fee attribution, quantity-aware costs, calibrated swing-edge, and no-side-effect coverage.
- `git diff --check` passes.
- Wrangler dry-run succeeds.
- The deployed source is `0b3b2a3` (Control-283, D1 read-budget optimization). Repo HEAD is `cbb8f87` (Control-364, docs-only). No source diff between `0b3b2a3` and HEAD: `git diff --stat 0b3b2a3..HEAD -- src/ wrangler.toml package.json schema.sql` is empty. Worker version `2.6.0` is live at 100% traffic; all four schedules are present; read-only `/health`, `/api/dashboard`, `/api/trades`, and `/api/runs` returned HTTP 200; `/api/dashboard.capitalCaps` is `{ daytrading: 5000, swing: 3700, crypto: 2000 }`.
- A dry-run warning must be investigated rather than ignored if it is new.

Do not run trading triggers, close endpoints, manual cycles, or order actions as deployment tests.

## Control-1002 (Sep 30 22:00+02 / 20:00 UTC Wed) - strict read-only control: **OPEN DEGRADED - D1 free-tier daily row READ limit exhaustion, 6th consecutive control (2nd consecutive UTC day), still mid-session**, NO deploy, no code/config/cap change; docs-only HEAD-identity advance plus a NEW LATENT-FINDING escalation. **Route signature (quota boundary, GET-only):** `/` and `/health` 200 `2.8.2` and `/api/account` 200 broker-direct (the documented exhaustion signature) while `/api/dashboard` **500**, `/api/trades` **500**, `/api/runs` **500** and `/api/positions` **503** with `positionsAvailable=false` / `source=alpaca` (fail-correct degradation - no stale D1 row passed off as broker state); `/api/config` **flapping** (200 on three probes, 500 on the next, then 200 x3). Every failure body is `D1_ERROR: Your account has exceeded D1's free tier daily row read limit ... wait until tomorrow (midnight UTC)`. Onset before 15:31z (C-992), still hard at 20:08z; **NOT deploy-fixable** - a redeploy does not reset the D1 quota; reads reset 00:00 UTC. No cap or risk parameter was touched. **IMPORTANT MID-SWEEP RECOVERY (new method fact):** at **20:05:4xz** the D1-backed surfaces RECOVERED mid-sweep - `/api/dashboard`, `/api/positions` and `/api/trades` each returned 200 on three consecutive probes - so the free-tier read block is **intermittent, not a hard wall**, and a control that gives up after one failed round loses capturable evidence. Capture every D1-backed surface as early AND as late as possible, and re-probe after each failure round. `/api/runs` gave exactly ONE 200 (500 rows at 20:02z) and was hard-blocked again by 20:08z across 20 further retries, so the run-log window still ends at 14:42z. **`/api/account` (broker-direct, no D1):** equity **$97,095.17 at 20:01z -> $97,094.72 at 20:05z** (`last_equity` $97,119.7209, `change_today` **-$24.55 / -0.0253%**), **~$95 above the $97,000 floor**, never touched; status `ACTIVE`, `trading_blocked` false, `account_blocked` false; direction source `broker_change_today_pct` (broker field present and non-zero, so no fallback was needed - the `equity-observability.ts` fallback percent convention `(delta/lastEquity)*100` holds). **Equity direction this control is NEGATIVE (a down day), not positive** - the trend-bend watch continues. **Config (successful flap-window snapshot):** caps daytrading `5000` (`max_capital_usd`) / swing `3700` (`swing_max_capital_usd`) / crypto `2000` (`crypto_max_capital_usd`), daily loss limits `150`/`100`/`100` USD, `account_equity_floor_usd` `97000`, `min_confidence` `0.8`, `crypto_trading_enabled` `false`, `eod_flatten` `true`, `crypto_min_edge_after_costs` `8` - all UNCHANGED (`config.version` `2.7.0` = the known cosmetic D1-seed lag, not a defect). **Run log (one successful read, `limit=500` at 20:02z, captured before the hard block):** ids `18847 -> 19346`, 500 rows, **ID-CONTIGUOUS, zero id gaps**, window `2026-09-29 08:36:57z -> 2026-09-30 14:42:09z`; exactly ONE time-gap >10 min: `19050 2026-09-29 18:41:01z -> 19051 2026-09-30 00:01:12z` = **320.2 min, all-trigger = occurrence-candidate 27, STANDS, NOT cleared**; trigger split `cron` 298 / `reconcile_cron` 151 / `crypto_cron` 51; **zero `swing_cron` rows in the window** (the Sep 29 22:00z fire falls inside occ-27's window per the C-976 correction - a consequence of that suppression, not a separate durable dispatch defect). Delivery today (to 14:42z): daytrading **177/177 intended 5-minute slots, ZERO missing** (normalized to the 1+5k grid, dispatch start-lag absorbed); reconcile **89 runs, every consecutive delta on the `*/10` grid** (10.0 x24, 9.9 x23, 10.1 x20, 9.8 x11, 10.2 x9, 10.3 x1); crypto **30 runs, minutes `{07 x15, 37 x14, 38 x1}`** = the documented :07/:37 cadence (the single :38 is +1 min dispatch start-lag, not a missed slot), **all fail-closed `CRYPTO_DISABLED_BY_CONFIG`**. **Zero `CYCLE_LEASE_HELD`** in the entire window. **7 error-class runs, all benign pre-existing `POSITION_QTY_MISMATCH`** (`18958`/`18971`/`19008`/`19027`/`19031`/`19034`/`19041`, Sep 29 14:07-18:12z) on CMCSA, LCID, NFLX, SOFI and the unattributed MS/RUN; each states `Broker-authoritative quantity persisted` with `new entries blocked for this cycle`, so the fail-safe held and no local row was passed off as broker state - and the run log is id-contiguous around every one, so no write was hidden. **Positions (broker-authoritative, recovered read at 20:05:5xz, `source=alpaca`, `positionsAvailable=true`, 23 rows):** 15 swing-tagged cost **$3,647.88** / MV $3,257.49; 6 daytrading cost **$4,706.38** / MV $4,754.14 `< $5,000` (CMCSA 140.32, NIO 269.41, NFLX 8.66, NVDA 0.44, SHOP 0.32, LCID 0.44); 2 `unattributed` cost **$246.82** / MV $244.80 (MS 0.64 + RUN 16). Swing-intended cost basis **$3,894.70 vs the $3,700 cap = +$194.70 OVER on cost basis** while the code's MV basis reads ~$3,502 = ~$198 under - the C-864 mechanism reconfirmed on a live broker read. `freshness.current_state_source` = **alpaca** (`metadata_source` d1, `metadata_updated_at` 2026-09-30 14:42:08z). **Trades (recovered read, 500 rows, ids `1489 -> 1988`, zero id gaps):** **500/500 `filled`, ZERO non-terminal rows**; strategy split daytrading 469 / swing 31; **0/500 rows carry `fees` or `net_amount`** - conservative aggregate-only fee accounting preserved (uncertain fees stay unattributed rather than force-matched). **Deployment identity (content-hash method, mandatory since C-911): PASS.** GET `.../workers/scripts/alpaca-trading-bot/content/v2` with `Accept: */*` returned HTTP 200 / 364,403 B multipart; the extracted `index.js` part is **364,154 B, sha256 `7e8d45070ff236fe0bd546e9253892647462c6a773be75f9a99a08e8b92717ad`**, `cmp`-verified **BYTE-IDENTICAL** to the local `bun build src/index.ts` output (364,154 B). CF active version `4c96049f-08bb-4e63-be1a-ff8dbe16c21f` @100% (deployment `62a32206-50b0-475b-8499-555408400a0f`, created `2026-09-28T20:04:24.862538Z`); all **four schedules** CF-API-GET verified through the `/client/v4` prefix, each `modified_on 2026-09-28T20:04:34.219701Z`: daytrading `1-59/5 * * * *`, swing `0 22 * * 2-6`, crypto `7-59/30 * * * *`, reconcile `*/10 * * * *`. **Crypto edge-gate wiring re-verified statically:** `src/crypto-strategy.ts:37` `prepareCryptoRiskDecision`, `:52` `checkCryptoEntryRisk`, `:73` `edgeGateEvaluated` keyed on `EDGE_CALIBRATION_UNAVAILABLE`/`INSUFFICIENT_NET_EDGE`, `:86` `edge_gate_evaluated`, disable code at `:284`/`:325` - intact in the deployed bundle, still never exercised live because `CRYPTO_DISABLED_BY_CONFIG` short-circuits earlier. **NEW FINDING (escalated, NOT corrected - latent, no live impact, adjacent to trading behaviour): the swing `ONCE_PER_DAY` guard is unreachable in practice and the swing lane has produced NO `ok` run in the retained 19-fire history (2026-09-02 -> 2026-09-28), all `skipped`.** `src/swing-strategy.ts:161` calls `db.getRecentRuns(5)`, whose query (`src/database.ts:1883`) is `ORDER BY timestamp DESC, id DESC LIMIT 5` across **ALL** triggers. Within a few minutes of the 22:00z fire the newest five rows are daytrading/reconcile/crypto, so a prior **successful** swing run of the same UTC day is no longer inside the window and `alreadyRanToday` reads false - the guard can never fire. Consequences: (a) `ONCE_PER_DAY` has **never** been recorded in the retained run history, and there is **no `ONCE_PER_DAY` regression test** in `test/`; (b) the guard's stated intent (a duplicate manual swing fire the same UTC day is suppressed) is silently unmet; (c) the derived-status logic is also incomplete - `src/skip-reasons.ts:114-124` `INFORMATIONAL_SKIP_CODES` omits `BROKER_AUTHORITATIVE_SYNC_ABSENT`, `UNATTRIBUTED_BROKER_EXPOSURE`, `EXIT_PENDING_RECONCILIATION`, `HELD_NO_SCORE_EXIT`, `NO_ENTRY_RISK` and `TURNOVER_LIMIT` (all present in the Sep 28 fire's detail list), so a swing cycle whose only skip is one of those is labelled `skipped` rather than `ok`. **Fail-safe analysis:** no duplicate orders occurred and none can be shown to have occurred, because the daytrading lane held all three symbols common to the two lanes' recent trade history (SOFI, LCID, SHOP) at the relevant times, so the swing symbol set contained only its own held book and every swing decision was a hold. The finding is therefore **latent** (a guard that does not guard, plus a mislabelled status), not an active defect. It was deliberately **NOT corrected this control** because a swing-lane change is trading-behaviour adjacent and the standing rule keeps non-reliability changes decision-gated for Joachim; it is recorded here as an explicit follow-up with the two exact edit points. **C-864 STILL OPEN (decision-gated, NO auto-fix):** `src/risk-manager.ts:234` `currentGross = Sum|market_value|` with `:237` `capRemaining`, and `src/swing-risk.ts:167/176/184` `conservativeGross = currentGross + unattributedExposure` - the "conservative" branch inherits the market-value basis rather than correcting it. **F** remains the selldown candidate (cost $2,256.81, uPL -$313.54; selling F would free ~$2,062 of cap room). **C-896-A STILL OPEN:** MS/RUN read `strategy=unattributed`, outside the daytrading `SWING_OWNED_EXCLUDE` attribution basis, so the F1 guard does not cover them on the accounting basis. **DOCS HEAD-IDENTITY: FAIL -> CORRECTED (docs-only).** No surface named the exact current HEAD: the runbook reference header stated "Repo HEAD (updated Control-998, Sep 30 18:00z) `3d455c6`" while the repo HEAD is **`0ecfaf4`** (the C-1000 docs-only commit, which by the C-524 convention cannot name itself). This C-1002 entry is prepended to README/OPERATIONS/RUNBOOK naming the real authoring HEAD `0ecfaf4`, and the runbook header HEAD line is advanced. The mandatory **Content-identity verification** header block remains at byte 0 of the runbook (first control entry at byte 2,259) after the C-1000 repair. **Standing escalation predicate (ANY further suppression/slot-miss = ESCALATE) remains FIRED and NOT CLEARED** for occ-27; the new swing `ONCE_PER_DAY` finding is escalated as a separate follow-up. **Watch:** Wed Sep 30 22:00z (CF DOW=4) is the first real swing-dispatch test since Sep 28, and the D1 read exhaustion is expected to persist until the 00:00z reset - both must be re-checked after the reset. **Validation at `0ecfaf4`:** worktree clean before the docs edit, **281 tests / 1016 assertions PASS**, typecheck exit 0, `git diff --check` clean, src unchanged from the deployed byte-identical bundle. Evidence `/workspace/control1002-evidence-20260930T200021Z/` (SHA256SUMS + CONTROL_SUMMARY.txt). **This control issued ONLY read-only GET calls: no trigger, submit, cancel, close, replace, retry, migration or broker mutation was attempted.**

## Control-1000 (Sep 30 21:00+02 / 19:00 UTC Wed) - strict read-only control: **OPEN DEGRADED - D1 free-tier daily row READ limit exhaustion, 5th consecutive control (2nd consecutive UTC day), still mid-session**, NO deploy, no code/config/cap change; docs-only HEAD-identity fix + a real docs-structure repair. **Route signature (quota boundary, GET-only):** `/` and `/health` 200 `2.8.2` and `/api/account` 200 broker-direct (the documented exhaustion signature) while `/api/dashboard` **500**, `/api/trades` **500**, `/api/runs` **500** and `/api/positions` **503** with `positionsAvailable=false` / `source=alpaca` (fail-correct degradation - no stale D1 row passed off as broker state); `/api/config` **flapping** (one success on the first attempt, then persistent 500 across the rest of the sweep). Every failure body is `D1_ERROR: Your account has exceeded D1's free tier daily row read limit ... wait until tomorrow (midnight UTC)`. Onset before 15:31z (C-992), still hard at 19:00z; **NOT deploy-fixable** - a redeploy does not reset the D1 quota; reads reset 00:00 UTC. No cap or risk parameter was touched. **`/api/account` (broker-direct, no D1):** equity **$97,130.49 POSITIVE** at 19:01z (probe sequence $97,129.20 -> $97,128.12 -> $97,130.49; `last_equity` $97,119.7209, `change_today` **+$10.77 / +0.0111%**, cash $88,799.21, long market value $8,330.19, status `ACTIVE`, `account_blocked` false, `trading_blocked` false), **~$130 above the $97,000 floor**, never touched; direction source `broker_change_today_pct` (broker `change_today_pct` present and non-zero, so no fallback was needed - the `equity-observability.ts` fallback percent convention `(delta/lastEquity)*100` holds). **Config (successful flap-window snapshot):** caps daytrading `5000` (`max_capital_usd`) / swing `3700` (`swing_max_capital_usd`) / crypto `2000` (`crypto_max_capital_usd`), daily loss limits `150`/`100`/`100` USD, `account_equity_floor_usd` `97000`, `min_confidence` `0.8`, `crypto_trading_enabled` `false`, `eod_flatten` `true` - all UNCHANGED (`config.version` `2.7.0` = the known cosmetic D1-seed lag, not a defect). **Run log (one successful read, `limit=500` at 19:00:5xz, captured before the hard block):** ids `18847 -> 19346`, 500 rows, **ID-CONTIGUOUS, zero id gaps**, window `2026-09-29 08:36:57z -> 2026-09-30 14:42:09z`; exactly ONE time-gap >10 min: `19050 2026-09-29 18:41:01z -> 19051 2026-09-30 00:01:12z` = **320.2 min, all-trigger = occurrence-candidate 27, STANDS, NOT cleared**; trigger split `cron` 298 / `reconcile_cron` 151 / `crypto_cron` 51; **zero `swing_cron` rows in the window** (the Sep 29 22:00z DOW=3 miss falls inside occ-27's window per the C-976 correction - a consequence of that suppression, not a separate durable defect). Delivery today (to 14:42z): daytrading **177/177 intended 5-minute slots, ZERO missing** (normalized to the 1+5k grid, dispatch start-lag absorbed); reconcile **89 runs, every consecutive delta on the `*/10` grid** (10.0 x24, 9.9 x23, 10.1 x20, 9.8 x11, 10.2 x9, 10.3 x1); crypto **30 runs, minutes `{07 x15, 37 x14, 38 x1}`** = the documented :07/:37 cadence (the single :38 is +1 min dispatch start-lag, not a missed slot), **all fail-closed `CRYPTO_DISABLED_BY_CONFIG`**. **Zero `CYCLE_LEASE_HELD`** in the entire window. **7 error-class runs, all benign pre-existing `POSITION_QTY_MISMATCH`** (`18958`/`18971`/`19008`/`19027`/`19031`/`19034`/`19041`, Sep 29 14:07-18:12z) on CMCSA, LCID, NFLX, SOFI and the unattributed MS/RUN; each states `Broker-authoritative quantity persisted` with `new entries blocked for this cycle`, so the fail-safe held and no local row was passed off as broker state - and the run log is id-contiguous around every one, so no write was hidden. **Positions (broker-authoritative, one successful read at 19:00:55z, `source=alpaca`, `positionsAvailable=true`, 23 rows):** 15 swing-tagged cost **$3,647.88** / MV $3,326.81; 6 daytrading cost **$4,706.38** / MV $4,755.98 `< $5,000` (CMCSA 140.32, NIO 269.41, NFLX 8.66, NVDA 0.44, SHOP 0.32, LCID 0.44); 2 `unattributed` cost **$246.82** / MV $246.12 (MS 0.64 + RUN 16). Swing-intended cost basis **$3,894.70 vs the $3,700 cap = +$194.70 OVER on cost basis** while the code's MV basis reads ~$3,573 = ~$127 under - the C-864 mechanism reconfirmed on a live broker read. `freshness.current_state_source` = **alpaca** (`metadata_source` d1, `metadata_updated_at` 2026-09-30 14:42:08z). **CANNOT VERIFY this control (D1 read-blocked):** `/api/trades` returned ZERO successes across ~25 retries and `/api/dashboard` ZERO across 8 retries through 19:05z - hard-exhausted, not flapping - so trade/fill lifecycle, fee/net conservatism and the dashboard aggregate could NOT be captured; carried forward from C-986/C-988/C-990/C-992/C-994/C-996/C-998 and to be re-attempted after the 00:00z reset. **Deployment identity (content-hash method, mandatory since C-911): PASS.** GET `.../workers/scripts/alpaca-trading-bot/content/v2` with `Accept: */*` returned HTTP 200 / 364,403 B multipart; the extracted `index.js` part is **364,154 B, sha256 `7e8d45070ff236fe0bd546e9253892647462c6a773be75f9a99a08e8b92717ad`**, `cmp`-verified **BYTE-IDENTICAL** to the local `bun build src/index.ts` output (364,154 B). CF active version `4c96049f-08bb-4e63-be1a-ff8dbe16c21f` @100% (deployment `62a32206-50b0-475b-8499-555408400a0f`, created `2026-09-28T20:04:24.862538Z`); all **four schedules** CF-API-GET verified through the `/client/v4` prefix, each `modified_on 2026-09-28T20:04:34.219701Z`: daytrading `1-59/5 * * * *`, swing `0 22 * * 2-6`, crypto `7-59/30 * * * *`, reconcile `*/10 * * * *`. **Crypto edge-gate wiring re-verified statically:** `src/crypto-strategy.ts:37` `prepareCryptoRiskDecision`, `:52` `checkCryptoEntryRisk`, `:73` `edgeGateEvaluated` keyed on `EDGE_CALIBRATION_UNAVAILABLE`/`INSUFFICIENT_NET_EDGE`, `:86` `edge_gate_evaluated`, disable code at `:284`/`:325` - intact in the deployed bundle, still never exercised live because `CRYPTO_DISABLED_BY_CONFIG` short-circuits earlier. **C-864 STILL OPEN (decision-gated, NO auto-fix):** `src/risk-manager.ts:234` `currentGross = Sum|market_value|` with `:237` `capRemaining`, and `src/swing-risk.ts:167/176/184` `conservativeGross = currentGross + unattributedExposure` - the "conservative" branch inherits the market-value basis rather than correcting it. **F** remains the selldown candidate (cost $2,256.81, uPL -$315.15; selling F would free ~$2,062 of cap room). **C-896-A STILL OPEN:** MS/RUN read `strategy=unattributed`, outside the daytrading `SWING_OWNED_EXCLUDE` attribution basis, so the F1 guard does not cover them on the accounting basis. **DOCS HEAD-IDENTITY: FAIL -> CORRECTED, plus a real docs-structure defect repaired (docs-only, no deploy).** (1) No surface named the exact current HEAD: the runbook reference header stated "Repo HEAD (updated Control-996, Sep 30 17:00z) `6409a22`" while the repo HEAD is **`10f2076`** (the C-998 docs-only NOW.md sync, which by the C-524 convention cannot name itself). This C-1000 entry is prepended to README/OPERATIONS/RUNBOOK naming the real authoring HEAD `10f2076`, and the runbook header HEAD line is advanced. (2) The mandatory **Content-identity verification** header block was sitting at byte **6,818** of `docs/DEPLOYMENT_RUNBOOK.md`, INSIDE the Control-998 entry rather than at the top - so a control that needs the recipe had to grep 2.1 MB. It was moved byte-identically to byte 0 (verified: the new file reconstructs EXACTLY as `block + "\n" + old-with-block-removed`, delta +1 byte for the separator); the first control entry now begins at byte 2,259 and the Repo-HEAD pointer at byte 9,077. **Root cause / rule going forward:** the docs-append template must insert new control entries BELOW the header block, never at byte 0. Standing escalation predicate (ANY further suppression/slot-miss = ESCALATE) remains **FIRED and NOT CLEARED** for occ-27. **Watch:** Wed Sep 30 22:00z (CF DOW=4) is the first real swing-dispatch test since Sep 28, and the D1 read exhaustion is expected to persist until the 00:00z reset - both must be re-checked after the reset. **Validation at `10f2076`:** worktree clean before the docs edit, **281 tests / 1016 assertions PASS**, typecheck exit 0, `git diff --check` clean, src unchanged from the deployed byte-identical bundle. Evidence `/workspace/control1000-evidence-20260930T190022Z/` (SHA256SUMS + IDENTITY.txt). **This control issued ONLY read-only GET calls: no trigger, submit, cancel, close, replace, retry, migration or broker mutation was attempted.**

Review the diff, then commit and push:

```bash
git diff --stat
git add <intended-files>
git commit -m "<short release description>"
git push origin main
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The final two commit hashes must match. A clean working tree is preferred before deployment.

## 3. Build an explicit fresh bundle

Do not select an arbitrary directory under `.wrangler/tmp`; it may contain an older bundle. Build to a new explicit output directory:

```bash
rm -rf /workspace/alpaca-worker-bundle-release
bunx wrangler deploy --dry-run --outdir /workspace/alpaca-worker-bundle-release
ls -l /workspace/alpaca-worker-bundle-release/index.js
```

The file uploaded below must be the `index.js` from this explicit build.

## 4. Upload directly through the Cloudflare multipart API

The production Worker is:

- Account ID: `763e5b5405cdf8b307fe62dbf68c4f32`
- Script: `alpaca-trading-bot`
- Public hostname: `alpaca-trading-bot.joachim-763.workers.dev`
- D1 database ID: `2bc505a2-d744-4322-8c3b-5f5ebe35f9a1`

Never paste the token into source, documentation, chat, or command history. In the managed assistant environment, retrieve it from the encrypted credential store:

```bash
export CLOUDFLARE_API_TOKEN="$(assistant credentials reveal --service cloudflare --field api_token)"
```

Create metadata with the binding and all four schedules. The `database_id` and `database_name` fields are both required for this multipart upload:

```bash
cat > /workspace/alpaca-worker-metadata.json <<'JSON'
{"main_module":"index.js","compatibility_date":"2024-06-20","compatibility_flags":["nodejs_compat"],"bindings":[{"type":"d1","name":"DB","database_id":"2bc505a2-d744-4322-8c3b-5f5ebe35f9a1","database_name":"alpaca-trading-bot"}],"triggers":{"crons":["1-59/5 * * * *","0 22 * * 2-6","7-59/30 * * * *","*/10 * * * *"]}}
JSON
```

Upload the exact fresh bundle. Use `--fail-with-body` so API errors are not mistaken for success:

```bash
curl --fail-with-body --silent --show-error --max-time 120 \
  -X PUT \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "metadata=@/workspace/alpaca-worker-metadata.json;type=application/json" \
  -F "index.js=@/workspace/alpaca-worker-bundle-release/index.js;type=application/javascript+module" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot" \
  | tee /workspace/alpaca-worker-direct-upload.json
```

The response must contain `success: true` and a new `deployment_id`. Do not assume that a response from Wrangler means the same thing.

## 5. Verify the actual Cloudflare deployment

Query the authoritative deployment list directly:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot/deployments"
```

The newest deployment must show:

- a new deployment ID;
- a new version ID;
- `percentage: 100`.

Verify schedules separately:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot/schedules"
```

The expected schedules are:

- `1-59/5 * * * *` daytrading (broad window, gated by Alpaca market clock)
- `0 22 * * 2-6` swing (Mon-Fri after close; Cloudflare DOW 2=Mon through 6=Fri)
- `7-59/30 * * * *` crypto (approximately :07 and :37 UTC, 24/7)
- `*/10 * * * *` read-only maintenance/reconciliation

If a schedule is missing, stop and repair the schedule configuration before declaring the release complete.

## 6. Run read-only live smoke tests

For this dashboard change, also inspect the JSON from `GET /api/dashboard`: `capitalCaps.daytrading`, `.swing`, and `.crypto` must be finite, non-negative resolved values or `null`. Verify the Pages dashboard renders the three clearly labeled **Capital cap** cards. A missing or malformed cap, dashboard HTTP failure, or timeout must show `Unavailable`; do not use buying power, cash, equity, portfolio value, or positions to fill it. This check is read-only and must not call trigger, close, submit, cancel, replace, or any other broker mutation endpoint.

```bash
base='https://alpaca-trading-bot.joachim-763.workers.dev'
for path in health api/dashboard api/trades api/runs; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$base/$path")
  printf '%s %s\n' "$path" "$code"
done
```

Expected result: HTTP 200 for all four endpoints.

Also check `/api/positions` when validating broker availability. Do not use `/api/trigger`, `/api/trigger-swing`, `/api/trigger-crypto`, close endpoints, or any order endpoint for smoke testing.

## 7. Documentation and release receipt

Documentation is part of every release. Before declaring work complete, update the relevant README, `docs/OPERATIONS.md`, this runbook, and the workspace status note. The update must state what changed, why it changed, validation results, deployment state, known risks, and concrete next steps. Do not leave documentation for a later cleanup pass.

Record these values in the release note or conversation:

- Git commit pushed to `origin/main`.
- Cloudflare deployment ID and version ID.
- Traffic percentage.
- Schedule list.
- Test/typecheck result.
- Read-only HTTP status results.
- Confirmation that no manual cycle, order, cancel, close, or retry was run.

## Current verified release

As of September 4, 2026 18:01 UTC (Control-365):

- Deployed source commit: `0b3b2a3` (Control-283, D1 read-budget optimization). No source change since.
- Repo HEAD: `cbb8f87` (Control-364, docs-only). 273 commits ahead of `origin/main` (pending docs push).
- Cloudflare deployment ID: `6d3ee0ab` (Control-364 reliability redeploy, same source `0b3b2a3`)
- Worker version: `2.6.0`. Traffic: 100%
- Schedules: `1-59/5 * * * *`, `0 22 * * 2-6`, `7-59/30 * * * *`, `*/10 * * * *`
- Validation: TypeScript clean; 224 tests passed with 845 assertions; diff-check passed
- Read-only HTTP: `/health`, `/api/dashboard`, `/api/runs`, `/api/trades`, `/api/config`, `/api/positions` returned HTTP 200; `/api/dashboard.capitalCaps` returned daytrading `5000`, swing `3700`, crypto `2000`; `positionsAvailable: true`, `source: alpaca`
- No manual trading cycle, order, cancel, close, retry, or reconciliation trigger was run during validation
- Run-log 7202-7301 contiguous, 0 gaps; 21 positions (15 swing + 6 daytrading, 0 crypto fail-closed); equity `$97,693.82`

## Natural reconciliation aftercheck

Read-only live verification on August 8, 2026 confirmed that the first natural maintenance schedule had run. `/api/runs` returned 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC, including 16 `MAINTENANCE_ONLY` completions and 7 `CYCLE_LEASE_HELD` skips. `/api/trades` returned 19 rows with populated `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at` fields, with reconciliation timestamps from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

No mutating endpoint was called. The run details reported `trades_executed: 0` and `imported: 0`, and the reconciler implementation is limited to broker order GETs plus D1 updates. This supports “no broker mutation observed or indicated.” It does not provide a strict broker order before/after proof because `/api/orders` is unsupported and no same-window order snapshot pair was available.

**Repo HEAD (updated Control-1002, Sep 30 20:00z):** `0ecfaf4` (authoring HEAD; prior entry named `6409a22`) == `origin/main`, worktree clean; deployed src is the content-hash-verified 2.8.2 bundle (see C-968 identity block). NOTE (C-974): the three runbook commits `18181ce`/`97e65eb`/`5f7dea7` (reference-header relocation + notes) carried no control entry, so the docs surfaces lagged HEAD for three commits - documentation lag only, no content drift; corrected by the C-974 entry.
Deployed src remains the 2.8.2 release `092b84b` PLUS the committed Control-901 reliability delta.

The August 9, 2026 live audit found that read-only `reconcile_cron` shared the strategy lease and could hold it while bounded broker imports were still in flight. That produced repeated `CYCLE_LEASE_HELD` skips and could starve trading. The fix isolates `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, bounds the default lease TTL to 10 minutes, and applies a 12-second timeout to each Alpaca HTTP request. The fix is read-only with respect to broker trading actions; deployment verification must confirm independent lease behavior through run logs, not by triggering a cycle or submitting an order.

## Fee-aware release notes

This patch is additive at the dashboard/API level: strategy tabs show gross P&L, recorded attributable fees, and net P&L, while account-level fees and unmatched broker P&L remain visible as unattributed. It does not rewrite historical realized P&L, category snapshots, or fill attribution.

BUY cost checks are quantity/notional-aware. Discretionary signal SELL/CLOSE checks are separate from BUY sizing, and protective, EOD, and manual exits bypass them. Swing cost estimates use explicit bps conversion and round-trip costs; BUY rejection remains disabled until calibrated `expectedEdgeBps` is configured.

Before deployment, rerun the full local gates, review the direct diff, commit/push, build an explicit bundle, upload through the documented Cloudflare multipart path, then verify a new version, 100% traffic, all four schedules, and read-only endpoints. Do not use trading actions as smoke tests.

## Current follow-up queue

The active weekly read-only deferred-risk review is `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), every Monday at 10:00 Europe/Copenhagen. It is verified active and must not trigger broker mutations.

1. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. After deploying the capital-cap dashboard change, capture read-only `/api/dashboard` and Pages evidence for all three cap cards, including an unavailable-path check for malformed/missing/HTTP-failed cap data.
6. Finish swing trigger attribution and decision-row accounting consistency work.
