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
    const data = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    if (data && data.chart && data.chart.result && data.chart.result[0]) {
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const prevClose = [meta.chartPreviousClose, meta.previousClose]
        .find(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
      const currency = meta.currency || 'CNY';
      const currSymbol = currencySymbols[currency] || currency + ' ';
      const name = stockNames[symbol] || meta.shortName || symbol;

      if (price) {
        let changePct = 'N/A';
        let changeArrow = '';
        if (prevClose !== undefined) {
          const pct = ((price - prevClose) / prevClose) * 100;
          if (Number.isFinite(pct)) {
            const sign = pct >= 0 ? '+' : '';
            changePct = sign + pct.toFixed(2) + '%';
            changeArrow = pct >= 0 ? '▲' : '▼';
          }
        }

        stockResults.push({
          symbol: symbol,
          name: name,
          price: currSymbol + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          change: changePct,
          arrow: changeArrow,
          currency: currency
        });
      }
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
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
