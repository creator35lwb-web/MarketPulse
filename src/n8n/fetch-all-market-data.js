// ============================================
// FETCH ALL MARKET DATA - MarketPulse v7.1
// Production: IPv4 Fix + safeFetch Retry
// ============================================

// --- IPv4 FIX ---
try { require('dns').setDefaultResultOrder('ipv4first'); } catch(e) {}

const FRED_API_KEY = 'YOUR_FRED_API_KEY_HERE';

// --- RETRY HELPER: auto-retries on network errors ---
const _self = this;

// ===== GLOBAL TIME BUDGET (2026-07-14) =====
// n8n kills a Code node at 300s. Each source can retry 3x with backoff, so a handful
// of slow/dead sources used to blow the whole budget - and we would lose EVERYTHING,
// including the sources that answered fine (exec #640: 'Task execution timed out after
// 300 seconds'). Now we track elapsed time and stop retrying / stop starting new work
// as the deadline nears, returning whatever we DID get, with health flags set. Partial
// verified data beats no data: the DEGRADED/OUTAGE banner already handles this honestly.
const NODE_START = Date.now();
const TIME_BUDGET_MS = 235000;              // of n8n's 300s - leaves ~65s to finish + return
const RETRY_RESERVE_MS = 20000;             // do not START a retry without this much left
function msLeft() { return TIME_BUDGET_MS - (Date.now() - NODE_START); }

