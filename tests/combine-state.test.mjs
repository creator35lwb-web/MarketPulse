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
      marketTime: data[benchmark + 'MarketTime'] - 86400, claims: [], ...extra }] },
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
