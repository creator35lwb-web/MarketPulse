# MarketPulse

**AI-Powered Daily Market Intelligence for Value Investors - Built with n8n**

> *Transforms the overwhelming noise of financial news into a concise, actionable daily intelligence digest, delivered to you before the market opens.*

<div align="center">
  <img src="docs/assets/branding/MarketPulse-Icon-new.png" alt="MarketPulse" width="200"/>

  [![Version](https://img.shields.io/badge/version-7.0-blue.svg)](https://github.com/creator35lwb-web/MarketPulse)
  [![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)](https://github.com/creator35lwb-web/MarketPulse)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![n8n](https://img.shields.io/badge/n8n-compatible-orange.svg)](https://n8n.io)

  [![Telegram](https://img.shields.io/badge/Telegram-Join%20Channel-blue?logo=telegram)](https://t.me/MarketPulse7am)
</div>

---

## 📢 Live Demo - Join Our Telegram Channel!

**See MarketPulse in action!** Join our public Telegram channel to receive daily market intelligence:

<div align="center">

  ### [👉 Join @MarketPulse7am on Telegram](https://t.me/MarketPulse7am)

</div>

Get daily briefings at 7 AM with Fear & Greed Index, economic indicators, stock watchlist, and AI-powered market analysis.

> **Support the Project:** If you find MarketPulse valuable, you can support us via Telegram's gift feature in the channel!

---

## 🌟 What is MarketPulse?

MarketPulse is an open-source n8n workflow that delivers comprehensive daily market briefings for value investors. It aggregates real-time economic data from the Federal Reserve (FRED), market sentiment from CNN Fear & Greed Index, financial news headlines, and stock watchlist prices into a single actionable digest delivered via Telegram.

This project embodies the **"Bootstrapper's Edge"** philosophy: leveraging developer incentives and open-source tools to build persistent, high-value intelligence systems at minimal cost.

---

## 📢 Latest Update: v7.0 - Value Investor Edition

**Release Date:** February 9, 2026

### What's New in v7.0

| Feature | Description |
|---------|-------------|
| **Value Investor Dashboard** | Top-of-message dashboard with 4 critical valuation indicators |
| **Buffett Indicator** | Market Cap to GDP ratio with color-coded valuation zones |
| **Shiller PE (CAPE)** | Cyclically Adjusted P/E Ratio with benchmark classification |
| **Yield Curve (10Y-2Y)** | Treasury spread with inversion warning system |
| **S&P 500 vs 200D-MA** | Trend signal with Golden/Death Cross detection |
| **Expanded Market Screener** | Added Oil (WTI), US Dollar (DXY), and Bitcoin |
| **2Y Treasury Yield** | New economic indicator from FRED (DGS2) |
| **Buffett Wisdom** | AI includes relevant Warren Buffett quote in analysis |
| **Valuation Overview** | AI interprets all 4 dashboard indicators together |

### Data Sources

| Data | Source | Frequency |
|------|--------|----------|
| Fear & Greed Index | CNN DataViz API | Daily |
| S&P 500 (^GSPC) | Yahoo Finance | Real-time |
| Dow Jones (^DJI) | Yahoo Finance | Real-time |
| VIX Volatility (^VIX) | Yahoo Finance | Real-time |
| Gold Futures (GC=F) | Yahoo Finance | Real-time |
| Oil/WTI (CL=F) | Yahoo Finance | Real-time |
| US Dollar/DXY (DX-Y.NYB) | Yahoo Finance | Real-time |
| Bitcoin (BTC-USD) | Yahoo Finance | Real-time |
| Wilshire 5000 (^W5000) | Yahoo Finance | Real-time |
| Shiller PE (CAPE) | multpl.com | Daily |
| GDP Growth | FRED (A191RL1Q225SBEA) | Quarterly |
| Nominal GDP | FRED (GDP) | Quarterly |
| Inflation/CPI | FRED (CPIAUCSL) | Monthly |
| Unemployment | FRED (UNRATE) | Monthly |
| Fed Funds Rate | FRED (DFEDTARU) | Daily |
| 10Y Treasury | FRED (DGS10) | Daily |
| 2Y Treasury | FRED (DGS2) | Daily |
| Headlines | MarketWatch RSS | Real-time |
| Stock Prices | Yahoo Finance | Real-time |

### Validation Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Value Investor Dashboard** | ✅ Working | 4 indicators with color-coded emojis |
| Buffett Indicator | ✅ Working | Wilshire 5000 / GDP ratio with benchmarks |
| Shiller PE (CAPE) | ✅ Working | Scraped from multpl.com with valuation zones |
| Yield Curve (10Y-2Y) | ✅ Working | FRED DGS10 - DGS2 with inversion warning |
| S&P 500 vs 200D-MA | ✅ Working | Golden/Death Cross detection |
| CNN Fear & Greed | ✅ Working | Score with daily/weekly change |
| Market Screener (7 instruments) | ✅ Working | S&P 500, Dow, VIX, Gold, Oil, DXY, Bitcoin |
| FRED Economic Data | ✅ Working | All 7 indicators fetching (incl. 2Y Treasury) |
| MarketWatch RSS | ✅ Working | 8+ headlines with entity decoding |
| Google Gemini LLM | ✅ Working | Gemini 2.5 Flash with Buffett-inspired analysis |
| Yahoo Finance | ✅ Working | 3 stocks (GOOGL, BABA, ADBE) with % change |
| IPv4 DNS Fix | ✅ Working | Workflow-level fix, no system-wide impact |
| Retry Logic | ✅ Working | 3 attempts with exponential backoff |
| Telegram Bot | ✅ Validated | Clean formatted messages |

---

## 💡 Why MarketPulse?

Professional traders have Bloomberg terminals. Retail investors have information overload. MarketPulse levels the playing field.

### The Problem

-   **Information Overload:** It's impossible to keep up with the constant stream of financial news.
-   **Lack of Context:** News headlines alone don't capture market sentiment.
-   **Costly Tools:** Professional analysis tools are prohibitively expensive for individual investors.
-   **Time Consuming:** Manually gathering and analyzing news takes hours every day.

### The Solution

MarketPulse provides a fully automated workflow that:

1.  **Aggregates News:** Pulls data from multiple financial news RSS feeds (MarketWatch).
2.  **Analyzes Sentiment:** Uses a free-tier Large Language Model (Groq) to analyze headlines and provide a sentiment score (Bullish, Bearish, Neutral).
3.  **Gathers Key Metrics:** Fetches the Fear & Greed Index for a broader market context.
4.  **Delivers a Digest:** Sends a clean, easy-to-read summary to your Telegram channel every morning.

---

## 🏗️ Architecture: The n8n Workflow

MarketPulse is a single, powerful n8n workflow running on n8n Cloud. The architecture is designed for efficiency and resilience.

<p align="center">
  <img src="docs/assets/diagrams/MarketPulse-Workflow.png" alt="MarketPulse Workflow" width="800"/>
</p>

### Key Components (v2.2)

1.  **Schedule Trigger:** Runs the workflow every weekday morning at 7 AM.
2.  **Data Collection:** HTTP Request nodes gather data from Alternative.me (Fear & Greed) and MarketWatch RSS.
3.  **RSS Parser:** Code node parses MarketWatch XML format and extracts headlines.
4.  **Input Validation:** Sanitizes and validates all incoming data.
5.  **AI Processing:** Groq LLM (Llama-3) analyzes headlines and determines sentiment.
6.  **Merge Node:** Synchronizes both data streams before composing the message.
7.  **Message Composer:** Formats the data into a clean digest with required disclaimers.
8.  **Telegram Delivery:** Sends the final digest to your configured channel.
9.  **Error Handler:** Sanitized error alerts (no credential leakage).

---

## 🔑 Required API Keys

| Service | Purpose | Free Tier | Get It |
|---------|---------|-----------|--------|
| **FRED** | Economic Data | Unlimited (free) | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| **Google Gemini** | LLM Sentiment Analysis | Free tier available | [ai.google.dev](https://ai.google.dev/) |
| **Telegram Bot** | Message Delivery | Unlimited | [@BotFather](https://t.me/BotFather) |
| **CNN Fear & Greed** | Market Sentiment | No key required | Built-in |
| **MarketWatch RSS** | Financial News | No key required | Built-in |
| **Yahoo Finance** | Stock Prices | No key required | Built-in |

---

## 🛡️ Security and Ethics: The VerifiMind-PEAS Guarantee

MarketPulse has been validated by the **[VerifiMind-PEAS](https://github.com/creator35lwb-web/VerifiMind-PEAS) X-Z-CS RefleXion Trinity**, ensuring it is innovative, ethical, and secure.

| Agent | Role | Validation |
|-------|------|------------|
| **X-Agent (Innovation)** | Strategic Novelty | Validated the clever synthesis of free infrastructure and AI for democratizing financial intelligence. |
| **Z-Agent (Ethics)** | Ethical Alignment | Ensured the design includes clear disclaimers that this is **not financial advice**. |
| **CS-Agent (Security)** | Security Posture | Confirmed that risks are manageable with mandatory authentication and secure credential management. |

📖 **[Read the Full VerifiMind-PEAS Case Study →](docs/CASE_STUDY_VERIFIMIND_PEAS.md)**

This case study demonstrates how the VerifiMind-PEAS methodology was applied to validate MarketPulse from concept to production, showcasing the framework's practical application in real-world AI development.

---

## 🚀 Getting Started

This project is designed to be easily replicated. Choose between **cloud hosting** or **local self-hosting** (completely free forever!).

### Option 1: Self-Hosted Local Setup (FREE Forever!)

Run MarketPulse on your own computer with **unlimited workflows** at **zero cost**.

#### Prerequisites
- Node.js (v18+) installed
- Windows/Mac/Linux

#### Quick Install

```bash
# 1. Install n8n globally
npm install -g n8n

# 2. Start n8n
n8n start

# 3. Open browser: http://localhost:5678
```

#### Windows Auto-Start Setup

To run n8n automatically on Windows boot (silent, no terminal):

1. Create `start-n8n.vbs` in your user folder:
```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "C:\Users\YOUR_USERNAME\AppData\Roaming\npm\n8n.cmd" & chr(34) & " start", 0
Set WshShell = Nothing
```

2. Copy to Windows Startup folder:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
```

3. n8n will now auto-start silently on every boot!

#### Desktop Shortcut for Manual Trigger

Create `Run MarketPulse.cmd` on your desktop:
```batch
@echo off
curl -s "http://localhost:5678/webhook/marketpulse-trigger" > nul
echo MarketPulse triggered! Check Telegram in ~30 seconds.
timeout /t 3 > nul
```

> **Note:** Requires adding a Webhook node to your workflow connected to the main flow.

### Option 2: n8n Cloud

Use n8n's managed cloud service (paid after trial):
- 14-day free trial
- Starter plan: ~$20/month

### Workflow Setup

1. **Import Workflow:** Import `MarketPulse-Secure/workflows/marketpulse-workflow-v7.0.json` into your n8n instance
2. **Add FRED API Key:** Edit the "Fetch All Market Data" node and replace `YOUR_FRED_API_KEY_HERE` on line 8
3. **Configure Credentials:** Add your Google Gemini API key and Telegram Bot Token in n8n credentials
4. **Set Channel ID:** Update the Telegram nodes with your channel ID
5. **Activate:** Toggle the workflow ON to enable the daily 7AM schedule

### The Workflow Files

| File | Description |
|------|-------------|
| `MarketPulse-Secure/workflows/marketpulse-workflow-v7.0.json` | **Latest production version** (recommended) |
| `MarketPulse-Secure/workflows/marketpulse-workflow-v6.0.json` | Market Screener Edition |
| `MarketPulse-Secure/workflows/marketpulse-workflow-v5.0.json` | Previous stable version |
| `MarketPulse-Secure/workflows/marketpulse-workflow-v4.1-fixed.json` | Legacy version |
| `workflows/MarketPulse.json` | Original v1.0 workflow |

### Example Daily Digest

```
📊 MarketPulse Daily Digest
━━━━━━━━━━━━━━━━━━━━
📅 Sunday, February 9, 2026

🏛️ VALUE INVESTOR DASHBOARD

🔴 BUFFETT INDICATOR: 155%
   Market Cap to GDP | Significantly Overvalued

🔴 SHILLER P/E (CAPE): 40.4
   Cyclically Adjusted P/E | Strongly Overvalued

🟢 YIELD CURVE (10Y-2Y): +0.62%
   Treasury Spread | Normal (Healthy)

🟢 S&P 500 vs 200D-MA: +7.2%
   Trend Signal | Strong Bullish (Golden Cross)

━━━━━━━━━━━━━━━━━━━━

🎯 FEAR & GREED INDEX 🟡
Score: 48/100 | Neutral
Change: -14 (1d) | -11 (1w)

📈 MARKET SCREENER
▲ S&P 500: 6,932.30 (+1.97%)
▲ Dow Jones: 50,115.67 (+2.47%)
▼ VIX: 17.76 (-18.42%) 🟢 NORMAL
▲ Gold: $5,052.40 (+1.46%)
▲ Oil (WTI): $63.22 (+0.02%)
▲ US Dollar: 97.57 (+0.14%)
▲ Bitcoin: $70,267 (+12.06%)

📊 ECONOMIC INDICATORS (USA)
• GDP Growth (Jul 2025): +4.3% (QoQ)
• Inflation/CPI (Dec 2025): 2.65%
• Unemployment (Dec 2025): 4.4%
• Fed Funds Rate: 3.72%
• 10Y Treasury: 4.21%
• 2Y Treasury: 3.59%

📋 WATCHLIST
  GOOGL: $322.86 (-2.53%)
  BABA: $162.51 (+3.01%)
  ADBE: $268.38 (-0.37%)

💡 AI ANALYSIS (Valu-Analyst)
MARKET SENTIMENT: Cautiously Bearish
Confidence: High

VALUATION OVERVIEW:
The dashboard paints a mixed picture. While the Buffett Indicator
and CAPE both signal significant overvaluation, the healthy yield
curve and strong bullish trend suggest no imminent crash.

BUFFETT WISDOM:
"Be fearful when others are greedy, and greedy when others are
fearful." With valuations stretched but sentiment neutral, patience
is the value investor's greatest ally.

KEY TAKEAWAY:
Build your watchlist, not your portfolio. At these valuations, the
margin of safety is thin. Wait for better entry points.

━━━━━━━━━━━━━━━━━━━━
⚠️ Disclaimer: AI-generated analysis for informational purposes
only. Not financial advice.

📎 Sources: CNN Fear & Greed, FRED, MarketWatch, Yahoo Finance,
multpl.com

MarketPulse v7.0 | Manus AI & Claude Code
```

---

## 📊 Version History

| Version | Date | Changes |
|---------|------|---------|
| v7.0 | Feb 9, 2026 | Value Investor Dashboard (Buffett Indicator, CAPE, Yield Curve, 200D-MA), expanded screener (Oil, DXY, BTC), Buffett Wisdom AI |
| v6.0 | Feb 9, 2026 | Market Screener (S&P 500, Dow Jones, VIX, Gold), IPv4 fix, retry logic, Gemini 2.5 Flash |
| v5.0 | Jan 21, 2026 | FRED API integration, Fed Rate & Treasury, reliable architecture |
| v4.1 | Jan 19, 2026 | Bug fixes, watchlist improvements |
| v4.0 | Jan 19, 2026 | Dynamic watchlist, dated economic data |
| v3.0 | Jan 18, 2026 | Valu-Analyst integration, Yahoo Finance stocks |
| v2.2 | Jan 19, 2026 | Fixed race condition, updated RSS feeds |
| v2.1 | Jan 18, 2026 | Security hardening, error handling |
| v2.0 | Jan 17, 2026 | Secure edition with VerifiMind-PEAS validation |
| v1.0 | Jan 06, 2026 | Initial release |

---

## 🤝 Contributing

MarketPulse is an open-source project, and we welcome contributions from the community. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to learn how you can get involved.

---

## 📜 License

MarketPulse is licensed under the **MIT License**.

---

## ⚠️ Disclaimer

**For informational purposes only. Not financial advice.**

MarketPulse provides automated market intelligence to help investors stay informed. The AI-generated analysis, sentiment scores, and data aggregation are tools for research and should not be considered as recommendations to buy, sell, or hold any securities. Always conduct your own research and consult with a qualified financial advisor before making investment decisions.

---

## 💝 Support the Project

If MarketPulse helps you stay ahead of the market, consider supporting continued development:

<div align="center">

  ### [👉 Join @MarketPulse7am on Telegram](https://t.me/MarketPulse7am)

  *You can send a gift via Telegram's built-in gift feature to support the channel!*

</div>
