import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the actual Code-node bodies with local responses and immediate timers.
// There is no network function in the sandbox, and each test expects one request.
async function fetchStock(edition, meta) {
  const file = edition === 'US' ? 'fetch-stock-prices.js' : 'fetch-cn-stock-prices.js';
  const code = readFileSync(new URL('../src/n8n/' + file, import.meta.url), 'utf8');
  const requested = [];
  const output = await vm.runInNewContext('(async function(){\n' + code + '\n}).call({helpers})', {
    helpers: { async httpRequest(options) {
      requested.push(options.url);
      return { chart: { result: [{ meta: { regularMarketPrice: 100, currency: 'CNY', ...meta } }] } };
    } },
    $input: { first: () => ({ json: { watchlist: 'ACME' } }) },
    setTimeout(callback) { callback(); },
    console: { log() {} },
  }, { timeout: 2000 });
  assert.equal(requested.length, 1);
  assert.match(requested[0], /\/ACME\?/);
  assert.equal(output.length, 1);
  assert.equal(output[0].json.stockDetails.length, 1);
  return output[0].json;
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
