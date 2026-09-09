import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  expectedPublicationDate, validPublicationTimestamp, checkEdition, assessDashboardFile,
  issueTitle, parseAlertTitle, planReconciliation, issueBody, resolutionBody,
  listIssues, reconcile, validateTelegram,
} from '../.github/scripts/check-freshness.mjs';
import { approvedPayload, withheldPayload } from './dashboard-contract-fixtures.mjs';
import { historicalGzipBase64 } from './dashboard-contract-historical-fixtures.mjs';
import { gunzipSync } from 'node:zlib';

const at = (value) => new Date(value);
const payload = (edition, generatedAt) => ({ edition, generatedAt });
const botIssue = (number, label, date, state = 'open', legacy = false) => ({
  number, title: legacy ? `⚠️ MarketPulse digest missing — ${label} — ${date}` : issueTitle(label, date),
  state, user: { login: 'github-actions[bot]' },
});

test('US deadline is 14:00 UTC / 22:00 MYT, including delayed checks after UTC midnight', () => {
  assert.equal(expectedPublicationDate('us', at('2026-09-10T21:59:59+08:00')), '2026-09-09');
  assert.equal(expectedPublicationDate('us', at('2026-09-10T22:00:00+08:00')), '2026-09-10');
  assert.equal(expectedPublicationDate('us', at('2026-09-11T00:10:00Z')), '2026-09-10');
  assert.equal(expectedPublicationDate('us', at('2026-09-12T14:00:00Z')), '2026-09-12');
});

test('CN deadline is 09:30 UTC / 17:30 MYT and advances only on weekdays', () => {
  for (const date of ['2026-09-12T12:00:00Z', '2026-09-13T23:59:00Z', '2026-09-14T17:29:59+08:00']) {
    assert.equal(expectedPublicationDate('cn', at(date)), '2026-09-11');
  }
  assert.equal(expectedPublicationDate('cn', at('2026-09-14T17:30:00+08:00')), '2026-09-14');
  assert.equal(expectedPublicationDate('cn', at('2026-09-15T00:05:00Z')), '2026-09-14');
});

test('prior due publication stays fresh before the next deadline and through CN weekends', () => {
  assert.equal(checkEdition('us', payload('US', '2026-09-09T13:01:00Z'), at('2026-09-10T13:59:00Z')).stale, false);
  assert.equal(checkEdition('cn', payload('CN', '2026-09-11T08:31:00Z'), at('2026-09-14T09:29:00Z')).stale, false);
  assert.equal(checkEdition('cn', payload('CN', '2026-09-11T08:31:00Z'), at('2026-09-14T09:30:00Z')).stale, true);
});

test('a current early publication is fresh without inventing a future expectation', () => {
  const result = checkEdition('cn', payload('CN', '2026-09-14T08:31:00Z'), at('2026-09-14T09:00:00Z'));
  assert.equal(result.expectedDate, '2026-09-11');
  assert.equal(result.publishedDate, '2026-09-14');
  assert.equal(result.stale, false);
});

test('timestamps require a real calendar date and explicit zone and reject future values', () => {
  const now = at('2026-09-10T13:00:00Z');
  for (const value of [null, 0, '', '2026-09-10', '2026-09-10T12:59:00', '2026-02-30T12:00:00Z',
    '2026-09-10T24:00:00Z', '2026-09-10T13:00:00.001Z', '2027-01-01T00:00:00Z']) {
    assert.equal(validPublicationTimestamp(value, now), null, String(value));
  }
  assert.equal(validPublicationTimestamp('2026-09-10T20:59:00+08:00', now).toISOString(), '2026-09-10T12:59:00.000Z');
  assert.equal(validPublicationTimestamp('2024-02-29T12:00:00Z', now).toISOString(), '2024-02-29T12:00:00.000Z');
});

test('invalid data, wrong edition, and a CN weekend publication cannot recover an alert', () => {
  const now = at('2026-09-14T14:00:00Z');
  for (const data of [null, {}, payload('US', '2026-09-14T08:30:00Z'), payload('CN', '2026-09-13T08:30:00Z')]) {
    const result = checkEdition('cn', data, now);
    assert.equal(result.valid, false);
    assert.equal(result.stale, true);
    assert.equal(planReconciliation([result], [botIssue(1, 'CN', '2026-09-13')]).close.length, 0);
  }
});

