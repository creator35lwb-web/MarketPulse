#!/usr/bin/env node
/**
 * Validates docs/data/latest-*.json — the files the n8n workflow commits to this PUBLIC
 * repo every day, automatically, with no human in the loop.
 *
 * Why this exists:
 * That is an unattended write path into a public artifact. If the pipeline ever emits
 * malformed JSON or drops a required key, the public dashboard silently breaks for every
 * reader and nobody finds out. This is the gate on that path.
 *
 * It does not just check that the JSON parses. It checks the VERIFICATION CONTRACT:
 * every claim the AI makes must cite a factKey that actually exists in the published data.
 * That is the product's core promise — so it is the thing worth enforcing in CI.
 *
 * Exit 0 = contract holds. Exit 1 = do not publish.
 */

import { readFileSync, existsSync } from 'node:fs';

const FILES = ['docs/data/latest-us.json', 'docs/data/latest-cn.json'];

const errors = [];
const warnings = [];

function fail(file, msg) { errors.push(`${file}: ${msg}`); }
function warn(file, msg) { warnings.push(`${file}: ${msg}`); }

for (const file of FILES) {
  if (!existsSync(file)) {
    warn(file, 'not present yet — skipping (the pipeline creates it on first publish)');
    continue;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(file, `does not parse as JSON — the dashboard would break for every reader. ${e.message}`);
    continue;
  }

  // --- required shape ---
  for (const key of ['edition', 'generatedAt', 'dateLabel', 'health', 'screener', 'economic', 'analysis', 'sources']) {
    if (data[key] === undefined) fail(file, `missing required key "${key}"`);
  }
  if (data.edition && !['US', 'CN'].includes(data.edition)) fail(file, `edition must be "US" or "CN", got "${data.edition}"`);
  if (data.generatedAt && Number.isNaN(Date.parse(data.generatedAt))) fail(file, `generatedAt is not a valid date: "${data.generatedAt}"`);

  // --- health block ---
  const h = data.health;
  if (h && typeof h === 'object') {
    if (!['OK', 'DEGRADED', 'OUTAGE'].includes(h.status)) fail(file, `health.status must be OK|DEGRADED|OUTAGE, got "${h.status}"`);
    if (!Array.isArray(h.missing)) fail(file, 'health.missing must be an array');
    if (!Array.isArray(h.suspect)) fail(file, 'health.suspect must be an array');
    if (Array.isArray(h.suspect) && h.suspect.length) {
      // Not fatal — a suspect value is a signal to a human, not a reason to withhold the ledger.
      // But it must never pass silently: an alarm nobody reads is worse than no alarm.
      warn(file, `DATA QUALITY FLAG raised on: ${h.suspect.map(s => `${s.field}=${s.value} (bound ±${s.bound}%)`).join(', ')} — investigate, do not ignore`);
    }
  }

  // --- screener must actually carry data ---
  if (Array.isArray(data.screener)) {
    if (data.screener.length === 0) fail(file, 'screener is empty — the dashboard would render a blank ledger');
    for (const row of data.screener) {
      if (!row.label || !row.factKey) fail(file, `screener row missing label/factKey: ${JSON.stringify(row)}`);
    }
  } else if (data.screener !== undefined) {
    fail(file, 'screener must be an array');
  }

  // --- THE CONTRACT: every claim must cite a factKey that exists in the published data ---
  const a = data.analysis;
  if (a && typeof a === 'object') {
    const publishedKeys = new Set();
    for (const row of (data.screener || [])) if (row.factKey) publishedKeys.add(row.factKey);
    for (const row of (data.economic || [])) if (row.factKey) publishedKeys.add(row.factKey);
    for (const k of Object.keys(data.dashboard || {})) publishedKeys.add(k);
    // data.facts is the flat published fact table — every factKey the workflow's enforce
    // gate lets a claim cite, with its value. Guaranteed superset of surviving claims'
    // citations (the gate rejects claims citing facts unavailable that day).
    for (const k of Object.keys(data.facts || {})) publishedKeys.add(k);

    for (const claim of (a.claims || [])) {
      if (!claim.text) fail(file, 'a claim has no text');
      const basedOn = claim.basedOn || [];
      if (basedOn.length === 0) {
        fail(file, `UNATTRIBUTED CLAIM (the one thing this product promises can never happen): "${String(claim.text).slice(0, 70)}..."`);
      }
      for (const key of basedOn) {
        // headline_N is the existence-verified news tier — validated upstream against the
        // day's real fetch, and deliberately not republished as a factKey row here.
        if (/^headline_\d+$/.test(key)) continue;
        if (!publishedKeys.has(key)) {
          fail(file, `claim cites factKey "${key}" which appears NOWHERE in the published data — a reader could not check it: "${String(claim.text).slice(0, 60)}..."`);
        }
      }
    }
  }
}

// --- report ---
for (const w of warnings) console.log(`⚠️  ${w}`);

if (errors.length) {
  console.error('\n❌ Dashboard data contract FAILED — refusing to publish:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('\nThe public dashboard is the promise that every number traces to a source.');
  console.error('Publishing data that breaks that contract is worse than publishing nothing.\n');
  process.exit(1);
}

console.log('\n✅ Dashboard data contract holds — every published claim cites a factKey a reader can check.');
