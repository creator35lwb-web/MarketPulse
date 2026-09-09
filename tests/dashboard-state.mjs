import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {additionalEvidence, citationEvidence, expectedPublicationDate, headlineKey, presentationState, verificationPresentation} from '../docs/dashboard-state.mjs';
import {approvedPayload, withheldPayload} from './dashboard-contract-fixtures.mjs';
import {historicalGzipBase64} from './dashboard-contract-historical-fixtures.mjs';

test('CN weekend and Monday before deadline retain Friday expectation', () => {
  for (const now of ['2026-09-12T12:00:00Z','2026-09-13T12:00:00Z','2026-09-14T09:29:00Z']) {
    assert.equal(expectedPublicationDate('CN',new Date(now)), '2026-09-11');
  }
  assert.equal(expectedPublicationDate('CN',new Date('2026-09-14T09:30:00Z')), '2026-09-14');
});
test('US checks use publication deadline even across MYT midnight', () => {
  assert.equal(expectedPublicationDate('US',new Date('2026-09-09T18:00:00Z')), '2026-09-09');
  assert.equal(expectedPublicationDate('US',new Date('2026-09-10T13:59:00Z')), '2026-09-09');
});
test('historical data never receives a current approval label', () => {
  const state = presentationState({edition:'US',generatedAt:'2026-08-09T14:47:53Z',analysis:{claims:[{}]},health:{status:'OK'}},new Date('2026-09-09T18:00:00Z'));
  assert.equal(state.stale,true);assert.equal(state.legacy,true);assert.equal(state.approved,false);
});
test('missing, future and invalid timestamps are visibly untrusted', () => {
  for (const generatedAt of [undefined,null,0,'invalid','2027-01-01T00:00:00Z','2026-09-09T18:00:01Z','2026-02-30T12:00:00Z','2026-09-09T12:00:00']) {
    const state = presentationState({edition:'US',generatedAt},new Date('2026-09-09T18:00:00Z'));
    assert.equal(state.stale,true);assert.equal(state.validTime,false);
  }
});
test('approval labels require the checked claim count to match', () => {
  const data=approvedPayload();
  data.generatedAt='2026-09-09T13:00:00Z';
  assert.equal(presentationState(data,new Date('2026-09-09T18:00:00Z')).approved,true);
  data.analysis.claims.push({});
  assert.equal(presentationState(data,new Date('2026-09-09T18:00:00Z')).approved,false);
});

test('publication time controls stale state regardless of the displayed date label', () => {
  const data=approvedPayload();
  data.generatedAt='2026-08-10T08:30:00Z';
  data.dateLabel='Thursday, September 10, 2026';
  const state=presentationState(data,new Date('2026-09-10T18:00:00Z'));
  assert.equal(state.stale,true);
  assert.equal(state.publicationDate,'2026-08-10');
  assert.equal(state.expectedDate,'2026-09-10');
  assert.equal(verificationPresentation(data,state).tone,'historical');
});

test('CN weekend publications do not stand in for the expected weekday briefing', () => {
  const data=approvedPayload('CN');
  data.generatedAt='2026-09-12T08:30:00Z';
  const state=presentationState(data,new Date('2026-09-12T12:00:00Z'));
  assert.equal(state.stale,true);
  assert.equal(state.offSchedule,true);
  assert.equal(state.expectedDate,'2026-09-11');
});

test('approval labels require a complete record and every displayed citation', () => {
  for (const mutate of [
    data=>{delete data.verification.reasonCodes;},
    data=>{data.verification.reasonCodes=['APPROVAL_INVALID'];},
    data=>{data.verification.version=2;},
    data=>{data.health.status='OUTAGE';},
    data=>{delete data.facts.sp500Change;},
    data=>{data.facts.sp500Change='N/A';},
    data=>{data.analysis.claims[0].basedOn=[];},
    data=>{data.analysis.claims[0].basedOn=['headline_1'];},
  ]) {
    const data=approvedPayload();mutate(data);
    assert.equal(presentationState(data).approved,false);
  }
  const unsupported=approvedPayload();unsupported.schemaVersion=3;
  assert.equal(presentationState(unsupported).legacy,false);
  assert.equal(presentationState(unsupported).approved,false);
});

test('unavailable model output, missing approval and failed checks have distinct explanations', () => {
  for (const edition of ['US','CN']) {
    const data=withheldPayload(edition);
    const explain=code=>{data.verification.reasonCodes=[code];return verificationPresentation(data);};
    assert.match(explain('MODEL_OUTPUT_UNAVAILABLE').message,/did not return a response/);
    assert.equal(explain('MODEL_OUTPUT_UNAVAILABLE').tone,'unavailable');
    assert.match(explain('APPROVAL_MISSING').message,/verification record is unavailable/);
    assert.match(explain('SOURCE_HEALTH_UNAVAILABLE').message,/source data and health checks/);
    assert.match(explain('FACT_UNAVAILABLE').message,/failed attribution checks/);
    assert.equal(explain('FACT_UNAVAILABLE').tone,'withheld');
    assert.match(explain('MODEL_JSON_INVALID').message,/format or consistency checks/);
    assert.match(explain('NUMERIC_MODEL_TEXT').message,/model supplied figures/);
  }
});

test('sparse headline keys preserve citation identity and support absent source URLs', () => {
  const data=approvedPayload();
  data.news[0].url=null;
  data.analysis.claims[0].basedOn=['headline_2'];
  assert.equal(presentationState(data).approved,true);
  assert.equal(citationEvidence(data,'headline_2').value,data.news[0].title);
  assert.equal(citationEvidence(data,'headline_1'),null);
  assert.equal(headlineKey(data.news[0],0), 'headline_2');
  delete data.news[0].factKey;
  assert.equal(headlineKey(data.news[0],0),null);
  assert.equal(headlineKey(data.news[0],0,true),'headline_1');
  assert.equal(presentationState(data).approved,false);
  data.facts.headline_2='An absent headline';
  assert.equal(citationEvidence(data,'headline_2'),null);
});

test('additional evidence covers watchlist, base price and absent citations without duplicates', () => {
  const data=approvedPayload('CN');
  data.facts.csi300='4,702.03';
  data.facts.moutaiChange='+3.03%';
  const claims=[{basedOn:['csi300Change','csi300','moutaiChange','fearGreedValue','headline_2','missingFact']},{basedOn:['moutaiChange']}];
  const rows=additionalEvidence(data,claims,['csi300Change','fearGreedValue','headline_2']);
  assert.deepEqual(rows.map(row=>row.key),['csi300','moutaiChange','missingFact']);
  assert.equal(rows[0].label,'CSI 300');
  assert.equal(rows[1].value,'+3.03%');
  assert.equal(rows[2].available,false);
  assert.match(rows[2].value,/unavailable/);
});

test('both frozen legacy editions retain resolvable claims and no current approval', () => {
  for (const edition of ['us','cn']) {
    const data=JSON.parse(gunzipSync(Buffer.from(historicalGzipBase64[edition], 'base64')).toString('utf8'));
    for (const claim of data.analysis.claims) {
      for (const key of claim.basedOn) assert.ok(citationEvidence(data,key),edition+': '+key);
    }
    assert.equal(presentationState(data).approved,false);
    assert.equal(verificationPresentation(data).tone,'historical');
  }
});
