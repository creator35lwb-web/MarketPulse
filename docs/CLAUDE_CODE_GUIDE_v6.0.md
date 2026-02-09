# Claude Code Implementation Guide: MarketPulse v6.0

**From:** Manus AI (CSO R / System Architect)
**To:** Claude Code (CTO RNA)
**Date:** 2026-02-09
**Bridge:** [MarketPulse GitHub Repository](https://github.com/creator35lwb-web/MarketPulse)

---

## Context

MarketPulse v5.0 was successfully deployed and validated via the VerifiMind-PEAS framework. The user has requested an upgrade to **v6.0 - Market Screener Edition** with the following requirements:

1. **IPv4 Fix** - Resolve IPv6/IPv4 DNS resolution issues that cause workflow automation failures
2. **New Market Indicators** - Add S&P 500 (^GSPC), Dow Jones (^DJI), VIX (^VIX), and Gold (GC=F)
3. **Watchlist Update** - Focus on GOOGL, BABA, ADBE only
4. **LLM Upgrade** - Use Google Gemini (gemini-2.5-flash) instead of Groq
5. **Reliability** - Add retry logic and rate limiting between API calls

## What Manus AI Has Completed

### 1. API Validation (All Passed)

| Data Source | Symbol | API | Status |
|------------|--------|-----|--------|
| S&P 500 | ^GSPC | Yahoo Finance | ✅ Working (6,932.30) |
| Dow Jones | ^DJI | Yahoo Finance | ✅ Working (50,115.67) |
| VIX | ^VIX | Yahoo Finance | ✅ Working (17.76) |
| Gold | GC=F | Yahoo Finance | ✅ Working ($5,048.20) |
| GOOGL | GOOGL | Yahoo Finance | ✅ Working ($322.86) |
| BABA | BABA | Yahoo Finance | ✅ Working ($162.51) |
| ADBE | ADBE | Yahoo Finance | ✅ Working ($268.38) |
| Fear & Greed | - | CNN API | ✅ Working (45/100) |
| Headlines | - | MarketWatch RSS | ✅ Working (8 headlines) |
| Economic Data | - | FRED API | ✅ Working (requires API key) |

### 2. Workflow JSON Created

File: `MarketPulse-Secure/workflows/marketpulse-workflow-v6.0.json`

### 3. Key Architecture Changes from v5.0

- **Fetch All Market Data** node now includes market indices (S&P 500, Dow Jones, VIX, Gold) fetching
- **IPv4 Fix**: Added `dns.setDefaultResultOrder('ipv4first')` at the top of both Code nodes
- **Consolidated Stock Fetching**: Replaced Split Watchlist + HTTP Request + Process Stock Prices with a single "Fetch Stock Prices" Code node that includes retry logic
- **Rate Limiting**: 500ms delay between API calls
- **Retry Logic**: 3 attempts with exponential backoff for stock price fetching
- **New Telegram Message Section**: "MARKET SCREENER" with directional arrows and VIX status indicators

## What Claude Code Needs To Do

### Priority 1: IPv4 Fix for Local n8n Instance

The user's local n8n instance on Windows has IPv6/IPv4 DNS resolution issues. Apply the **workflow-level fix** (not NSSM-level) to keep changes scoped to this workflow only:

```javascript
// Add at the TOP of every Code node that makes HTTP requests:
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
```

This is already included in the v6.0 JSON. Verify it works on the user's local machine.

### Priority 2: Deploy v6.0 Workflow

1. Import `marketpulse-workflow-v6.0.json` into the user's local n8n instance
2. Configure credentials:
   - **Google Gemini API**: Use key `AIzaSyAjvR0Rk2umbDun1xfj6qESwfkm_OSOkKs`
   - **FRED API**: Use existing key (already in user's environment)
   - **Telegram API**: Use existing bot token and chat ID
3. Test execution and verify all data sources return values

### Priority 3: Validate Telegram Message Format

The expected output format should include the new **MARKET SCREENER** section:

```
📊 MarketPulse Daily Digest
━━━━━━━━━━━━━━━━━━━━
📅 [Date]

🎯 FEAR & GREED INDEX [emoji]
Score: XX/100 | [Classification]
Change: [1d] | [1w]

📈 MARKET SCREENER
▲ S&P 500: XXXX.XX (+X.XX%)
▲ Dow Jones: XXXXX.XX (+X.XX%)
▼ VIX: XX.XX (-X.XX%) 🟢 NORMAL
▲ Gold: $XXXX.XX (+X.XX%)

📊 ECONOMIC INDICATORS (USA)
• GDP Growth (Mon YYYY): +X.X% (QoQ)
• Inflation/CPI (Mon YYYY): X.XX%
• Unemployment (Mon YYYY): X.X%
• Fed Funds Rate: X.XX%
• 10Y Treasury: X.XX%

📋 WATCHLIST
  GOOGL: $XXX.XX (+/-X.XX%)
  BABA: $XXX.XX (+/-X.XX%)
  ADBE: $XXX.XX (+/-X.XX%)

💡 AI ANALYSIS
[Gemini analysis]

━━━━━━━━━━━━━━━━━━━━
MarketPulse v6.0 | Manus AI & Claude Code
```

### Priority 4: Push Updated Workflow to GitHub

After successful local testing, push the working workflow JSON back to:
- `MarketPulse-Secure/workflows/marketpulse-workflow-v6.0.json`

## Changelog: v5.0 → v6.0

| Feature | v5.0 | v6.0 |
|---------|------|------|
| Market Indices | None | S&P 500, Dow Jones, VIX, Gold |
| IPv4 Fix | None | `dns.setDefaultResultOrder('ipv4first')` |
| Stock Fetching | 3 nodes (Split + HTTP + Process) | 1 consolidated Code node |
| Retry Logic | None | 3 attempts with backoff |
| Rate Limiting | None | 500ms between API calls |
| LLM Model | Groq llama-3.3-70b | Google Gemini 2.5 Flash |
| Watchlist | GOOGL, BABA, ADBE, SOFI, ASML | GOOGL, BABA, ADBE |
| VIX Indicators | None | LOW/NORMAL/ELEVATED/HIGH |
| Direction Arrows | None | ▲/▼ for market movements |
| Node Count | ~14 | 14 (optimized) |

## Security Notes

- **DO NOT** commit API keys to GitHub
- FRED API key placeholder: `YOUR_FRED_API_KEY_HERE`
- Telegram Chat ID placeholder: `YOUR_TELEGRAM_CHAT_ID`
- Gemini credential ID placeholder: `CONFIGURE_IN_N8N`

---

**Sandbox Boundary Check:** Created at `/tmp/MarketPulse/docs/CLAUDE_CODE_GUIDE_v6.0.md`. Will be pushed to GitHub at `MarketPulse/docs/CLAUDE_CODE_GUIDE_v6.0.md`.
