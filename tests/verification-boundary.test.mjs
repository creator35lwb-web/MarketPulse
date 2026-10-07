import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../src/n8n/analysis-policy.js';
import {pipeline,runNode,groundTruth,validAnalysis,publishedSourceFixture,suffixFor,FIXTURE_NOW} from './helpers/n8n.mjs';

const rejected = [
  ['unstructured prose',()=> 'The market outlook remains constructive and every reader should remain optimistic.'],
  ['malformed JSON',()=> '{"claims":['],
  ['code fence',ed => '```json\n' + JSON.stringify(validAnalysis(ed)) + '\n```'],
  ['null JSON',()=> 'null'],
  ['array JSON',()=> '[]'],
  ['null claim',ed => ({...validAnalysis(ed),claims:[null]})],
  ['seventh unchecked claim',ed => {const a=validAnalysis(ed);a.claims=Array.from({length:6},()=>structuredClone(a.claims[0]));a.claims.push({claim:'Gold is worth 987654 dollars.',basedOn:['gold'],direction:'neutral'});return a;}],
  ['sixth claim has unavailable evidence',ed => {const a=validAnalysis(ed);a.claims=Array.from({length:6},()=>structuredClone(a.claims[0]));a.claims[5].basedOn=['missingMetric'];return a;}],
  ['numeric sentiment',ed => ({...validAnalysis(ed),sentiment:'Bearish, guaranteed return 987654%'})],
  ['numeric confidence',ed => ({...validAnalysis(ed),confidence:'987654%'})],
  ['spelled number',ed => {const a=validAnalysis(ed);a.claims[0].claim='Gold is worth nine billion dollars.';return a;}],
  ['unicode digits',ed => {const a=validAnalysis(ed);a.claims[0].claim='Gold is worth ９８７６５４ dollars.';return a;}],
  ['numeric interpretation',ed => ({...validAnalysis(ed),interpretation:'Expect a return of 987654%.'})],
  ['numeric wisdom',ed => ({...validAnalysis(ed),wisdom:'Hold for three years.'})],
  ['missing claim text',ed => {const a=validAnalysis(ed);delete a.claims[0].claim;return a;}],
  ['empty claims',ed => ({...validAnalysis(ed),claims:[]})],
  ['missing wisdom',ed => {const a=validAnalysis(ed);delete a.wisdom;return a;}],
  ['unknown top-level field',ed => ({...validAnalysis(ed),secret:'ignored extra prose'})],
  ['empty attribution',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=[];return a;}],
  ['string attribution',ed => {const a=validAnalysis(ed);a.claims[0].basedOn='gold';return a;}],
  ['duplicate attribution',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=['gold','gold'];return a;}],
  ['null citation',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=[null];return a;}],
  ['unknown citation',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=['inventedMetric'];return a;}],
  ['inherited citation',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=['constructor'];return a;}],
  ['missing headline',ed => {const a=validAnalysis(ed);a.claims[0].basedOn=['headline_999999'];return a;}],
  ['invalid direction',ed => {const a=validAnalysis(ed);a.claims[0].direction='optimistic';return a;}],
  ['direction-label conflict',ed => ({...validAnalysis(ed),sentiment:'Bullish'})],
  ['oversize prose',ed => ({...validAnalysis(ed),interpretation:'x'.repeat(1201)})],
];

