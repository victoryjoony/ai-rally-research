import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {modelTarget} from './valuation.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=JSON.parse(await fs.readFile(path.join(ROOT,'src/research.json'),'utf8'));
const coverage=JSON.parse(await fs.readFile(path.join(ROOT,'src/coverage.json'),'utf8'));
const scope=JSON.parse(await fs.readFile(path.join(ROOT,'src/research-scope.json'),'utf8'));
const riskAudit=JSON.parse(await fs.readFile(path.join(ROOT,'data/risk-review.json'),'utf8'));
let live={stocks:{},health:{status:'unavailable'},events:[],scheduleKST:'매일 오전 7:00'};
try{live=JSON.parse(await fs.readFile(path.join(ROOT,'data/live.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'data/model-overrides.json'),'utf8'));
const serverReview=JSON.parse(await fs.readFile(path.join(ROOT,'data/server-review.json'),'utf8'));
const anchors=JSON.parse(await fs.readFile(path.join(ROOT,'data/model-anchors.json'),'utf8')); 
const report=structuredClone(baseline);report.baselineAsOf=baseline.asOf;report.live=live;report.serverReview=serverReview;
function applyOverride(s){const x=overrides.stocks[s.ticker];if(!x)return;const original=s.models||Object.fromEntries(['bear','base','bull'].map(k=>[k,s[k]]));if(JSON.stringify(original)!==JSON.stringify(anchors.stocks[s.ticker]?.models))return;s.serverOverlay=x;if(s.models)s.models=structuredClone(x.models);else for(const k of ['bear','base','bull'])s[k]=structuredClone(x.models[k]);}
report.stocks.forEach(applyOverride);coverage.stocks.forEach(applyOverride);
report.scope=scope;report.riskAudit=riskAudit;
report.modelRevisions=JSON.parse(await fs.readFile(path.join(ROOT,'data/model-revisions.json'),'utf8'));
for(const e of report.modelRevisions.entries){if(!e.ticker||!e.reviewedAt||!e.reason||!e.before||!e.after||!e.valuationImpact||!e.reviewPeriod||!e.sources?.length||e.sources.some(u=>!u.startsWith('https://')))throw new Error('Incomplete model revision record');}
report.remainingYears=Math.max(.01,(Date.parse(baseline.horizon+'T00:00:00Z')-Date.parse(live.checkedAt||baseline.asOf))/(365.25*86400000));
const dates=[];
for(const s of report.stocks){
 const current=live.stocks[s.ticker]||{};s.baselinePrice=s.price;s.baselineEPS=s.gaapEPS;s.live=current;
 s.priceDate=current.quote?.date||baseline.priceDate;
 if(current.quote?.close>0)s.price=current.quote.close;
 dates.push(s.priceDate);
 const factor=current.quote?.splitFactor||1;s.splitFactor=factor;
 s.eps27/=factor;if(s.eps28!==null)s.eps28/=factor;
 for(const key of ['bear','base','bull'])s[key][0]/=factor;
 s.gaapEPS=typeof current.financials?.ttmEPS==='number'?current.financials.ttmEPS:null;
 if(current.financials?.shares>0){s.sharesB=current.financials.shares/1e9;s.sharesDate=current.financials.period;}
 else{s.sharesB*=factor;s.sharesDate=baseline.asOf;}
}
const unique=[...new Set(dates)];report.priceDate=unique.length===1?unique[0]:'종목별 기준일';
report.coverageAsOf=coverage.asOf;
report.extended=coverage.stocks.map(s=>{
 const current=live.stocks[s.ticker]||{},quote=current.quote||{};
 const x={...s,live:current,price:quote.close??null,priceDate:quote.date??null,splitFactor:quote.splitFactor||1};
 for(const k of ['bear','base','bull'])modelTarget(x,k);
 return x;
});
report.total=report.stocks.length+report.extended.length;
const allDates=[...new Set([...dates,...report.extended.map(s=>s.priceDate||'미확인')])];
report.priceDate=allDates.length===1?allDates[0]:'종목별 기준일';
let template=await fs.readFile(path.join(ROOT,'src/template.html'),'utf8');
for(const [marker,name] of [['/*__LIVE_CSS__*/','live.css'],['<!--__LIVE_PANEL__-->','live-panel.html'],['<!--__PHYSICAL_AI__-->','physical-ai.html'],['<!--__COVERAGE_PANEL__-->','coverage-panel.html'],['/*__COVERAGE_UI__*/','coverage-ui.js'],['/*__DAILY_UI__*/','daily-ui.js']]){
 if(!template.includes(marker))throw new Error('Missing source marker: '+name);
 const fragment=await fs.readFile(path.join(ROOT,'src',name),'utf8');
 template=template.replace(marker,()=>fragment);
}
const modelCode=(await fs.readFile(path.join(ROOT,'scripts/valuation.mjs'),'utf8')).replaceAll('export function','function');
function renderPage(source,view){return source.replace('/*__MODEL_FUNCTIONS__*/',()=>modelCode).replace('/*__REPORT_DATA__*/',()=>JSON.stringify({...report,view}).replace(/</g,'\\u003c'));}
const mainTemplate=template.replace(/<(tr|div|p)\b(?=[^>]*data-scope-ticker="([A-Z]+)")[^>]*>[\s\S]*?<\/\1>/g,(match,tag,ticker)=>scope.observation[ticker]?'':match);
const html=renderPage(mainTemplate,'core'),archive=renderPage(template,'archive');
if(html.includes('/*__REPORT_DATA__*/'))throw new Error('Data injection failed');
for(const page of [html,archive])for(const m of page.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('application/json'))new vm.Script(m[1]);
await fs.mkdir(path.join(ROOT,'dist/data'),{recursive:true});
await fs.writeFile(path.join(ROOT,'index.html'),html);await fs.writeFile(path.join(ROOT,'dist/index.html'),html);
await fs.writeFile(path.join(ROOT,'archive.html'),archive);await fs.writeFile(path.join(ROOT,'dist/archive.html'),archive);
await fs.writeFile(path.join(ROOT,'dist/data/risk-review.json'),JSON.stringify(riskAudit));
await fs.writeFile(path.join(ROOT,'dist/.nojekyll'),'');await fs.writeFile(path.join(ROOT,'dist/data/live.json'),JSON.stringify(live));
console.log('Built report: prices '+report.priceDate+' / '+live.health.status);