async function safeFetch(options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (msLeft() <= 0) throw new Error('TIME_BUDGET_EXCEEDED: skipped to protect the run');
    try {
      return await _self.helpers.httpRequest(options);
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      const isNet = msg.includes('enetunreach') || msg.includes('econnrefused') ||
        msg.includes('etimedout') || msg.includes('eai_again') || msg.includes('ehostunreach') ||
        msg.includes('enotfound') || msg.includes('socket hang up') || msg.includes('network');
      if (isNet && attempt < 2 && msLeft() > RETRY_RESERVE_MS) {
        console.log('Retry ' + (attempt+1) + '/2 (' + Math.round(msLeft()/1000) + 's budget left): ' + (options.url || '').substring(0, 60));
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}


// ===== DATA-HEALTH INSTRUMENTATION (hardening) =====
// LOUD failures so N/A can never masquerade as success.
// Grep n8n logs:  [MarketPulse][FETCH-FAIL] / [MarketPulse][DATA-HEALTH]
const health = { status: 'OK', failed: [], missing: [] };
function fail(source, e) {
  const code = (e && (e.code || (e.cause && e.cause.code))) || '';
  const msg = ((e && e.message) || String(e)).slice(0, 180);
  health.failed.push({ source, code, msg });
  console.error('🔴 [MarketPulse][FETCH-FAIL] ' + source + ' :: ' + code + ' ' + msg);
}

const results = {
  fearGreedValue: 'N/A', fearGreedClassification: 'Unknown',
  fearGreedChange1d: 'N/A', fearGreedChange1w: 'N/A',
  buffettIndicator: 'N/A', buffettStatus: 'N/A', buffettEmoji: '',
  shillerPE: 'N/A', shillerStatus: 'N/A', shillerEmoji: '',
  yieldCurve: 'N/A', yieldCurveStatus: 'N/A', yieldCurveEmoji: '',
  sp500VsMa200: 'N/A', sp500VsMa200Status: 'N/A', sp500VsMa200Emoji: '', maSignal: 'N/A',
  sp500: 'N/A', sp500Change: 'N/A',
  dowJones: 'N/A', dowJonesChange: 'N/A',
  vix: 'N/A', vixChange: 'N/A',
  gold: 'N/A', goldChange: 'N/A',
  oil: 'N/A', oilChange: 'N/A',
  dxy: 'N/A', dxyChange: 'N/A',
  btc: 'N/A', btcChange: 'N/A',
  gdpValue: 'N/A', gdpYear: 'N/A',
  cpiValue: 'N/A', cpiYear: 'N/A',
  unemploymentValue: 'N/A', unemploymentYear: 'N/A',
  fedRateValue: 'N/A', treasury10Y: 'N/A', treasury2Y: 'N/A',
  headlines: 'No headlines available',
  sp500MarketTime: null,
  headlinesList: [],
  headlinesCount: 0
};

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

// ---- 1. CNN FEAR & GREED INDEX ----
try {
  const fgData = await safeFetch({
    method: 'GET',
    url: 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.cnn.com/markets/fear-and-greed',
      'Accept': 'application/json'
    },
    timeout: 30000
  });
  if (fgData && fgData.fear_and_greed) {
    const fg = fgData.fear_and_greed;
    results.fearGreedValue = Math.round(fg.score);
    results.fearGreedClassification = fg.rating ?
      fg.rating.charAt(0).toUpperCase() + fg.rating.slice(1) : 'Unknown';
    if (fg.previous_close !== null && fg.previous_close !== undefined) {
      const d = Math.round(fg.score - fg.previous_close);
      results.fearGreedChange1d = (d >= 0 ? '+' : '') + d;
    }
    if (fg.previous_1_week !== null && fg.previous_1_week !== undefined) {
      const w = Math.round(fg.score - fg.previous_1_week);
      results.fearGreedChange1w = (w >= 0 ? '+' : '') + w;
    }
  }
} catch (e) { fail('Fear & Greed', e); }

// ---- 2. MARKET INDICES via Yahoo Finance ----
const indices = [
  { symbol: '^GSPC', namePrice: 'sp500', nameChange: 'sp500Change', label: 'S&P 500' },
  { symbol: '^DJI', namePrice: 'dowJones', nameChange: 'dowJonesChange', label: 'Dow Jones' },
  { symbol: '^VIX', namePrice: 'vix', nameChange: 'vixChange', label: 'VIX' },
  { symbol: 'GC=F', namePrice: 'gold', nameChange: 'goldChange', label: 'Gold', prefix: '$' },
  { symbol: 'CL=F', namePrice: 'oil', nameChange: 'oilChange', label: 'Oil (WTI)', prefix: '$' },
  { symbol: 'DX-Y.NYB', namePrice: 'dxy', nameChange: 'dxyChange', label: 'US Dollar (DXY)' },
  { symbol: 'BTC-USD', namePrice: 'btc', nameChange: 'btcChange', label: 'Bitcoin', prefix: '$' }
];

let sp500Price = 0;
let sp500Closes = [];

for (const idx of indices) {
  try {
    const range = (idx.symbol === '^GSPC') ? '1y' : '1d';
    const data = await safeFetch({
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(idx.symbol) + '?interval=1d&range=' + range,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    if (data && data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const price = meta.regularMarketPrice;
      // The exchange's OWN last-trade timestamp. This is the ground truth for
      // "has the market actually traded since the previous call?" — it closes
      // weekends, market holidays, and duplicate same-day runs in one signal.
      if (idx.symbol === '^GSPC' && meta.regularMarketTime) { results.sp500MarketTime = meta.regularMarketTime; }
      // Yahoo meta.chartPreviousClose = the close BEFORE the chart range starts.
      // ^GSPC is fetched with range=1y (it needs a year of closes for the 200-day MA),
      // so ITS chartPreviousClose is the close from a YEAR AGO - not yesterday. Using it
      // published the S&P annual return (+20.62%) as its DAILY change, every day, and
      // that number then fed the digest, the LLM evidence, and the track-record scoring.
      // Derive the true prior close from the timeseries whenever the range gives us one;
      // fall back to meta for range=1d, where the series holds only today candle.
      const seriesCloses = ((result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [])
        .filter(function (c) { return c !== null && c !== undefined; });
      const prevClose = (seriesCloses.length >= 2)
        ? seriesCloses[seriesCloses.length - 2]
        : (meta.chartPreviousClose || meta.previousClose);
      if (price) {
        const prefix = idx.prefix || '';
        if (idx.symbol === 'BTC-USD') {
          results[idx.namePrice] = prefix + price.toLocaleString('en-US', {maximumFractionDigits: 0});
        } else {
          results[idx.namePrice] = prefix + price.toFixed(2);
        }
        if (prevClose && prevClose > 0) {
          const changePct = ((price - prevClose) / prevClose) * 100;
          const sign = changePct >= 0 ? '+' : '';
          results[idx.nameChange] = sign + changePct.toFixed(2) + '%';
        }
      }
      if (idx.symbol === '^GSPC') {
        sp500Price = price;
        const closes = result.indicators.quote[0].close;
        sp500Closes = closes.filter(c => c !== null && c !== undefined);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  } catch (e) { fail(idx.label, e); }
}

// ---- 3. S&P 500 vs 200-DAY MOVING AVERAGE ----
try {
  if (sp500Closes.length >= 200 && sp500Price > 0) {
    const ma200 = sp500Closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const ma50 = sp500Closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, sp500Closes.slice(-50).length);
    const pctVsMa200 = ((sp500Price - ma200) / ma200) * 100;
    results.sp500VsMa200 = (pctVsMa200 >= 0 ? '+' : '') + pctVsMa200.toFixed(1) + '%';
    results.maSignal = ma50 > ma200 ? 'Golden Cross' : 'Death Cross';
    if (pctVsMa200 > 5) { results.sp500VsMa200Status = 'Strong Bullish'; results.sp500VsMa200Emoji = '🟢🟢'; }
    else if (pctVsMa200 > 0) { results.sp500VsMa200Status = 'Bullish'; results.sp500VsMa200Emoji = '🟢'; }
    else if (pctVsMa200 > -5) { results.sp500VsMa200Status = 'Caution'; results.sp500VsMa200Emoji = '🟡'; }
    else { results.sp500VsMa200Status = 'Bearish Signal'; results.sp500VsMa200Emoji = '🔴'; }
  }
} catch (e) { fail('MA200', e); }

// ---- 4. SHILLER PE (CAPE) RATIO ----
try {
  const capeResp = await safeFetch({
    method: 'GET',
    url: 'https://www.multpl.com/shiller-pe',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
    json: false
  });
  if (capeResp && typeof capeResp === 'string') {
    const match = capeResp.match(/Current Shiller PE Ratio[^0-9]*(\d+\.\d+)/);
    if (match) {
      const cape = parseFloat(match[1]);
      results.shillerPE = cape.toFixed(1);
      if (cape < 20) { results.shillerStatus = 'Undervalued'; results.shillerEmoji = '🟢🟢'; }
      else if (cape < 25) { results.shillerStatus = 'Fair Value'; results.shillerEmoji = '🟢'; }
      else if (cape < 30) { results.shillerStatus = 'Slightly Overvalued'; results.shillerEmoji = '🟡'; }
      else if (cape < 35) { results.shillerStatus = 'Overvalued'; results.shillerEmoji = '🟠'; }
      else { results.shillerStatus = 'Strongly Overvalued'; results.shillerEmoji = '🔴'; }
    }
  }
} catch (e) { fail('CAPE', e); }

// ---- 5-10. FRED DATA ----
try {
  const unempData = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=' + FRED_API_KEY + '&file_type=json&limit=1&sort_order=desc', timeout: 30000 });
  if (unempData && unempData.observations && unempData.observations[0]) { results.unemploymentValue = unempData.observations[0].value + '%'; results.unemploymentYear = formatDate(unempData.observations[0].date); }
} catch (e) { fail('FRED Unemployment', e); }

try {
  const cpiData = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=' + FRED_API_KEY + '&file_type=json&limit=13&sort_order=desc', timeout: 30000 });
  if (cpiData && cpiData.observations && cpiData.observations.length >= 13) { const latest = parseFloat(cpiData.observations[0].value); const yearAgo = parseFloat(cpiData.observations[12].value); results.cpiValue = (((latest - yearAgo) / yearAgo) * 100).toFixed(2) + '%'; results.cpiYear = formatDate(cpiData.observations[0].date); }
} catch (e) { fail('FRED CPI', e); }

try {
  const gdpData = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=A191RL1Q225SBEA&api_key=' + FRED_API_KEY + '&file_type=json&limit=1&sort_order=desc', timeout: 30000 });
  if (gdpData && gdpData.observations && gdpData.observations[0]) { const obs = gdpData.observations[0]; results.gdpValue = (parseFloat(obs.value) >= 0 ? '+' : '') + obs.value + '% (QoQ annualized)'; results.gdpYear = formatDate(obs.date); }
} catch (e) { fail('FRED GDP', e); }

try {
  const fedData = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU&api_key=' + FRED_API_KEY + '&file_type=json&limit=10&sort_order=desc', timeout: 30000 });
  if (fedData && fedData.observations) { for (const obs of fedData.observations) { if (obs.value && obs.value !== '.' && parseFloat(obs.value) > 0) { results.fedRateValue = parseFloat(obs.value).toFixed(2) + '%'; break; } } }
} catch (e) { fail('FRED Fed Rate', e); }

try {
  const t10Data = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=' + FRED_API_KEY + '&file_type=json&limit=10&sort_order=desc', timeout: 30000 });
  if (t10Data && t10Data.observations) { for (const obs of t10Data.observations) { if (obs.value && obs.value !== '.' && parseFloat(obs.value) > 0) { results.treasury10Y = parseFloat(obs.value).toFixed(2) + '%'; break; } } }
} catch (e) { fail('FRED 10Y', e); }

try {
  const t2Data = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=' + FRED_API_KEY + '&file_type=json&limit=10&sort_order=desc', timeout: 30000 });
  if (t2Data && t2Data.observations) { for (const obs of t2Data.observations) { if (obs.value && obs.value !== '.' && parseFloat(obs.value) > 0) { results.treasury2Y = parseFloat(obs.value).toFixed(2) + '%'; break; } } }
} catch (e) { fail('FRED 2Y', e); }

// ---- 11. YIELD CURVE ----
try {
  const t10 = parseFloat(results.treasury10Y); const t2 = parseFloat(results.treasury2Y);
  if (!isNaN(t10) && !isNaN(t2)) {
    const spread = t10 - t2;
    results.yieldCurve = (spread >= 0 ? '+' : '') + spread.toFixed(2) + '%';
    if (spread < 0) { results.yieldCurveStatus = 'INVERTED (Recession Warning)'; results.yieldCurveEmoji = '🔴'; }
    else if (spread < 0.5) { results.yieldCurveStatus = 'Flat (Caution)'; results.yieldCurveEmoji = '🟡'; }
    else { results.yieldCurveStatus = 'Normal (Healthy)'; results.yieldCurveEmoji = '🟢'; }
  }
} catch (e) { fail('Yield curve', e); }

// ---- 12. BUFFETT INDICATOR ----
try {
  const w5Data = await safeFetch({ method: 'GET', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EW5000?interval=1d&range=5d', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, timeout: 15000 });
  const gdpNomData = await safeFetch({ method: 'GET', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=' + FRED_API_KEY + '&file_type=json&limit=1&sort_order=desc', timeout: 30000 });
  if (w5Data && w5Data.chart && w5Data.chart.result && w5Data.chart.result[0] && gdpNomData && gdpNomData.observations && gdpNomData.observations[0]) {
    const w5Price = w5Data.chart.result[0].meta.regularMarketPrice;
    const totalMarketCap = w5Price * 1.05;
    const gdpBillions = parseFloat(gdpNomData.observations[0].value);
    if (totalMarketCap > 0 && gdpBillions > 0) {
      const ratio = (totalMarketCap / gdpBillions) * 100;
      results.buffettIndicator = ratio.toFixed(0) + '%';
      if (ratio < 100) { results.buffettStatus = 'Undervalued'; results.buffettEmoji = '🟢🟢'; }
      else if (ratio < 120) { results.buffettStatus = 'Fair Value'; results.buffettEmoji = '🟢'; }
      else if (ratio < 150) { results.buffettStatus = 'Slightly Overvalued'; results.buffettEmoji = '🟡'; }
      else if (ratio < 200) { results.buffettStatus = 'Significantly Overvalued'; results.buffettEmoji = '🟠'; }
      else { results.buffettStatus = 'Strongly Overvalued'; results.buffettEmoji = '🔴'; }
    }
  }
} catch (e) { fail('Buffett Indicator', e); }

// ---- 13. MARKETWATCH RSS HEADLINES ----
try {
  const rssResponse = await safeFetch({ method: 'GET', url: 'https://www.marketwatch.com/rss/topstories', timeout: 30000, json: false });
  if (rssResponse && typeof rssResponse === 'string') {
    // ===== NEWS LINKS (Phase A, 2026-07-20): parse <item> blocks so each headline
    // keeps its source <link>. headlinesList stays a plain string array (Compose +
    // Verify depend on its shape) - links ride in the parallel headlinesLinks array.
    const cleanTitle = (t) => String(t || '')
      .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
      .replace(/<\/?title>/g, '').trim()
      .replace(/&#x201c;/g, '"').replace(/&#x201d;/g, '"')
      .replace(/&#x2019;/g, "'").replace(/&#x2018;/g, "'")
      .replace(/&#x2014;/g, ' - ').replace(/&#x2013;/g, '-')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#xa0;/g, ' ');
    const cleaned = [];
    const links = [];
    const itemBlocks = rssResponse.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const block of itemBlocks) {
      if (cleaned.length >= 8) break;
      const tm = /<title>([\s\S]*?)<\/title>/.exec(block);
      const lm = /<link>([\s\S]*?)<\/link>/.exec(block);
      const title = tm ? cleanTitle(tm[1]) : '';
      if (title.length > 10) {
        cleaned.push(title);
        const href = lm ? lm[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() : '';
        links.push(/^https?:\/\//.test(href) ? href : null);
      }
    }
    if (!cleaned.length) {
      // FALLBACK: old title-only parse if the feed's <item> structure ever changes
      const titleMatches = rssResponse.match(/<title>([^<]+)<\/title>/g);
      if (titleMatches && titleMatches.length > 1) {
        for (let i = 1; i < Math.min(titleMatches.length, 9); i++) {
          const title = cleanTitle(titleMatches[i]);
          if (title.length > 10) { cleaned.push(title); links.push(null); }
        }
      }
    }
    if (cleaned.length > 0) {
      results.headlinesList = cleaned;
      results.headlinesLinks = links;
      results.headlinesCount = cleaned.length;
      results.headlines = cleaned.map((t, idx) => (idx + 1) + '. ' + t).join('\n');
    }
  }
} catch (e) { fail('RSS', e); }

// ===== HEALTH AUDIT: flag any critical field still N/A =====
const CRITICAL = {
  'Fear&Greed':'fearGreedValue',
  'S&P 500':'sp500',
  'VIX':'vix',
  'CAPE/Shiller':'shillerPE',
  'Buffett':'buffettIndicator',
  'Unemployment':'unemploymentValue',
  'CPI':'cpiValue',
  '10Y Treasury':'treasury10Y',
  '2Y Treasury':'treasury2Y',
  'GDP':'gdpValue'
};
for (const [label, key] of Object.entries(CRITICAL)) {
  const v = results[key];
  if (v === undefined || v === null || v === '' || v === 'N/A') health.missing.push(label);
}
const totalCritical = Object.keys(CRITICAL).length;
if (health.missing.length === 0) health.status = 'OK';
else if (health.missing.length >= Math.ceil(totalCritical * 0.6)) health.status = 'OUTAGE';
else health.status = 'DEGRADED';

// ===== DATA QUALITY: flag implausible values for review (never withholds - a
// human/downstream reader decides). Catches "poisoned"/corrupted upstream data or
// our own parsing bugs that a pure availability check (missing/N-A) can never see,
// since a bad number still looks present and non-N/A. =====
const CHANGE_BOUNDS = { sp500Change: 15, dowJonesChange: 15, goldChange: 10, oilChange: 15, dxyChange: 8, vixChange: 60, btcChange: 40 };
for (const field of Object.keys(CHANGE_BOUNDS)) {
  const raw = results[field];
  if (raw === undefined || raw === null || raw === 'N/A') continue;
  const num = parseFloat(String(raw).replace('%', ''));
  if (!isNaN(num) && Math.abs(num) > CHANGE_BOUNDS[field]) {
    health.suspect = health.suspect || [];
    health.suspect.push({ field: field, value: raw, bound: CHANGE_BOUNDS[field] });
    console.error('\u{1F7E0} [MarketPulse][DATA-QUALITY] ' + field + ' = ' + raw + ' exceeds plausible \u00b1' + CHANGE_BOUNDS[field] + '% - flagged for review, not withheld');
  }
}

health.elapsedMs = Date.now() - NODE_START;
if (msLeft() <= 0) console.error('🟠 [MarketPulse][TIME-BUDGET] exhausted after ' + Math.round(health.elapsedMs/1000) + 's - some sources were skipped to protect the run');
results._health = health;
if (health.status !== 'OK') {
  console.error('\u{1F534} [MarketPulse][DATA-HEALTH] ' + health.status + ' | missing: ' + (health.missing.join(', ') || 'none') + ' | fetch errors: ' + health.failed.length);
} else {
  console.log('✅ [MarketPulse][DATA-HEALTH] OK - all ' + totalCritical + ' critical sources populated');
}

return [{ json: results }];
