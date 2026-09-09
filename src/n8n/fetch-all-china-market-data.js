// ============================================
// FETCH ALL MARKET DATA - MarketPulse v6.0 (CN)
// China Market Edition
// Data Sources: Yahoo Finance, World Bank
// ============================================


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
  // China Market Indices
  csi300: 'N/A',
  csi300Change: 'N/A',
  sseComposite: 'N/A',
  sseCompositeChange: 'N/A',
  szseComponent: 'N/A',
  szseComponentChange: 'N/A',
  hangSeng: 'N/A',
  hangSengChange: 'N/A',
  // Commodities & Forex
  gold: 'N/A',
  goldChange: 'N/A',
  usdCny: 'N/A',
  usdCnyChange: 'N/A',
  // Economic Indicators (World Bank - China)
  gdpValue: 'N/A',
  gdpYear: 'N/A',
  cpiValue: 'N/A',
  cpiYear: 'N/A',
  unemploymentValue: 'N/A',
  unemploymentYear: 'N/A',
  // News Headlines
  headlines: 'No headlines available',
  csi300MarketTime: null,
  headlinesList: [],
  headlinesCount: 0
};

// --- Helper Functions ---

function formatPct(price, prevClose) {
  if (!price || !prevClose || prevClose === 0) return 'N/A';
  const changePct = ((price - prevClose) / prevClose) * 100;
  const sign = changePct >= 0 ? '+' : '';
  return sign + changePct.toFixed(2) + '%';
}

// --- 1. FETCH CHINA MARKET INDICES (Yahoo Finance) ---

const indices = [
  { symbol: '000300.SS', namePrice: 'csi300', nameChange: 'csi300Change', label: 'CSI 300' },
  { symbol: '000001.SS', namePrice: 'sseComposite', nameChange: 'sseCompositeChange', label: 'SSE Composite' },
  { symbol: '399001.SZ', namePrice: 'szseComponent', nameChange: 'szseComponentChange', label: 'SZSE Component' },
  { symbol: '^HSI', namePrice: 'hangSeng', nameChange: 'hangSengChange', label: 'Hang Seng' }
];

for (const idx of indices) {
  try {
    const data = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(idx.symbol) + '?interval=1d&range=1d',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    if (data && data.chart && data.chart.result && data.chart.result[0]) {
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      // The exchange's OWN last-trade timestamp. This is the ground truth for
      // "has the market actually traded since the previous call?" — it closes
      // weekends, market holidays, and duplicate same-day runs in one signal.
      if (idx.symbol === '000300.SS' && meta.regularMarketTime) { results.csi300MarketTime = meta.regularMarketTime; }
      const prevClose = meta.chartPreviousClose || meta.previousClose;

      if (price) {
        results[idx.namePrice] = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (prevClose && prevClose > 0) {
          results[idx.nameChange] = formatPct(price, prevClose);
        }
      }
    }
    // Rate limit: small delay between requests
    await new Promise(r => setTimeout(r, 500));
  } catch (e) { fail(idx.label, e); }
}

// --- 2. FETCH GOLD & USD/CNY (Yahoo Finance) ---

const fxCommodities = [
  { symbol: 'GC=F', namePrice: 'gold', nameChange: 'goldChange', label: 'Gold', prefix: '$' },
  { symbol: 'CNY=X', namePrice: 'usdCny', nameChange: 'usdCnyChange', label: 'USD/CNY', prefix: '' }
];

for (const item of fxCommodities) {
  try {
    const data = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(item.symbol) + '?interval=1d&range=1d',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    if (data && data.chart && data.chart.result && data.chart.result[0]) {
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;

      if (price) {
        if (item.symbol === 'CNY=X') {
          results[item.namePrice] = item.prefix + price.toFixed(4);
        } else {
          results[item.namePrice] = item.prefix + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (prevClose && prevClose > 0) {
          results[item.nameChange] = formatPct(price, prevClose);
        }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  } catch (e) { fail(item.label, e); }
}

// --- 3. FETCH CHINA ECONOMIC DATA (World Bank API) ---

// GDP Growth
try {
  const gdpData = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.worldbank.org/v2/country/CN/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=5&mrv=1',
    timeout: 30000
  });

  if (gdpData && gdpData[1] && gdpData[1][0]) {
    const obs = gdpData[1][0];
    if (obs.value !== null) {
      const sign = obs.value >= 0 ? '+' : '';
      results.gdpValue = sign + parseFloat(obs.value).toFixed(2) + '%';
      results.gdpYear = obs.date;
    }
  }
} catch (e) { fail('World Bank GDP', e); }

// CPI Inflation
try {
  const cpiData = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.worldbank.org/v2/country/CN/indicator/FP.CPI.TOTL.ZG?format=json&per_page=5&mrv=1',
    timeout: 30000
  });

  if (cpiData && cpiData[1] && cpiData[1][0]) {
    const obs = cpiData[1][0];
    if (obs.value !== null) {
      results.cpiValue = parseFloat(obs.value).toFixed(2) + '%';
      results.cpiYear = obs.date;
    }
  }
} catch (e) { fail('World Bank CPI', e); }

// Unemployment Rate
try {
  const unempData = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.worldbank.org/v2/country/CN/indicator/SL.UEM.TOTL.ZS?format=json&per_page=5&mrv=1',
    timeout: 30000
  });

  if (unempData && unempData[1] && unempData[1][0]) {
    const obs = unempData[1][0];
    if (obs.value !== null) {
      results.unemploymentValue = parseFloat(obs.value).toFixed(2) + '%';
      results.unemploymentYear = obs.date;
    }
  }
} catch (e) { fail('World Bank Unemployment', e); }

// --- 4. FETCH NEWS HEADLINES (Reuters China, Sina Finance RSS) ---

try {
  // Try Reuters China news first
  const rssResponse = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://news.google.com/rss/search?q=China+stock+market+economy&hl=en&gl=US&ceid=US:en',
    timeout: 30000,
    json: false
  });

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
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#xa0;/g, ' ')
      .replace(/ - .*$/, ''); // Remove source attribution
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
  'CSI 300':'csi300',
  'SSE Composite':'sseComposite',
  'SZSE Component':'szseComponent',
  'Hang Seng':'hangSeng',
  'USD/CNY':'usdCny',
  'GDP':'gdpValue',
  'CPI':'cpiValue',
  'Unemployment':'unemploymentValue'
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
const CHANGE_BOUNDS = { csi300Change: 15, sseCompositeChange: 15, szseComponentChange: 15, hangSengChange: 15, goldChange: 10, usdCnyChange: 5 };
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

results._health = health;
if (health.status !== 'OK') {
  console.error('\u{1F534} [MarketPulse][DATA-HEALTH] ' + health.status + ' | missing: ' + (health.missing.join(', ') || 'none') + ' | fetch errors: ' + health.failed.length);
} else {
  console.log('✅ [MarketPulse][DATA-HEALTH] OK - all ' + totalCritical + ' critical sources populated');
}

return [{ json: results }];
