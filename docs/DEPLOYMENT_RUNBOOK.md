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
- 53 tests pass, 0 fail, 151 assertions, including fee-aware risk and strategy-comparison coverage.
- `git diff --check` passes.
- Wrangler dry-run succeeds.
- The fee-aware patch is deployed and verified: commit `bc451d61631f8b34f05aac00c8e95b10b96e5c9d` is pushed; Worker deployment `a51dfa749d8f47d280a658342dc98e40` is live at 100% traffic; all four schedules are present; `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, and `/api/positions` returned HTTP 200; the Pages workflow for the commit completed successfully.
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

As of August 8, 2026:

- Git commit: `bc451d61631f8b34f05aac00c8e95b10b96e5c9d`
- Cloudflare deployment ID: `a51dfa749d8f47d280a658342dc98e40`
- Cloudflare version ID: `a51dfa74-9d8f-47d2-80a6-58342dc98e40`
- Traffic: 100%
- Schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, `*/10 * * * *`
- Validation: TypeScript passed; 53 tests passed with 151 assertions; diff-check passed; Wrangler dry-run passed
- Read-only HTTP: `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, and `/api/positions` returned HTTP 200
- GitHub Pages workflow run `31249077806` completed successfully for the same commit
- No manual trading cycle, order, cancel, close, retry, or reconciliation trigger was run during deployment

## Fee-aware release notes

This patch is additive at the dashboard/API level: strategy tabs show gross P&L, recorded attributable fees, and net P&L, while account-level fees and unmatched broker P&L remain visible as unattributed. It does not rewrite historical realized P&L, category snapshots, or fill attribution.

BUY cost checks are quantity/notional-aware. Discretionary signal SELL/CLOSE checks are separate from BUY sizing, and protective, EOD, and manual exits bypass them. Swing cost estimates use explicit bps conversion and round-trip costs; BUY rejection remains disabled until calibrated `expectedEdgeBps` is configured.

Before deployment, rerun the full local gates, review the direct diff, commit/push, build an explicit bundle, upload through the documented Cloudflare multipart path, then verify a new version, 100% traffic, all four schedules, and read-only endpoints. Do not use trading actions as smoke tests.

## Current follow-up queue

1. Verify the first `reconcile_cron` run, lifecycle-field population, run-log evidence, and absence of broker mutations.
2. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
