import test from 'node:test';
import assert from 'node:assert/strict';
import { runNode, groundTruth, FIXTURE_NOW } from './helpers/n8n.mjs';

const today = FIXTURE_NOW.slice(0, 10);
for (const edition of ['US', 'CN']) {
  const node = 'combine-all-data' + (edition === 'CN' ? '1' : '');
  const benchmark = edition === 'CN' ? 'csi300' : 'sp500';
  const run = (data, state = {}) => runNode(node, [{ json: data }], { state })[0].json;
  const priorState = (data, extra = {}) => ({
    mpLedger: { [edition]: [{ date: '2026-09-09', sentiment: 'Bearish', confidence: 'High', verdict: 'PASS',
      marketTime: data[benchmark + 'MarketTime'] - 86400, claims: [], phase: 'beta', ...extra }] },
    mpTrackRecord: { [edition]: [] },
  });

  test(`${edition}: shared combine derives watchlist evidence from fetched stock details`, () => {
    const data = groundTruth(edition); delete data.acmeChange;
    const result = run(data);
    assert.equal(result.acmeChange, '+0.50%');
    assert.equal(result.watchlistFactKeys, 'acmeChange');
    assert.equal(result.gold, data.gold);
    assert.equal(result._health.status, data._health.status);
  });

  test(`${edition}: advanced session scores once and retains a readable outcome on repeated runs`, () => {
    const data = groundTruth(edition); const state = priorState(data);
    const first = run(data, state);
    assert.equal(state.mpTrackRecord[edition].length, 1);
    assert.equal(state.mpTrackRecord[edition][0].result, 'hit');
    assert.equal(state.mpTrackRecord[edition][0].scoredDate, today);
    assert.equal(first.trackRecordAccuracy, '1/1 (100%)');
    assert.match(first.previousAnalysis, /2026-09-09.*Bearish/);
    const repeated = run(data, state);
    assert.equal(state.mpTrackRecord[edition].length, 1);
    assert.equal(repeated.trackRecordAccuracy, first.trackRecordAccuracy);
    assert.equal(repeated.trackRecordLast, first.trackRecordLast);
  });

  test(`${edition}: unchanged session, excessive gap, and missing session do not score`, () => {
    const data = groundTruth(edition);
    for (const override of [{ marketTime: data[benchmark + 'MarketTime'] }, { date: '2026-09-01' }, { marketTime: null }]) {
      const state = priorState(data, override); run(data, state);
      assert.equal(state.mpTrackRecord[edition].length, 0);
    }
  });

  test(`${edition}: valid flat and directional changes preserve the existing scoring band`, () => {
    for (const [change, expected] of [['+0.00%', 'flat'], ['-0.10%', 'flat'], ['+2.00%', 'miss'], ['-2.00%', 'hit']]) {
      const data = groundTruth(edition); data[benchmark + 'Change'] = change;
      const state = priorState(data); run(data, state);
      assert.equal(state.mpTrackRecord[edition][0].result, expected);
      assert.equal(state.mpTrackRecord[edition][0].actualChange, change);
    }
  });

  test(`${edition}: a verdict-less trailing record does not hide the previous stated sentiment`, () => {
    const data = groundTruth(edition); const state = priorState(data);
    state.mpLedger[edition].push({ date: today, sentiment: null, marketTime: null });
    const result = run(data, state);
    assert.match(result.previousAnalysis, /2026-09-09.*Bearish/);
    assert.equal(state.mpTrackRecord[edition][0].priorDate, '2026-09-09');
  });

  test(`${edition}: missing source health becomes an outage`, () => {
    const data = groundTruth(edition); delete data._health;
    const result = run(data);
    assert.equal(result._health.status, 'OUTAGE');
    assert.equal(result._health.missing[0], 'ALL');
  });
}

// ===== W3: one grade per call and per session, closed sessions only =====
// Session times are the exchange's own last-trade timestamps, in seconds; clocks are the run times.
const at = iso => Date.parse(iso) / 1000;
const clockAt = iso => class extends Date {
  constructor(...args) { super(...(args.length ? args : [iso])); }
  static now() { return Date.parse(iso); }
};
const runAt = (node, state, now, data) => runNode(node, [{ json: data }], { state, context: { Date: clockAt(now) } })[0].json;
// Calls written by the current code carry the beta phase (W25); tests/beta-record.test.mjs covers older calls.
const call = (date, marketTime) => ({ date, sentiment: 'Cautiously Bearish', confidence: 'High', verdict: 'PASS', marketTime, claims: [], phase: 'beta' });

