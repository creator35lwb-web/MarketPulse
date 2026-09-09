import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { validateDashboardData, validateDashboardFile } from '../.github/scripts/validate-dashboard-data.mjs';
import { approvedPayload, withheldPayload, VALIDATION_NOW as now } from './dashboard-contract-fixtures.mjs';
import { historicalGzipBase64 } from './dashboard-contract-historical-fixtures.mjs';
import { pipeline, validAnalysis, FIXTURE_NOW } from './helpers/n8n.mjs';

const script = fileURLToPath(new URL('../.github/scripts/validate-dashboard-data.mjs', import.meta.url));
const historicalBytes = edition => gunzipSync(Buffer.from(historicalGzipBase64[edition], 'base64'));
function cliFixture(t, writeSnapshots = true) {
  const dir = mkdtempSync(join(tmpdir(), 'marketpulse-contract-'));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(dir).startsWith('marketpulse-contract-'));
    rmSync(dir, { recursive: true, force: true });
  });
  mkdirSync(join(dir, 'docs', 'data'), { recursive: true });
  if (writeSnapshots) for (const edition of ['us', 'cn']) writeFileSync(join(dir, 'docs', 'data', `latest-${edition}.json`), historicalBytes(edition));
  return dir;
}
function accepted(data, edition = data.edition) {
  const result = validateDashboardData(data, { edition, now });
  assert.equal(result.ok, true, result.errors.join('\n'));
}
function rejected(data, message) {
  const result = validateDashboardData(data, { edition: 'US', now });
  assert.equal(result.ok, false, message);
  assert.ok(result.errors.length > 0);
}
function mutation(name, change) {
  test(name, () => { const data = approvedPayload(); change(data); rejected(data, name); });
}

test('approved US and CN payloads validate without network or side effects', () => {
  accepted(approvedPayload()); accepted(approvedPayload('CN'));
});
test('withheld payload keeps source data and contains no model prose', () => accepted(withheldPayload()));
test('degraded macro-only data cannot replace the last available market snapshot', () => {
  const data = withheldPayload(); data.health.status = 'DEGRADED'; data.screener = []; rejected(data);
});
test('stale schema-v2 data remains renderable; freshness is a separate visible property', () => {
  const data = approvedPayload(); data.generatedAt = '2026-08-01T01:00:00.000Z'; accepted(data);
});
test('headline identity is the explicit key, even when earlier source items are absent', () => {
  const data = approvedPayload(); data.analysis.claims[0].basedOn = ['headline_2']; accepted(data);
});
test('a fetched headline remains citable when its optional source link is unavailable', () => {
  const data = approvedPayload(); data.news[0].url = null; data.analysis.claims[0].basedOn = ['headline_2']; accepted(data);
});
test('missing optional source labels and periods do not reject available values', () => {
  const data = approvedPayload();
  data.dashboard.fearGreedValue = { title: 'Fear & Greed', status: '', emoji: '', value: 64 };
  data.economic = [{ label: 'GDP', factKey: 'gdpValue', value: '+1.5%', period: '' }];
  data.facts.gdpValue = '+1.5%'; accepted(data);
});
test('withheld model and provider attribution may be explicitly null', () => {
  const data = withheldPayload(); data.analysisModel = null; data.analysisProvider = null; accepted(data);
});
for (const edition of ['US', 'CN']) {
  test(`${edition} actual Prepare output validates through the public contract`, () => {
    const { payload } = pipeline(edition, validAnalysis(edition));
    assert.ok(payload);
    const result = validateDashboardData(payload, { edition, now: Date.parse(FIXTURE_NOW) });
    assert.equal(result.ok, true, result.errors.join('\n'));
  });
  test(`${edition} malformed model output is safely withheld through Prepare and contract`, () => {
    const { payload } = pipeline(edition, { claims: [null] });
    assert.ok(payload); assert.equal(payload.verification.status, 'withheld');
    const result = validateDashboardData(payload, { edition, now: Date.parse(FIXTURE_NOW) });
    assert.equal(result.ok, true, result.errors.join('\n'));
  });
}

