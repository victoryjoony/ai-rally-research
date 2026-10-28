import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeQuote,normalizeFinancials,assessImpact,daysBetween} from './market.mjs';
import {modelTarget} from './valuation.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(ROOT,p),'utf8'));
const research=await read('src/research.json');
const coverage=await read('src/coverage.json');
const universe=[...research.stocks,...coverage.stocks.map(s=>({...s,asOf:coverage.asOf,bear:[modelTarget(s,'bear'),1]}))];
let previous={stocks:{},events:[]};
try{previous=await read('data/live.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const now=new Date(),today=now.toISOString().slice(0,10);
const out={schemaVersion:1,checkedAt:now.toISOString(),scheduleKST:'매일 오전 7:00 (GitHub 실행 지연 가능)',source:'Yahoo Finance 공개 API · 비공식, 서비스 보장 없음',stocks:{},events:previous.events||[],health:{quotes:0,financials:0,total:universe.length,errors:[]}};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url){
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(url,{headers:{'User-Agent':'AI-Rally-Research/1.0 (+https://github.com/victoryjoony/ai-rally-research)','Accept':'application/json'},signal:AbortSignal.timeout(25000)});
    if(response.status===429||response.status>=500){
      if(attempt<2){await pause((attempt+1)*1500);continue;}
    }
    if(!response.ok)throw new Error('공급자 HTTP '+response.status);
    return response.json();
  }
}
const types=['trailingDilutedEPS','quarterlyDilutedEPS','quarterlyTotalRevenue','quarterlyOperatingIncome','quarterlyOperatingCashFlow','quarterlyCapitalExpenditure','quarterlyOrdinarySharesNumber'];
for(const stock of universe){
  const old=previous.stocks[stock.ticker]||{},next=structuredClone(old);
  next.checkedAt=now.toISOString();next.errors=[];
  try{
    const p1=Math.floor(Date.parse(research.asOf+'T00:00:00Z')/1000)-40*86400,p2=Math.ceil(now.getTime()/1000)+86400;
    const quote=await json('https://query1.finance.yahoo.com/v8/finance/chart/'+stock.ticker+'?interval=1d&events=splits&period1='+p1+'&period2='+p2);
    next.quote=normalizeQuote(quote,now,stock.asOf||research.asOf);out.health.quotes++;
  }catch(e){next.errors.push('종가: '+e.message);if(next.quote)next.quote={...next.quote,status:'stale'};}
  await pause(450);
  try{
    const p1=Math.floor(now.getTime()/1000)-850*86400,p2=Math.ceil(now.getTime()/1000);
    const payload=await json('https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/'+stock.ticker+'?symbol='+stock.ticker+'&type='+types.join(',')+'&period1='+p1+'&period2='+p2);
    const facts=normalizeFinancials(payload);
    if(stock.scenarioReviewedPeriod&&daysBetween(facts.period,stock.scenarioReviewedPeriod)>14)throw new Error('최초 리서치보다 오래된 재무자료: 공급자 반영 지연');
    if(next.financials&&facts.period<next.financials.period)throw new Error('재무 기간이 이전 값보다 과거로 후퇴');
    next.financials={...facts,sourceUrl:'https://finance.yahoo.com/quote/'+stock.ticker+'/financials/',fetchedAt:now.toISOString()};out.health.financials++;
  }catch(e){
    next.errors.push('실적: '+e.message);
    if(!next.financials||(stock.scenarioReviewedPeriod&&daysBetween(next.financials.period,stock.scenarioReviewedPeriod)>14)){
      next.financials={period:stock.scenarioReviewedPeriod,ttmEPS:stock.gaapEPS,epsMethod:'최초 리서치 TTM GAAP EPS · 자동 공급자 반영 지연',status:'stale',source:'최초 리서치 확인 값',sourceUrl:stock.primary,fetchedAt:research.asOf+'T00:00:00Z'};
    }else next.financials={...next.financials,status:'stale'};
  }
  next.impact=assessImpact(stock,old,next,stock.asOf||research.asOf,now);
  if(stock.referencePerShare){next.impact.reasons.push('REIT 가치 지표는 고정된 회사 FFO/AFFO 가이던스 기반: 새 공시 수동 검토 필요');}
  if(next.financials&&daysBetween(next.financials.period,today)>150){next.impact.review=true;next.impact.label='시나리오 재검토';next.impact.reasons.push('최근 재무 기간 150일 경과: 공급자 반영 지연 확인');}
  if(next.impact.isNew||next.impact.revised){
    const id=stock.ticker+':'+next.financials.period+':'+next.financials.ttmEPS;
    if(!out.events.some(e=>e.id===id))out.events.unshift({id,ticker:stock.ticker,detectedAt:now.toISOString(),period:next.financials.period,ttmEPS:next.financials.ttmEPS,previousEPS:old.financials?.ttmEPS??null,label:next.impact.label,reasons:next.impact.reasons});
  }
  for(const error of next.errors)out.health.errors.push(stock.ticker+' '+error);
  out.stocks[stock.ticker]=next;
  console.log(stock.ticker+': quote '+(next.quote?.date||'unavailable')+' / financials '+(next.financials?.period||'unavailable')+' / '+next.errors.length+' errors');
  await pause(450);
}
out.events=out.events.slice(0,100);out.health.status=out.health.quotes===0?'failed':out.health.errors.length?'partial':'ok';
await fs.mkdir(path.join(ROOT,'data'),{recursive:true});
const target=path.join(ROOT,'data/live.json'),tmp=target+'.tmp';
await fs.writeFile(tmp,JSON.stringify(out,null,2)+'\n','utf8');await fs.rename(tmp,target);
console.log(JSON.stringify(out.health));
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## Daily market update','Checked: '+out.checkedAt,'Quotes: '+out.health.quotes+'/'+out.health.total+' · Financials: '+out.health.financials+'/'+out.health.total,'Status: '+out.health.status,...out.health.errors.map(x=>'- '+x)];
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
