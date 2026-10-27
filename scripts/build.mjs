import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=JSON.parse(await fs.readFile(path.join(ROOT,'src/research.json'),'utf8'));
let live={stocks:{},health:{status:'unavailable'},events:[],scheduleKST:'매일 오전 7:00'};
try{live=JSON.parse(await fs.readFile(path.join(ROOT,'data/live.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const report=structuredClone(baseline);report.baselineAsOf=baseline.asOf;report.live=live;
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
let template=await fs.readFile(path.join(ROOT,'src/template.html'),'utf8');
for(const [marker,name] of [['/*__LIVE_CSS__*/','live.css'],['<!--__LIVE_PANEL__-->','live-panel.html'],['<!--__PHYSICAL_AI__-->','physical-ai.html'],['/*__DAILY_UI__*/','daily-ui.js']]){
 if(!template.includes(marker))throw new Error('Missing source marker: '+name);
 template=template.replace(marker,await fs.readFile(path.join(ROOT,'src',name),'utf8'));
}
const html=template.replace('/*__REPORT_DATA__*/',JSON.stringify(report).replace(/</g,'\\u003c'));
if(html.includes('/*__REPORT_DATA__*/'))throw new Error('Data injection failed');
for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('application/json'))new vm.Script(m[1]);
await fs.mkdir(path.join(ROOT,'dist/data'),{recursive:true});
await fs.writeFile(path.join(ROOT,'index.html'),html);await fs.writeFile(path.join(ROOT,'dist/index.html'),html);
await fs.writeFile(path.join(ROOT,'dist/.nojekyll'),'');await fs.writeFile(path.join(ROOT,'dist/data/live.json'),JSON.stringify(live));
console.log('Built report: prices '+report.priceDate+' / '+live.health.status);
