## August 22, 2026 Control-4 production control

Release-control status: **FAIL**. Live operations status: **DEGRADED**, not healthy. All six GET endpoints remain HTTP 200; positions are broker-authoritative (`source: alpaca`, 29 rows), equity is 98,504.50 versus last_equity 98,270.0927 (+234.4073), and caps remain $5,000/$3,700/$2,000.

Local reliability correction passed focused 26/154 and full 157/518 regressions, typecheck, diff-check, and Wrangler dry-run. Deployment stopped before upload because Wrangler rejected the non-interactive process without `CLOUDFLARE_API_TOKEN`; live remains 1.0.0/2.4.0 versus local 2.6.0.

CONTROL-4 owner: Joachim, next trigger: authenticated Cloudflare deployment access. Acceptance: deploy exact validated 2.6.0 artifact, tie receipt to source commit and four UTC crons, then separately GET-verify all six endpoints, filtered runs, broker source, equity, schedules, fresh structured terminal records, lifecycle/accounting, edge observability, and unchanged caps. Fresh alias probes currently match canonical rows, but older saved captures show empty aliases, so alias behavior remains unresolved. Run-log analyzed/filtered counts are not persisted, and production has no calibrated `rawEdgeBps` producer; daily direction is also unproven because live daily fields are zero. No broker-mutating endpoint, trigger, migration, or trading action was used.

At 08:02 UTC, the authorized Wrangler retry using the stored Cloudflare credential again stopped before upload with `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` No deployment or broker mutation occurred; retain FAIL/DEGRADED and the follow-up.
