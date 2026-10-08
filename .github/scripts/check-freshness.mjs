// Observe dashboard repository publication, independently of host and Telegram health.
// Staleness is an issue signal; failures of the monitor itself fail its Actions job.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateDashboardFile } from './validate-dashboard-data.mjs';

export const EDITIONS = Object.freeze({
  us: { label: 'US', deadlineHour: 14, deadlineMinute: 0, weekdaysOnly: false },
  cn: { label: 'CN', deadlineHour: 9, deadlineMinute: 30, weekdaysOnly: true },
});

const TITLE_PREFIX = '⚠️ MoatPillar dashboard publication stale';
// Titles filed before the rename to MoatPillar (W26) and before September 2026: still matched,
// so their issues close when the edition recovers and the same date is not filed twice.
const LEGACY_PREFIXES = ['⚠️ MarketPulse dashboard publication stale', '⚠️ MarketPulse digest missing'];
const DAY = 86_400_000;

function editionConfig(edition) {
  const config = EDITIONS[edition];
  if (!config) throw new Error('Unsupported dashboard edition');
  return config;
}

function isPublicationDay(date, edition) {
  return !editionConfig(edition).weekdaysOnly || ![0, 6].includes(date.getUTCDay());
}

// Use the latest elapsed deadline, not the runner's calendar date or cron string.
// US publishes at 13:00 UTC / 21:00 MYT; CN at 08:30 UTC / 16:30 MYT.
// One hour of grace is included in these deadlines. Delayed/repeated jobs use the
// actual observation time, including checks after UTC midnight and on weekends.
export function expectedPublicationDate(edition, now) {
  const config = editionConfig(edition);
  const deadline = new Date(now);
  if (!Number.isFinite(deadline.getTime())) throw new Error('Invalid observation time');
  deadline.setUTCHours(config.deadlineHour, config.deadlineMinute, 0, 0);
  if (deadline > now) deadline.setTime(deadline.getTime() - DAY);
  while (!isPublicationDay(deadline, edition)) deadline.setTime(deadline.getTime() - DAY);
  return deadline.toISOString().slice(0, 10);
}

// Date.parse alone accepts calendar rollovers such as February 30. Require an
// explicit RFC3339 zone, a real calendar date, and a timestamp no later than now.
export function validPublicationTimestamp(value, now) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, sec] = parts;
  if (y < 1970 || m < 1 || m > 12 || d < 1 ||
      d > new Date(Date.UTC(y, m, 0)).getUTCDate() ||
      h > 23 || min > 59 || sec > 59) return null;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed > now) return null;
  return parsed;
}

export function checkEdition(edition, data, now) {
  const { label } = editionConfig(edition);
  const expectedDate = expectedPublicationDate(edition, now);
  const base = { edition, label, expectedDate, checkedAt: now.toISOString() };
  if (!data || typeof data !== 'object' || data.edition !== label) {
    return { ...base, stale: true, valid: false, reason: 'missing, unreadable, or wrong-edition dashboard data' };
  }
  const published = validPublicationTimestamp(data.generatedAt, now);
  if (!published || !isPublicationDay(published, edition)) {
    return { ...base, stale: true, valid: false, reason: 'missing, invalid, future, or unscheduled publication timestamp' };
  }
  const publishedDate = published.toISOString().slice(0, 10);
  const ageHours = ((now - published) / 3_600_000).toFixed(1);
  const stale = publishedDate < expectedDate;
  return {
    ...base, stale, valid: true, publishedDate, generatedAt: published.toISOString(), ageHours,
    reason: `repository update dated ${publishedDate} (${ageHours}h old); latest due edition date ${expectedDate}`,
  };
}

// A current timestamp cannot recover publication if the same payload would be
// rejected by the Pages gate. Legacy data is only accepted by its frozen hash.
export function assessDashboardFile(edition, raw, now) {
  let validation;
  try {
    validation = validateDashboardFile(raw, `latest-${edition}.json`, { allowHistorical: true, now: now.getTime() });
  } catch { /* Missing and unreadable files share the invalid-publication result. */ }
  if (!validation?.ok) {
    return { ...checkEdition(edition, null, now), reason: 'dashboard data is missing, unreadable, or rejected by the publication contract' };
  }
  return { ...checkEdition(edition, JSON.parse(raw.toString()), now), contractMode: validation.mode };
}