for (const edition of ['US','CN']) {
  test(`${edition}: baseline approval reaches both renderers with source evidence`,()=>{
    const result=pipeline(edition,validAnalysis(edition));
    assert.equal(result.data._verification.status,'PASS');
    assert.equal(result.data.approvedAnalysis.edition,edition);
    assert.equal(result.payload.schemaVersion,2);
    assert.deepEqual(result.payload.verification,{version:1,status:'approved',checkedClaims:1,reasonCodes:[]});
    assert.match(result.message,/Equities face pressure/);
    assert.match(result.message,/-2\.00%/);
    assert.equal(result.payload.analysis.claims[0].text,'Equities face pressure.');
    assert.equal(result.state.mpLedger[edition].length,1);
    assert.equal(result.state.mpLedger[edition][0].verdict,'PASS');
    for(const key of ['text','response','llmAnalysis','_structured']) assert.equal(Object.hasOwn(result.data,key),false);
  });
  for (const [label,candidate] of rejected) {
    test(`${edition}: ${label} is withheld in both channels`,()=>{
      const result=pipeline(edition,candidate(edition));
      assert.equal(result.data._verification.status,'FAIL');
      assert.equal(result.data._verification.action,'withheld');
      assert.equal(result.data.approvedAnalysis,null);
      assert.match(result.message,/AI commentary withheld/);
      assert.doesNotMatch(result.message,/987654|nine billion|every reader should remain optimistic|"claims"/);
      assert.equal(result.payload.verification.status,'withheld');
      assert.equal(result.payload.verification.checkedClaims,0);
      assert.ok(result.payload.verification.reasonCodes.length);
      assert.deepEqual(result.payload.analysis,{sentiment:'Unavailable',confidence:'',claims:[],interpretation:'',wisdom:''});
      assert.ok(!result.state.mpLedger?.[edition]?.length);
    });
  }
  for(const unavailable of ['N/A','NaN%','1e999',null,Infinity]) {
    test(`${edition}: unavailable source ${unavailable} cannot support a claim`,()=>{
      const data=groundTruth(edition);data.gold=unavailable;
      const a=validAnalysis(edition);a.claims[0].basedOn=['gold'];
      const r=pipeline(edition,a,{data});
      assert.equal(r.data._verification.status,'FAIL');assert.ok(!Object.hasOwn(r.payload.facts,'gold'));
    });
  }
  test(`${edition}: source-only output survives unavailable model`,()=>{
    const r=pipeline(edition,'');assert.equal(r.payload.verification.status,'withheld');assert.equal(r.payload.facts.gold,'$2000');
  });
  test(`${edition}: six accepted claims have identical checked and published counts`,()=>{
    const a=validAnalysis(edition);a.claims=Array.from({length:6},()=>structuredClone(a.claims[0]));const r=pipeline(edition,a);
    assert.equal(r.data._verification.checked,6);assert.equal(r.payload.analysis.claims.length,6);assert.equal(r.payload.verification.checkedClaims,6);
  });
  test(`${edition}: approved dynamic watchlist and headline keys retain evidence`,()=>{
    const a=validAnalysis(edition);a.claims[0].basedOn=['acmeChange','headline_1'];const r=pipeline(edition,a);
    assert.equal(r.payload.verification.status,'approved');assert.equal(r.payload.facts.acmeChange,'+0.50%');
    assert.equal(r.payload.news[0].factKey,'headline_1');assert.match(r.message,/Acme change/);
  });
  test(`${edition}: watchlist citations render the same canonical value as the fact table`,()=>{
    const data=groundTruth(edition);data.stockDetails[0].change='+0.75%';
    const a=validAnalysis(edition);a.claims[0].basedOn=['acmeChange'];const r=pipeline(edition,a,{data});
    assert.match(r.message,/evidence: Acme change \+0\.50%/);assert.equal(r.payload.facts.acmeChange,'+0.50%');
  });
  test(`${edition}: published source formats retain all available facts and rendered rows`,()=>{
    const fixture=publishedSourceFixture(edition);const r=pipeline(edition,fixture.analysis,{data:fixture.data});
    assert.equal(r.data._verification.status,'PASS');assert.deepEqual(r.payload.facts,fixture.facts);
    assert.equal(r.payload.verification.checkedClaims,fixture.analysis.claims.length);
    assert.equal(r.payload.screener.length,edition==='US'?7:6);assert.equal(r.payload.economic.length,edition==='US'?6:3);
    for(const row of r.payload.screener) {
      assert.equal(row.value,fixture.facts[row.factKey.replace(/Change$/,'')]);assert.equal(row.change,fixture.facts[row.factKey]);
    }
    assert.equal(r.payload.economic[0].value,fixture.data.gdpValue);assert.equal(r.payload.economic[0].period,fixture.data.gdpYear);
    assert.equal(r.payload.news[0].title,fixture.data.headlinesList[0]);assert.equal(r.payload.news[0].url,fixture.data.headlinesLinks[0]);
    assert.equal(r.payload.watchlist,fixture.data.watchlistSummary);assert.match(r.message,edition==='US'?/7757\.64/:/4,702\.03/);
    if(edition==='US') {assert.equal(r.payload.fearGreed.score,64);assert.equal(r.payload.dashboard.buffettIndicator.value,'136%');}
    else assert.equal(r.payload.fearGreed,null);
  });
  test(`${edition}: missing market level omits its screener row without discarding available change`,()=>{
    const data=groundTruth(edition);delete data[edition==='US'?'sp500':'csi300'];const r=pipeline(edition,validAnalysis(edition),{data});
    assert.equal(r.payload.verification.status,'approved');assert.equal(r.payload.screener.length,1);
    assert.equal(r.payload.facts[edition==='US'?'sp500Change':'csi300Change'],'-2.00%');
  });
  test(`${edition}: long commentary is compacted with no separated claim or evidence`,()=>{
    const a=validAnalysis(edition);a.claims=Array.from({length:6},()=>({...a.claims[0],claim:'Markets remain uncertain. '.repeat(20)}));
    const r=pipeline(edition,a);assert.equal(r.payload.analysis.claims.length,6);assert.ok(r.message.length<=4096);
    assert.match(r.message,/Detailed commentary omitted/);assert.match(r.message,/prose accuracy is not fact-checked/);
    assert.doesNotMatch(r.message,/Markets remain uncertain|evidence:/);assert.match(r.message,/-2\.00%/);
  });
  test(`${edition}: oversized source summary preserves a bounded, complete digest`,()=>{
    const data=groundTruth(edition);data.watchlistSummary='Long source summary. '.repeat(300);const r=pipeline(edition,validAnalysis(edition),{data});
    assert.ok(r.message.length<=4096);assert.match(r.message,/Digest shortened/);assert.match(r.message,/-2\.00%/);
    assert.match(r.message,/<a href="https:\/\/creator35lwb-web\.github\.io\/MarketPulse\/">Open Dashboard<\/a>$/);
    assert.equal((r.message.match(/<code>/g)||[]).length,(r.message.match(/<\/code>/g)||[]).length);
    assert.equal((r.message.match(/<i>/g)||[]).length,(r.message.match(/<\/i>/g)||[]).length);
  });
  test(`${edition}: filtered headlines preserve their original citation IDs`,()=>{
    const data=groundTruth(edition);data.headlinesList=['', 'Available later headline.'];data.headlinesLinks=[null,'javascript:alert(1)'];
    const a=validAnalysis(edition);a.claims[0].basedOn=['headline_2'];const r=pipeline(edition,a,{data});
    assert.deepEqual(r.payload.news,[{factKey:'headline_2',title:'Available later headline.',url:null}]);assert.doesNotMatch(r.message,/javascript:/);
  });
  test(`${edition}: stale legacy approval and raw prose cannot bypass output boundary`,()=>{
    const data={...groundTruth(edition),_structured:validAnalysis(edition),_verification:{status:'PASS'},text:'Leaked 987654',llmAnalysis:'Leaked 987654'};
    const items=[{json:data}];const suffix=suffixFor(edition);
    const message=runNode('compose-telegram-message'+suffix,items)[0].json.message;
    const payload=JSON.parse(runNode('prepare-dashboard-data'+suffix,items)[0].json.dashboardJson);
    assert.doesNotMatch(message,/Leaked 987654|Equities face pressure/);assert.equal(payload.verification.status,'withheld');
  });
  test(`${edition}: modified approved prose is rechecked by both renderers`,()=>{
    const r=pipeline(edition,validAnalysis(edition));r.data.approvedAnalysis.analysis.sentiment='Bearish 987654%';
    const suffix=suffixFor(edition);const items=[{json:r.data}];
    assert.doesNotMatch(runNode('compose-telegram-message'+suffix,items)[0].json.message,/987654/);
    assert.equal(JSON.parse(runNode('prepare-dashboard-data'+suffix,items)[0].json.dashboardJson).verification.status,'withheld');
  });
  for(const [label,modify] of [
    ['missing approval',data=>{delete data.approvedAnalysis;}],
    ['missing verdict',data=>{delete data._verification;}],
    ['mismatched checked count',data=>{data._verification.checked=0;}],
    ['wrong edition',data=>{data.approvedAnalysis.edition=edition==='US'?'CN':'US';}],
    ['unavailable approved evidence',data=>{delete data[edition==='US'?'sp500Change':'csi300Change'];}],
  ]) {
    test(`${edition}: ${label} withholds commentary at each output boundary`,()=>{
      const r=pipeline(edition,validAnalysis(edition));modify(r.data);const items=[{json:r.data}];const suffix=suffixFor(edition);
      const message=runNode('compose-telegram-message'+suffix,items)[0].json.message;
      const payload=JSON.parse(runNode('prepare-dashboard-data'+suffix,items)[0].json.dashboardJson);
      assert.doesNotMatch(message,/Equities face pressure/);assert.match(message,/AI commentary withheld/);
      assert.equal(payload.verification.status,'withheld');assert.equal(payload.analysis.claims.length,0);
    });
  }
  test(`${edition}: verification exceptions cannot return raw model input`,()=>{
    const r=runNode('verify-ai-analysis'+suffixFor(edition),[],{context:{$input:{all(){throw new Error('probe');}}}});
    assert.equal(r[0].json._verification.status,'FAIL');assert.equal(r[0].json.approvedAnalysis,null);
    assert.equal(r[0].json._verification.reasonCodes[0],'VERIFICATION_EXCEPTION');
  });
  test(`${edition}: live session, same-day, and history-cap ledger guards remain`,()=>{
    const data=groundTruth(edition);const mt=data[edition==='CN'?'csi300MarketTime':'sp500MarketTime'];
    const state={mpLedger:{[edition]:[{date:'2026-09-09',sentiment:'Bearish',marketTime:mt,verdict:'PASS'}]}};
    pipeline(edition,validAnalysis(edition),{data,state});assert.equal(state.mpLedger[edition].length,1);
    data[edition==='CN'?'csi300MarketTime':'sp500MarketTime']=mt+86400;
    pipeline(edition,validAnalysis(edition),{data,state});assert.equal(state.mpLedger[edition].length,2);
    pipeline(edition,validAnalysis(edition),{data,state});assert.equal(state.mpLedger[edition].length,2);
    const many={mpLedger:{[edition]:Array.from({length:30},(_,i)=>({date:'2026-08-'+String(i+1).padStart(2,'0'),sentiment:'Bearish',marketTime:mt-86400,verdict:'PASS'}))}};
    pipeline(edition,validAnalysis(edition),{data,state:many});assert.equal(many.mpLedger[edition].length,30);assert.equal(many.mpLedger[edition].at(-1).date,FIXTURE_NOW.slice(0,10));
  });
  for(const marketTime of [undefined,null,0,-1,NaN,Infinity,'1789066800']) {
    test(`${edition}: unavailable session ${marketTime} publishes commentary without adding a scoreable prior`,()=>{
      const data=groundTruth(edition);const key=edition==='CN'?'csi300MarketTime':'sp500MarketTime';const previousTime=data[key];
      if(marketTime===undefined) delete data[key];else data[key]=marketTime;
      const prior={date:'2026-09-09',sentiment:'Bearish',marketTime:previousTime,verdict:'PASS'};
      const state={mpLedger:{[edition]:[prior]}};const logs=[];
      const r=pipeline(edition,validAnalysis(edition),{data,state,context:{console:{log(){},error(message){logs.push(message);}}}});
      assert.equal(r.payload.verification.status,'approved');assert.match(r.message,/Equities face pressure/);
      assert.equal(state.mpLedger[edition].length,1);assert.equal(state.mpLedger[edition][0],prior);
      assert.ok(logs.some(line=>line.includes('benchmark session time unavailable')));
    });
  }
  test(`${edition}: an older unknown-session record cannot mask the timestamped prior`,()=>{
    const data=groundTruth(edition);const key=edition==='CN'?'csi300MarketTime':'sp500MarketTime';
    const state={mpLedger:{[edition]:[
      {date:'2026-09-08',sentiment:'Bearish',marketTime:data[key],verdict:'PASS'},
      {date:'2026-09-09',sentiment:'Bearish',marketTime:null,verdict:'PASS'},
    ]}};
    pipeline(edition,validAnalysis(edition),{data,state});assert.equal(state.mpLedger[edition].length,2);
    data[key]+=86400;pipeline(edition,validAnalysis(edition),{data,state});assert.equal(state.mpLedger[edition].length,3);
  });
  test(`${edition}: unusable numerical source table fields display N/A`,()=>{
    const data=groundTruth(edition);data.gold='NaN%';data.goldChange='junk1';data.cpiValue=Infinity;
    const r=pipeline(edition,validAnalysis(edition),{data});
    assert.match(r.message,/Gold: <code>N\/A<\/code> \(N\/A\)/);assert.doesNotMatch(r.message,/NaN%|junk1|Infinity/);
    assert.equal(r.payload.verification.status,'approved');assert.equal(Object.hasOwn(r.payload.facts,'gold'),false);
  });
  test(`${edition}: macro-only partial data retains the last dashboard and sends available source data`,()=>{
    const data={_health:{status:'DEGRADED',missing:['market prices'],suspect:[]},gdpValue:'+1.5% (QoQ annualized)',gdpYear:'2026',cpiValue:'3.46%'};
    const r=pipeline(edition,'',{data});assert.equal(r.payload,null);assert.ok(!r.state.mpLedger?.[edition]?.length);
    assert.match(r.message,/\+1\.5% \(QoQ annualized\)/);assert.match(r.message,/AI commentary withheld/);
  });
  test(`${edition}: outage cannot replace last-good dashboard or ledger`,()=>{
    const data=groundTruth(edition);data._health.status='OUTAGE';const r=pipeline(edition,validAnalysis(edition),{data});
    assert.equal(r.payload,null);assert.equal(r.data.approvedAnalysis,null);assert.ok(!r.state.mpLedger?.[edition]?.length);
  });
  test(`${edition}: ledger storage failure does not break verified data delivery`,()=>{
    const r=pipeline(edition,validAnalysis(edition),{context:{$getWorkflowStaticData(){throw new Error('storage unavailable');}}});
    assert.equal(r.payload.verification.status,'approved');assert.match(r.message,/Equities face pressure/);
  });
  test(`${edition}: fallback provenance comes from executed node, not model self-report`,()=>{
    const a=validAnalysis(edition);const text=JSON.stringify(a);const r=pipeline(edition,a,{context:{$:()=>({all:()=>[{json:{text}}]})}});
    assert.equal(r.payload.analysisProvider,'Groq');assert.equal(r.payload.analysisModel,'openai/gpt-oss-120b');
  });
  test(`${edition}: markup in approved qualitative prose is escaped`,()=>{
    const a=validAnalysis(edition);a.claims[0].claim='Equities face <b>pressure</b> & uncertainty.';const r=pipeline(edition,a);
    assert.match(r.message,/&lt;b&gt;pressure&lt;\/b&gt; &amp; uncertainty/);
  });
}

