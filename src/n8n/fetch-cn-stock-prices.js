// ============================================
// FETCH CHINA STOCK PRICES - MarketPulse v6.0 (CN)
// Stocks: Moutai, CATL, BYD, Alibaba HK, Tencent HK
// ============================================

const watchlistStr = $input.first().json.watchlist || '';
const symbols = watchlistStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

const stockNames = {
  '600519.SS': 'Moutai',
  '300750.SZ': 'CATL',
  '002594.SZ': 'BYD',
  '9988.HK': 'Alibaba',
  '0700.HK': 'Tencent',
  '1810.HK': 'Xiaomi',
  'PDD': 'PDD',
  'NIO': 'NIO',
  'BABA': 'Alibaba US',
  'JD': 'JD.com'
};

const currencySymbols = {
  'CNY': '¥',
  'HKD': 'HK$',
  'USD': '$'
};

const stockResults = [];

for (const symbol of symbols) {
  try {
    const data = await this.helpers.httpRequest(yahooChartRequest(symbol));

    const result = yahooChartResult(data);
    if (result) {
      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const currency = meta.currency || 'CNY';
      const currSymbol = currencySymbols[currency] || currency + ' ';
      const name = stockNames[symbol] || meta.shortName || symbol;

      if (price) {
        const daily = stockDailyChange(price, meta);

        stockResults.push({
          symbol: symbol,
          name: name,
          price: currSymbol + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          change: daily.change,
          arrow: daily.arrow,
          currency: currency
        });
      }
    }
    // Rate limit
    await fetchDelay(500);
  } catch (e) {
    console.log('Stock ' + symbol + ' error: ' + e.message);
    stockResults.push({
      symbol: symbol,
      name: stockNames[symbol] || symbol,
      price: 'N/A',
      change: 'N/A',
      arrow: '',
      currency: 'N/A'
    });
  }
}

// Format watchlist summary
let watchlistSummary = 'Watchlist data unavailable';
if (stockResults.length > 0) {
  const lines = stockResults.map(s => {
    return s.arrow + ' ' + s.name + ' (' + s.symbol + '): ' + s.price + ' (' + s.change + ')';
  });
  watchlistSummary = lines.join('\n');
}

return [{ json: { watchlistSummary: watchlistSummary, stockDetails: stockResults } }];
