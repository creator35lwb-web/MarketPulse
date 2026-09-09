# Contributing to MarketPulse

Contributions should improve the reliability, clarity, or usefulness of the source-attributed market digest. Read the [project overview](README.md) and [architecture](docs/ARCHITECTURE.md) before changing the publication path.

## Report a problem

Use [GitHub issues](https://github.com/creator35lwb-web/MarketPulse/issues) for reproducible bugs and feature proposals. Include the affected edition, expected and actual behavior, relevant timestamps, n8n/Node versions, and a small sanitized example.

Distinguish source fetch, model verification, Telegram delivery, repository publication, and Pages deployment. A stale dashboard alone does not establish that the host is offline or that Telegram failed.

Do not attach populated workflow exports, API keys, credential objects, subscriber identifiers, or raw execution dumps containing sensitive data. Report suspected credential exposure through an available private security-reporting channel rather than a public issue.

## Edit the source, then rebuild

| Change | Source location |
|---|---|
| Code-node behavior | `src/n8n/` |
| Shared schema and attribution policy | `src/n8n/analysis-policy.js` |
| Workflow graph, configuration, schedules | `scripts/workflow-template.json` |
| Code-node mapping and ordered shared-source includes | `scripts/node-sources.json` |
| Shared source resolution for builds and tests | `scripts/node-source.mjs` |
| Shared analyst output constraints | `scripts/analysis-contract.txt` |
| Dashboard | `docs/` |
| Publication validation and monitoring | `.github/scripts/` and `.github/workflows/` |

Do not hand-edit only `marketpulse-workflow-CURRENT.json` or its manifest. Rebuild them from source and include the generated changes in your PR.

Keep behavior shared between editions in the common runtime or fetching helpers. The resolver prepends declared dependencies once, then the edition wrapper. The builder checks syntax without executing node code and hashes every included source. Tests execute those same resolved bodies with mocked n8n dependencies.

## Run the checks

Use Node.js 22 from the repository root:

```sh
node scripts/build-workflow.mjs
node --test tests/*.mjs
node scripts/build-workflow.mjs --check
node .github/scripts/validate-dashboard-data.mjs --allow-historical
git diff --check
```

The Node suite uses offline fixtures and mocked providers. Add focused regression coverage when changing a contract, numeric calculation, failure path, or persistent-state rule. Use realistic source formats and exercise both editions when they share behavior. Do not send live channel messages or modify a production workflow as part of an ordinary test run.

The validator defaults to schema v2. Its historical flag recognizes only the frozen original snapshots, not arbitrary legacy input. Do not extend that allowlist to make new invalid data pass.

For monitoring changes, an observation-only check is available:

```sh
node .github/scripts/check-freshness.mjs
```

Offline checks do not validate container migrations, external credentials, provider behavior, or deployed Pages. State separately which installation checks were performed.

## Preserve the verification boundary

Commentary is either approved in full or withheld in full. The renderers must not fall back to raw model prose, silently drop unchecked excess claims, or invent unavailable evidence. Stable headline keys must survive filtering. Genuine zero values must remain distinguishable from missing data.

Approval means schema and citation availability were checked. Do not describe it as semantic fact checking, a guarantee against all numerical language, or investment-performance validation. Preserve the visible legacy/withheld/stale distinctions.

Changes to publication must retain validation of the artifact that Pages deploys. Changes to schedules must update monitor and dashboard deadlines together. Ledger changes must preserve historical records and document any change in scoring rules.

## Submit a pull request

Create a branch from `main`. Explain the concrete problem, the resulting behavior, and relevant validation. Include configuration or migration implications and identify any behavior that still requires a live installation check.

Keep credentials and deployment-specific values out of the patch. Preserve unrelated work and existing historical data. Repository changes and workflow deployment are separate actions; neither a PR nor a successful local test proves production is running the new code.

Please keep reviews respectful, specific, and grounded in evidence.
