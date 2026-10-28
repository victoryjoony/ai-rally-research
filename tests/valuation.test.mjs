import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {modelTarget,modelValue} from '../scripts/valuation.mjs';
test('Enterprise value below debt cannot become a negative stock price',()=>{
 const s={modelKind:'ev-sales',models:{base:{revenueB:12,multiple:3,netDebtB:65,sharesB:.75}},price:80};
 const v=modelValue(s);assert.equal(v.target,0);assert.equal(v.ret,-1);assert.equal(v.discount,null);
});
test('Enterprise valuation subtracts net debt and uses every economic share',()=>{
 const s={modelKind:'ev-sales',models:{base:{revenueB:5,multiple:4,netDebtB:-1,sharesB:.7}}};
 assert.ok(Math.abs(modelTarget(s)-30)<1e-10);assert.ok(Math.abs(modelTarget(s,'base',2)-15)<1e-10);
});
test('Normalized net margin includes dilution before applying the earnings multiple',()=>{
 const s={modelKind:'net-margin',models:{base:{revenueB:4.5,netMargin:.035,sharesB:.24,multiple:20}}};
 assert.ok(Math.abs(modelTarget(s)-13.125)<1e-10);
});
test('REIT per-share model does not subtract debt a second time',()=>{
 const s={modelKind:'per-share',models:{base:{perShare:10,multiple:21}},price:180};
 assert.equal(modelTarget(s),210);assert.ok(Math.abs(modelValue(s).pv-210/1.12**2)<1e-10);
});
test('Every individually named investment candidate has exactly one model',()=>{
 const main=JSON.parse(fs.readFileSync(new URL('../src/research.json',import.meta.url))),extra=JSON.parse(fs.readFileSync(new URL('../src/coverage.json',import.meta.url)));
 const tickers=[...main.stocks,...extra.stocks].map(s=>s.ticker);
 assert.equal(new Set(tickers).size,20);
 for(const t of ['NVDA','AVGO','META','AMZN','COHR','VRT','GOOGL','MSFT','LRCX','ETN','MU','LITE','SYM','TER','TSLA','DLR','EQIX','CRWV','FLNC','INTC'])assert.ok(tickers.includes(t));
 for(const s of extra.stocks)for(const k of ['bear','base','bull'])assert.ok(Number.isFinite(modelTarget(s,k)));
});