for (const value of [null, false, 0, '', [], 'payload']) {
  test(`reject root type ${JSON.stringify(value)} without crashing`, () => rejected(value));
}
for (const field of ['health', 'facts', 'dashboard', 'analysis', 'verification']) {
  for (const value of [null, [], '', 1]) mutation(`reject ${field}=${JSON.stringify(value)}`, d => { d[field] = value; });
}
for (const field of ['screener', 'economic', 'news', 'sources']) {
  for (const value of [null, {}, '', 1]) mutation(`reject array ${field}=${JSON.stringify(value)}`, d => { d[field] = value; });
}
mutation('new schema is required', d => { delete d.schemaVersion; });
mutation('old version cannot assert approval', d => { d.schemaVersion = 1; });
mutation('edition matches expected filename', d => { d.edition = 'CN'; });
mutation('generatedAt is required', d => { d.generatedAt = null; });
mutation('generatedAt must have explicit UTC timezone', d => { d.generatedAt = '2026-09-10T01:00:00'; });
mutation('impossible calendar timestamps are rejected', d => { d.generatedAt = '2026-02-31T01:00:00.000Z'; });
mutation('future payload timestamps are rejected', d => { d.generatedAt = '2026-09-10T01:05:00.001Z'; });
mutation('empty facts cannot pass', d => { d.facts = {}; });
mutation('empty healthy screener cannot pass', d => { d.screener = []; });
mutation('missing economic fact is not citable through row key existence', d => {
  d.economic = [{ label: 'GDP', factKey: 'gdpValue', value: 'N/A' }]; d.analysis.claims[0].basedOn = ['gdpValue'];
});
mutation('dashboard property without a usable fact is not citable', d => {
  d.dashboard.fakeValue = { title: 'Fake', value: 'N/A', status: 'Unknown', emoji: 'x' };
  d.analysis.claims[0].basedOn = ['fakeValue'];
});
for (const value of [null, false, {}, [], '', 'N/A', 'NaN', 'Infinity', '1e999', Infinity, NaN]) {
  mutation(`unavailable citation value ${String(value)} cannot pass`, d => { d.facts.sp500Change = value; });
}
mutation('displayed screener change must equal fact value', d => { d.screener[0].change = '+99%'; });
mutation('displayed market level must equal its base fact value', d => { d.screener[0].value = '999.00'; });
mutation('displayed market level requires its base fact', d => { delete d.facts.sp500; });
mutation('a market row cannot disguise its level as a change fact', d => { d.screener[0].factKey = 'sp500'; d.screener[0].change = d.facts.sp500; });
mutation('Fear & Greed score must agree with its published source fact', d => { d.fearGreed = { score: 99, classification: 'Extreme Greed' }; });
mutation('optional source period still requires a string type', d => { d.economic = [{ label: 'GDP', factKey: 'gdpValue', value: 1.5, period: {} }]; d.facts.gdpValue = 1.5; });
mutation('health arrays are typed', d => { d.health.missing = null; });
mutation('outage cannot approve AI analysis', d => { d.health.status = 'OUTAGE'; });
mutation('headlines cannot bypass evidence resolution', d => { d.analysis.claims[0].basedOn = ['headline_999']; });
mutation('array offset cannot substitute for stable headline identity', d => { d.analysis.claims[0].basedOn = ['headline_1']; });
mutation('headline needs a title', d => { d.news[0].title = ''; d.analysis.claims[0].basedOn = ['headline_2']; });
mutation('unavailable source URL must use explicit null', d => { d.news[0].url = ''; d.analysis.claims[0].basedOn = ['headline_2']; });
mutation('headline URLs cannot run script', d => { d.news[0].url = 'javascript:alert(1)'; });
mutation('headline URLs cannot contain credentials', d => { d.news[0].url = 'https://user:password@example.com/report'; });
mutation('duplicate headline keys are rejected', d => { d.news.push({ ...d.news[0] }); });
mutation('headline keys cannot be forged as numeric facts', d => { d.facts.headline_999 = 1; d.analysis.claims[0].basedOn = ['headline_999']; });
mutation('verification schema requires every field', d => { delete d.verification.checkedClaims; });
mutation('unexpected approval metadata is rejected', d => { d.verification.approved = true; });
mutation('ambiguous verification status is rejected', d => { d.verification.status = 'PASS'; });
mutation('unversioned approval metadata is rejected', d => { d.verification.version = 2; });
mutation('claim count must equal checked count', d => { d.verification.checkedClaims = 0; });
mutation('approved analysis cannot carry rejection reasons', d => { d.verification.reasonCodes = ['SCHEMA_INVALID']; });
mutation('unstructured analysis is rejected', d => { d.analysis = 'Markets rose sharply.'; });
mutation('null claim is rejected without crashing', d => { d.analysis.claims = [null]; });
mutation('claims is a real array', d => { d.analysis.claims = { 0: d.analysis.claims[0] }; });
mutation('zero claims cannot be approved', d => { d.analysis.claims = []; d.verification.checkedClaims = 0; });
mutation('seventh claim is rejected instead of bypassing verification', d => {
  d.analysis.claims = Array.from({ length: 7 }, () => structuredClone(d.analysis.claims[0]));
  d.analysis.claims[6].text = 'Invented value is 999.'; d.verification.checkedClaims = 6;
});
mutation('unexpected analysis fields are rejected', d => { d.analysis.raw = 'unguarded text'; });
mutation('unexpected claim fields are rejected', d => { d.analysis.claims[0].raw = 'unguarded text'; });
mutation('sentiment must be a strict enum', d => { d.analysis.sentiment = 'Bullish 999'; });
mutation('confidence must be a strict enum', d => { d.analysis.confidence = 100; });
mutation('direction must be a strict enum', d => { d.analysis.claims[0].direction = 'Buy'; });
mutation('sentiment and cited directions cannot directly conflict', d => { d.analysis.sentiment = 'Bearish'; });
mutation('citation list cannot be a string', d => { d.analysis.claims[0].basedOn = 'sp500Change'; });
mutation('citations cannot be empty', d => { d.analysis.claims[0].basedOn = []; });
mutation('citation object is rejected without coercion', d => { d.analysis.claims[0].basedOn = [{}]; });
mutation('duplicate citations are rejected', d => { d.analysis.claims[0].basedOn = ['sp500Change', 'sp500Change']; });
mutation('prototype properties never count as citations', d => { d.analysis.claims[0].basedOn = ['constructor']; });
for (const field of ['interpretation', 'wisdom']) {
  for (const value of ['Market rose 999%.', 'Market rose ９９９%.', 'Market rose nine hundred percent.']) {
    mutation(`reject numeric ${field}: ${value}`, d => { d.analysis[field] = value; });
  }
}
mutation('digit prose in a cited claim is rejected', d => { d.analysis.claims[0].text = 'Market rose 999%.'; });
mutation('spelled numeric prose in a cited claim is rejected', d => { d.analysis.claims[0].text = 'Market rose nine hundred percent.'; });
test('withheld metadata cannot conceal populated analysis', () => {
  const data = withheldPayload(); data.analysis.wisdom = 'Unverified leaked text'; rejected(data);
});
test('withheld must explain why no analysis is published', () => {
  const data = withheldPayload(); data.verification.reasonCodes = []; rejected(data);
});
test('withheld reason codes are typed', () => {
  const data = withheldPayload(); data.verification.reasonCodes = [null]; rejected(data);
});
test('withheld output cannot keep model attribution suggesting published analysis', () => {
  const data = withheldPayload(); data.analysisModel = 'unverified-model'; rejected(data);
});

