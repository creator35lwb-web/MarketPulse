import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildNodeSource } from '../scripts/node-source.mjs';

async function runFetchingNode(name, respond, input = { watchlist: 'ACME' }) {
  const requested = [], delays = [], logs = [];
  class FixedDate extends Date { static now() { return 1789066800000; } }
  const output = await vm.runInNewContext('(async function(){\n' + buildNodeSource(name) + '\n}).call({helpers})', {
    helpers: { async httpRequest(options) {
      requested.push(structuredClone(options));
      return respond(options, requested.length);
    } },
    $input: { first: () => ({ json: input }) }, Date: FixedDate,
    setTimeout(callback, milliseconds) { delays.push(milliseconds); callback(); },
    console: { log(...args) { logs.push(args.join(' ')); }, error(...args) { logs.push(args.join(' ')); } },
  }, { timeout: 2000 });
  return { data: structuredClone(output[0].json), requested, delays, logs };
}

// Run the actual Code-node bodies with local responses and immediate timers.
// There is no network function in the sandbox, and each test expects one request.
async function fetchStock(edition, meta) {
  const name = edition === 'US' ? 'Fetch Stock Prices' : 'Fetch CN Stock Prices';
  const { data, requested } = await runFetchingNode(name, () => ({ chart: { result: [{ meta: { regularMarketPrice: 100, currency: 'CNY', ...meta } }] } }));
  assert.equal(requested.length, 1);
  assert.match(requested[0].url, /\/ACME\?/);
  assert.equal(data.stockDetails.length, 1);
  return data;
}

test('US stock retries qualifying network errors and preserves backoff and request options', async () => {
  const { data, requested, delays } = await runFetchingNode('Fetch Stock Prices', (_, attempt) => {
    if (attempt < 3) throw new Error('ENETUNREACH');
    return { chart: { result: [{ meta: { regularMarketPrice: 105, chartPreviousClose: 100 } }] } };
  });
  assert.equal(requested.length, 3);
  assert.deepEqual(requested[1], requested[0]);
  assert.equal(requested[0].method, 'GET');
  assert.equal(requested[0].timeout, 15000);
  assert.deepEqual(delays, [2000, 4000, 500]);
  assert.equal(data.stockDetails[0].change, '+5.00%');
});

for (const [name, error] of [['Fetch Stock Prices', 'HTTP 403'], ['Fetch CN Stock Prices', 'ENETUNREACH']]) {
  test(`${name}: terminal failure stays explicit without adding retries`, async () => {
    const { data, requested } = await runFetchingNode(name, () => { throw new Error(error); });
    assert.equal(requested.length, 1);
    assert.equal(data.stockDetails[0].price, 'N/A');
    assert.equal(data.stockDetails[0].change, 'N/A');
  });
}

const sourceRss = '<rss><title>Feed</title><item><title><![CDATA[Market earnings &amp; outlook - Example News]]></title><link><![CDATA[https://example.com/earnings]]></link></item><item><title>Another market report title</title><link>javascript:invalid</link></item></rss>';
function marketResponse({ url }, rss = sourceRss) {
  if (url.includes('finance.yahoo.com')) return { chart: { result: [{
    meta: { regularMarketPrice: 105, chartPreviousClose: 80, previousClose: 90, regularMarketTime: 1789066800 },
    indicators: { quote: [{ close: url.includes('%5EGSPC') ? [...Array(199).fill(100), 100, 105] : [105] }] },
  }] } };
  if (url.includes('cnn.io')) return { fear_and_greed: { score: 64, rating: 'greed', previous_close: 60, previous_1_week: 55 } };
  if (url.includes('multpl.com')) return 'Current Shiller PE Ratio 25.5';
  if (url.includes('stlouisfed.org')) return { observations: Array.from({ length: 13 }, (_, index) => ({ value: String(index === 0 ? 110 : 100), date: '2026-07-01' })) };
  if (url.includes('worldbank.org')) return [{}, [{ value: 4.5, date: '2025' }]];
  return rss;
}