test('recovery requires the publication contract as well as a current timestamp', () => {
  const now = at('2026-09-10T14:00:00Z');
  for (const data of [approvedPayload(), withheldPayload()]) {
    const result = assessDashboardFile('us', Buffer.from(JSON.stringify(data)), now);
    assert.equal(result.valid, true); assert.equal(result.stale, false);
    assert.equal(result.contractMode, 'schema-v2');
    assert.equal(planReconciliation([result], [botIssue(1, 'US', '2026-09-10')]).close.length, 1);
  }
  const invalid = approvedPayload(); invalid.analysis.claims = [];
  for (const raw of [JSON.stringify(invalid), JSON.stringify(payload('US', now.toISOString())), '{', null]) {
    const result = assessDashboardFile('us', raw, now);
    assert.equal(result.valid, false); assert.equal(result.stale, true);
    assert.match(result.reason, /publication contract/);
    assert.equal(planReconciliation([result], [botIssue(1, 'US', '2026-09-10')]).close.length, 0);
  }
});

test('only frozen legacy snapshots remain valid historical observations', () => {
  const now = at('2026-09-10T14:00:00Z');
  const bytes = gunzipSync(Buffer.from(historicalGzipBase64.us, 'base64'));
  const result = assessDashboardFile('us', bytes, now);
  assert.equal(result.valid, true); assert.equal(result.stale, true);
  assert.equal(result.contractMode, 'historical');
  assert.equal(assessDashboardFile('us', Buffer.concat([bytes, Buffer.from(' ')]), now).valid, false);
});

test('matching publication retires only its own bot-owned edition/date, including legacy alerts', () => {
  const result = checkEdition('cn', payload('CN', '2026-09-14T10:00:00Z'), at('2026-09-14T14:00:00Z'));
  const issues = [
    botIssue(1, 'CN', '2026-09-11'), botIssue(2, 'CN', '2026-09-14', 'open', true),
    botIssue(3, 'US', '2026-09-14'),
    { ...botIssue(4, 'CN', '2026-09-14'), user: { login: 'human' } },
    { ...botIssue(5, 'CN', '2026-09-14'), pull_request: {} },
    { ...botIssue(6, 'CN', '2026-09-14'), title: '⚠️ MarketPulse digest missing — US + CN — 2026-09-14' },
  ];
  assert.deepEqual(planReconciliation([result], issues).close.map((x) => x.number), [2]);
});

test('a late older dated update can resolve itself while a newer edition remains stale', () => {
  const result = checkEdition('cn', payload('CN', '2026-09-14T23:50:00Z'), at('2026-09-15T10:00:00Z'));
  const plan = planReconciliation([result], [botIssue(1, 'CN', '2026-09-14')]);
  assert.equal(result.stale, true);
  assert.deepEqual(plan.close.map((x) => x.date), ['2026-09-14']);
  assert.deepEqual(plan.create.map((x) => x.expectedDate), ['2026-09-15']);
});

test('repeated checks and operator-acknowledged closed alerts do not create duplicate same-date issues', () => {
  const result = checkEdition('us', payload('US', '2026-08-09T13:00:00Z'), at('2026-09-10T14:00:00Z'));
  for (const state of ['open', 'closed']) {
    assert.equal(planReconciliation([result], [botIssue(1, 'US', '2026-09-10', state, true)]).create.length, 0);
  }
  assert.equal(planReconciliation([result], [botIssue(1, 'US', '2026-09-09')]).create.length, 1);
});

test('title parsing is exact and cannot confuse partial dates or combined editions', () => {
  assert.deepEqual(parseAlertTitle(issueTitle('US', '2026-09-10')), { label: 'US', date: '2026-09-10' });
  assert.equal(parseAlertTitle(issueTitle('US', '2026-09-10') + ' extra'), null);
  assert.equal(parseAlertTitle('⚠️ MarketPulse digest missing — US + CN — 2026-09-10'), null);
});

test('issue text distinguishes repository publication from host, Telegram, and website health', () => {
  const result = checkEdition('us', null, at('2026-09-10T14:00:00Z'));
  assert.match(issueBody(result), /does not establish host availability, Telegram delivery/);
  assert.doesNotMatch(issueBody(result), /host.*is offline|No stale data was sent|next scheduled run/);
  assert.doesNotMatch(resolutionBody({ label: 'US', date: '2026-09-10', generatedAt: '2026-09-10T14:30:00Z' }), /host.*offline|Nothing stale/);
});

