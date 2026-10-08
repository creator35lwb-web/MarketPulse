import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import MP_PHASE from '../src/n8n/record-phase.js';
import {validateDashboardData} from '../.github/scripts/validate-dashboard-data.mjs';
import {EDITIONS, RECORD_FIELDS, isPreBeta, readArchive, recordOf, renderPage} from '../scripts/archive-pre-beta.mjs';
import {runNode, groundTruth, validAnalysis, pipeline} from './helpers/n8n.mjs';

// W25: the public record restarts as a beta when the launch bundle goes live. Calls and grades
// written by the current code carry the phase; older entries are kept but never shown or graded.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const at = iso => Date.parse(iso) / 1000;
const clockAt = iso => class extends Date {
  constructor(...args) { super(...(args.length ? args : [iso])); }
  static now() { return Date.parse(iso); }
};
const preBetaCall = (date, marketTime) => ({date, sentiment: 'Cautiously Bearish', confidence: 'High', verdict: 'PASS', marketTime, claims: []});
const preBetaGrade = (priorDate, actualChange, result) =>
  ({priorDate, scoredDate: priorDate, priorSentiment: 'Cautiously Bearish', actualChange, result, band: 0.25});

test('the phase marks entries and names dates in the style the posts use', () => {
  assert.equal(MP_PHASE.CURRENT, 'beta');
  assert.equal(MP_PHASE.current({phase: 'beta'}), true);
  assert.equal(MP_PHASE.current({}), false);
  assert.equal(MP_PHASE.current(null), false);
  assert.equal(MP_PHASE.dateLabel('2026-10-12'), 'Oct 12, 2026');
  for (const bad of ['', null, '2026-13-01', '12 Oct 2026', '2026-10-12T00:00:00Z']) assert.equal(MP_PHASE.dateLabel(bad), '');
});

test('deploy replay: the beta ignores the calls before it, then grades its own first call', () => {
  // Monday Oct 12, 2026: the bundle goes live. The ledger still holds a call from before the beta,
  // and the track record holds grades from before the beta.
  const state = {
    mpLedger: {US: [preBetaCall('2026-10-09', at('2026-10-08T20:00:00Z'))]},
    mpTrackRecord: {US: [preBetaGrade('2026-10-07', '-0.40%', 'hit'), preBetaGrade('2026-10-08', '+0.30%', 'miss')]},
  };
  // 09:00 New York, Mon Oct 12: the run sees Friday's close.
  const mon = {...groundTruth('US'), sp500Change: '-0.80%', sp500MarketTime: at('2026-10-09T20:00:00Z')};
  const combined = runNode('combine-all-data', [{json: mon}], {state, context: {Date: clockAt('2026-10-12T13:00:05Z')}})[0].json;
  assert.equal(state.mpTrackRecord.US.length, 2, 'the call from before the beta is not graded');
  assert.equal(combined.previousAnalysis, 'No prior analysis available.');
  assert.equal(combined.trackRecordAccuracy, 'Building history', 'grades from before the beta are not shown');
  assert.equal(combined.trackRecordSince, '');
  const first = pipeline('US', validAnalysis('US'), {data: combined, state, context: {Date: clockAt('2026-10-12T13:00:10Z')}});
  assert.equal(state.mpLedger.US.at(-1).date, '2026-10-12');
  assert.equal(state.mpLedger.US.at(-1).phase, 'beta', 'the first beta call carries the phase');
  assert.match(first.message, /<i>The beta record starts once its first call is graded\. Short-term reads/);
  assert.deepEqual(first.payload.history, [{date: '2026-10-12', sentiment: 'Bearish', verdict: 'PASS', result: null, actualChange: null}]);
  assert.equal(first.payload.trackRecord.phase, 'beta');
  assert.equal(first.payload.trackRecord.since, '');

  // 09:00 New York, Tue Oct 13: Monday's close grades the beta's first call.
  const tue = {...groundTruth('US'), sp500Change: '-0.60%', sp500MarketTime: at('2026-10-12T20:00:00Z')};
  const next = runNode('combine-all-data', [{json: tue}], {state, context: {Date: clockAt('2026-10-13T13:00:05Z')}})[0].json;
  const grade = state.mpTrackRecord.US.at(-1);
  assert.equal(state.mpTrackRecord.US.length, 3);
  assert.deepEqual([grade.priorDate, grade.session, grade.result, grade.phase], ['2026-10-12', '2026-10-12', 'hit', 'beta']);
  assert.equal(next.trackRecordAccuracy, '1/1 (100%)');
  assert.equal(next.trackRecordBaseline, 'the market fell on that day');
  assert.equal(next.trackRecordSince, '2026-10-12');
  assert.match(next.previousAnalysis, /^On 2026-10-12 your sentiment was Bearish/);
  const second = pipeline('US', validAnalysis('US'), {data: next, state, context: {Date: clockAt('2026-10-13T13:00:10Z')}});
  assert.match(second.message, /🎯 <b>TRACK RECORD<\/b> <code>1\/1 \(100%\)<\/code>/);
  assert.match(second.message, /<i>Beta record since Oct 12, 2026\. Short-term reads are graded automatically/);
  assert.equal(second.payload.trackRecord.since, '2026-10-12');
  assert.deepEqual(second.payload.history.map(h => [h.date, h.result]), [['2026-10-12', 'hit'], ['2026-10-13', null]]);
  assert.equal(validateDashboardData(second.payload, {edition: 'US', now: Date.parse('2026-10-13T13:05:00Z')}).ok, true);
});

