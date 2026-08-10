## Lifecycle hardening release gate — August 10, 2026

Before deploying this candidate, run the full local gates: `bun test`, `bunx tsc --noEmit`, and `git diff --check`. Confirm that the release preserves daytrading **$5,000**, swing **$3,700**, and crypto **$2,000** caps and does not alter confidence thresholds, max-trade settings, universes, or fee gates.

Apply/verify the additive trade-intent columns `intent_stop_loss_price` and `intent_take_profit_price` through the normal write-path schema readiness, and verify the existing `crypto_entry_reservations` migration remotely before any crypto entry cycle. Do not use a trading cycle as a migration or smoke test.

After deployment, verify the new Worker version, 100% traffic, configured schedules, health, read-only GET endpoints, remote D1 schema, broker-authoritative positions, reservation counts/notional, pending/partial/filled decision convergence, and category exposure against caps. Read-only checks must not submit, cancel, replace, retry, or close orders. Roll back to the prior verified Worker version if schema readiness fails, broker/D1 lifecycle divergence persists, or cap enforcement is not evidenced.

Current candidate validation: 89 tests passed with 264 assertions, typecheck and diff-check passed, and no broker mutation was used. Cloudflare deployment truth remains unverified until authenticated read-only credentials are available.

# Deployment runbook

## Dashboard 1102 hotfix gate — August 10, 2026

Before any release of the local dashboard hotfix, verify that every GET/read-only API construction uses `new Database(env.DB, { readOnly: true })`. Read-only construction must perform zero DDL, `ALTER TABLE`, index creation, pragma/schema checks, or other repair work; write/trading construction remains the only runtime schema-readiness path. Confirm `src/index.ts` has no unconditional fetch-time `ALTER TABLE positions` or equivalent schema repair.

The dashboard uses bounded history windows (90 performance rows and 90 category rows per strategy) and does not issue the removed duplicate per-strategy decision/trade/run history fan-out. Verify broker-authoritative positions: when Alpaca positions fail, return `positionsAvailable: false` with no D1 fallback. The pre-release validation gate was local/read-only; the release is now deployed and live evidence is recorded below.

Required commands from `/workspace/alpaca-trading-bot`:

```bash
bun test
bunx tsc --noEmit
git diff --check
bunx wrangler deploy --dry-run
```

Record exact pass counts and dry-run output in the release evidence. A failed or timed-out dashboard dry-run, any read-only DDL, an unbounded history query, or a broker-failure D1 fallback is a release blocker.

This is the canonical release procedure for `alpaca-trading-bot`.

## Important environment fact

In the current proxy environment, `bunx wrangler deploy` can exit successfully without creating a new Cloudflare Worker version. Treat Wrangler's exit code and console output as a build/upload attempt, not as proof of a live deployment.

For this Worker, the authoritative proof is the Cloudflare API deployment list showing a new version at 100% traffic, followed by read-only HTTP smoke tests.

## 1. Review and test locally

Run from the repository root. The local migration command is safe for a disposable/local D1; do not use the remote command during local validation:

```bash
bun run db:migrate:crypto-reservations
```

