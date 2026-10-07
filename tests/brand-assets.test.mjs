import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The dashboard uses the Telegram channel's logo: every brand file it references must exist,
// be a PNG, and have the size the page declares, in both themes.
const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const png = path => {
  const data = readFileSync(new URL('../docs/' + path, import.meta.url));
  assert.equal(data.toString('latin1', 1, 4), 'PNG', path);
  return {width:data.readUInt32BE(16), height:data.readUInt32BE(20)};
};

test('the favicon, touch icon and both logo lockups exist at their declared sizes', () => {
  for (const [path, size] of [['assets/brand/favicon-32.png', 32], ['assets/brand/favicon-64.png', 64], ['assets/brand/apple-touch-icon.png', 180]]) {
    assert.ok(html.includes('href="' + path + '"'), path + ' is linked');
    assert.deepEqual(png(path), {width:size, height:size}, path);
  }
  for (const theme of ['on-light', 'on-dark']) {
    const tag = new RegExp('<img class="brand-lockup ' + theme + '" src="([^"]+)" alt="" width="(\\d+)" height="(\\d+)">').exec(html);
    assert.ok(tag, theme + ' lockup is in the top bar');
    assert.deepEqual(png(tag[1]), {width:Number(tag[2]), height:Number(tag[3])}, tag[1]);
  }
  assert.doesNotMatch(html, /data:image\/svg\+xml/, 'the old drawn mark is gone');
});
