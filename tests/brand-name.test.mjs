import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// W26: readers see MoatPillar. "MarketPulse" may remain only where it names the past, an internal
// log tag, or a folder name. The repository and the channel are renamed, so no address keeps it.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ALLOWED = [
  /MarketPulse-Secure[^\s"'<)`]*/g,
  /\[MarketPulse\]/g,
  /(?:called|then|renamed from) MarketPulse/g,
  /OANDA's MarketPulse/g,
  /the live form still says MarketPulse/g,
  /\['⚠️ MarketPulse dashboard publication stale', '⚠️ MarketPulse digest missing'\]/g,
];
const READER_FACING = [
  'src/n8n/compose-telegram-runtime.js', 'src/n8n/compose-weekly-report.js', 'src/n8n/compose-status-message.js',
  'src/n8n/public-links.js', 'docs/index.html', 'docs/app.js', 'docs/feedback-form.md', 'docs/archive/pre-beta.html',
  'scripts/archive-pre-beta.mjs', 'README.md', 'CONTRIBUTING.md', '.github/scripts/check-freshness.mjs',
];

test('reader-facing text says MoatPillar, and MarketPulse remains only in old addresses and history notes', () => {
  for (const file of READER_FACING) {
    const text = ALLOWED.reduce((t, pattern) => t.replace(pattern, ''), read(file));
    assert.deepEqual(text.split('\n').filter(line => line.includes('MarketPulse')).map(line => line.trim()), [], file);
  }
});

test('the posts, the share text and the dashboard carry the new name', () => {
  assert.match(read('src/n8n/compose-telegram-runtime.js'), /const header = '🏛️ <b>MoatPillar<\/b> · '/);
  assert.match(read('src/n8n/compose-weekly-report.js'), /'📅 <b>MoatPillar Weekly — '/);
  assert.match(read('src/n8n/public-links.js'), /const PITCH = 'MoatPillar: a free daily US and China market brief/);
  assert.match(read('docs/index.html'), /<title>MoatPillar — Market Brief<\/title>/);
  assert.match(read('docs/index.html'), /<meta property="og:site_name" content="MoatPillar">/);
});

test('the channel is addressed as @MoatPillar everywhere, since the old handle no longer exists', () => {
  for (const file of READER_FACING) assert.doesNotMatch(read(file), /n8nMarketPulse/, file);
  assert.match(read('src/n8n/public-links.js'), /const CHANNEL = 'https:\/\/t\.me\/MoatPillar';/);
  assert.equal((read('.github/scripts/check-freshness.mjs').match(/chat_id: '@MoatPillar'/g) || []).length, 2, 'the watchdog checks and posts to the channel');
});
