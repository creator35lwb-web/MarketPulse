# MarketPulse v4.0 - Comprehensive Specification

**Version:** 4.0
**Date:** January 19, 2026

## 1. Goal

To create a comprehensive daily briefing for value investors by integrating all validated data sources from the Valu-Analyst framework into MarketPulse. This includes economic indicators, stock market sentiment, and watchlist company fundamentals.

## 2. Validated Data Sources

| Data Source | API | Status | Notes |
| :--- | :--- | :--- | :--- |
| **CNN Fear & Greed** | CNN DataViz API | ⚠️ 418 Error | Use browser-like headers or fallback to feargreedmeter.com |
| **GDP Data** | World Bank API | ✅ Validated | `https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD` |
| **CPI/Inflation** | World Bank API | ✅ Validated | `https://api.worldbank.org/v2/country/USA/indicator/FP.CPI.TOTL.ZG` |
| **Unemployment** | World Bank API | ✅ Validated | `https://api.worldbank.org/v2/country/USA/indicator/SL.UEM.TOTL.ZS` |
| **MarketWatch RSS** | RSS Feed | ✅ Validated | `http://www.marketwatch.com/rss/topstories` |
| **Stock Fundamentals** | Yahoo Finance | ✅ Validated | `https://query1.finance.yahoo.com/ws/insights/v2/finance/insights` |
| **Stock Prices** | Yahoo Finance | ✅ Validated | `https://query1.finance.yahoo.com/v8/finance/chart/` |

## 3. MarketPulse v4.0 Workflow Architecture

The workflow will be a multi-stage process to gather all data points before composing the final message.

```mermaid
graph TD
    A[Daily 7AM Trigger] --> B(Fetch CNN Fear & Greed);
    A --> C(Fetch World Bank GDP);
    A --> D(Fetch World Bank CPI);
    A --> E(Fetch World Bank Unemployment);
    A --> F(Fetch MarketWatch RSS);
    A --> G(Fetch Watchlist Stocks);

    subgraph Watchlist Processing
        G --> H{For each stock...};
        H --> I(Fetch Price);
        H --> J(Fetch Fundamentals);
    end

    F --> K(Parse RSS Data);
    K --> L(Enhanced Input Validation);
    L --> M{Has Valid Data?};

    M -- True --> N(Basic LLM Chain: Sentiment & Key Takeaway);
    
    B --> O(Merge All Data);
    C --> O;
    D --> O;
    E --> O;
    N --> O;
    J --> O;

    O --> P(Compose Telegram Message);
    P --> Q(Send to Telegram Channel);

    subgraph Error Handling
        R(Error Trigger) --> S(Sanitize Error);
        S --> T(Send to Admin Channel);
    end
```

## 4. Key Enhancements in v4.0

### 4.1. Comprehensive Data Integration

-   The workflow will fetch data from all validated sources in parallel.
-   A **Merge** node will be used to combine all data points before the final message composition.

### 4.2. Watchlist Company Analysis

-   The workflow will iterate through the watchlist companies (BABA, GOOGL, SOFI, S, ONON, ASML).
-   For each company, it will fetch the latest price and fundamental data (valuation, sector).

### 4.3. Updated LLM Prompt (for Basic LLM Chain)

```
Analyze the sentiment of the following financial news headlines and provide a brief market sentiment summary. Also, identify the single most important "Key Takeaway" for a value investor to research further.

**Economic Indicators:**
- GDP: {{ $json.gdpValue }}
- CPI/Inflation: {{ $json.cpiValue }}
- Unemployment: {{ $json.unemploymentValue }}

**Market Sentiment:**
- Fear & Greed Index: {{ $json.fearGreedValue }} ({{ $json.fearGreedClassification }})

**News Headlines:**
{{ $json.headlines }}

**Watchlist Summary:**
{{ $json.watchlistSummary }}

**Provide:**
1. Overall market sentiment (Bullish/Bearish/Neutral)
2. Key themes identified
3. Brief 2-3 sentence summary
4. Confidence level (High/Medium/Low)
5. **Key Takeaway for Today:** (Identify the single most impactful headline or theme and explain why it matters for a value investor)

Keep the response concise and actionable.
```

## 5. Implementation Plan for Claude Code

1.  **Clone** the MarketPulse repository from GitHub.
2.  **Create** a new workflow file: `MarketPulse-Secure/workflows/marketpulse-workflow-v4.0-complete.json`
3.  **Implement** the multi-stage workflow as per the architecture diagram.
4.  **Add** nodes to fetch data from all validated APIs.
5.  **Use** a Loop node to process the watchlist companies.
6.  **Update** the Basic LLM Chain with the comprehensive prompt.
7.  **Commit** the new workflow with the message: "Add MarketPulse v4.0 - Complete Valu-Analyst integration"

This specification provides a complete roadmap for Claude Code to build the most comprehensive version of MarketPulse yet.