test('numeric policy states a bounded lexicon and catches nonfinite values',()=>{
  for(const value of ['nine billion dollars','９８７','١٢٣','Ⅸ','three years']) assert.equal(policy.hasNumericText(value),true);
  assert.equal(policy.hasNumericText('Keep a margin of safety.'),false);
  assert.equal(policy.isUsableFact('1e999','gold'),false);
  assert.equal(policy.isUsableFact('NaN%','gold'),false);
  assert.equal(policy.isUsableFact(0,'fearGreedValue'),true);
  for(const value of ['junk1','1.2.3','1,23','123,4567','1e999','2% (unspecified)','']) assert.equal(policy.isUsableFact(value,'gold'),false);
  for(const value of ['+1.5% (QoQ)','+1.5% (QoQ annualized)','+4.96%','+3.2% (YoY)']) assert.equal(policy.isUsableFact(value,'gdpValue'),true);
  for(const value of ['$65,123','4,702.03','$4,414.20','6.7442','-2.00%']) assert.equal(policy.isUsableFact(value,'gold'),true);
  assert.equal(policy.isUsableFact(7,'maSignal'),false);assert.equal(policy.isUsableFact('Golden Cross','maSignal'),true);
  for(const value of [-1,101,'200','64%','$64']) assert.equal(policy.isUsableFact(value,'fearGreedValue'),false);
});

test('only ordinary HTTP(S) source links are emitted',()=>{
  for(const value of ['javascript:alert(1)','https://user:pass@example.com/news','https://example.com\\evil','data:text/html,hello']) assert.equal(policy.safeHttpUrl(value),null);
  assert.equal(policy.safeHttpUrl('https://example.com/news?a=b'),'https://example.com/news?a=b');
});
