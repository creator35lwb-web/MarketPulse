# MarketPulse Workflows

## Import this one

**`marketpulse-workflow-CURRENT.json`** — the actual production workflow, exported from the
live instance. 37 nodes, US + China editions. This is what really runs and sends
[@MarketPulse7am](https://t.me/MarketPulse7am) every day.

Everything in `archive/` is **historical** (v2.1 → v7.0, 11–28 nodes). Those are kept so the
evolution is readable, not because you should run them. They predate the verification
architecture entirely — importing one would give you a plain LLM summarizer, which is the
opposite of the point.

## What's actually in the current workflow

The thing that makes this different from "an LLM that reads market data" is that **the LLM is
never allowed to state a number.** Code fetches and verifies; the model only narrates.

| Layer | What it does |
|---|---|
| **Structured generation** | The prompt demands strict JSON — `{sentiment, confidence, claims[{claim, basedOn, direction}], interpretation, wisdom}` — and **forbids digits anywhere in the model's text**. |
| **Deterministic verify + enforce** | Every claim must cite a `basedOn` factKey. Code checks each citation against the fetched ground truth: unknown key, cites-an-N/A-source, digits-in-text, sentiment contradicting its own cited evidence. **Any violation and the AI commentary is withheld** — the verified data still ships. |
| **Evidence injection** | Numbers in the digest are injected from source data under each claim, never written by the model. Numeric hallucination is structurally impossible, not merely discouraged. |
| **Sanity bounds** | Each `*Change` value is checked against a plausible daily move. Out-of-bounds → a 🔍 DATA QUALITY FLAG for a human. *(This is not theoretical: it caught a real bug — see below.)* |
| **Verdict ledger** | Each day's sentiment + attributions persist, giving the next day a challengeable prior. |
| **Track record** | Yesterday's stated sentiment is scored against what the market actually did. Retrospective only — the system never predicts. Published, hit or miss. |
| **Headline citation tier** | The model may cite `headline_N`, verified for **existence** in that day's real fetch — explicitly *not* fact-checked, and the prompt says so, so the guarantee is never overclaimed. |
| **Graceful degradation** | If the model provider is down, the digest **still ships the verified ledger** with an honest "AI commentary unavailable" note. The analysis layer is advisory; the data is the product. |

## Setup

Import into n8n, then replace every `YOUR_*` placeholder:

| Placeholder | What it is |
|---|---|
| `YOUR_FRED_API_KEY_HERE` | Free key from [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `YOUR_TELEGRAM_CHAT_ID` | The channel the digest posts to |
| `YOUR_TELEGRAM_ADMIN_DM_ID` | Your own DM — error alerts go here, not to subscribers |
| `YOUR_GITHUB_USERNAME` | Owner of the repo the dashboard publishes to |
| `YOUR_*_CREDENTIAL_ID` | n8n will bind these when you attach your own credentials |

**A note on credentials, learned the hard way:** if you *rotate* a credential by creating a
**new** one in n8n rather than editing the existing one in place, every node still points at
the **old credential ID** — which no longer exists. The credential list looks healthy, the
workflow still reports `active: true`, and the next run silently ships nothing. Re-point the
nodes, and then *prove* the new credential works rather than assuming it does.

## An honest note on the sanity-bound check

It earns its place. On 2026-07-13 it flagged the S&P 500 "daily change" as implausible at
**+20.62%**. That turned out to be real: the S&P is fetched with `range=1y` (the 200-day
moving average needs a year of closes), and Yahoo's `chartPreviousClose` means *"the close
before the chart range starts"* — so for that one symbol it meant **a year ago**. We had been
publishing the S&P's **annual return as its daily change**.

Worse, the track record scores sentiment against that number — so with it pinned near +20%,
"Bearish" was an automatic Miss and "Bullish" an automatic Hit. The credibility metric was
measuring nothing.

The detector worked. We ignored it for several sessions, filed as "anomalous, not yet
root-caused," and built features on top of it. That is the real lesson, and it is not a
flattering one: **a detector that fires into a void is worse than no detector — it
manufactures the appearance of coverage.**

Fixed (derive the prior close from the timeseries, not the range boundary), and the track
record was **reset to zero** rather than publish a score derived from a broken measurement.
A track record you don't reset when it's proven wrong isn't a track record; it's marketing.
