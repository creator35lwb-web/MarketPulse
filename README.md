# MarketPulse

**AI-Powered Daily Stock Market Sentiment Analyzer using n8n Cloud Free Tier**

<div align="center">
  <img src="docs/assets/branding/MarketPulse-Icon.png" alt="MarketPulse" width="200"/>
</div>

---

## 🌟 What is MarketPulse?

MarketPulse is an open-source project that demonstrates how to build a powerful, automated daily stock market sentiment analyzer using **n8n** on a **perpetually free cloud infrastructure**. It transforms the overwhelming noise of financial news into a concise, actionable daily intelligence digest, delivered to you before the market opens.

This project embodies the **"Bootstrapper's Edge"** philosophy: leveraging developer incentives and open-source tools to build persistent, high-value intelligence systems at zero cost.

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

1.  **Aggregates News:** Pulls data from multiple financial news RSS feeds.
2.  **Analyzes Sentiment:** Uses a free-tier Large Language Model (LLM) to analyze headlines and provide a sentiment score (Bullish, Bearish, Neutral).
3.  **Gathers Key Metrics:** Fetches the Fear & Greed Index for a broader market context.
4.  **Delivers a Digest:** Sends a clean, easy-to-read summary to your Telegram or email every morning.

---

## 🏗️ Architecture: The n8n Workflow

MarketPulse is a single, powerful n8n workflow running on a free, 1GB RAM cloud instance on ClawCloud. The architecture is designed for efficiency and resilience.

<p align="center">
  <img src="docs/assets/diagrams/MarketPulse-Workflow.png" alt="MarketPulse Workflow" width="800"/>
</p>

### Key Components

1.  **Schedule Trigger:** Runs the workflow every weekday morning.
2.  **Data Collection:** HTTP Request and RSS Feed nodes gather data from financial sources.
3.  **AI Processing:** An AI Agent node with a free-tier LLM (like Groq's Llama-3-8b) summarizes the news and determines sentiment.
4.  **Formatting:** A Code node formats the data into a clean message.
5.  **Delivery:** A Telegram node sends the final digest.

---

## 🛡️ Security and Ethics: The VerifiMind-PEAS Guarantee

MarketPulse has been validated by the **VerifiMind-PEAS X-Z-CS RefleXion Trinity**, ensuring it is innovative, ethical, and secure.

-   **X-Agent (Innovation):** Validated the clever synthesis of free infrastructure and AI for democratizing financial intelligence.
-   **Z-Agent (Ethics):** Ensured the design includes clear disclaimers that this is **not financial advice**.
-   **CS-Agent (Security):** Confirmed that risks are manageable with mandatory authentication and secure credential management.

---

## 🚀 Getting Started

This project is designed to be easily replicated. The full implementation guide, including how to set up your free cloud infrastructure on ClawCloud, is in the [ARCHITECTURE.md](docs/ARCHITECTURE.md) file.

### The Workflow

The complete n8n workflow can be found in `workflows/MarketPulse.json`. You can import this directly into your n8n instance to get started.

### Example Daily Digest

```
📈 **Market Pulse** - Jan 06, 2026

**Sentiment:** 🐂 Bullish
**Fear & Greed:** 65 (Greed)

**Key Movers:**
• Fed signals potential rate cuts in the next quarter, boosting market confidence. (Source: Yahoo Finance)
• NVDA reports record earnings, exceeding all analyst expectations. (Source: MarketWatch)
• Inflation data comes in lower than expected, easing market fears. (Source: CNBC)

*Disclaimer: This is automated market sentiment analysis for informational purposes only. Not investment advice. Do your own research.*
```

---

## 🤝 Contributing

MarketPulse is an open-source project, and we welcome contributions from the community. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to learn how you can get involved.

---

## 📜 License

MarketPulse is licensed under the **MIT License**.
