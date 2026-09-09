// Shared request construction and retry policy, embedded by build-workflow.mjs.
function fetchDelay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function yahooChartRequest(symbol, range = '1d') {
  return {
    method: 'GET',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000
  };
}

function yahooChartResult(data) {
  return data && data.chart && data.chart.result && data.chart.result[0];
}

function retrySourceFetch(request, { msLeft = () => Infinity, reserveMs = 0, includeNetwork = false, logRetry } = {}) {
  return async function (options) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (msLeft() <= 0) throw new Error('TIME_BUDGET_EXCEEDED: skipped to protect the run');
      try {
        return await request(options);
      } catch (error) {
        const message = (error.message || '').toLowerCase();
        const networkErrors = ['enetunreach', 'econnrefused', 'etimedout', 'eai_again', 'ehostunreach', 'enotfound', 'socket hang up'];
        const isNetworkError = networkErrors.some(code => message.includes(code)) || (includeNetwork && message.includes('network'));
        if (isNetworkError && attempt < 2 && msLeft() > reserveMs) {
          if (logRetry) logRetry(attempt + 1, options);
          await fetchDelay(2000 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
  };
}
