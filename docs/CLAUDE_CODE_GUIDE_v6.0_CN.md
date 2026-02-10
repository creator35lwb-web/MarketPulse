# Claude Code Implementation Guide: MarketPulse v6.0 (CN)

**Agent:** RNA (Claude Code)
**From:** T (Manus AI - CTO)
**Protocol:** MACP v2.0 | FLYWHEEL Level 2

**Mission:** Deploy the **MarketPulse v6.0 (CN) - China Market Edition** workflow to your local n8n instance.

This workflow adapts the successful US v6.0 foundation to the Chinese market, using validated, free, and reliable data sources (Yahoo Finance, World Bank).

## 1. Get Workflow File

The workflow JSON is located in the `MarketPulse` repository at:
`MarketPulse-Secure/workflows/marketpulse-workflow-v6.0-cn.json`

## 2. Deployment Steps

1.  **Navigate to your n8n instance.**
2.  Go to **Workflows** and click **"New"** to create a new workflow.
3.  Click the **three dots (...)** in the top right corner and select **"Import from file"**.
4.  Upload the `marketpulse-workflow-v6.0-cn.json` file.
5.  The workflow will load onto the canvas.

## 3. Configuration

This workflow requires two credentials to be configured before it can run successfully.

### a. Google Gemini API Key

1.  Open the **"Google Gemini Chat Model"** node.
2.  In the **"Credential"** field, select your existing Google Gemini API credential.
3.  If you do not have one, create a new one using your Gemini API key.

### b. Telegram API Key & Chat ID

1.  Open the **"Send to Telegram"** node.
2.  In the **"Credential"** field, select your existing Telegram API credential.
3.  In the **"Chat ID"** field, enter the target Telegram Chat ID (e.g., `@YourChannelName` or a numeric ID).
4.  Repeat the same configuration for the **"Send Error Alert"** node.

## 4. Activation & Testing

1.  **Save** the workflow.
2.  **Activate** the workflow using the toggle in the top right corner.
3.  To test immediately, click the **"Execute workflow"** button.

## 5. Expected Outcome

Upon successful execution, a formatted daily digest for the Chinese market will be sent to your configured Telegram channel. The message will include:

*   Major China market indices (CSI 300, SSE, SZSE, Hang Seng)
*   Gold and USD/CNY prices
*   Key economic indicators from the World Bank (GDP, CPI, Unemployment)
*   A curated watchlist of prominent Chinese stocks
*   AI-powered analysis from Gemini, tailored to the Chinese market

## 6. Handoff Confirmation

Once the workflow is deployed and you have received the first successful Telegram message, please create a MACP handoff record in the `verifimind-genesis-mcp` repository under `.macp/handoffs/` confirming the successful deployment of **MarketPulse v6.0 (CN)**.
