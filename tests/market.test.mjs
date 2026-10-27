import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuote,normalizeFinancials,assessImpact} from '../scripts/market.mjs';
const epoch=s=>Date.parse(s)/1000;
function chart(){return {chart:{result:[{meta:{symbol:'NVDA',currency:'USD',exchangeTimezoneName:'America/New_York',currentTradingPeriod:{regular:{start:epoch('2026-10-26T13:30Z'),end:epoch('2026-10-26T20:00Z')}}},timestamp:[epoch('2026-10-23T13:30Z'),epoch('2026-10-26T13:30Z')],indicators:{quote:[{close:[210.96,215]}]}}]}};}
test('Intraday quote is never labelled as a completed closing price',()=>{
 const q=normalizeQuote(chart(),new Date('2026-10-26T15:00Z'));assert.equal(q.date,'2026-10-23');assert.equal(q.close,210.96);
});
test('Completed session close is accepted after settlement buffer',()=>{
 const q=normalizeQuote(chart(),new Date('2026-10-26T20:16Z'));assert.equal(q.date,'2026-10-26');assert.equal(q.close,215);
});
test('A different currency is rejected',()=>{
 const p=chart();p.chart.result[0].meta.currency='EUR';assert.throws(()=>normalizeQuote(p,new Date('2026-10-26T15:00Z')));
});
test('Split after research date scales model EPS but excludes fake daily loss',()=>{
 const p=chart();p.chart.result[0].events={splits:{a:{date:epoch('2026-10-26T13:30Z'),numerator:2,denominator:1}}};
 const q=normalizeQuote(p,new Date('2026-10-26T20:16Z'),'2026-10-23');assert.equal(q.splitFactor,2);assert.equal(q.changePct,null);
});
function series(type,values,period='3M'){return {meta:{type:[type]},[type]:values.map(([date,value])=>({asOfDate:date,periodType:period,currencyCode:'USD',reportedValue:{raw:value}}))};}
function facts(extra=[]){return {timeseries:{result:[series('quarterlyTotalRevenue',[['2025-06-30',100],['2026-06-30',150]]),series('quarterlyOperatingIncome',[['2025-06-30',25],['2026-06-30',30]]),...extra]}};}
test('Margins compare the same prior-year quarter and missing EPS remains null',()=>{
 const f=normalizeFinancials(facts());assert.equal(f.revenueYoY,.5);assert.ok(Math.abs(f.marginChangePP+5)<1e-9);assert.equal(f.ttmEPS,null);
});
test('Negative EPS is retained as a loss rather than an invalid price multiple',()=>{
 const f=normalizeFinancials(facts([series('trailingDilutedEPS',[['2026-06-30',-10]],'TTM')]));
 assert.equal(f.ttmEPS,-10);
});
test('Incomplete quarterly history cannot fabricate TTM EPS',()=>{
 const f=normalizeFinancials(facts([series('quarterlyDilutedEPS',[['2025-12-31',2],['2026-03-31',3],['2026-06-30',4]])]));
 assert.equal(f.ttmEPS,null);
});
test('Noncontiguous quarterly history cannot fabricate TTM EPS',()=>{
 const f=normalizeFinancials(facts([series('quarterlyDilutedEPS',[['2025-03-31',1],['2025-12-31',2],['2026-03-31',3],['2026-06-30',4]])]));assert.equal(f.ttmEPS,null);
});
test('Four contiguous quarters are explicitly marked as an approximation',()=>{
 const f=normalizeFinancials(facts([series('quarterlyDilutedEPS',[['2025-09-30',1],['2025-12-31',2],['2026-03-31',3],['2026-06-30',4]])]));
 assert.equal(f.ttmEPS,10);assert.match(f.epsMethod,/근사/);
});
test('Capex sign conventions cannot overstate free cash flow',()=>{
 for(const value of [-30,30]){
 const f=normalizeFinancials(facts([series('quarterlyOperatingCashFlow',[['2026-06-30',20]]),series('quarterlyCapitalExpenditure',[['2026-06-30',value]])]));assert.equal(f.fcfProxy,-10);
 }
});
const stock={bear:[8,16]};
test('Initial-data fallback is not misreported as a new earnings event',()=>{
 const impact=assessImpact(stock,{financials:{period:'2026-03-31',ttmEPS:8,status:'ok'}},{financials:{period:'2026-06-30',ttmEPS:12,status:'stale'},quote:{close:200}},'2026-10-26',new Date('2026-10-26'));
 assert.equal(impact.isNew,false);
});
test('Review remains active until the model has reviewed the new quarter',()=>{
 const s={...stock,scenarioReviewedPeriod:'2026-06-30'},f={period:'2026-09-30',ttmEPS:12,status:'ok'};
 const impact=assessImpact(s,{financials:f},{financials:f,quote:{close:200}},'2026-10-26',new Date('2026-10-26'));
 assert.equal(impact.isNew,false);assert.equal(impact.review,true);
});
test('First synchronization is not presented as a new earnings announcement',()=>{
 const impact=assessImpact(stock,{}, {financials:{period:'2026-06-30',ttmEPS:10},quote:{close:200}},'2026-10-26',new Date('2026-10-26'));
 assert.equal(impact.isNew,false);
});
test('New quarter requests scenario review without rewriting model assumptions',()=>{
 const before=structuredClone(stock);
 const impact=assessImpact(stock,{financials:{period:'2026-03-31',ttmEPS:10}},{financials:{period:'2026-06-30',ttmEPS:8},quote:{close:200}},'2026-10-26',new Date('2026-10-26'));
 assert.equal(impact.isNew,true);assert.equal(impact.review,true);assert.deepEqual(stock,before);
});
