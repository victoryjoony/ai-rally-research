import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeRevision} from '../scripts/server-model.mjs';
const models={bear:[6,15],base:[10,20],bull:[15,25]};
const stock={ticker:'TEST',...structuredClone(models)};
const anchor={period:'2026-06-30',ttmRevenue:100,ttmOperatingMargin:.2,models};
const current={quote:{status:'ok',splitFactor:1},financials:{status:'ok',period:'2026-09-30',ttmRevenue:110,ttmOperatingMargin:.2}};
test('New TTM period scales earnings once from immutable anchor and preserves multiples',()=>{
 const p=proposeRevision(stock,anchor,current,{status:'ok',unreviewed:false});
 assert.equal(p.status,'revised');assert.deepEqual(p.after.base,[11,20]);
 assert.equal(proposeRevision({...stock,...p.after},anchor,current,{status:'ok',unreviewed:false}).status,'unchanged');
});
test('Initial synchronization and same period cannot claim a new forecast update',()=>{
 assert.equal(proposeRevision(stock,null,current).status,'held');
 assert.equal(proposeRevision(stock,anchor,{...current,financials:{...current.financials,period:anchor.period}}).status,'unchanged');
});
test('A structural move beyond the cumulative limit is held, not capped repeatedly',()=>{
 assert.equal(proposeRevision(stock,anchor,{...current,financials:{...current.financials,ttmRevenue:130}},{status:'ok'}).status,'held');
});
test('Missing SEC evidence prevents an upward revision',()=>{
 assert.equal(proposeRevision(stock,anchor,current,{status:'unavailable'}).status,'held');
 assert.equal(proposeRevision(stock,anchor,current,{status:'ok',unreviewed:true}).status,'held');
});
test('Risk warnings, split units, missing margin and FFO are not overwritten',()=>{
 const d={status:'ok'};
 assert.equal(proposeRevision({...stock,riskReview:{}},anchor,current,d).status,'held');
 assert.equal(proposeRevision({...stock,referencePerShare:10},anchor,current,d).status,'held');
 assert.equal(proposeRevision(stock,anchor,{...current,quote:{status:'ok',splitFactor:2}},d).status,'held');
 assert.equal(proposeRevision(stock,anchor,{...current,financials:{...current.financials,ttmOperatingMargin:null}},d).status,'held');
});
test('EV revenue overlay never invents a debt or share count change',()=>{
 const s={ticker:'EV',modelKind:'ev-sales',models:{bear:{revenueB:3,multiple:2,netDebtB:4,sharesB:.5},base:{revenueB:5,multiple:4,netDebtB:4,sharesB:.5},bull:{revenueB:8,multiple:6,netDebtB:4,sharesB:.5}}};
 const p=proposeRevision(s,{...anchor,models:s.models},current,{status:'ok'});
 assert.deepEqual(p.after.base,{revenueB:5.5,multiple:4,netDebtB:4,sharesB:.5});
});
