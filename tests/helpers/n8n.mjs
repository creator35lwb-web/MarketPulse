import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const policy = readFileSync(new URL('../../src/n8n/analysis-policy.js', import.meta.url), 'utf8');
export const FIXTURE_NOW = '2026-09-10T12:00:00.000Z';
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXTURE_NOW])); }
  static now() { return Date.parse(FIXTURE_NOW); }
}
export function runNode(name, items, {state = {}, context = {}} = {}) {
  const source = readFileSync(new URL('../../src/n8n/' + name + '.js', import.meta.url), 'utf8');
  return vm.runInNewContext('(function(){\n' + policy + '\n' + source + '\n})()', {
    $input:{all:()=>items,first:()=>items[0]},$getWorkflowStaticData:()=>state,
    $:()=>{throw new Error('Fallback was not executed');},
    console:{log(){},error(){},warn(){}},Date:FixtureDate,Buffer,...context,
  }, {timeout:2000});
}
export const suffixFor = edition => edition === 'CN' ? '1' : '';
export function groundTruth(edition) {
  return {
    _health:{status:'DEGRADED',missing:['unused sources'],suspect:[]},
    ...(edition === 'CN' ? {csi300:'4702.03',csi300Change:'-2.00%',csi300MarketTime:1789036800} : {sp500:'5000',sp500Change:'-2.00%',sp500MarketTime:1789066800}),
    gold:'$2000',goldChange:'+0.30%',gdpValue:'+1.5% (QoQ annualized)',gdpYear:'2026',
    stockDetails:[{name:'Acme',symbol:'ACME',price:'$100',change:'+0.50%'}],acmeChange:'+0.50%',
    watchlistSummary:'Acme: $100 (+0.50%)',
    headlinesList:['Example source headline about corporate earnings.'],headlinesLinks:['https://example.com/news'],
  };
}
export function validAnalysis(edition) {
  return {sentiment:'Bearish',confidence:'High',claims:[{claim:'Equities face pressure.',basedOn:[edition === 'CN' ? 'csi300Change' : 'sp500Change'],direction:'supports_bearish'}],
    interpretation:'Conditions remain uncertain.',wisdom:'Keep a margin of safety.'};
}
export function pipeline(edition, candidate, {data = groundTruth(edition),state = {},context = {}} = {}) {
  const suffix = suffixFor(edition);
  const items = [{json:data},{json:{text:typeof candidate === 'string' ? candidate : JSON.stringify(candidate)}}];
  const verified = runNode('verify-ai-analysis' + suffix,items,{state,context});
  const message = runNode('compose-telegram-message' + suffix,verified,{state,context})[0].json.message;
  const prepared = runNode('prepare-dashboard-data' + suffix,verified,{state,context});
  return {verified,data:verified[0].json,message,payload:prepared.length ? JSON.parse(prepared[0].json.dashboardJson) : null,state};
}

