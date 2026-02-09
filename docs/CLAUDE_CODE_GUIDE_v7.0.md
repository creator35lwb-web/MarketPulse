# Claude Code Implementation Guide - MarketPulse v7.0

## From: CTO T (Manus AI) | To: CTO RNA (Claude Code)
## Date: February 9, 2026

---

## Mission Brief

Deploy MarketPulse v7.0 "Value Investor Edition" to the user's local n8n instance. This is a major upgrade that adds a **Value Investor Dashboard** inspired by Warren Buffett's investment philosophy, featuring the Buffett Indicator, Shiller PE (CAPE), Yield Curve analysis, and S&P 500 vs 200-Day Moving Average tracking.

## What's New in v7.0

### Value Investor Dashboard (NEW)
The top section of the Telegram message now features four critical valuation indicators, each with color-coded emoji signals:

| Indicator | Source | Calculation |
|-----------|--------|-------------|
| **Buffett Indicator** | Yahoo Finance (^W5000) + FRED (GDP) | (Wilshire 5000 x 1.05) / GDP x 100 |
| **Shiller PE (CAPE)** | Scraped from multpl.com | Parsed from HTML |
| **Yield Curve** | FRED (DGS10 - DGS2) | 10Y Treasury - 2Y Treasury |
| **S&P 500 vs 200D-MA** | Yahoo Finance (^GSPC, 1y range) | (Current / 200-day MA) - 1 |

### Color-Coded Benchmark System

**Buffett Indicator:**
- `< 100%` = Undervalued
- `100-120%` = Fair Value
- `120-150%` = Slightly Overvalued
- `150-200%` = Significantly Overvalued
- `> 200%` = Strongly Overvalued

**Shiller PE (CAPE):**
- `< 20` = Undervalued
- `20-25` = Fair Value
- `25-30` = Slightly Overvalued
- `30-35` = Overvalued
- `> 35` = Strongly Overvalued

**Yield Curve (10Y-2Y):**
- `< 0%` = INVERTED (Recession Warning)
- `0-0.5%` = Flat (Caution)
- `> 0.5%` = Normal (Healthy)

**S&P 500 vs 200-Day MA:**
- `> +5%` = Strong Bullish
- `0 to +5%` = Bullish
- `-5% to 0%` = Caution
- `< -5%` = Bearish Signal

### Expanded Market Screener
Added three new instruments:
- **Oil (WTI)**: `CL=F` via Yahoo Finance
- **US Dollar (DXY)**: `DX-Y.NYB` via Yahoo Finance
- **Bitcoin**: `BTC-USD` via Yahoo Finance

### New FRED Series
- **2-Year Treasury Yield**: `DGS2` (needed for Yield Curve calculation)

### Updated LLM Prompt
- Now includes Value Investor Dashboard data in context
- Requests "Buffett Wisdom" quote relevant to current conditions
- Requests "Valuation Overview" interpreting all four dashboard indicators together

## Deployment Steps

### Step 1: Pull Latest from GitHub
```bash
cd ~/MarketPulse
git pull origin main
```

### Step 2: Import Workflow
The workflow JSON is at: `MarketPulse-Secure/workflows/marketpulse-workflow-v7.0.json`

Import into n8n:
1. Open n8n dashboard
2. Go to Workflows > Import from File
3. Select `marketpulse-workflow-v7.0.json`
4. Or use n8n CLI: `n8n import:workflow --input=marketpulse-workflow-v7.0.json`

### Step 3: Configure Credentials
Replace these placeholders in the workflow:
- `YOUR_FRED_API_KEY_HERE` → User's FRED API key
- `YOUR_TELEGRAM_CHAT_ID` → Telegram channel/chat ID
- `CONFIGURE_IN_N8N` → Select existing Telegram and Gemini credentials

### Step 4: IPv4 Fix (if needed)
The workflow already includes `dns.setDefaultResultOrder('ipv4first')` in both Code nodes. If the local n8n instance still has IPv4 issues, also set the environment variable:
```bash
export NODE_OPTIONS="--dns-result-order=ipv4first"
```

### Step 5: Test Execution
Run the workflow manually and verify:
1. All 4 Value Investor Dashboard indicators populate with values and color emojis
2. All 7 Market Screener instruments show prices and % changes
3. All 6 Economic Indicators show values with dates
4. Watchlist shows GOOGL, BABA, ADBE with prices
5. AI Analysis includes "Valuation Overview" and "Buffett Wisdom" sections
6. Telegram message delivers successfully as a single message

## Architecture (14 nodes)

```
Daily 7AM Trigger
    ├── Fetch All Market Data (Code) ──→ Merge All ──→ Combine All Data
    │   [Fear&Greed, Indices, Gold,       (input 0)     (merges all)
    │    Oil, DXY, BTC, FRED data,                         │
    │    CAPE, Buffett, Yield Curve,                        ├──→ Basic LLM Chain ──→ Merge LLM Result
    │    200-Day MA]                                        │         │                    │
    │                                                       └─────────┘                    │
    └── Set Dynamic Watchlist                                                              │
            └── Fetch Stock Prices ──→ Merge All ──→ ... ──→ Compose Telegram Message
                (GOOGL, BABA, ADBE)    (input 1)                      │
                                                              Send to Telegram

Error Trigger ──→ Sanitize Error ──→ Send Error Alert (Telegram)
```

## Validation Checklist
- [ ] Buffett Indicator shows percentage with color emoji
- [ ] Shiller PE shows ratio with valuation status
- [ ] Yield Curve shows spread with inversion warning if applicable
- [ ] S&P 500 vs 200D-MA shows percentage with Golden/Death Cross
- [ ] Oil, DXY, Bitcoin appear in Market Screener
- [ ] 2Y Treasury appears in Economic Indicators
- [ ] AI Analysis includes Valuation Overview and Buffett Wisdom
- [ ] Single Telegram message (no duplicates)
- [ ] No Markdown parsing errors in Telegram

## GitHub Tracking
- Workflow JSON: `MarketPulse-Secure/workflows/marketpulse-workflow-v7.0.json`
- This Guide: `docs/CLAUDE_CODE_GUIDE_v7.0.md`
- Repository: https://github.com/creator35lwb-web/MarketPulse
