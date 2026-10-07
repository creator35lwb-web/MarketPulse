import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDashboardData} from '../.github/scripts/validate-dashboard-data.mjs';
import {runNode, groundTruth, validAnalysis, pipeline} from './helpers/n8n.mjs';

// W4: beside the hit rate, how often the market fell on the same judged days. A call that never
// changes scores exactly that share, so the hit rate alone flatters it.
const entry = (priorDate, actualChange, result, scoredDate = priorDate) =>
  ({priorDate, scoredDate, priorSentiment:'Cautiously Bearish', actualChange, result, band:0.25});
const combine = (edition, tr) =>
  runNode('combine-all-data' + (edition === 'CN' ? '1' : ''), [{json:groundTruth(edition)}], {state:{mpLedger:{[edition]:[]}, mpTrackRecord:{[edition]:tr}}})[0].json;

test('the base rate counts the judged days only, beside the same hit rate', () => {
  for (const edition of ['US', 'CN']) {
    const r = combine(edition, [entry('2026-09-01', '-1.00%', 'hit'), entry('2026-09-02', '+0.50%', 'miss'),
      entry('2026-09-03', '+0.10%', 'flat'), entry('2026-09-04', '-0.30%', 'hit')]);
    assert.equal(r.trackRecordAccuracy, '2/3 (67%) · 1 too flat to judge');
    assert.equal(r.trackRecordBaseline, 'the market fell on 2 of those 3 days');
  }
  assert.equal(combine('US', [entry('2026-09-01', '+0.40%', 'miss')]).trackRecordBaseline, 'the market did not fall on that day');
  assert.equal(combine('US', [entry('2026-09-01', '-0.40%', 'hit')]).trackRecordBaseline, 'the market fell on that day');
  assert.equal(combine('US', [entry('2026-09-01', '+0.10%', 'flat')]).trackRecordBaseline, '', 'no judged day, no comparison');
  assert.equal(combine('US', []).trackRecordBaseline, '');
});

test('Telegram and the dashboard both show the comparison, and the contract accepts it', () => {
  for (const edition of ['US', 'CN']) {
    const data = {...groundTruth(edition), trackRecordAccuracy:'2/3 (67%)', trackRecordBaseline:'the market fell on 2 of those 3 days'};
    const r = pipeline(edition, validAnalysis(edition), {data});
    assert.match(r.message, /🎯 <b>TRACK RECORD<\/b> <code>2\/3 \(67%\)<\/code>\n<i>For comparison, the market fell on 2 of those 3 days\.<\/i>/);
    assert.equal(r.payload.trackRecord.baseline, 'the market fell on 2 of those 3 days');
    const now = Date.parse('2026-09-10T12:05:00Z');
    assert.equal(validateDashboardData(r.payload, {edition, now}).ok, true);
    for (const bad of [42, 'x'.repeat(201)]) {
      const payload = structuredClone(r.payload); payload.trackRecord.baseline = bad;
      assert.equal(validateDashboardData(payload, {edition, now}).ok, false);
    }
    const old = structuredClone(r.payload); delete old.trackRecord.baseline;
    assert.equal(validateDashboardData(old, {edition, now}).ok, true, 'payloads from before W4 stay valid');
  }
  const none = pipeline('US', validAnalysis('US'));
  assert.doesNotMatch(none.message, /For comparison/);
  assert.equal(none.payload.trackRecord.baseline, '');
});

test('the weekly report gives the same comparison for the week and all-time', () => {
  // The fixture clock is 2026-09-10 20:00 in Malaysia, so the week runs Sep 3 to Sep 9.
  const state = {mpLedger:{US:[], CN:[]}, mpTrackRecord:{US:[entry('2026-09-03', '-1.00%', 'hit', '2026-09-04'),
    entry('2026-09-07', '+0.50%', 'miss', '2026-09-08'), entry('2026-08-19', '-0.40%', 'hit', '2026-08-20')], CN:[]}};
  const message = runNode('compose-weekly-report', [], {state})[0].json.message;
  assert.match(message, /<i>For comparison, the market fell on 1 of 2 judged days this week and 2 of 3 all-time\.<\/i>/);
  const quiet = {mpLedger:{US:[], CN:[]}, mpTrackRecord:{US:[entry('2026-08-19', '-0.40%', 'hit', '2026-08-20'),
    entry('2026-09-05', '+0.10%', 'flat', '2026-09-06')], CN:[]}};
  assert.match(runNode('compose-weekly-report', [], {state:quiet})[0].json.message, /For comparison, the market fell on 1 of 1 judged days all-time\./);
});
