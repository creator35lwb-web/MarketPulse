# MarketPulse workflow setup

Import [marketpulse-workflow-CURRENT.json](marketpulse-workflow-CURRENT.json). It is a generated, sanitized **46-node** workflow containing both daily editions, fallback analysts, notifications, and the weekly ledger summary.

This checkout contains the schema-v2 implementation. Deploying this code and importing the workflow are separate operator steps; inspect actual deployed versions and publication timestamps. The export is an inactive installation template. Files under [archive](archive/) are historical examples and are not the supported import target.

## Build the import artifact

From the repository root, use Node.js 22:

```sh
node scripts/build-workflow.mjs
node --test tests/*.mjs
node scripts/build-workflow.mjs --check
node .github/scripts/validate-dashboard-data.mjs --allow-historical
```

The export is assembled from `src/n8n/`, `scripts/node-sources.json`, `scripts/workflow-template.json`, and `scripts/analysis-contract.txt`. The adjacent [workflow-manifest.json](workflow-manifest.json) records source and workflow hashes. It establishes reproducibility, not production installation.

## Configure your inactive import

Create an n8n owner account and import into a separate, inactive workflow. Keep schedules inactive while binding credentials and configuring destinations.

| Placeholder or node | Required configuration |
|---|---|
| `YOUR_FRED_API_KEY_HERE` | Set the FRED key in the imported **Fetch All Market Data** Code node. This template currently uses a code constant; keep the populated copy out of Git and public exports. |
| `YOUR_GOOGLE_PALM_API_CREDENTIAL_ID` | Bind your Google credential to both Gemini model nodes. |
| `YOUR_GROQ_API_CREDENTIAL_ID` | Bind your Groq credential to both fallback model nodes. |
| `YOUR_TELEGRAM_API_CREDENTIAL_ID` | Bind your Telegram bot credential to every Telegram delivery/error/status/weekly node. |
| `YOUR_TELEGRAM_CHAT_ID` | Set your own digest/status/weekly destination. Use a test destination during setup. |
| `YOUR_TELEGRAM_ADMIN_DM_ID` | Set your error-notification destination. |
| `YOUR_PUBLIC_GITHUB_CREDENTIAL_ID` | Bind publication credentials to both **Publish Dashboard Data** nodes. Grant access to the target repository's contents. |
| `YOUR_PRIVATE_GITHUB_CREDENTIAL_ID` | Bind issue-creation credentials for the operator's incident repository, if that branch is enabled. |
| `YOUR_GITHUB_USERNAME`, `YOUR_PUBLIC_REPOSITORY`, `YOUR_PRIVATE_OPS_REPOSITORY` | Replace repository owners and destinations in the relevant GitHub nodes. |
| Watchlist configuration nodes | Set your US and China watchlist symbols. |
| Model nodes | Confirm the template's selected model identifiers are available to your account. |

Credential names in an export are placeholders. Selecting a new credential object requires rebinding every affected node; a working credential elsewhere does not repair a stale node reference.

The Docker `.env` file configures infrastructure. It does not populate the workflow's API credentials or replace the FRED code constant. Follow the [deployment template instructions](../README.md) for owner-account, secret-file, and runtime configuration.

The template includes an operator status form that can send notifications. Configure access to that form before exposing the workflow publicly. Adapt hardcoded dashboard/repository links in message code and the optional watchdog channel destination for your fork.

## Check schedules and destinations

The workflow timezone is `Asia/Kuala_Lumpur` (UTC+8):

| Branch | Cron expression | Scheduled time |
|---|---|---|
| US | `0 21 * * *` | Daily, 21:00 MYT / 13:00 UTC |
| China | `30 16 * * 1-5` | Weekdays, 16:30 MYT / 08:30 UTC |
| Weekly summary | `0 8 * * 0` | Sunday, 08:00 MYT / 00:00 UTC |

Changing these schedules also requires updating the freshness monitor's deadline configuration and the dashboard's freshness rules.

Set both GitHub publication nodes to your repository. Their file-edit operation expects the edition files to exist; a fork already includes them. The publication workflow targets `main`, so align the repository's default branch and automation configuration.

For Pages, select **GitHub Actions** as the deployment source. The included workflow validates and uploads one artifact, then deploys only after that validation job succeeds. Configure the `github-pages` environment if your repository uses deployment protection.

The freshness workflow uses the repository's automatic GitHub token for issue reconciliation. Its optional `TELEGRAM_BOT_TOKEN` Actions secret is separate from n8n's credential store. The observation command below needs neither token:

```sh
node .github/scripts/check-freshness.mjs
```

## Verify before activation

Use your own test destinations to check each edition. Inspect source health, the verifier result, Telegram content, the committed JSON, and the Pages deployment separately. A successful node test is not an end-to-end delivery result.

Commentary must either carry explicit approval under the current schema or be withheld. New dashboard data must use schema v2 with matching facts, claim counts, and stable headline identifiers. If source health is an outage or no usable market row remains, the producer preserves the previous dashboard file.

The original August 2026 dashboard files are hash-pinned legacy snapshots. The `--allow-historical` flag retains those exact files as unverified history; it does not exempt new publications from schema v2.

Activate only after checking schedules, destinations, credentials, and persistence on your installation. Importing this export into an existing installation does not migrate its stored ledger automatically. Back up the workflow and its state before replacing an existing active workflow.

## What “approved” means

Approval checks JSON structure, allowed labels, bounded numeric-text rules, and whether cited values or titles are available. It does not prove a claim follows from its evidence, that a source is correct, or that a trading decision will succeed. A missing source URL does not invalidate an actual fetched title; readers see when the link is unavailable.

The retrospective ledger and outcome ratio are not investment returns or a guarantee of future performance. See [Architecture](../../docs/ARCHITECTURE.md) for the full contract and its limits.