test('issue pagination includes matching alerts beyond the former 30/100 issue limits', async () => {
  const first = Array.from({ length: 100 }, (_, i) => botIssue(i + 1, 'US', '2026-01-01'));
  const old = botIssue(101, 'US', '2026-09-10');
  const calls = [];
  const found = await listIssues('owner/repo', 'offline-token', async (url) => {
    calls.push(url);
    return Response.json(url.endsWith('page=1') ? first : [old]);
  });
  const result = checkEdition('us', payload('US', '2026-08-09T13:00:00Z'), at('2026-09-10T14:00:00Z'));
  assert.equal(found.length, 101);
  assert.equal(calls.length, 2);
  assert.equal(planReconciliation([result], found).create.length, 0);
});

test('reconciliation creates once, uses structured bodies, and only sends factual new-event notices', async () => {
  const issues = [];
  const calls = [];
  const mockFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('api.telegram.org')) return Response.json({ ok: true });
    if (options.method === 'GET') return Response.json(issues);
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    const issue = { ...botIssue(1, 'US', '2026-09-10'), ...body };
    issues.push(issue);
    return Response.json(issue, { status: 201 });
  };
  const result = checkEdition('us', payload('US', '2026-08-09T13:00:00Z'), at('2026-09-10T14:00:00Z'));
  const options = { repository: 'owner/repo', githubToken: 'offline-token', telegramToken: 'offline-token', fetchImpl: mockFetch };
  assert.deepEqual(await reconcile([result], options), { created: 1, resolved: 0 });
  assert.deepEqual(await reconcile([result], options), { created: 0, resolved: 0 });
  const messages = calls.filter((call) => call.url.includes('/sendMessage'));
  assert.equal(messages.length, 1);
  assert.match(JSON.parse(messages[0].options.body).text, /does not establish whether a Telegram digest was delivered/);
});

test('reconciliation closes a matching date while preserving older unresolved issues', async () => {
  const issues = [botIssue(1, 'CN', '2026-09-11'), botIssue(2, 'CN', '2026-09-14')];
  issues[1].body = 'Original missing-date observation and operator context.';
  const writes = [];
  const mockFetch = async (url, options) => {
    if (options.method === 'GET') return Response.json(issues);
    writes.push({ url, body: JSON.parse(options.body) });
    return Response.json({});
  };
  const result = checkEdition('cn', payload('CN', '2026-09-14T10:00:00Z'), at('2026-09-14T14:00:00Z'));
  assert.deepEqual(await reconcile([result], { repository: 'owner/repo', githubToken: 'offline-token', fetchImpl: mockFetch }),
    { created: 0, resolved: 1 });
  assert.ok(writes.every((write) => write.url.includes('/issues/2')));
  assert.equal(writes.length, 1, 'recovery evidence and closure must be committed atomically');
  assert.equal(writes[0].body.state, 'closed');
  assert.match(writes[0].body.body, /^Original missing-date observation and operator context\./);
  assert.match(writes[0].body.body, /Recorded publication timestamp: 2026-09-14T10:00:00.000Z/);
});

test('Telegram validation performs only read-access calls and no sends', async () => {
  const methods = [];
  await validateTelegram('offline-token', async (url) => {
    methods.push(url.split('/').at(-1));
    return Response.json({ ok: true });
  });
  assert.deepEqual(methods, ['getMe', 'getChat']);
});

test('CLI dry-run makes no writes and privileged reconciliation rejects untrusted events', () => {
  const script = fileURLToPath(new URL('../.github/scripts/check-freshness.mjs', import.meta.url));
  const base = { ...process.env, GITHUB_EVENT_NAME: 'pull_request_target', GITHUB_REF: 'refs/heads/main',
    GH_TOKEN: 'offline-token', TG_TOKEN: '', FRESHNESS_VALIDATE_TELEGRAM: 'false' };
  const dry = spawnSync(process.execPath, [script, '--reconcile'], {
    encoding: 'utf8', env: { ...base, FRESHNESS_DRY_RUN: 'true' },
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Observation only/);
  const blocked = spawnSync(process.execPath, [script, '--reconcile'], {
    encoding: 'utf8', env: { ...base, FRESHNESS_DRY_RUN: 'false' },
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /trusted main-branch workflow event/);
});
