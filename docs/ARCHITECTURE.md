# MarketPulse: Architecture & Implementation Guide

This document provides a detailed technical architecture and step-by-step implementation guide for the MarketPulse project. It is designed for users who want to replicate this setup on their own free cloud infrastructure.

---

## 1. System Architecture

MarketPulse is built on a simple yet powerful architecture that leverages free and open-source components.

### 1.1. Infrastructure Layer

-   **Host:** [ClawCloud](https://www.clawcloud.com/)
    -   **Plan:** Free tier with $5/month credit (requires GitHub account >180 days old)
    -   **Region:** Singapore or Japan (recommended for Asia-based users)
    -   **Resources:** 1 vCPU, 1GB RAM
-   **Containerization:** Docker
    -   **Image:** `n8nio/n8n:latest`

### 1.2. Application Layer

-   **Automation Engine:** [n8n](https://n8n.io/)
    -   **Workflow:** `MarketPulse.json`
    -   **Authentication:** Basic Auth (mandatory)
    -   **Backup:** Git integration with a private GitHub repository

### 1.3. Data & AI Layer

-   **Data Sources:**
    -   Yahoo Finance RSS Feed
    -   MarketWatch RSS Feed
    -   CNN Fear & Greed Index (via HTTP Request)
-   **AI Model:**
    -   [Groq API](https://groq.com/) (Llama-3-8b, free tier)
    -   [Google Gemini API](https://ai.google.dev/) (Free tier)

### 1.4. Delivery Layer

-   **Messaging:** [Telegram](https://telegram.org/)
    -   Requires a custom Telegram bot and token.

---

## 2. n8n Workflow Design

The core of MarketPulse is a single n8n workflow. Below is a detailed breakdown of each node.

<p align="center">
  <img src="assets/diagrams/MarketPulse-Workflow.png" alt="MarketPulse Workflow" width="800"/>
</p>

### Node 1: Schedule Trigger

-   **Type:** Schedule
-   **Configuration:**
    -   **Trigger Interval:** Every Day
    -   **Hour:** 8 (for 8:00 AM)
    -   **Timezone:** Your local timezone

### Node 2: Get Fear & Greed Index

-   **Type:** HTTP Request
-   **Configuration:**
    -   **URL:** `https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
    -   **Method:** GET
    -   **Options:** Send to Frontend -> false

### Node 3: Get Yahoo Finance News

-   **Type:** RSS Feed Read
-   **Configuration:**
    -   **URL:** `https://finance.yahoo.com/rss/topstories`

### Node 4: Get MarketWatch News

-   **Type:** RSS Feed Read
-   **Configuration:**
    -   **URL:** `https://feeds.content.dowjones.io/public/rss/mw_topstories`

### Node 5: Merge News

-   **Type:** Merge
-   **Configuration:**
    -   **Mode:** Combine
    -   **Join:** Append

### Node 6: Filter Articles (Code Node)

-   **Type:** Code
-   **Language:** JavaScript
-   **Purpose:** Filters articles to only include those with relevant keywords, saving memory and AI processing time.
-   **Code:**

```javascript
const keywords = ["earnings", "fed", "inflation", "ai", "rate cut", "recession"];
const items = $input.all();

const filteredItems = items.filter(item => {
  const title = item.json.title.toLowerCase();
  const description = item.json.description ? item.json.description.toLowerCase() : '';
  return keywords.some(keyword => title.includes(keyword) || description.includes(keyword));
});

return filteredItems;
```

### Node 7: Summarize with AI

-   **Type:** AI Agent
-   **Configuration:**
    -   **LLM:** Groq (Llama-3-8b)
    -   **System Prompt:**

```
You are a financial analyst. Summarize these headlines into a 3-bullet point 'Market Sentiment' brief. Identify if the overall mood is Bullish, Bearish, or Neutral. For each point, cite the source (e.g., Yahoo Finance, MarketWatch).
```

### Node 8: Format Message (Code Node)

-   **Type:** Code
-   **Language:** JavaScript
-   **Purpose:** Formats the final message for Telegram delivery.
-   **Code:**

```javascript
const fearAndGreed = $input.item.json.fear_and_greed.score.toFixed(0);
const sentimentSummary = $input.item.json.summary;
const date = new Date().toDateString();

let sentimentEmoji = '😐';
if (sentimentSummary.toLowerCase().includes('bullish')) sentimentEmoji = '🐂';
if (sentimentSummary.toLowerCase().includes('bearish')) sentimentEmoji = '🐻';

const message = `
📈 **Market Pulse** - ${date}

**Sentiment:** ${sentimentEmoji} ${sentimentSummary.split('\n')[0]}
**Fear & Greed:** ${fearAndGreed}

**Key Movers:**
${sentimentSummary.substring(sentimentSummary.indexOf('\n') + 1)}

*Disclaimer: This is automated market sentiment analysis for informational purposes only. Not investment advice. Do your own research.*
`;

return { message };
```

### Node 9: Send to Telegram

-   **Type:** Telegram
-   **Configuration:**
    -   **Authentication:** Your Telegram Bot Token
    -   **Chat ID:** Your personal Telegram Chat ID
    -   **Text:** `{{ $json.message }}`
    -   **Parse Mode:** Markdown

---

## 3. Step-by-Step Implementation Guide

Follow these steps to deploy your own MarketPulse instance.

### 3.1. Pre-Deployment Checklist

1.  **Verify GitHub Account:** Ensure your GitHub account is older than 180 days.
2.  **Register on ClawCloud:** Sign up at [clawcloud.com](https://www.clawcloud.com/) with your GitHub account.
3.  **Create Telegram Bot:** Talk to the [BotFather](https://t.me/botfather) on Telegram to create a new bot and get your token.
4.  **Get Groq API Key:** Register at [groq.com](https://groq.com/) to get your free API key.
5.  **Create GitHub Repo:** Create a new private GitHub repository named `n8n-backups`.

### 3.2. Deployment on ClawCloud

1.  Log in to ClawCloud and go to the **App Store**.
2.  Find **n8n** and click **Deploy App**.
3.  Once deployed, go to **App Launchpad**, click on your n8n instance, and go to **Advanced Configuration -> Manage**.
4.  **Update Image:** Change the image to `n8nio/n8n:latest`.
5.  **Set Memory:** Set the memory to `1GB`.
6.  **Enable Authentication (CRITICAL):** Add the following environment variables:
    -   `N8N_BASIC_AUTH_ACTIVE=true`
    -   `N8N_BASIC_AUTH_USER=your_username`
    -   `N8N_BASIC_AUTH_PASSWORD=your_strong_password`
7.  Click **Update**.

### 3.3. n8n Configuration

1.  Log in to your new n8n instance.
2.  **Import Workflow:** Go to **Workflows** and import the `workflows/MarketPulse.json` file from this repository.
3.  **Configure Credentials:**
    -   Go to **Credentials** and add your **Groq API Key** and **Telegram Bot Token**.
    -   Update the **AI Agent** and **Telegram** nodes in the workflow to use these credentials.
4.  **Set Up Git Backup:**
    -   Go to **Settings -> Source Control**.
    -   Connect to your `n8n-backups` GitHub repository.

### 3.4. Testing and Activation

1.  **Manual Run:** Run the workflow manually to ensure all nodes execute correctly.
2.  **Check Telegram:** Verify that you receive the formatted message in Telegram.
3.  **Activate Workflow:** Once you are satisfied, activate the workflow.

---

## 4. Conclusion

You now have a fully functional, automated daily stock market sentiment analyzer running on a free cloud infrastructure. This powerful tool will help you stay connected to market sentiment and make more informed investment decisions.
