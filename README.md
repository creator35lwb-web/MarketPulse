# MarketPulse

MarketPulse is an open-source market digest for US and China coverage, built with n8n. It combines fetched market data, source-attributed AI commentary, Telegram delivery, and a static dashboard.

[Dashboard](https://creator35lwb-web.github.io/MarketPulse/) · [Telegram channel](https://t.me/n8nMarketPulse) · [Issues](https://github.com/creator35lwb-web/MarketPulse/issues) · [MIT license](LICENSE)

## Repository status

This checkout contains the schema-v2 implementation and a reproducible **46-node** workflow export. Deploying this code and importing the workflow are separate operator steps. Check execution records, publication timestamps, and deployed versions before assuming the hosted system matches this code.

The original dashboard snapshots dated August 9, 2026 (US) and August 10, 2026 (CN) are **historical, unverified legacy data**. A frozen allowlist permits their unchanged presence during migration; their presence does not establish current service health or approval under the new contract.

## What the checks establish

The model returns structured qualitative commentary. Code supplies numeric evidence from fetched fields. Before commentary can reach either output, the shared policy checks:

- Exact analysis fields, allowed sentiment/confidence/direction values, and one to six claims.
- A nonempty citation list for every claim, resolving to a usable fetched value or the actual fetched headline.
- Bounded text and a conservative numeric-text filter covering Unicode numbers and a documented English lexicon.
- Explicit approval metadata, rechecked by the Telegram and dashboard producers.

Any failure withholds the entire AI commentary. Available source data can still be delivered. Dashboard publication additionally requires usable market rows and acceptable source health.

These checks establish **schema and citation availability**. They do not prove source accuracy, semantic agreement between a claim and its evidence, exhaustive detection of numerical language, or investment value. Headline citations establish that a title was fetched; an unavailable source link is shown explicitly. Source feeds can be delayed, incomplete, or wrong.

## Coverage and schedules

The US edition includes market indices, commodities, currencies, FRED economic indicators, valuation measures, CNN Fear & Greed, headlines, and a configurable stock watchlist. The China edition includes mainland and Hong Kong indices, USD/CNY, World Bank economic indicators, headlines, and a configurable watchlist.

The workflow template uses `Asia/Kuala_Lumpur` (UTC+8):

| Trigger | MYT | UTC |
|---|---|---|
| US digest | Daily at 21:00 | Daily at 13:00 |
| China digest | Monday–Friday at 16:30 | Monday–Friday at 08:30 |
| Weekly ledger summary | Sunday at 08:00 | Sunday at 00:00 |

These are execution schedules, not promises that every source contains a new market session. Publication monitoring allows one hour of grace. The weekly summary reads stored records; it does not fetch new market data or call a model.

The template selects Google Gemini `gemini-3.6-flash` with Groq `openai/gpt-oss-120b` as the fallback (Groq retired `llama-3.3-70b-versatile` on 2026-08-16). Both analysis chains retry five times, five seconds apart. Configure credentials and confirm model availability for your own installation.

## Build and check locally

Use Node.js 22 from the repository root. These checks use built-in Node modules and offline fixtures:

```sh
node scripts/build-workflow.mjs
node --test tests/*.mjs
node scripts/build-workflow.mjs --check
node .github/scripts/validate-dashboard-data.mjs --allow-historical
node .github/scripts/check-freshness.mjs
```

The builder creates `MarketPulse-Secure/workflows/marketpulse-workflow-CURRENT.json` and its hash manifest. The freshness command shown above observes local files without changing issues or sending messages.

The validator checks both required dashboard files. Its default mode requires schema v2; `--allow-historical` additionally permits only the exact hash-pinned original legacy snapshots. It does not approve arbitrary old-format data.

## Run your own instance

1. Prepare an n8n installation and an owner account. The Docker files under [MarketPulse-Secure](MarketPulse-Secure/) are deployment templates that require configuration and runtime verification.
2. Import the generated [CURRENT workflow](MarketPulse-Secure/workflows/marketpulse-workflow-CURRENT.json) while inactive.
3. Follow the [workflow setup guide](MarketPulse-Secure/workflows/README.md) to bind credentials, replace destination placeholders, configure the FRED key in your imported copy, and set watchlists.
4. Test against your own Telegram destination and repository, then verify publication independently from message delivery.
5. Set GitHub Pages to **GitHub Actions** so deployment uses the validated artifact, and activate schedules after checking your installation.

Importing a workflow does not configure credentials, deploy Pages, or prove delivery. Changing source files does not update a running n8n workflow automatically.

## Project layout

| Path | Purpose |
|---|---|
| `src/n8n/` | Edition wrappers, shared Code-node runtimes, and verification policy |
| `scripts/workflow-template.json` | Sanitized workflow graph, settings, and node configuration |
| `scripts/node-sources.json` | Workflow-node mapping and ordered shared-source includes |
| `scripts/node-source.mjs` | Source resolver used by the builder and offline node tests |
| `scripts/analysis-contract.txt` | Shared constraints appended to all four analyst prompts |
| `scripts/build-workflow.mjs` | Reproducible export and source-hash manifest |
| `docs/` | Static dashboard, data, and architecture documentation |
| `.github/` | Publication validator, Pages workflow, and freshness monitor |
| `tests/` | Offline boundary, producer, source, dashboard, and monitor checks |
| `MarketPulse-Secure/workflows/archive/` | Historical exports; not the current import target |

The displayed track record is a retrospective comparison of stored sentiment with later benchmark movement. It is not a trading return, a forecast guarantee, or a measure of all commentary accuracy. From the beta onward, it counts only calls made and graded under the current rules. The record published before the beta is archived unchanged in [`docs/archive/pre-beta.html`](https://creator35lwb-web.github.io/MarketPulse/archive/pre-beta.html); `scripts/archive-pre-beta.mjs` copies it byte for byte from the repository history.

Read [Architecture](docs/ARCHITECTURE.md) for the publication contract and [Contributing](CONTRIBUTING.md) for development guidance. MarketPulse is informational software, not financial advice.
