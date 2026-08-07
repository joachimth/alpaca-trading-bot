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
- 46 tests pass, 0 fail, 127 assertions.
- Wrangler dry-run succeeds.
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

## 4. Upload directly through the Cloudflare API

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

## 7. Release receipt

Record these values in the release note or conversation:

- Git commit pushed to `origin/main`.
- Cloudflare deployment ID and version ID.
- Traffic percentage.
- Schedule list.
- Test/typecheck result.
- Read-only HTTP status results.
- Confirmation that no manual cycle, order, cancel, close, or retry was run.

## Current verified release

As of August 7, 2026:

- Git commit: `86def4f22ecdb30fdc919b74f84115a112b3bd17`
- Cloudflare deployment ID: `da419696-2fb6-498c-86f4-d659f4bac8f3`
- Cloudflare version ID: `0f05e645-b33c-4335-92d9-68b8237eb62a`
- Traffic: 100%
- Validation: TypeScript passed; 46 tests passed; `/health`, `/api/dashboard`, `/api/trades`, and `/api/runs` returned HTTP 200
- No manual trading cycle or order action was run during deployment