// Pinned source-format snapshots from docs/data/latest-{us,cn}.json as reviewed
// on 2026-09-10 (published August 9/10). These are rendering regression fixtures,
// not a statement about current markets or independent verification of the feed.
const publishedFacts = {
  US: {
    buffettIndicator:'136%',shillerPE:'42.4',yieldCurve:'+0.44%',sp500VsMa200:'+10.0%',maSignal:'Golden Cross',fearGreedValue:64,
    sp500:'7757.64',sp500Change:'+0.62%',dowJones:'54036.93',dowJonesChange:'+0.28%',vix:'14.90',vixChange:'-1.65%',
    gold:'$4399.70',goldChange:'+2.33%',oil:'$78.18',oilChange:'+1.15%',dxy:'99.60',dxyChange:'+0.07%',btc:'$65,123',btcChange:'+0.33%',
    gdpValue:'+1.5% (QoQ)',cpiValue:'3.46%',unemploymentValue:'4.1%',fedRateValue:'3.75%',treasury10Y:'4.69%',treasury2Y:'4.25%',
    googlChange:'-0.96%',babaChange:'+1.26%',adbeChange:'+1.91%',sofiChange:'+1.55%',asmlChange:'+2.15%',
  },
  CN: {
    csi300:'4,702.03',csi300Change:'+0.16%',sseComposite:'3,966.59',sseCompositeChange:'+0.67%',szseComponent:'14,316.96',szseComponentChange:'+0.04%',
    hangSeng:'25,937.49',hangSengChange:'+1.05%',gold:'$4,414.20',goldChange:'+0.33%',usdCny:'6.7442',usdCnyChange:'+0.10%',
    gdpValue:'+4.96%',cpiValue:'0.06%',unemploymentValue:'4.62%',moutaiChange:'+3.03%',catlChange:'+1.86%',bydChange:'+1.23%',alibabaChange:'+2.34%',tencentChange:'+0.54%',
  },
};
export function publishedSourceFixture(edition) {
  const facts = structuredClone(publishedFacts[edition]);
  const names = edition === 'US' ? ['GOOGL','BABA','ADBE','SOFI','ASML'] : ['Moutai','CATL','BYD','Alibaba','Tencent'];
  const data = {
    ...facts,_health:{status:'OK',missing:[],suspect:[]},
    [edition === 'US' ? 'sp500MarketTime' : 'csi300MarketTime']:1789066800,
    stockDetails:names.map(name=>({name,change:facts[name.toLowerCase()+'Change']})),
    watchlistSummary:edition === 'US' ? '  GOOGL: $354.30 (-0.96%)\n  BABA: $128.41 (+1.26%)' : '▲ Moutai (600519.SS): ¥1,348.86 (+3.03%)\n▲ CATL (300750.SZ): ¥393.87 (+1.86%)',
    gdpYear:edition === 'US' ? 'Apr 2026' : '2025',cpiYear:edition === 'US' ? 'Jun 2026' : '2025',unemploymentYear:edition === 'US' ? 'Jul 2026' : '2025',
    fearGreedClassification:'Greed',fearGreedChange1d:'+4',fearGreedChange1w:'+18',
    buffettStatus:'Slightly Overvalued',buffettEmoji:'🟡',shillerStatus:'Strongly Overvalued',shillerEmoji:'🔴',
    yieldCurveStatus:'Flat (Caution)',yieldCurveEmoji:'🟡',sp500VsMa200Status:'Strong Bullish',sp500VsMa200Emoji:'🟢🟢',
    headlinesList:edition === 'US' ? ["S&P 500 sales growth is at a nearly 5-year high. Here's what's behind the surge."] : ['China, Its Economy Stumbling, Signals Only Cautious Support'],
    headlinesLinks:edition === 'US'
      ? ['https://www.marketwatch.com/story/s-p-500-sales-growth-is-at-a-nearly-5-year-high-heres-whats-behind-the-surge-a4ccf06d?mod=mw_rss_topstories']
      : ['https://news.google.com/rss/articles/CBMifEFVX3lxTE9TRmNOT1NtYjRsTW4xOWJ6X3dHMmpLYkp4QThERHMwTXpwT2FPVW5wWDg0dGE4VUI5WXBvR3pZSnRNSWFXT0t6eW15YkQwd1A0U19LOVhQZDYyLUNVU3J1OFZVWS1iTlVPaXZyOHdSSmtHNTZ1Yk9IaDJLZFY?oc=5'],
  };
  const keys = [...Object.keys(facts),'headline_1'];
  const claims = [];
  for (let i = 0; i < keys.length; i += 12) claims.push({claim:'Available readings warrant a measured assessment.',basedOn:keys.slice(i,i+12),direction:'neutral'});
  const analysis = {sentiment:'Neutral',confidence:'Medium',claims,interpretation:'The source readings provide context for a cautious assessment.',wisdom:'Keep a margin of safety.'};
  return {facts,data,analysis};
}
