import test from 'node:test';
import assert from 'node:assert/strict';
import MP_LINKS from '../src/n8n/public-links.js';
import {buildNodeSource, readNodeSources} from '../scripts/node-source.mjs';
import {runNode} from './helpers/n8n.mjs';

// The bundle deploys every Code node built from this repository except the Fetch nodes, whose
// live code is kept (W20). A template placeholder in any of them would reach production as is:
// the first export replaced the account name with YOUR_GITHUB_USERNAME throughout, and the status
// notice carried one until 2026-10-08.
test('no node that deploys from this repository carries a template placeholder', () => {
  for (const name of Object.keys(readNodeSources())) {
    if (name.startsWith('Fetch')) continue;
    assert.doesNotMatch(buildNodeSource(name), /\bYOUR_[A-Z_]+/, name);
  }
});

test('every status notice names MoatPillar, and the offline notice links the repository issues', () => {
  for (const statusType of ['restored', 'maintenance', 'degraded', 'scheduled_downtime', 'unavailable']) {
    const message = runNode('compose-status-message', [{json:{statusType}}])[0].json.message;
    assert.match(message, /MoatPillar/, statusType);
    assert.doesNotMatch(message, /YOUR_/, statusType);
    // Addresses follow the repository's name; the words readers see must not.
    assert.doesNotMatch(message.replace(/https:\/\/\S+/g, ''), /MarketPulse/, statusType);
  }
  const offline = runNode('compose-status-message', [{json:{statusType:'unavailable'}}])[0].json.message;
  assert.ok(offline.includes(MP_LINKS.REPOSITORY + '/issues'), 'links ' + MP_LINKS.REPOSITORY + '/issues');
});
