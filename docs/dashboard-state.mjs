// Publication freshness is independent of source quality and Telegram delivery.
export function expectedPublicationDate(edition, now = new Date()) {
  const day = new Date(now);
  const minutes = day.getUTCHours() * 60 + day.getUTCMinutes();
  const deadline = edition === 'CN' ? 9 * 60 + 30 : 14 * 60;
  if (minutes < deadline) day.setUTCDate(day.getUTCDate() - 1);
  if (edition === 'CN') {
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  }
  return day.toISOString().slice(0, 10);
}

const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const text = value => typeof value === 'string' && !!value.trim();
const available = value => typeof value === 'number' ? Number.isFinite(value)
  : text(value) && !/^(?:n\/?a|unknown|unavailable|null|undefined|nan|[+-]?infinity)$/i.test(value.trim());

export function headlineKey(item, index, legacy = false) {
  if (/^headline_[1-9]\d*$/.test(item?.factKey || '')) return item.factKey;
  return legacy ? 'headline_' + (index + 1) : null;
}

export function citationEvidence(data, key) {
  if (typeof key !== 'string') return null;
  const headline = (data.news || []).find((item, index) => headlineKey(item, index, data.schemaVersion === undefined) === key);
  if (headline && text(headline.title)) return {label: 'Headline ' + key.slice(9), value: headline.title};
  if (/^headline_/.test(key)) return null;
  if (!own(data.facts, key) || !available(data.facts[key])) return null;
  const row = [...(data.screener || []), ...(data.economic || [])].find(item => item.factKey === key || item.factKey === key + 'Change');
  const label = data.dashboard?.[key]?.title || row?.label
    || (key === 'fearGreedValue' ? 'Fear & Greed score' : key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase()));
  return {label, value: String(data.facts[key])};
}

// Every displayed citation gets a visible target, including unavailable legacy evidence.
export function additionalEvidence(data, claims, visibleKeys = []) {
  const seen = new Set(visibleKeys);
  const rows = [];
  for (const claim of claims) {
    for (const key of Array.isArray(claim.basedOn) ? claim.basedOn : []) {
      if (typeof key !== 'string' || seen.has(key)) continue;
      const evidence = citationEvidence(data, key);
      rows.push({key, ...(evidence || {label: key, value: 'Evidence unavailable in this briefing'}), available: !!evidence});
      seen.add(key);
    }
  }
  return rows;
}

export function presentationState(data, now = new Date()) {
  const published = new Date(data.generatedAt);
  const validTime = typeof data.generatedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.generatedAt)
    && Number.isFinite(published.getTime())
    && published.toISOString().slice(0, 19) === data.generatedAt.slice(0, 19)
    && published.getTime() <= now.getTime();
  const expectedDate = expectedPublicationDate(data.edition, now);
  const publicationDate = validTime ? published.toISOString().slice(0, 10) : null;
  const offSchedule = validTime && data.edition === 'CN' && [0, 6].includes(published.getUTCDay());
  const stale = !validTime || offSchedule || !['US', 'CN'].includes(data.edition) || publicationDate < expectedDate;
  const legacy = data.schemaVersion === undefined;
  const claims = Array.isArray(data.analysis?.claims) ? data.analysis.claims : [];
  const approved = data.schemaVersion === 2 && data.verification?.version === 1 && data.verification?.status === 'approved'
    && Array.isArray(data.verification.reasonCodes) && data.verification.reasonCodes.length === 0
    && ['OK', 'DEGRADED'].includes(data.health?.status)
    && claims.length > 0 && claims.length <= 6 && data.verification.checkedClaims === claims.length
    && claims.every(claim => text(claim?.text) && Array.isArray(claim.basedOn) && claim.basedOn.length > 0
      && claim.basedOn.every(key => citationEvidence(data, key)));
  return {stale, legacy, approved, validTime, expectedDate, publicationDate, offSchedule};
}

export function verificationPresentation(data, state = presentationState(data)) {
  if (state.legacy) return {tone: 'historical', message: 'Historical commentary. It predates the current verification checks and carries no current approval.'};
  if (state.approved) {
    const count = data.analysis.claims.length;
    return {tone: state.stale ? 'historical' : 'approved', message: 'At publication, ' + count + ' claim' + (count === 1 ? '' : 's')
      + ' passed structure and attribution checks. Market figures come from data; interpretations remain AI-generated. Headline citations confirm an available headline, not the truth of its report.'};
  }
  const reasons = Array.isArray(data.verification?.reasonCodes) ? data.verification.reasonCodes : [];
  if (data.health?.status === 'OUTAGE' || reasons.includes('SOURCE_HEALTH_UNAVAILABLE')) {
    return {tone: 'unavailable', message: 'AI commentary unavailable: sufficient source data and health checks were not available for this run.'};
  }
  if (reasons.includes('MODEL_OUTPUT_UNAVAILABLE')) {
    return {tone: 'unavailable', message: 'AI commentary unavailable: the model did not return a response for this run.'};
  }
  if (reasons.some(code => ['APPROVAL_MISSING', 'APPROVAL_INVALID', 'APPROVAL_COUNT_MISMATCH', 'VERIFICATION_EXCEPTION'].includes(code))
      || data.verification?.status !== 'withheld' || !reasons.length) {
    return {tone: 'unavailable', message: 'AI commentary hidden: a complete verification record is unavailable. No approval is claimed.'};
  }
  if (reasons.some(code => ['FACT_UNAVAILABLE', 'HEADLINE_UNAVAILABLE', 'CITATION_LIST_INVALID', 'CITATION_KEY_INVALID'].includes(code))) {
    return {tone: 'withheld', message: 'AI commentary withheld: its evidence references failed attribution checks. The available source data is shown separately.'};
  }
  if (reasons.includes('NUMERIC_MODEL_TEXT')) {
    return {tone: 'withheld', message: 'AI commentary withheld: the model supplied figures that did not meet the source attribution rules. The available source data is shown separately.'};
  }
  return {tone: 'withheld', message: 'AI commentary withheld: the response failed the required format or consistency checks. The available source data is shown separately.'};
}
