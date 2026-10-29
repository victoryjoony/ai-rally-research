import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {modelTarget} from './valuation.mjs';
import {proposeRevision} from './server-model.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async(name,fallback)=>{try{return JSON.parse(await fs.readFile(root+name,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const write=(name,value)=>fs.writeFile(root+name,JSON.stringify(value,null,2)+'\n');
const research=await read('src/research.json'),coverage=await read('src/coverage.json');
const live=await read('data/live.json'),policy=await read('src/server-policy.json');
const anchors=await read('data/model-anchors.json',{stocks:{}}),overrides=await read('data/model-overrides.json',{stocks:{}});
const history=await read('data/model-revisions.json',{schemaVersion:1,entries:[]});
const previous=await read('data/server-review.json',{stocks:{}});
const now=new Date().toISOString(),universe=[...research.stocks,...coverage.stocks];
const out={checkedAt:now,execution:'GitHub-hosted runner · PC 불필요',method:'공시 목록·문자열 탐지 및 제한된 수치 민감도. AI 정독·감사의견 아님',stocks:{},total:universe.length};
const headers={'User-Agent':'AI Rally Research victoryjoony (64259631+victoryjoony@users.noreply.github.com)','Accept':'application/json,text/html'};
async function get(url,json=true){const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return json?r.json():r.text();}
function plain(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');}
const terms=[/material weakness/ig,/restatement/ig,/non-reliance/ig,/subpoena/ig,/Department of Justice/ig,/securities litigation/ig,/going concern/ig];
let secUnavailable=null;
for(const s of universe){
 const current=live.stocks[s.ticker],old=previous.stocks?.[s.ticker];
 const d={checkedAt:now,status:'unavailable',unreviewed:true,documents:[],matches:[],note:'기존 회계·소송 의혹 전수조사와 구분'};
 try{
  if(secUnavailable)throw Error(secUnavailable);
  const cik=policy.ciks[s.ticker];if(!cik)throw Error('CIK 미등록');
  const url='https://data.sec.gov/submissions/CIK'+String(cik).padStart(10,'0')+'.json';
  const p=await get(url),r=p.filings?.recent;if(!r?.form)throw Error('공시 목록 누락');
  const docs=r.form.map((form,i)=>({form,date:r.filingDate[i],accession:r.accessionNumber[i],url:'https://www.sec.gov/Archives/edgar/data/'+Number(cik)+'/'+r.accessionNumber[i].replaceAll('-','')+'/'+r.primaryDocument[i]})).filter(x=>/^(10-Q|10-K|20-F|8-K|6-K)(\/A)?$/.test(x.form));
  d.sourceUrl=url;d.status='ok';d.documents=docs.slice(0,12);
  // A new filing requires interpretation even if no keyword is found.
  d.unreviewed=docs.some(x=>x.date>(s.asOf||research.asOf));
  const scan=docs.filter(x=>x.date>(s.asOf||research.asOf)).slice(0,3);
  if(!old&&scan.length===0&&docs[0])scan.push(docs[0]);
  d.scanned=old?.scanned||[];
  for(const doc of scan){
   if(d.scanned.some(x=>x.accession===doc.accession))continue;
   try{
    const text=plain(await get(doc.url,false));
    const matches=terms.flatMap(re=>{re.lastIndex=0;const m=re.exec(text);return m?[{term:m[0],context:text.slice(Math.max(0,m.index-100),m.index+240),url:doc.url}]:[];});
    d.matches.push(...matches);d.scanned.push({...doc,checkedAt:now,matches});
   }catch(e){d.unreviewed=true;d.documentError=e.message;}
  }
  d.scanned=d.scanned.slice(-24);
  if(d.scanned.some(x=>x.date>(s.asOf||research.asOf)&&x.matches?.length))d.unreviewed=true;
 }catch(e){d.error=e.message;if(!secUnavailable&&(e.message.includes('HTTP 403')||e.message.includes('HTTP 429')))secUnavailable='SEC 접근 제한: '+e.message;}
 const rawModels=structuredClone(s.models||Object.fromEntries(['bear','base','bull'].map(k=>[k,s[k]])));
 if(!anchors.stocks[s.ticker]&&current?.financials?.status==='ok'&&current.financials.ttmRevenue>0&&current.quote?.splitFactor===1){
  anchors.stocks[s.ticker]={createdAt:now,period:current.financials.period,ttmRevenue:current.financials.ttmRevenue,ttmOperatingMargin:current.financials.ttmOperatingMargin,models:rawModels};
 }
 const active=overrides.stocks[s.ticker];
 const model=structuredClone(s);
 if(active){if(s.models)model.models=active.models;else for(const k of ['bear','base','bull'])model[k]=active.models[k];}
 let proposal=proposeRevision(model,anchors.stocks[s.ticker],current,d);
 // Manual changes supersede the anchor; do not silently put an old model back.
 if(anchors.stocks[s.ticker]&&JSON.stringify(anchors.stocks[s.ticker].models)!==JSON.stringify(rawModels))proposal={status:'held',reason:'분석자가 원본 가정을 변경함: 비교 기준 재설정 필요'};
 if(proposal.status==='revised'){
  const years=Math.max(.01,(Date.parse(research.horizon+'T00:00:00Z')-Date.parse(now))/(365.25*86400000));
  const target=models=>s.models?modelTarget({...s,models},'base'):models.base[0]*models.base[1];
  const b=target(proposal.before),a=target(proposal.after);
  history.entries.push({ticker:s.ticker,reviewedAt:now,reviewPeriod:current.financials.period,reason:proposal.reason,sources:[current.financials.sourceUrl],before:proposal.before,after:proposal.after,valuationImpact:{beforeTarget:b,afterTarget:a,beforePV:b/1.12**years,afterPV:a/1.12**years},method:'server-rule',factor:proposal.factor});
  overrides.stocks[s.ticker]={models:proposal.after,asOf:now,period:current.financials.period,reason:proposal.reason};
 }
 out.stocks[s.ticker]={disclosure:d,model:{status:proposal.status,reason:proposal.reason,period:current?.financials?.period}};
 if(current){current.serverReview={status:d.status,unreviewed:d.unreviewed};if(d.unreviewed){current.impact.review=true;if(!s.riskReview)current.impact.label='공시 확인 필요';current.impact.reasons.push(d.status==='ok'?'검토일 이후 공시: 문맥 확인 필요':'SEC 조회 불가: 공시 최신성 미확인');}}
 console.log(s.ticker+': disclosures '+d.status+' / model '+proposal.status);
}
out.disclosuresAvailable=Object.values(out.stocks).filter(x=>x.disclosure.status==='ok').length;
out.revised=Object.values(out.stocks).filter(x=>x.model.status==='revised').length;
history.status='server_rules_active';history.lastServerRunAt=now;
await Promise.all([write('data/server-review.json',out),write('data/model-anchors.json',anchors),write('data/model-overrides.json',overrides),write('data/model-revisions.json',history),write('data/live.json',live)]);
