// ============================================
// COMPOSE TELEGRAM MESSAGE - MarketPulse v7.1
// Value Investor Edition - HTML-styled (2026-07-10)
// ============================================

const items = $input.all();
const now = new Date();

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function oneLine(s){ return String(s).replace(/\s*\n+\s*/g, ' ').trim(); }

let d = {
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
  watchlistSummary: 'N/A',
  trackRecordAccuracy: 'Building history',
  trackRecordLast: '',
  llmAnalysis: '🚫 AI commentary withheld — no analysis passed the current schema and attribution checks. Available source data is shown above.',
  headlinesList: [],
  headlinesLinks: []
};

for (const item of items) {
  const j = item.json || {};
  for (const key of Object.keys(d)) {
    if (key === 'llmAnalysis') continue;
    if (j[key] !== undefined && j[key] !== null && j[key] !== '' && j[key] !== 'N/A' && j[key] !== 'Unknown' && j[key] !== 'Analysis unavailable') {
      d[key] = j[key];
    }
  }
}

// Apply the same availability rule to source tables and citation evidence.
for (const key of [...MP_POLICY.factKeysFor('US'),'fearGreedChange1d','fearGreedChange1w']) {
  if (MP_POLICY.own(d, key) && !MP_POLICY.isUsableFact(d[key], key)) d[key] = 'N/A';
}

// escape every dynamic value ONCE, here - the template below only ever uses
// pre-escaped d[] fields, so it is free to add its own trusted <b>/<code>/<i> tags
// without a final blanket-escape stripping them back out.
// headlinesList stays an array (escaped per-element where it's actually used) - String()-ing
// it here would collapse it to a comma-joined string and break headline_N index lookups.
for (const k of Object.keys(d)) { if (k !== 'llmAnalysis' && k !== 'headlinesList' && k !== 'headlinesLinks') d[k] = esc(d[k]); }


// ===== DATA HEALTH BANNER (hardening) =====
let _health = null;
for (const item of items) { if (item.json && item.json._health) _health = item.json._health; }
let healthBanner = '';
if (_health && _health.status === 'OUTAGE') {
  healthBanner = `🚨 <b>DATA OUTAGE</b> - most live sources failed to load today.\nValues below may be missing/stale (${esc((_health.missing || []).join(', '))}).\nCheck n8n logs (tag: MarketPulse FETCH-FAIL).\n\n`;
} else if (_health && _health.status === 'DEGRADED') {
  healthBanner = `⚠️ <b>PARTIAL DATA</b> - some sources unavailable: ${esc((_health.missing || []).join(', '))}.\n\n`;
}
if (_health && _health.suspect && _health.suspect.length) {
  const suspectList = _health.suspect.map(function (s) { return esc(String(s.field)) + ' (' + esc(String(s.value)) + ', exceeds \u00b1' + s.bound + '%)'; }).join('; ');
  healthBanner += '\uD83D\uDD0D <b>DATA QUALITY FLAG</b> \u2014 unusual reading(s), verify before relying on: ' + suspectList + '.\n\n';
}

