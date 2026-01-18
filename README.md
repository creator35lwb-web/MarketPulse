# MarketPulse

**AI-Powered Daily Stock Market Sentiment Analyzer using n8n Cloud Free Tier**

<div align="center">
  <img src="docs/assets/branding/MarketPulse-Icon.png" alt="MarketPulse" width="200"/>
  
  [![Version](https://img.shields.io/badge/version-2.2-blue.svg)](https://github.com/creator35lwb-web/MarketPulse)
  [![Status](https://img.shields.io/badge/status-validated-brightgreen.svg)](https://github.com/creator35lwb-web/MarketPulse)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![n8n](https://img.shields.io/badge/n8n-compatible-orange.svg)](https://n8n.io)
</div>

---

## 🌟 What is MarketPulse?

MarketPulse is an open-source project that demonstrates how to build a powerful, automated daily stock market sentiment analyzer using **n8n** on a **perpetually free cloud infrastructure**. It transforms the overwhelming noise of financial news into a concise, actionable daily intelligence digest, delivered to you before the market opens.

This project embodies the **"Bootstrapper's Edge"** philosophy: leveraging developer incentives and open-source tools to build persistent, high-value intelligence systems at zero cost.

---

## 📢 Latest Update: v2.2 - Validated Working Edition

**Release Date:** January 19, 2026

### What's New in v2.2

| Feature | Description |
|---------|-------------|
| **Race Condition Fix** | Added Merge node to synchronize Fear & Greed and LLM analysis before composing message |
| **RSS Feed Updated** | Replaced Yahoo Finance (deprecated) with MarketWatch RSS (stable) |
| **RSS Parser Added** | New Parse RSS Data node properly handles MarketWatch XML format |
| **Telegram Validated** | Successfully tested message delivery to MarketPulse Alerts channel |
| **Error Handling** | Sanitized error handler prevents credential leakage in alerts |
| **Security Hardened** | Channel IDs properly configured, no sensitive data in workflow JSON |

### Validation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Fear & Greed API | ✅ Working | Alternative.me - Score: 49 (Neutral) |
| MarketWatch RSS | ✅ Working | Fetching 10+ headlines |
| Groq LLM | ✅ Configured | Free tier - 30 req/min |
| Telegram Bot | ✅ Validated | Message delivery confirmed |
| n8n Workflow | ✅ Executing | No errors in 3.4s execution |

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

## 🔑 Required API Keys (All FREE)

| Service | Purpose | Free Tier | Get It |
|---------|---------|-----------|--------|
| **Groq** | LLM Sentiment Analysis | 30 req/min, 14,400 req/day | [console.groq.com](https://console.groq.com/keys) |
| **Telegram Bot** | Message Delivery | Unlimited | [@BotFather](https://t.me/BotFather) |
| **Alternative.me** | Fear & Greed Index | Unlimited (no key) | [alternative.me](https://alternative.me/crypto/fear-and-greed-index/) |
| **MarketWatch RSS** | Financial News | Unlimited (no key) | [marketwatch.com/rss](https://www.marketwatch.com/rss) |

---

## 🛡️ Security and Ethics: The VerifiMind-PEAS Guarantee

MarketPulse has been validated by the **VerifiMind-PEAS X-Z-CS RefleXion Trinity**, ensuring it is innovative, ethical, and secure.

-   **X-Agent (Innovation):** Validated the clever synthesis of free infrastructure and AI for democratizing financial intelligence.
-   **Z-Agent (Ethics):** Ensured the design includes clear disclaimers that this is **not financial advice**.
-   **CS-Agent (Security):** Confirmed that risks are manageable with mandatory authentication and secure credential management.

---

## 🚀 Getting Started

This project is designed to be easily replicated. The full implementation guide, including how to set up your free cloud infrastructure, is in the [ARCHITECTURE.md](docs/ARCHITECTURE.md) file.

### Quick Start

1. **Import Workflow:** Import `MarketPulse-Secure/workflows/marketpulse-workflow-v2.2-fixed.json` into your n8n instance
2. **Configure Credentials:** Add your Groq API key and Telegram Bot Token in n8n credentials
3. **Set Channel ID:** Update the Telegram nodes with your channel ID
4. **Activate:** Publish the workflow to enable the daily schedule

### The Workflow Files

| File | Description |
|------|-------------|
| `MarketPulse-Secure/workflows/marketpulse-workflow-v2.2-fixed.json` | **Latest validated version** (recommended) |
| `workflows/MarketPulse.json` | Original v1.0 workflow |

### Example Daily Digest

```
📊 MarketPulse Daily Digest
📅 Sunday, January 19, 2026

🎯 Fear & Greed Index (Crypto)
Score: 49/100
Rating: Neutral

📈 AI Sentiment Analysis
Based on the latest financial headlines, the market sentiment appears 
Neutral with mixed signals. Key themes include ongoing earnings reports 
and macroeconomic data releases.

⚠️ IMPORTANT DISCLAIMER
This analysis is generated by AI and is for informational purposes only. 
It does NOT constitute financial advice. Always consult a qualified 
financial advisor before making investment decisions.

---
MarketPulse v2.2 | Validated Edition
```

---

## 📊 Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.2 | Jan 19, 2026 | Fixed race condition, updated RSS feeds, validated Telegram delivery |
| v2.1 | Jan 18, 2026 | Added security hardening, error handling, input validation |
| v2.0 | Jan 17, 2026 | Secure edition with VerifiMind-PEAS validation |
| v1.0 | Jan 06, 2026 | Initial release |

---

## 🤝 Contributing

MarketPulse is an open-source project, and we welcome contributions from the community. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to learn how you can get involved.

---

## 📜 License

MarketPulse is licensed under the **MIT License**.
