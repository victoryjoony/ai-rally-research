function renderDaily(){
 const live=REPORT.live||{},health=live.health||{},checked=live.checkedAt?new Date(live.checkedAt):null;
 const fmtDate=d=>d?d.replaceAll('-','.'): '미확인';
 const fmtTime=d=>d?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(d):'첫 갱신 대기';
 const signed=n=>typeof n==='number'?pct(n):'—';
 const money=n=>typeof n==='number'?usd(n/1e9,2)+'B':'—';
 const ageHours=checked?(Date.now()-checked.getTime())/3600000:Infinity,stale=ageHours>36;
 const healthLabel=stale?'자동 갱신 지연':health.status==='ok'?'갱신 완료':health.status==='partial'?'일부 자료 지연':health.status==='failed'?'공급자 조회 실패':'첫 갱신 대기';
 $('dailyStatus').innerHTML='<span class="tag '+(stale||health.status!=='ok'?'watch':'')+'">'+healthLabel+'</span><span>마지막 조회 '+fmtTime(checked)+' KST</span><span>종가 '+(health.quotes??0)+'/'+UNIVERSE.length+' · 재무 '+(health.financials??0)+'/'+UNIVERSE.length+'</span>';
 $('dailyPriceDate').textContent=REPORT.priceDate;
 $('dailyUpdateTime').textContent=checked?fmtTime(checked):'대기 중';
 $('dailyModelDate').textContent=REPORT.baselineAsOf+' · 추가 '+REPORT.coverageAsOf+' / 목표 '+REPORT.horizon;
 $('liveRows').innerHTML=UNIVERSE.map(s=>{
  const x=s.live||{},q=x.quote||{},f=x.financials||{},impact=x.impact||{},errors=x.errors||[];
  const pe=typeof f.ttmEPS==='number'&&f.ttmEPS>0?s.price/f.ttmEPS:null;
  const status=q.status==='ok'&&f.status==='ok'?'자료 정상':'자료 지연·확인 필요';
  return '<tr><td><button type="button" class="stock-btn" data-daily-ticker="'+s.ticker+'">'+s.ticker+'</button><small>'+status+'</small></td><td>'+usd(s.price,2)+'<small>'+fmtDate(s.priceDate)+(q.changePct!==null&&q.changePct!==undefined?' / '+pct(q.changePct/100):'')+'</small></td><td>'+(typeof f.ttmEPS==='number'?usd(f.ttmEPS,2):'미확인')+'<small>기간 '+fmtDate(f.period)+'</small></td><td>'+(pe!==null?pe.toFixed(1)+'×':typeof f.ttmEPS==='number'&&f.ttmEPS<=0?'적자·산정 불가':'미확인')+'</td><td>'+signed(f.revenueYoY)+'<small>영업마진 '+signed(f.operatingMargin)+'</small></td><td>'+money(f.fcfProxy)+'<small>OCF−|설비투자|</small></td><td class="impact-cell"><span class="tag '+(impact.review?'watch':'weak')+'">'+esc(impact.label||'확인 필요')+'</span><small>'+esc((impact.reasons||[]).join(' · '))+'</small>'+(errors.length?'<small class="negative">'+esc(errors.join(' / '))+'</small>':'')+'</td><td><a href="'+esc(f.sourceUrl||s.primary)+'" target="_blank" rel="noopener noreferrer">재무 ↗</a><br><a href="'+esc(s.primary)+'" target="_blank" rel="noopener noreferrer">최초 실적 ↗</a></td></tr>';
 }).join('');
 const events=(live.events||[]).slice(0,12);
 $('dailyEvents').innerHTML=events.length?events.map(e=>'<li><b>'+esc(e.ticker)+'</b> · 자료 기간 '+fmtDate(e.period)+' · 감지 '+fmtTime(new Date(e.detectedAt))+' · '+esc(e.label)+'<br><span class="note">'+esc(e.reasons.join(' · '))+'</span></li>').join(''):'<li>아직 새 분기 실적 변화를 감지하지 않았습니다. 최초 동기화는 새 실적 발표로 세지 않습니다.</li>';
 const candidates=UNIVERSE.map(s=>({s,v:coverageValue(s,'base',12)})).filter(x=>x.s.price>0&&x.v.discount!==null&&x.v.discount>=.2).sort((a,b)=>b.v.discount-a.v.discount).slice(0,3);
 $('heroPicks').innerHTML=candidates.length?candidates.map(({s,v})=>'<div class="lead-pick"><div><span class="ticker">'+s.ticker+'</span><small>'+esc(s.sector)+' · '+esc(s.risk)+'</small></div><div class="lead-num">'+(v.discount*100).toFixed(0)+'%<small>현재 모형가치 대비 가격 할인</small></div></div>').join(''):'<p class="note">현재 기본 가정에서 20% 이상 가격 할인 후보가 없습니다.</p>';
 $('daily').addEventListener('click',e=>{const b=e.target.closest('[data-daily-ticker]');if(b)openCoverageStock(b.dataset.dailyTicker);});
 const elapsed=document.createElement('p');elapsed.className='note';
 elapsed.textContent='가정 검토일 '+REPORT.baselineAsOf+' · 목표일 '+REPORT.horizon+' 고정 · 잔여기간 약 '+REPORT.remainingYears.toFixed(2)+'년. 최근 종가로 가치 여력·PER를 재계산하며 기존 조정 예상 EPS와 미래 EPS·PER 가정은 자동 상향하지 않습니다.';
 $('screen').insertBefore(elapsed,$('screen').children[1]);
}
renderDaily();
