# Repository instructions for coding assistants

MarketPulse is a **public** repository containing an n8n market-digest workflow, a static dashboard, and publication automation. This document concerns work in this repository; it does not require access to another project or a coordination service.

## Start from the source

Read [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [CONTRIBUTING.md](CONTRIBUTING.md). Check the worktree before editing and preserve unrelated changes.

The supported workflow export is `MarketPulse-Secure/workflows/marketpulse-workflow-CURRENT.json` with 46 nodes. Its editable inputs are `src/n8n/`, `scripts/node-sources.json`, `scripts/workflow-template.json`, and `scripts/analysis-contract.txt`. Build with `scripts/build-workflow.mjs`; do not edit only the generated export or manifest.

Keep shared behavior in common runtime/helper files and declare dependencies in the node-source map. The builder and tests use the same `scripts/node-source.mjs` resolver; the manifest hashes every included source.

## Verify changes

Use Node.js 22 from the repository root:

```sh
node scripts/build-workflow.mjs
node --test tests/*.mjs
node scripts/build-workflow.mjs --check
node .github/scripts/validate-dashboard-data.mjs --allow-historical
git diff --check
```

For a local freshness observation without external writes:

```sh
node .github/scripts/check-freshness.mjs
```

## Preserve the product contract

New dashboard publications use schema v2. Approval establishes schema and citation availability, not semantic truth or investment performance. Withhold failed commentary without forwarding raw model output. Preserve stable headline identifiers, valid zero values, and the distinction between approved, withheld, stale, and unverified legacy data.

Only the hash-pinned original snapshots may use the historical exception. Do not rewrite historical ledger results or expand the exception to conceal invalid new payloads.

## Keep operational state separate

Never commit API keys, populated credential exports, runtime ledger state, or deployment-specific destinations. Maintain `YOUR_*` placeholders in the public template. The FRED key is currently configured in the imported workflow's Code node, not through the repository's infrastructure `.env`.

Repository edits do not deploy a running workflow. Do not automatically push to `main`, activate workflows, publish to channels, change credentials, or alter Pages settings unless those actions are authorized in the current task. Report local validation and production verification separately.

Deploying this code and importing the workflow are separate operator steps. Inspect actual deployed versions and publication timestamps before making a deployment claim.
