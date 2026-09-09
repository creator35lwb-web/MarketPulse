// Shared verifier for both editions; n8n capabilities are supplied explicitly.
function MP_VERIFY(EDITION, {$input, $, $getWorkflowStaticData, Date: RuntimeDate, console}) {
  let data = {};
  let candidateText = '';
  let reasons = ['VERIFICATION_EXCEPTION'];
  let approved = null;
  let analysisModel = null;
  let analysisProvider = null;

  try {
    const items = $input.all();
    const candidates = [];
    for (const item of items) {
      if (!item || !MP_POLICY.record(item.json)) continue;
      const input = item.json;
      // Only the data branch, identified by its source-health block, supplies facts.
      // Raw model result fields cannot overwrite fetched values or approval metadata.
      if (MP_POLICY.record(input._health)) {
        for (const key of Object.keys(input)) {
          if (['text','response','llmAnalysis','approvedAnalysis','_structured','_verification','_analysisModel','_analysisProvider','__proto__','constructor','prototype'].includes(key)) continue;
          data[key] = input[key];
        }
      }
      for (const key of ['text','response','llmAnalysis']) {
        if (typeof input[key] === 'string' && input[key].trim()) candidates.push(input[key].trim());
      }
    }
    const texts = [...new Set(candidates)];
    candidateText = texts.length === 1 ? texts[0] : '';
    reasons = [];
    if (!data._health || !['OK','DEGRADED'].includes(data._health.status)) reasons.push('SOURCE_HEALTH_UNAVAILABLE');
    if (!texts.length) reasons.push('MODEL_OUTPUT_UNAVAILABLE');
    else if (texts.length !== 1) reasons.push('MODEL_OUTPUT_AMBIGUOUS');
    else if (candidateText.length > 16000) reasons.push('MODEL_OUTPUT_TOO_LARGE');
    if (candidateText) {
      // Preserve live provider attribution: derive it from the branch that executed.
      try {
        const fallback = $(EDITION === 'CN' ? 'Groq Analyst1' : 'Groq Analyst').all();
        if (fallback.some(item => item && item.json && typeof item.json.text === 'string' && item.json.text.trim() === candidateText)) {
          analysisModel = 'llama-3.3-70b-versatile'; analysisProvider = 'Groq';
        }
      } catch (_) { /* fallback was not executed */ }
      if (!analysisModel) { analysisModel = 'gemini-3.6-flash'; analysisProvider = 'Google'; }
    }
    if (!reasons.length) {
      let parsed;
      try { parsed = JSON.parse(candidateText); }
      catch (_) { reasons.push('MODEL_JSON_INVALID'); }
      if (!reasons.length) {
        const result = MP_POLICY.validateAnalysis(parsed, {
          facts:MP_POLICY.collectFacts(data, EDITION),
          headlines:Array.isArray(data.headlinesList) ? data.headlinesList : [],
        });
        reasons = result.reasonCodes;
        approved = result.analysis;
      }
    }
  } catch (_) {
    // A verification exception can never restore or forward raw model output.
    approved = null;
    reasons = ['VERIFICATION_EXCEPTION'];
  }

  if (!data._health || !MP_POLICY.record(data._health)) {
    data._health = {status:'OUTAGE',missing:['ALL'],suspect:[],failed:[]};
  }
  if (reasons.length) approved = null;
  data.approvedAnalysis = approved ? {version:1,edition:EDITION,analysis:approved} : null;
  data._verification = {
    contractVersion:1,edition:EDITION,status:approved ? 'PASS' : 'FAIL',
    action:approved ? 'none' : 'withheld',mode:'enforce',structured:!!approved,
    checked:approved ? approved.claims.length : 0,score:approved ? 100 : null,
    reasonCodes:approved ? [] : [...new Set(reasons.length ? reasons : ['APPROVAL_MISSING'])],
    contradictions:approved ? [] : [...new Set(reasons)],unverified:[],
    scope:'schema-and-attribution',analysisModel,analysisProvider,
  };
  data._analysisModel = approved ? analysisModel : null;
  data._analysisProvider = approved ? analysisProvider : null;

  // Preserve live outage/session/same-day guards and bounded ledger history.
  // Only an approved analysis can become tomorrow's scoreable prior.
  if (approved && data._health.status !== 'OUTAGE') {
    try {
      const state = $getWorkflowStaticData('global');
      if (!state.mpLedger) state.mpLedger = {};
      if (!Array.isArray(state.mpLedger[EDITION])) state.mpLedger[EDITION] = [];
      const ledger = state.mpLedger[EDITION];
      const today = new RuntimeDate().toISOString().slice(0, 10);
      const marketTime = EDITION === 'CN' ? data.csi300MarketTime : data.sp500MarketTime;
      const knownSession = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
      let previous = null;
      for (let i = ledger.length - 1; i >= 0; i--) {
        if (ledger[i] && ledger[i].date !== today && ledger[i].sentiment && knownSession(ledger[i].marketTime)) { previous = ledger[i]; break; }
      }
      if (!knownSession(marketTime)) {
        console.error('[MarketPulse][LEDGER] skipped scoreable observation: benchmark session time unavailable');
      } else if (!previous || marketTime > previous.marketTime) {
        const entry = {
          date:today,edition:EDITION,sentiment:approved.sentiment,confidence:approved.confidence,
          claims:approved.claims.map(c => ({claim:c.claim.slice(0,200),basedOn:[...c.basedOn]})),
          verdict:'PASS',score:100,violations:0,health:data._health.status,
          model:analysisModel,marketTime,verificationVersion:1,
        };
        if (ledger.length && ledger[ledger.length - 1].date === today) ledger[ledger.length - 1] = entry;
        else ledger.push(entry);
        if (ledger.length > 30) ledger.splice(0, ledger.length - 30);
      }
    } catch (_) { console.error('[MarketPulse][LEDGER] approved observation could not be persisted'); }
  }
  console.log('[MarketPulse][VERIFY] ' + EDITION + ' ' + data._verification.status + ' ' + data._verification.reasonCodes.join(','));
  return [{json:data}];
}