export function issueTitle(label, date) {
  return `${TITLE_PREFIX} — ${label} — ${date}`;
}

export function parseAlertTitle(title) {
  if (typeof title !== 'string') return null;
  for (const prefix of [TITLE_PREFIX, ...LEGACY_PREFIXES]) {
    const match = new RegExp('^' + prefix + ' — (US|CN) — (\\d{4}-\\d{2}-\\d{2})$').exec(title);
    if (match) return { label: match[1], date: match[2] };
  }
  return null; // Combined-edition and unrelated issues cannot be retired.
}

function isOwnedAlert(issue) {
  return !issue.pull_request && issue.user?.login === 'github-actions[bot]' && parseAlertTitle(issue.title);
}

// Match exact edition + date. A newer healthy publication never closes an older
// missing day. A valid older publication may retire its own alert even when a
// newer edition is already due. Closed alerts count as acknowledged, preventing
// repeated checks from recreating a same-date issue after an operator closes it.
export function planReconciliation(results, issues) {
  const owned = issues.filter(isOwnedAlert);
  const create = [];
  const close = [];
  for (const result of results) {
    if (result.valid) {
      for (const issue of owned) {
        const alert = parseAlertTitle(issue.title);
        if (issue.state === 'open' && alert.label === result.label && alert.date === result.publishedDate) {
          close.push({ number: issue.number, label: result.label, date: result.publishedDate, generatedAt: result.generatedAt,
            originalBody: typeof issue.body === 'string' ? issue.body : '' });
        }
      }
    }
    if (result.stale && !owned.some((issue) => {
      const alert = parseAlertTitle(issue.title);
      return alert.label === result.label && alert.date === result.expectedDate;
    })) create.push(result);
  }
  return { create, close };
}

export function issueBody(result) {
  return `The **${result.label} dashboard repository update** expected for **${result.expectedDate} UTC** has not been observed.

- Checked at: ${result.checkedAt}
- Observation: ${result.reason}

This checks the dashboard data committed to the repository. It does not establish host availability, Telegram delivery, or whether the served website has refreshed.

Inspect the private execution record to identify the failed stage. If publishing failed after Telegram accepted the digest, recover the publisher independently to avoid resending that digest.

A matching edition and publication date can retire this alert automatically. A newer edition does not repair a permanently missing date.

_Filed by the Dashboard Freshness Watchdog._`;
}

export function resolutionBody(alert) {
  return `✅ The **${alert.label} dashboard repository update for ${alert.date} UTC** is now present.

Recorded publication timestamp: ${alert.generatedAt}

This resolves only the matching edition and date. It does not infer why publication was delayed or establish Telegram delivery or served-site availability.

_Retired by the Dashboard Freshness Watchdog._`;
}

async function githubRequest(repository, token, path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => { throw new Error('GitHub monitor request failed'); });
  if (!response.ok) throw new Error(`GitHub monitor request failed (HTTP ${response.status})`);
  return response.status === 204 ? null : response.json();
}

export async function listIssues(repository, token, fetchImpl = fetch) {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubRequest(repository, token, `issues?state=all&per_page=100&page=${page}`, { fetchImpl });
    if (!Array.isArray(batch)) throw new Error('Invalid GitHub issue-list response');
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
}

function cleanTelegramToken(token) {
  return (token || '').replace(/\s/g, '').replace(/^bot(?=\d+:)/i, '');
}

async function telegramRequest(token, method, parameters, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json();
    return response.ok && data.ok === true;
  } catch {
    return false; // Never print URLs, tokens, response bodies, or transport errors.
  }
}