test('both editions label every post as the beta', () => {
  for (const edition of ['US', 'CN']) {
    const r = pipeline(edition, validAnalysis(edition));
    assert.match(r.message, new RegExp('^📊 <b>MarketPulse</b> · ' + (edition === 'US' ? 'US' : 'China') + ' Daily Brief · <i>Beta</i>\\n'));
    assert.equal(r.state.mpLedger[edition][0].phase, 'beta');
  }
});

test('the weekly report restates the beta record only', () => {
  // The fixture clock is 2026-09-10 20:00 in Malaysia, so the week runs Sep 3 to Sep 9.
  const old = {mpLedger: {US: [preBetaCall('2026-09-04', 1)], CN: []}, mpTrackRecord: {US: [preBetaGrade('2026-09-04', '-1.00%', 'hit')], CN: []}};
  const message = runNode('compose-weekly-report', [], {state: old})[0].json.message;
  assert.match(message, /^📅 <b>MarketPulse Weekly — Sep 3–9, 2026<\/b> · <i>Beta<\/i>/);
  assert.match(message, /🇺🇸 <b>US edition<\/b>\nNo calls on the beta record this week\./);
  assert.doesNotMatch(message, /Calls made|All-time/);
});

test('the dashboard contract accepts the phase and start date, and rejects anything else', () => {
  const r = pipeline('US', validAnalysis('US'));
  const now = Date.parse('2026-09-10T12:05:00Z');
  assert.equal(validateDashboardData(r.payload, {edition: 'US', now}).ok, true);
  for (const [field, bad] of [['phase', 'alpha'], ['phase', 1], ['since', '12 Oct'], ['since', '2026-02-30x'], ['since', null]]) {
    const payload = structuredClone(r.payload); payload.trackRecord[field] = bad;
    assert.equal(validateDashboardData(payload, {edition: 'US', now}).ok, false, field + ' = ' + JSON.stringify(bad));
  }
  const old = structuredClone(r.payload); delete old.trackRecord.phase; delete old.trackRecord.since;
  assert.equal(validateDashboardData(old, {edition: 'US', now}).ok, true, 'payloads from before the beta stay valid');
});

test('the dashboard shows the beta tag and links the archived record only for beta data', () => {
  const html = read('docs/index.html');
  assert.match(html, /<span class="beta-tag" aria-hidden="true" hidden>Beta<\/span>/);
  assert.match(html, /<p class="phase-note" hidden><\/p>/);
  const app = read('docs/app.js');
  const archive = /var ARCHIVE_URL = '([^']+)';/.exec(app);
  assert.ok(archive && existsSync(new URL('../docs/' + archive[1], import.meta.url)), 'the archive link resolves');
  assert.match(app, /if \(data\.trackRecord\.phase === 'beta'\) \{/);
});

test('the archive page is rebuilt exactly from the record of the last publication before the beta', () => {
  const {page, archives} = readArchive();
  assert.equal(renderPage(archives), page, 'run node scripts/archive-pre-beta.mjs');
  assert.deepEqual(archives.map(a => a.key), EDITIONS.map(e => e.key));
  for (const a of archives) {
    assert.match(a.commit, /^[0-9a-f]{40}$/);
    assert.ok(isPreBeta(a.data), a.key + ' is from before the beta');
    assert.deepEqual(Object.keys(a.data), RECORD_FIELDS, a.key + ' keeps the record and nothing else');
    assert.ok(Array.isArray(a.data.history) && a.data.history.length > 0);
    assert.ok(page.includes(a.data.trackRecord.accuracy), a.key + ' figure shown as published');
    assert.equal((page.match(new RegExp('<tr><td>\\d{4}-\\d{2}-\\d{2}</td>', 'g')) || []).length,
      archives.reduce((n, x) => n + x.data.history.length, 0), 'one row per published call');
  }
  assert.equal(isPreBeta({trackRecord: {accuracy: 'x', last: '', phase: 'beta'}}), false);
  assert.deepEqual(recordOf({edition: 'US', news: [], trackRecord: {accuracy: 'x', last: ''}}), {edition: 'US', trackRecord: {accuracy: 'x', last: ''}});
});

test('every node that reads or writes the record carries the phase module', () => {
  const sources = JSON.parse(read('scripts/node-sources.json'));
  const nodes = ['Combine All Data', 'Combine All Data1', 'Verify AI Analysis', 'Verify AI Analysis1', 'Prepare Dashboard Data',
    'Prepare Dashboard Data1', 'Compose Telegram Message', 'Compose Telegram Message1', 'Compose Weekly Report'];
  for (const name of nodes) assert.ok(sources[name].includes.includes('record-phase.js'), name);
  for (const [name, descriptor] of Object.entries(sources)) {
    const code = read('src/n8n/' + descriptor.file) + (descriptor.includes || []).map(f => read('src/n8n/' + f)).join('\n');
    if (/mpLedger|mpTrackRecord/.test(code)) assert.ok(nodes.includes(name), name + ' touches the record without the phase module');
  }
});
