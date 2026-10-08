import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

// The MoatPillar brand (W26): a vector seal (a pillar standing in its moat) and the name in live
// text. Every file the dashboard or the archive references must exist at the size it declares.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('docs/index.html');
const png = path => {
  const data = readFileSync(new URL('../docs/' + path, import.meta.url));
  assert.equal(data.toString('latin1', 1, 4), 'PNG', path);
  return {width:data.readUInt32BE(16), height:data.readUInt32BE(20)};
};

test('the favicons and touch icon exist at their declared sizes, with an SVG favicon first', () => {
  for (const [path, size] of [['assets/brand/favicon-32.png', 32], ['assets/brand/favicon-64.png', 64], ['assets/brand/apple-touch-icon.png', 180]]) {
    assert.ok(html.includes('href="' + path + '"'), path + ' is linked');
    assert.deepEqual(png(path), {width:size, height:size}, path);
  }
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/brand\/mark-small\.svg">/);
  assert.deepEqual(png('assets/brand/channel-photo.png'), {width:640, height:640}, 'the Telegram channel photo');
});

test('the top bar shows the seal and the name as text, and the old lockup images are gone', () => {
  assert.match(html, /<img class="brand-mark" src="assets\/brand\/mark\.svg" alt="" width="40" height="40">/);
  assert.match(html, /<span class="brand-name">Moat<span>Pillar<\/span><\/span>/);
  assert.match(html, /aria-label="MoatPillar home"/);
  assert.doesNotMatch(html, /brand-lockup|lockup(-dark)?\.png/);
  for (const old of ['docs/assets/brand/lockup.png', 'docs/assets/brand/lockup-dark.png']) {
    assert.equal(existsSync(new URL('../' + old, import.meta.url)), false, old + ' is removed');
  }
  assert.match(read('scripts/archive-pre-beta.mjs'), /src="\.\.\/assets\/brand\/mark\.svg"/, 'the archive page uses the same seal');
});

test('the brand SVGs are self-contained drawings: no scripts, no external references', () => {
  for (const name of ['mark.svg', 'mark-small.svg', 'mark-square.svg']) {
    const svg = read('docs/assets/brand/' + name);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"/, name);
    assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+=|(?:xlink:)?href=|url\((?!#)/i, name);
  }
});
