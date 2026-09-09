/** Minimal schema-v2 examples reusable by producer and publication tests. */
export function approvedPayload(edition = 'US') {
  const key = edition === 'US' ? 'sp500Change' : 'csi300Change';
  return {
    schemaVersion: 2,
    edition,
    generatedAt: '2026-09-10T01:00:00.000Z',
    dateLabel: 'Thursday, September 10, 2026',
    health: { status: 'OK', missing: [], suspect: [] },
    dashboard: {},
    facts: { [key.slice(0, -6)]: '7757.64', [key]: '+0.62%', fearGreedValue: 64 },
    screener: [{ label: edition === 'US' ? 'S&P 500' : 'CSI 300', factKey: key, value: '7757.64', change: '+0.62%' }],
    economic: [],
    news: [{ factKey: 'headline_2', title: 'A publisher reports improving market breadth', url: 'https://example.com/report' }],
    sources: ['Example market feed'],
    analysis: {
      sentiment: 'Bullish', confidence: 'Medium',
      claims: [{ text: 'Market breadth points toward strength.', basedOn: [key], direction: 'supports_bullish' }],
      interpretation: 'The source data supports a constructive assessment.',
      wisdom: 'Preserve a margin of safety.',
    },
    verification: { version: 1, status: 'approved', checkedClaims: 1, reasonCodes: [] },
  };
}

export function withheldPayload(edition = 'US') {
  const data = approvedPayload(edition);
  data.analysis = { sentiment: 'Unavailable', confidence: '', claims: [], interpretation: '', wisdom: '' };
  data.verification = { version: 1, status: 'withheld', checkedClaims: 0, reasonCodes: ['APPROVAL_MISSING'] };
  return data;
}

export const VALIDATION_NOW = Date.parse('2026-09-10T01:00:00.000Z');