For the release environment, after source review and before deployment, an authorized operator must apply the idempotent migration and run the read-only verification:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
```

The verification must show the `crypto_entry_reservations` table and `idx_crypto_entry_reservations_expiry` index. A missing object blocks deployment; the Worker fails closed rather than creating this safety-critical table at runtime.

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
- 85 tests pass, 0 fail, 257 assertions, including fresh/idempotent crypto schema migration, crypto reservation, dashboard read-only, fee telemetry, budget, risk, strategy-comparison, and reconciliation coverage.
- `git diff --check` passes.
- Wrangler dry-run succeeds.
- The earlier capital-cap release is the historical baseline; the current hardening release is recorded in the August 10, 2026 release block below.
- A dry-run warning must be investigated rather than ignored if it is new.

Do not run trading triggers, close endpoints, manual cycles, or order actions as deployment tests.

## 2. Commit and push source changes

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
{"main_module":"index.js","compatibility_date":"2024-06-20","compatibility_flags":["nodejs_compat"],"bindings":[{"type":"d1","name":"DB","database_id":"2bc505a2-d744-4322-8c3b-5f5ebe35f9a1","database_name":"alpaca-trading-bot"}],"triggers":{"crons":["*/5 13-21 * * 1-5","0 22 * * 1-5","7-59/30 * * * *","*/10 * * * *"]}}
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

- `*/5 13-21 * * 1-5`
- `0 22 * * 1-5`
- `7-59/30 * * * *`
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

## Last documented release evidence

As of August 10, 2026:

- Runtime source commit: `4261009` (`Bound dashboard reads and remove GET schema mutations`), including crypto hardening commit `8280696`
- Documentation/release-receipt commit: `7cf03ed` (`Record crypto hardening live release`)
- Documented deployment candidate: `24b7df43-a710-479a-96f8-46b879fc9171`
- Documented Worker version candidate: `d304d14c-c6ea-45ca-97ce-47fd6d350c33`
- Cloudflare control-plane verification was unavailable on August 10, 2026: Wrangler was unauthenticated and Cloudflare API requests returned HTTP 403
- Conflicting later artifact remains unresolved: deployment `5088dbe0-31f9-4892-a149-a74702bbad4e`, version `cb88271c-8712-42a8-88a9-de58c841d3ec`, 100%
- Local `wrangler.toml` schedules are `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`; live scheduler state was not confirmed
- Documented traffic candidate: 100% (not freshly verified)
- Remote D1: `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry` verified; live `positions.strategy` and lifecycle trade columns verified
- Validation: 85 tests passed with 257 assertions; TypeScript, diff-check, and fresh Wrangler dry-run passed
- Read-only HTTP verification at `2026-08-10 13:43:32-13:43:35 UTC`: `/health`, `/api/runs`, `/api/trades`, `/api/positions`, `/`, and `/api/config` returned HTTP 200; `/api/positions` reported `positionsAvailable: true`, `source: alpaca`, and 18 positions
- D1 SELECT-only run evidence: daytrading cron rows 913, 914, and 915 at 13:25:59, 13:35:59, and 13:40:59 UTC all had status `skipped`, `CYCLE_LEASE_HELD`, and `trades_executed: 0`; `/api/trades` showed 12 August 10 records in its latest 50 rows, all crypto, with no daytrading trade indicated
- Maintenance evidence: row 911 at 13:10:59 UTC was a `CYCLE_LEASE_HELD` skip; row 908 at 12:41:35 UTC was `MAINTENANCE_ONLY` with brokerOrders=1, imported=0, ledgerActivities=136, and `trades_executed: 0`
- Source inspection confirms separate `maintenance` and `daytrading` lease keys, but exact historical lease ownership is not reconstructable from available artifacts
- Dashboard contract: `capitalCaps` resolved to daytrading `5000`, swing `3700`, crypto `2000`; performance and category histories are bounded to 90 rows; no `strategyHistory` payload remains
- No manual trading cycle, order, cancel, close, retry, reconciliation trigger, or other mutating endpoint was run during verification
- Source mapping note: Cloudflare deployment artifacts do not embed the Git SHA; the release bundle was built from the pushed repository state and uploaded directly.

## Prior-release natural reconciliation evidence

Read-only live verification on August 8, 2026 confirmed that the prior-release natural maintenance schedule had run. `/api/runs` returned 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC, including 16 `MAINTENANCE_ONLY` completions and 7 `CYCLE_LEASE_HELD` skips. `/api/trades` returned 19 rows with populated `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at` fields, with reconciliation timestamps from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

No mutating endpoint was called. The run details reported `trades_executed: 0` and `imported: 0`, and the reconciler implementation is limited to broker order GETs plus D1 updates. This supports “no broker mutation observed or indicated” for that prior-release window. It does not provide a strict broker order before/after proof because `/api/orders` is unsupported and no same-window order snapshot pair was available. The latest post-August 10 `reconcile_cron` records observed at 07:10:59, 07:30:59, and 07:50:59 UTC were `CYCLE_LEASE_HELD` skips with `trades_executed: 0`; no completed post-release reconciliation is confirmed. The later daytrading open-window rows at 13:25:59, 13:35:59, and 13:40:59 UTC were also `CYCLE_LEASE_HELD` skips; no 13:30:00 UTC daytrading row was retained in the 30-row response, so that exact first market-open tick is an evidence gap.

## Lease starvation incident and fix

The August 9, 2026 live audit found that read-only `reconcile_cron` shared the strategy lease and could hold it while bounded broker imports were still in flight. That produced repeated `CYCLE_LEASE_HELD` skips and could starve trading. The fix isolates `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, bounds the default lease TTL to 10 minutes, and applies a 12-second timeout to each Alpaca HTTP request. The fix is read-only with respect to broker trading actions; deployment verification must confirm independent lease behavior through run logs, not by triggering a cycle or submitting an order.

## Confirmed lifecycle evidence

Read-only source and historical live evidence confirm a higher-severity lifecycle gap than reconciliation alone: the August 6, 2026 live audit recorded repeated partial-filled exits and subsequent quantity mismatches for daytrading/swing symbols. Those strategy paths have no pending-exit guard, so a partial or failed close can be submitted again on a later cycle. Their BUY paths also create a full D1 position immediately after order submission from requested quantity and decision price instead of confirmed broker fill quantity; a partial or pending BUY can therefore inflate internal quantity before reconciliation. Daytrading and swing client IDs use `Date.now()` and are not deterministic across retries, while swing BUYs use `decision_id: null` and swing exits omit the originating decision ID. Crypto has a pending-exit guard and deterministic client IDs, but no complete broker retry/cancel/replace lifecycle. This remains an open production risk until pending-order state, fill-aware position creation, deterministic correlation, and retry/cancel/replace behavior are implemented and tested.

## Fee-aware release notes

This local patch hardens crypto execution economics without changing the $2,000 crypto cap: protective exits run before discretionary halts, entries default to one per cycle, discretionary exits default to two per cycle, pending entries reserve position/capital capacity, D1 supplies persistent recent-order rate state, and fee telemetry is scoped to positive curated-universe samples from seven days. Strategy tabs still show gross P&L, recorded attributable fees, and net P&L; historical realized P&L remains model/gross-style until fill-lot matching is implemented.

BUY cost checks are quantity/notional-aware. Discretionary signal SELL/CLOSE checks are separate from BUY sizing, and protective, EOD, and manual exits bypass them. Swing cost estimates use explicit bps conversion and round-trip costs; BUY rejection remains disabled until calibrated `expectedEdgeBps` is configured.

Before deployment, rerun the full local gates, review the direct diff, commit/push, build an explicit bundle, upload through the documented Cloudflare multipart path, then verify a new version, 100% traffic, all four schedules, and read-only endpoints. Do not use trading actions as smoke tests.

## Current follow-up queue

The active weekly read-only deferred-risk review is `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), every Monday at 10:00 Europe/Copenhagen. It is verified active and must not trigger broker mutations.

1. Verify a completed post-August 10 `reconcile_cron` run, lifecycle-field population, run-log evidence, and absence of broker mutations without triggering reconciliation; the checked 07:10:59, 07:30:59, and 07:50:59 UTC records were skips.
2. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
6. Revalidate Cloudflare deployment identity, 100% traffic, and all four live schedules when authenticated read-only Cloudflare credentials are available; the August 10 conflict remains unresolved.