export async function validateTelegram(token, fetchImpl = fetch) {
  const clean = cleanTelegramToken(token);
  if (!clean) throw new Error('Telegram token is not configured');
  const me = await telegramRequest(clean, 'getMe', {}, fetchImpl);
  const chat = await telegramRequest(clean, 'getChat', { chat_id: '@n8nMarketPulse' }, fetchImpl);
  if (!me || !chat) throw new Error('Telegram credential read-access check failed');
  console.log('Telegram token and channel read access verified; posting permission was not tested.');
}

export async function reconcile(results, { repository, githubToken, telegramToken, fetchImpl = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') || !githubToken) {
    throw new Error('GitHub repository or monitor token is not configured');
  }
  const issues = await listIssues(repository, githubToken, fetchImpl);
  const plan = planReconciliation(results, issues);
  const created = [];
  const resolved = [];
  for (const alert of plan.close) {
    // Record the observed recovery and close in the same API operation. Preserve
    // the original missed-date report so a failed second request cannot erase
    // the evidence behind an automatically closed alert.
    await githubRequest(repository, githubToken, `issues/${alert.number}`, {
      method: 'PATCH', body: { state: 'closed', state_reason: 'completed',
        body: `${alert.originalBody}\n\n---\n\n${resolutionBody(alert)}` }, fetchImpl,
    });
    resolved.push(`${alert.label} — ${alert.date}`);
  }
  for (const result of plan.create) {
    const issue = await githubRequest(repository, githubToken, 'issues', {
      method: 'POST', body: { title: issueTitle(result.label, result.expectedDate), body: issueBody(result) }, fetchImpl,
    });
    created.push(`${result.label} — ${result.expectedDate}`);
    console.log(`Opened dashboard publication alert #${issue.number} (${result.label} ${result.expectedDate}).`);
  }
  const token = cleanTelegramToken(telegramToken);
  const notices = [];
  if (created.length) notices.push(`📡 MoatPillar dashboard publication status

No dashboard repository update has been observed for: ${created.join('; ')} (UTC dates).

This does not establish whether a Telegram digest was delivered or whether the host is available. Check the dashboard's displayed date before using its data.
https://creator35lwb-web.github.io/MarketPulse/`);
  if (resolved.length) notices.push(`✅ MoatPillar dashboard publication update

The repository now contains the dated update associated with these earlier alerts: ${resolved.join('; ')}.

Only those matching dates are resolved. Other missing dates remain recorded. The served dashboard may still need to refresh.
https://creator35lwb-web.github.io/MarketPulse/`);
  for (const notice of notices) {
    if (!token) {
      console.log('Telegram status notice skipped: token is not configured.');
      continue;
    }
    const sent = await telegramRequest(token, 'sendMessage', {
      chat_id: '@n8nMarketPulse', text: notice, disable_web_page_preview: true,
    }, fetchImpl);
    console.log(sent ? 'Telegram dashboard status notice accepted.' : 'Telegram status notice failed; the issue remains the record.');
  }
  return { created: created.length, resolved: resolved.length };
}

export async function main() {
  const now = new Date();
  const results = Object.keys(EDITIONS).map((edition) => {
    let raw = null;
    try { raw = readFileSync(`docs/data/latest-${edition}.json`); } catch { /* classified below */ }
    return assessDashboardFile(edition, raw, now);
  });
  for (const result of results) console.log(`[${result.label}] ${result.stale ? 'STALE' : 'FRESH'}: ${result.reason}`);
  if (process.env.FRESHNESS_VALIDATE_TELEGRAM === 'true') {
    await validateTelegram(process.env.TG_TOKEN);
    return;
  }
  if (!process.argv.includes('--reconcile') || process.env.FRESHNESS_DRY_RUN === 'true') {
    console.log('Observation only: no issue changes or Telegram messages.');
    return;
  }
  // No pull_request_target/workflow_run execution path. Manual runs from another
  // branch must never receive the monitor's write authority.
  if (!['push', 'schedule', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) ||
      process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Issue reconciliation requires a trusted main-branch workflow event');
  }
  await reconcile(results, {
    repository: process.env.GITHUB_REPOSITORY,
    githubToken: process.env.GH_TOKEN,
    telegramToken: process.env.TG_TOKEN,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