test('US replay of 2026-10-03 to 10-08: the Oct 3 call is graded once, on the Monday close, never on a late wake', () => {
  // The AI layer was down from Oct 4 to Oct 6, so no newer call was written.
  const state = { mpLedger: { US: [call('2026-10-03', at('2026-10-02T20:00:00Z'))] }, mpTrackRecord: { US: [] } };
  // Tue Oct 6, 09:00 New York: the Monday close.
  runAt('combine-all-data', state, '2026-10-06T13:00:05Z', { ...groundTruth('US'), sp500Change: '+0.66%', sp500MarketTime: at('2026-10-05T20:00:00Z') });
  const tr = state.mpTrackRecord.US;
  assert.equal(tr.length, 1);
  assert.equal(tr[0].result, 'miss');
  assert.equal(tr[0].session, '2026-10-05');
  assert.equal(tr[0].priorSession, '2026-10-02');
  // Wed Oct 7, 09:39 New York: the laptop woke 39 minutes late, nine minutes into trading.
  runAt('combine-all-data', state, '2026-10-07T13:39:14Z', { ...groundTruth('US'), sp500Change: '-0.62%', sp500MarketTime: at('2026-10-07T13:39:00Z') });
  assert.equal(tr.length, 1, 'a partial move does not grade, and the call is already graded');
  // Thu Oct 8, 09:00 New York: the Wednesday close, still with no newer call.
  runAt('combine-all-data', state, '2026-10-08T13:00:05Z', { ...groundTruth('US'), sp500Change: '-0.40%', sp500MarketTime: at('2026-10-07T20:00:00Z') });
  assert.equal(tr.length, 1, 'a call is graded once');
});

test('a run during trading waits for the close, for both exchanges', () => {
  for (const [edition, node, key, prior, open, closeRun, close] of [
    ['US', 'combine-all-data', 'sp500', '2026-09-08T20:00:00Z', ['2026-09-09T14:05:00Z', '2026-09-09T14:04:00Z'], '2026-09-10T13:00:00Z', '2026-09-09T20:00:00Z'],
    ['CN', 'combine-all-data1', 'csi300', '2026-09-08T07:00:00Z', ['2026-09-09T03:00:00Z', '2026-09-09T02:59:00Z'], '2026-09-09T08:30:00Z', '2026-09-09T07:00:00Z'],
  ]) {
    const state = { mpLedger: { [edition]: [call('2026-09-08', at(prior))] }, mpTrackRecord: { [edition]: [] } };
    runAt(node, state, open[0], { ...groundTruth(edition), [key + 'Change']: '-1.00%', [key + 'MarketTime']: at(open[1]) });
    assert.equal(state.mpTrackRecord[edition].length, 0, edition + ': no grade while the session trades');
    runAt(node, state, closeRun, { ...groundTruth(edition), [key + 'Change']: '-1.20%', [key + 'MarketTime']: at(close) });
    assert.equal(state.mpTrackRecord[edition].length, 1, edition + ': graded on the close');
    assert.equal(state.mpTrackRecord[edition][0].actualChange, '-1.20%');
  }
});

test('a session grades one call, including sessions graded before the session field and the beta existed', () => {
  // An older entry, without a session field or a phase, already graded the Sep 9 close.
  const state = {
    mpLedger: { US: [call('2026-09-09', at('2026-09-08T20:00:00Z'))] },
    mpTrackRecord: { US: [{ priorDate: '2026-09-08', scoredDate: '2026-09-09', priorSentiment: 'Bearish', actualChange: '-1.00%', result: 'hit', marketTime: at('2026-09-09T20:00:00Z'), band: 0.25 }] },
  };
  const result = runAt('combine-all-data', state, '2026-09-10T13:00:00Z', { ...groundTruth('US'), sp500Change: '-1.00%', sp500MarketTime: at('2026-09-09T20:00:00Z') });
  assert.equal(state.mpTrackRecord.US.length, 1);
  assert.equal(result.trackRecordAccuracy, 'Building history', 'a grade from before the beta blocks the session but is not shown');
});