for (const [edition, name, expectedRequests] of [['US', 'Fetch All Market Data', 18], ['CN', 'Fetch All China Market Data', 10]]) {
  test(`${edition}: shared market helpers retain source requests, RSS evidence, and health signals`, async () => {
    const { data, requested } = await runFetchingNode(name, options => marketResponse(options));
    assert.equal(requested.length, expectedRequests);
    assert.equal(data._health.status, 'OK');
    assert.deepEqual(data._health.failed, []);
    assert.deepEqual(data._health.missing, []);
    assert.equal(data.headlinesCount, 2);
    assert.deepEqual(data.headlinesLinks, ['https://example.com/earnings', null]);
    assert.equal(data.headlinesList[0], edition === 'CN' ? 'Market earnings & outlook' : 'Market earnings & outlook - Example News');
    assert.ok(data._health.suspect.some(item => item.field === 'goldChange'));
    if (edition === 'US') {
      assert.equal(data.sp500Change, '+5.00%');
      assert.equal(data.sp500MarketTime, 1789066800);
      assert.ok(requested.some(request => request.url.includes('%5EGSPC?interval=1d&range=1y')));
      assert.match(data.gdpValue, /QoQ annualized/);
    } else {
      assert.equal(data.csi300, '105.00');
      assert.equal(data.gold, '$105.00');
      assert.equal(data.usdCny, '105.0000');
      assert.equal(data.csi300MarketTime, 1789066800);
    }
  });
  test(`${edition}: source failures retain outage, failure codes, and missing fields`, async () => {
    const { data, requested } = await runFetchingNode(name, () => { throw Object.assign(new Error('HTTP 503'), { code: 'UPSTREAM' }); });
    assert.equal(requested.length, expectedRequests - (edition === 'US' ? 1 : 0));
    assert.equal(data._health.status, 'OUTAGE');
    assert.ok(data._health.missing.length >= 8);
    assert.ok(data._health.failed.every(failure => failure.code === 'UPSTREAM'));
    assert.equal(data.headlinesCount, 0);
  });
  test(`${edition}: title-only RSS fallback retains evidence with unavailable links`, async () => {
    const { data } = await runFetchingNode(name, options => marketResponse(options, '<rss><title>Feed</title><title>Long market update title</title></rss>'));
    assert.deepEqual(data.headlinesList, ['Long market update title']);
    assert.deepEqual(data.headlinesLinks, [null]);
  });
}

for (const edition of ['US', 'CN']) {
  for (const prior of [undefined, null, 0, -1, NaN, Infinity, '100', {}, []]) {
    test(`${edition}: unavailable prior close ${String(prior)} never becomes a flat return`, async () => {
      const data = await fetchStock(edition, { chartPreviousClose: prior });
      assert.equal(data.stockDetails[0].change, 'N/A');
      assert.match(data.watchlistSummary, /\(N\/A\)/);
      assert.doesNotMatch(data.watchlistSummary, /\+0\.00%/);
      if (edition === 'CN') assert.equal(data.stockDetails[0].arrow, '');
    });
  }
  test(`${edition}: unchanged prices retain a valid zero return`, async () => {
    const data = await fetchStock(edition, { chartPreviousClose: 100 });
    assert.equal(data.stockDetails[0].change, '+0.00%');
  });
  test(`${edition}: finite positive prior close preserves directional changes`, async () => {
    for (const [price, expected] of [[105, '+5.00%'], [95, '-5.00%']]) {
      const data = await fetchStock(edition, { regularMarketPrice: price, chartPreviousClose: 100 });
      assert.equal(data.stockDetails[0].change, expected);
    }
  });
  test(`${edition}: valid alternate prior close recovers absent or malformed chart close`, async () => {
    for (const prior of [undefined, null, 0, -1, NaN, Infinity, 'invalid']) {
      const data = await fetchStock(edition, { regularMarketPrice: 105, chartPreviousClose: prior, previousClose: 100 });
      assert.equal(data.stockDetails[0].change, '+5.00%');
    }
  });
  test(`${edition}: chart close remains preferred when both numeric closes are usable`, async () => {
    const data = await fetchStock(edition, { regularMarketPrice: 105, chartPreviousClose: 100, previousClose: 50 });
    assert.equal(data.stockDetails[0].change, '+5.00%');
  });
  test(`${edition}: overflowed return is unavailable`, async () => {
    const data = await fetchStock(edition, { chartPreviousClose: Number.MIN_VALUE });
    assert.equal(data.stockDetails[0].change, 'N/A');
    if (edition === 'CN') assert.equal(data.stockDetails[0].arrow, '');
  });
}
