// ============================================
// FETCH STOCK PRICES - MarketPulse v7.1
// Production: IPv4 Fix + safeFetch Retry
// ============================================

try { require('dns').setDefaultResultOrder('ipv4first'); } catch(e) {}

const _self = this;
async function safeFetch(options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await _self.helpers.httpRequest(options);
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      const isNet = msg.includes('enetunreach') || msg.includes('econnrefused') ||
        msg.includes('etimedout') || msg.includes('eai_again') || msg.includes('ehostunreach') ||
        msg.includes('enotfound') || msg.includes('socket hang up');
      if (isNet && attempt < 2) {
        console.log('Stock retry ' + (attempt+1) + '/2');
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

const watchlistStr = $input.first().json.watchlist || 'GOOGL,BABA,ADBE,SOFI,ASML';
const symbols = watchlistStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
const stockResults = [];

for (const symbol of symbols) {
  try {
    const data = await safeFetch({
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
      if (price) {
        let change = 'N/A';
        if (prevClose !== undefined) {
          const changePct = ((price - prevClose) / prevClose) * 100;
          if (Number.isFinite(changePct)) change = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
        }
        stockResults.push({ symbol, price: '$' + price.toFixed(2), change });
      }
    }
  } catch (e) {
    console.log(symbol + ' failed: ' + e.message);
    stockResults.push({ symbol, price: 'N/A', change: 'N/A' });
  }
  await new Promise(r => setTimeout(r, 500));
}

let watchlistSummary = stockResults.length > 0
  ? stockResults.map(s => '  ' + s.symbol + ': ' + s.price + ' (' + s.change + ')').join('\n')
  : 'Watchlist data unavailable';

return [{ json: { watchlistSummary, stockDetails: stockResults } }];