for (const edition of ['us', 'cn']) {
  const filename = `docs/data/latest-${edition}.json`;
  test(`legacy ${edition} only passes exact frozen allowlist explicitly`, () => {
    const bytes = historicalBytes(edition);
    assert.equal(validateDashboardFile(bytes, filename).ok, false);
    const result = validateDashboardFile(bytes, filename, { allowHistorical: true });
    assert.equal(result.ok, true); assert.equal(result.mode, 'historical');
    assert.match(result.warnings[0], /archived\/unverified/);
    const windowsBytes = Buffer.from(bytes.toString().replaceAll('\n', '\r\n'));
    assert.equal(validateDashboardFile(windowsBytes, filename, { allowHistorical: true }).ok, true);
    assert.equal(validateDashboardFile(Buffer.concat([bytes, Buffer.from(' ')]), filename, { allowHistorical: true }).ok, false);
    const modified = JSON.parse(bytes); modified.analysis.sentiment = 'Bullish 999';
    assert.equal(validateDashboardFile(JSON.stringify(modified), filename, { allowHistorical: true }).ok, false);
    const otherFile = `docs/data/latest-${edition === 'us' ? 'cn' : 'us'}.json`;
    assert.equal(validateDashboardFile(bytes, otherFile, { allowHistorical: true }).ok, false);
  });
}
test('new schema-less files never inherit legacy approval', () => {
  const data = approvedPayload(); delete data.schemaVersion;
  assert.equal(validateDashboardFile(JSON.stringify(data), 'latest-us.json', { allowHistorical: true, now }).ok, false);
});
test('new schema-v2 file path validates edition independently', () => {
  const raw = JSON.stringify(approvedPayload());
  assert.equal(validateDashboardFile(raw, 'latest-us.json', { now }).ok, true);
  assert.equal(validateDashboardFile(raw, 'latest-cn.json', { now }).ok, false);
});
test('malformed JSON and unexpected filenames fail cleanly', () => {
  assert.equal(validateDashboardFile('{', 'latest-us.json').ok, false);
  assert.equal(validateDashboardFile('{}', 'anything.json').ok, false);
});
test('CLI explicit historical mode preserves recovery without asserting approval', t => {
  const run = spawnSync(process.execPath, [script, '--allow-historical'], { cwd: cliFixture(t), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /archived\/unverified/);
  assert.doesNotMatch(run.stdout, /contract accepted/);
});
test('CLI default refuses legacy data and missing required files', t => {
  const run = spawnSync(process.execPath, [script], { cwd: cliFixture(t), encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /schemaVersion/);
  const missing = spawnSync(process.execPath, [script], { cwd: cliFixture(t, false), encoding: 'utf8' });
  assert.equal(missing.status, 1); assert.match(missing.stderr, /missing/);
});