// Only the explicitly approved analysis can supply commentary. Raw fields are ignored.
let _analysisModel = null, _analysisProvider = null;
for (const item of items) { if (item.json && item.json._analysisModel) { _analysisModel = item.json._analysisModel; _analysisProvider = item.json._analysisProvider; } }
const boundaryData = Object.assign({}, ...items.map(item => item.json || {}));
const approval = MP_POLICY.readApproval(boundaryData, 'US');
const _structured = approval.ok ? approval.analysis : null;
const evidenceFacts = MP_POLICY.collectFacts(boundaryData, 'US');
if (_structured) {
  const LBL = {
    buffettIndicator: ['Buffett Indicator', 'buffettStatus'], shillerPE: ['Shiller CAPE', 'shillerStatus'],
    yieldCurve: ['Yield Curve 10Y-2Y', 'yieldCurveStatus'], sp500VsMa200: ['S&P vs 200D-MA', 'sp500VsMa200Status'],
    maSignal: ['Trend Signal', null], fearGreedValue: ['Fear & Greed', 'fearGreedClassification'],
    sp500: ['S&P 500', null], sp500Change: ['S&P 500 change', null], dowJones: ['Dow Jones', null],
    dowJonesChange: ['Dow change', null], vix: ['VIX', null], vixChange: ['VIX change', null],
    gold: ['Gold', null], goldChange: ['Gold change', null], oil: ['Oil WTI', null], oilChange: ['Oil change', null],
    dxy: ['Dollar DXY', null], dxyChange: ['DXY change', null], btc: ['Bitcoin', null], btcChange: ['Bitcoin change', null],
    gdpValue: ['GDP', null], cpiValue: ['CPI', null], unemploymentValue: ['Unemployment', null],
    fedRateValue: ['Fed Funds', null], treasury10Y: ['10Y Treasury', null], treasury2Y: ['2Y Treasury', null],
    csi300: ['CSI 300', null], csi300Change: ['CSI 300 change', null], sseComposite: ['SSE Composite', null],
    sseCompositeChange: ['SSE change', null], szseComponent: ['SZSE Component', null], szseComponentChange: ['SZSE change', null],
    hangSeng: ['Hang Seng', null], hangSengChange: ['Hang Seng change', null],
    usdCny: ['USD/CNY', null], usdCnyChange: ['USD/CNY change', null]
  };
  // d[] is already HTML-escaped above; these labels are our own trusted literals.
  // Watchlist evidence is dynamic - labels AND values come from the same stockDetails
  // the factKeys were derived from. The template merge copies only predefined keys
  // into d, so the per-stock keys are injected here from the items (escaped at
  // insertion, matching the pre-escape doctrine of the template fields).
  const wlSlug = (s) => String((s && (s.name || s.symbol)) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const item of items) {
    const sdl = item.json && item.json.stockDetails;
    if (!Array.isArray(sdl)) continue;
    for (const s of sdl) {
      const b = wlSlug(s);
      if (!b) continue;
      if (!LBL[b + 'Change']) LBL[b + 'Change'] = [esc(String(s.name || s.symbol)) + ' change', null];
      if (MP_POLICY.own(evidenceFacts, b + 'Change')) d[b + 'Change'] = esc(evidenceFacts[b + 'Change']);
    }
  }
  // headline_N citations aren't in LBL (dynamic per-day, not a fixed factKey) - handled
  // separately, quoting the actual headline text (escaped here, at point of use, since
  // headlinesList was deliberately skipped in the blanket-escape pass above).
  const evidenceFor = (keys) => (keys || []).map((k) => {
    const hm = /^headline_(\d+)$/.exec(k);
    if (hm) {
      const hIdx = parseInt(hm[1], 10) - 1;
      const text = Array.isArray(d.headlinesList) ? d.headlinesList[hIdx] : null;
      if (!text) return null;
      // NEWS LINKS (Phase A): a cited headline links to its real source when captured
      const href = MP_POLICY.safeHttpUrl(Array.isArray(d.headlinesLinks) ? d.headlinesLinks[hIdx] : null);
      const q = '"' + esc(oneLine(text)) + '"';
      return href ? ('📰 <a href="' + esc(String(href)).replace(/"/g, '%22') + '">' + q + '</a>') : ('📰 ' + q);
    }
    const m = LBL[k]; if (!m) return null;
    if (!MP_POLICY.own(evidenceFacts, k)) return null;
    const val = esc(evidenceFacts[k]);
    const st = m[1] && d[m[1]] && d[m[1]] !== 'N/A' ? ' (' + d[m[1]] + ')' : '';
    return m[0] + ' ' + val + st;
  }).filter(Boolean).join('; ');
  let outA = '<b>MARKET SENTIMENT:</b> ' + esc(oneLine(_structured.sentiment || 'n/a'));
  outA += '\n<b>Confidence:</b> ' + esc(oneLine(_structured.confidence || 'n/a'));
  outA += '\n\n<b>KEY DRIVERS</b> (each claim cites its source data):';
  _structured.claims.forEach((c, i) => {
    outA += '\n' + (i + 1) + '. ' + esc(oneLine(c.claim));
    const ev = evidenceFor(c.basedOn);
    if (ev) outA += '\n   <i>evidence: ' + ev + '</i>';
  });
  if (_structured.interpretation) outA += '\n\n<b>INTERPRETATION:</b>\n' + esc(oneLine(_structured.interpretation));
  if (_structured.wisdom) outA += '\n\n<blockquote>' + esc(oneLine(_structured.wisdom)) + '</blockquote>';
  const modelNote = _analysisModel ? (' Analysis written by ' + esc(_analysisModel) + ' (' + esc(_analysisProvider) + ').') : '';
  outA += '\n\n<i>[Checked: ' + ((_structured.claims || []).length) + ' claims cite available source data. Schema and citation availability checked; prose accuracy is not fact-checked.' + modelNote + ']</i>';
  d.llmAnalysis = outA;
} else {
  // Withholding notice is fixed code-owned text, never the original model response.
  d.llmAnalysis = esc(d.llmAnalysis);
}

const dateStr = now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Fear & Greed emoji
const fgScore = parseInt(d.fearGreedValue) || 0;
let fgEmoji = '';
if (fgScore >= 75) fgEmoji = '🟢🟢';
else if (fgScore >= 55) fgEmoji = '🟢';
else if (fgScore >= 45) fgEmoji = '🟡';
else if (fgScore >= 25) fgEmoji = '🟠';
else if (fgScore > 0) fgEmoji = '🔴';

// VIX emoji
const vixVal = parseFloat(d.vix) || 0;
let vixEmoji = '';
if (vixVal >= 30) vixEmoji = '🔴 HIGH';
else if (vixVal >= 20) vixEmoji = '🟠 ELEVATED';
else if (vixVal >= 12) vixEmoji = '🟢 NORMAL';
else if (vixVal > 0) vixEmoji = '🟢🟢 LOW';

function arrow(changeStr) {
  if (!changeStr || changeStr === 'N/A') return '';
  return changeStr.startsWith('+') ? '▲' : '▼';
}

const trackRecordLine = d.trackRecordLast ? ('Last call: ' + d.trackRecordLast + '\n') : '';

let message = `📊 <b>MarketPulse Daily Digest</b>
━━━━━━━━━━━━━━━━━━━━
📅 ${dateStr}

${healthBanner}🏛️ <b>VALUE INVESTOR DASHBOARD</b>

${d.buffettEmoji} <b>BUFFETT INDICATOR:</b> <code>${d.buffettIndicator}</code>
   Market Cap to GDP | ${d.buffettStatus}

${d.shillerEmoji} <b>SHILLER P/E (CAPE):</b> <code>${d.shillerPE}</code>
   Cyclically Adjusted P/E | ${d.shillerStatus}

${d.yieldCurveEmoji} <b>YIELD CURVE (10Y-2Y):</b> <code>${d.yieldCurve}</code>
   Treasury Spread | ${d.yieldCurveStatus}

${d.sp500VsMa200Emoji} <b>S&amp;P 500 vs 200D-MA:</b> <code>${d.sp500VsMa200}</code>
   Trend Signal | ${d.sp500VsMa200Status} (${d.maSignal})

━━━━━━━━━━━━━━━━━━━━

🎯 <b>FEAR &amp; GREED INDEX</b> ${fgEmoji}
Score: <code>${d.fearGreedValue}/100</code> | ${d.fearGreedClassification}
Change: ${d.fearGreedChange1d} (1d) | ${d.fearGreedChange1w} (1w)

📈 <b>MARKET SCREENER</b>
${arrow(d.sp500Change)} S&amp;P 500: <code>${d.sp500}</code> (${d.sp500Change})
${arrow(d.dowJonesChange)} Dow Jones: <code>${d.dowJones}</code> (${d.dowJonesChange})
${arrow(d.vixChange)} VIX: <code>${d.vix}</code> (${d.vixChange}) ${vixEmoji}
${arrow(d.goldChange)} Gold: <code>${d.gold}</code> (${d.goldChange})
${arrow(d.oilChange)} Oil (WTI): <code>${d.oil}</code> (${d.oilChange})
${arrow(d.dxyChange)} US Dollar: <code>${d.dxy}</code> (${d.dxyChange})
${arrow(d.btcChange)} Bitcoin: <code>${d.btc}</code> (${d.btcChange})

📊 <b>ECONOMIC INDICATORS (USA)</b>
• GDP Growth (${d.gdpYear}): <code>${d.gdpValue}</code>
• Inflation/CPI (${d.cpiYear}): <code>${d.cpiValue}</code>
• Unemployment (${d.unemploymentYear}): <code>${d.unemploymentValue}</code>
• Fed Funds Rate: <code>${d.fedRateValue}</code>
• 10Y Treasury: <code>${d.treasury10Y}</code>
• 2Y Treasury: <code>${d.treasury2Y}</code>

📋 <b>WATCHLIST</b>
${d.watchlistSummary}

📈 <b>TRACK RECORD</b>
Accuracy: <code>${d.trackRecordAccuracy}</code>
${trackRecordLine}<i>Was yesterday’s sentiment consistent with what the market did next — scored automatically, never predicted.</i>

💡 <b>AI ANALYSIS (Valu-Analyst)</b>
${d.llmAnalysis}

━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Disclaimer: AI-generated analysis for informational purposes only. Not financial advice.</i>

📎 Sources: CNN Fear &amp; Greed, FRED, MarketWatch, Yahoo Finance, multpl.com

🔗 <a href="https://creator35lwb-web.github.io/MarketPulse/">Full Dashboard</a> · <a href="https://github.com/creator35lwb-web/MarketPulse">Open Source on GitHub</a>

MarketPulse — Verified AI Market Intelligence`;

// Keep commentary and its evidence together. Removing individual trailing lines
// could leave a claim on Telegram after removing the evidence immediately below it.
if (message.length > 4096) {
  const compactAnalysis = _structured
    ? '<b>MARKET SENTIMENT:</b> ' + esc(_structured.sentiment) + '\n<b>Confidence:</b> ' + esc(_structured.confidence) +
      '\n<i>Detailed commentary omitted to fit Telegram. Schema and citation availability checked; prose accuracy is not fact-checked.</i>'
    : d.llmAnalysis;
  message = message.replace(d.llmAnalysis, compactAnalysis);
  if (message.length > 4096) {
    const sourceValue = key => MP_POLICY.own(evidenceFacts, key) ? esc(evidenceFacts[key]) : 'N/A';
    const sourceStatus = _health && ['OK','DEGRADED','OUTAGE'].includes(_health.status) ? _health.status : 'OUTAGE';
    message = '📊 <b>MarketPulse Daily Digest (US)</b>\n📅 ' + dateStr +
      '\n<b>Source health:</b> ' + sourceStatus +
      '\nS&amp;P 500: <code>' + sourceValue('sp500') + '</code> (' + sourceValue('sp500Change') + ')' +
      '\nGold: <code>' + sourceValue('gold') + '</code> (' + sourceValue('goldChange') + ')' +
      '\n\n' + compactAnalysis +
      '\n\n<i>Digest shortened to fit Telegram. AI commentary is informational only, not financial advice.</i>' +
      '\n<a href="https://creator35lwb-web.github.io/MarketPulse/">Open Dashboard</a>';
  }
  console.error('[MarketPulse][TG-COMPACT] digest shortened to ' + message.length + ' chars');
}
return [{ json: { message, timestamp: now.toISOString() } }];
