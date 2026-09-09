// ============================================
// FETCH STOCK PRICES - MarketPulse v7.1
// Production: IPv4 Fix + safeFetch Retry
// ============================================

try { require('dns').setDefaultResultOrder('ipv4first'); } catch(e) {}

const _self = this;
const safeFetch = retrySourceFetch(options => _self.helpers.httpRequest(options), {
  logRetry: attempt => console.log('Stock retry ' + attempt + '/2')
});

const watchlistStr = $input.first().json.watchlist || 'GOOGL,BABA,ADBE,SOFI,ASML';
const symbols = watchlistStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
const stockResults = [];

for (const symbol of symbols) {
  try {
    const data = await safeFetch(yahooChartRequest(symbol));
    const result = yahooChartResult(data);
    if (result) {
      const meta = result.meta;
      const price = meta.regularMarketPrice;
      if (price) {
        const { change } = stockDailyChange(price, meta);
        stockResults.push({ symbol, price: '$' + price.toFixed(2), change });
      }
    }
  } catch (e) {
    console.log(symbol + ' failed: ' + e.message);
    stockResults.push({ symbol, price: 'N/A', change: 'N/A' });
  }
  await fetchDelay(500);
}

let watchlistSummary = stockResults.length > 0
  ? stockResults.map(s => '  ' + s.symbol + ': ' + s.price + ' (' + s.change + ')').join('\n')
  : 'Watchlist data unavailable';

return [{ json: { watchlistSummary, stockDetails: stockResults } }];
