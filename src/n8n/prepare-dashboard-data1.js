// ============================================
// PREPARE DASHBOARD DATA (CN) - MarketPulse
// Shapes the same verified data Compose uses into the JSON contract
// the public dashboard (docs/) reads. Code-only, no LLM involved -
// mirrors what already shipped to Telegram, doesn't reinterpret it.
// ============================================

const items = $input.all();
const d = {};
for (const item of items) {
  const j = item.json || {};
  for (const key of Object.keys(j)) {
    if (j[key] !== undefined && j[key] !== null) d[key] = j[key];
  }
}

function safe(v, fallback) {
  if (fallback === undefined) fallback = 'N/A';
  return (v === undefined || v === null || v === 'N/A' || v === '') ? fallback : v;
}

const approval = MP_POLICY.readApproval(d, 'CN');
const _structured = approval.ok ? approval.analysis : null;
const _health = d._health || null;

const now = new Date();
const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const screener = [
  { label: 'CSI 300', factKey: 'csi300Change', value: safe(d.csi300), change: safe(d.csi300Change, '') },
  { label: 'SSE Composite', factKey: 'sseCompositeChange', value: safe(d.sseComposite), change: safe(d.sseCompositeChange, '') },
  { label: 'SZSE Component', factKey: 'szseComponentChange', value: safe(d.szseComponent), change: safe(d.szseComponentChange, '') },
  { label: 'Hang Seng', factKey: 'hangSengChange', value: safe(d.hangSeng), change: safe(d.hangSengChange, '') },
  { label: 'Gold', factKey: 'goldChange', value: safe(d.gold), change: safe(d.goldChange, '') },
  { label: 'USD/CNY', factKey: 'usdCnyChange', value: safe(d.usdCny), change: safe(d.usdCnyChange, '') }
];

const economic = [
  { label: 'GDP Growth', period: d.gdpYear || '', factKey: 'gdpValue', value: safe(d.gdpValue) },
  { label: 'Inflation/CPI', period: d.cpiYear || '', factKey: 'cpiValue', value: safe(d.cpiValue) },
  { label: 'Unemployment', period: d.unemploymentYear || '', factKey: 'unemploymentValue', value: safe(d.unemploymentValue) }
];

const claims = (_structured && Array.isArray(_structured.claims))
  ? _structured.claims.map(function (c) { return { text: c.claim, basedOn: c.basedOn || [], direction: c.direction || 'neutral' }; })
  : [];

// ===== HISTORY (read-only): the ledger + track record already persisted by Verify AI
// Analysis and Combine All Data1, read directly here (independent of $json) so the
// dashboard can show a day-by-day sentiment timeline, not just today's snapshot. =====
function buildHistory(edition) {
  try {
    const sd = $getWorkflowStaticData('global');
    const ledger = (sd.mpLedger && sd.mpLedger[edition]) || [];
    const tr = (sd.mpTrackRecord && sd.mpTrackRecord[edition]) || [];
    const scoredByPriorDate = {};
    for (const t of tr) scoredByPriorDate[t.priorDate] = t;
    return ledger.map(function (entry) {
      const scored = scoredByPriorDate[entry.date];
      return {
        date: entry.date,
        sentiment: entry.sentiment || 'n/a',
        verdict: entry.verdict || 'n/a',
        result: scored ? scored.result : null,
        actualChange: scored ? scored.actualChange : null
      };
    });
  } catch (e) { return []; }
}
const history = buildHistory('CN');

// ===== PUBLISHED FACT TABLE (2026-07-18) =====
// Every factKey the enforce gate lets a claim cite, with its value when available.
// The gate rejects claims citing unavailable facts, so this is a guaranteed superset
// of what any surviving claim cites - the CI data contract resolves by construction.
const facts = MP_POLICY.collectFacts(d, 'CN');
const availableScreener = screener.filter(row => MP_POLICY.own(facts, row.factKey) && MP_POLICY.own(facts, row.factKey.replace(/Change$/, '')));

// ===== PUBLISH GUARD (2026-07-20) =====
// A degraded/zombie run must never overwrite good published data (exec 658: a
// sleep-frozen run resumed ~10h late and clobbered the dashboard with an empty
// facts table). If the day's verified facts are absent or health says OUTAGE,
// skip the publish entirely - the previous good payload stands.
if (Object.keys(facts).length === 0 || availableScreener.length === 0 || !_health || !['OK','DEGRADED'].includes(_health.status)) {
  console.error('[MarketPulse][PUBLISH-GUARD] dashboard publish SKIPPED (facts=' + Object.keys(facts).length + ', marketRows=' + availableScreener.length + ', health=' + (_health ? _health.status : 'none') + ') - retaining the last published payload without usable market quotes.');
  return [];
}

const payload = {
  schemaVersion: 2,
  verification: MP_POLICY.verificationFor(approval, d),
  edition: 'CN',
  generatedAt: now.toISOString(),
  dateLabel: dateLabel,
  health: _health ? { status: _health.status, missing: _health.missing || [], suspect: _health.suspect || [] } : { status: 'OUTAGE', missing: ['ALL'], suspect: [] },
  dashboard: {},
  facts: facts,
  fearGreed: null,
  screener: availableScreener,
  economic: economic.filter(row => MP_POLICY.own(facts, row.factKey)),
  watchlist: d.watchlistSummary || '',
  trackRecord: { accuracy: d.trackRecordAccuracy || 'Building history', last: d.trackRecordLast || '' },
  history: history,
  analysisModel: _structured ? (d._analysisModel || null) : null,
  analysisProvider: _structured ? (d._analysisProvider || null) : null,
  analysis: _structured
    ? { sentiment: _structured.sentiment || 'n/a', confidence: _structured.confidence || 'n/a', claims: claims, interpretation: _structured.interpretation || '', wisdom: _structured.wisdom || '' }
    : { sentiment: 'Unavailable', confidence: '', claims: [], interpretation: '', wisdom: '' },
  news: (Array.isArray(d.headlinesList) ? d.headlinesList : []).map(function (t, i) {
    return MP_POLICY.isUsableHeadline(t) ? { factKey: 'headline_' + (i + 1), title: t, url: MP_POLICY.safeHttpUrl(Array.isArray(d.headlinesLinks) ? d.headlinesLinks[i] : null) } : null;
  }).filter(Boolean),
  sources: ['Yahoo Finance', 'World Bank', 'Google News']
};

const dashboardJson = JSON.stringify(payload, null, 2);
const commitMessage = 'Publish CN dashboard data - ' + dateLabel;

return [{ json: { dashboardJson: dashboardJson, commitMessage: commitMessage } }];
