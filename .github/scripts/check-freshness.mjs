// Dashboard Freshness Watchdog — the EXTERNAL, always-on eye.
//
// Why this exists:
// MarketPulse's digest runs on a self-hosted n8n on the operator's personal laptop, which
// is often offline. A watchdog running ON that laptop cannot report the laptop being
// offline — a thing cannot monitor its own absence. This script runs on GitHub Actions
// (always on, off the laptop) and checks the ONE artifact the laptop leaves behind when it
// succeeds: the `generatedAt` timestamp in the published dashboard JSON.
//
// Design choices that matter:
//   • It NEVER fails the job. A red build on every offline day trains the operator to ignore
//     CI — the exact anti-pattern the repo already avoids ("an alarm nobody trusts is worse
//     than no alarm"). Instead it emits `alert=true` and the workflow opens a GitHub Issue,
//     a distinct and intentional signal.
//   • Staleness = the published UTC date is not today's UTC date. Simple and drift-proof:
//     the pipeline stamps dates in UTC, and each edition is checked right after its own
//     publish window, so "did today's run land?" is exactly the right question.
//   • The CN check is scheduled Mon–Fri only (see the workflow), so weekends — when CN
//     legitimately does not publish — can never raise a false alarm. Market holidays do not
//     stop the *publish* (only the scoring), so they do not false-alarm either.

import { readFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';

const CRON_TO_EDITIONS = {
  '0 14 * * *': ['us'],       // US: ~1h after the 13:00 UTC publish window
  '30 9 * * 1-5': ['cn'],     // CN: ~1h after the 08:30 UTC weekday publish window
};

// Which editions to check: derived from the cron that triggered this run; both on manual
// dispatch or an override. FRESHNESS_EDITIONS is a comma-separated override for testing.
function editionsToCheck() {
  const override = (process.env.FRESHNESS_EDITIONS || '').trim();
  if (override) return override.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const sched = (process.env.SCHEDULE || '').trim();
  if (CRON_TO_EDITIONS[sched]) return CRON_TO_EDITIONS[sched];
  return ['us', 'cn'];
}

const todayUTC = () => new Date().toISOString().slice(0, 10);

function checkEdition(ed) {
  const label = ed.toUpperCase();
  const path = `docs/data/latest-${ed}.json`;
  let generatedAt;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    generatedAt = data.generatedAt;
  } catch (err) {
    return { ed, label, stale: true, reason: `could not read/parse ${path}: ${err.message}` };
  }
  if (!generatedAt) {
    return { ed, label, stale: true, reason: `no generatedAt field in ${path}` };
  }
  const published = new Date(generatedAt);
  if (isNaN(published.getTime())) {
    return { ed, label, stale: true, reason: `unparseable generatedAt "${generatedAt}"` };
  }
  const publishedDate = published.toISOString().slice(0, 10);
  const today = todayUTC();
  const ageHours = ((Date.now() - published.getTime()) / 3_600_000).toFixed(1);
  const stale = publishedDate !== today;
  return {
    ed, label, stale, generatedAt, publishedDate, today, ageHours,
    reason: stale
      ? `last publish was ${publishedDate} (${ageHours}h ago); expected today ${today}`
      : `fresh — published today ${publishedDate} (${ageHours}h ago)`,
  };
}

const results = editionsToCheck().map(checkEdition);
for (const r of results) {
  console.log(`[${r.label}] ${r.stale ? 'STALE ⚠️' : 'OK ✅'} — ${r.reason}`);
}

const stale = results.filter((r) => r.stale);
const alert = stale.length > 0;

// Build a human summary for the issue body (no secrets, no webhook URLs — this repo is public).
const summaryLines = stale.map((r) => `- **${r.label} edition**: ${r.reason}`);
const summary = summaryLines.join('\n');
const editionsLabel = stale.map((r) => r.label).join(' + ');

// ===== LATE-vs-MISSING RESOLUTION (2026-07-30) =====
// This watchdog can only ever answer "is it published *right now*?", so a digest that is
// merely LATE looks identical to one that is MISSING. On 2026-07-30 the CN run fired 3h38m
// late: this check announced an outage to the channel at 19:29 MYT and the digest arrived at
// 20:08 — subscribers saw a missing-digest warning followed 39 minutes later by the digest.
// Every step was accurate and the net effect was still damaging: a monitor that cries outage
// and then delivers reads as unreliable, which costs more credibility than the delay did.
//
// The fix is not to alarm less eagerly — detecting a genuinely offline host quickly is the
// whole point of running off-box. It is to CLOSE THE STORY: emit the fresh editions too, so
// the workflow can retire any alert its earlier self opened and tell the channel the digest
// landed. An alarm that never resolves is an alarm that gets ignored.
const freshResults = results.filter((r) => !r.stale);
const freshLabel = freshResults.map((r) => r.label).join(' ');
const freshSummary = freshResults
  .map((r) => `- **${r.label} edition**: published ${r.generatedAt} (${r.ageHours}h ago)`)
  .join('\n');

// Emit outputs for the workflow's issue-opening step.
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `alert=${alert}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `editions=${editionsLabel}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `today=${todayUTC()}\n`);
  // Space-separated labels, safe to iterate in shell; empty when nothing is fresh.
  appendFileSync(process.env.GITHUB_OUTPUT, `fresh=${freshResults.length > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `fresh_editions=${freshLabel}\n`);
  // Multi-line outputs via heredoc-style delimiters.
  appendFileSync(process.env.GITHUB_OUTPUT, `summary<<FRESHNESS_EOF\n${summary}\nFRESHNESS_EOF\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `fresh_summary<<FRESHNESS_EOF\n${freshSummary}\nFRESHNESS_EOF\n`);
}

// Always exit 0 — the alarm is the Issue, not a red build.
process.exit(0);
