const EXTENDED=REPORT.extended||[];
const UNIVERSE=[...STOCKS,...EXTENDED];
function coverageValue(s,k='base',r=12){return s.modelKind?modelValue(s,k,r,REPORT.remainingYears):value(s,k,r,0);}
function coverageClass(s,v){
 if(!(s.price>0))return ['가격 미확인','watch'];
 if(v.pv===0)return ['자본가치 없음','risk'];
 return verdict(v.discount);
}
function renderCoverage(){
 const k=$('coverageScenario').value,r=Number($('coverageDiscount').value),term=$('coverageSearch').value.trim().toLowerCase();
 const rows=UNIVERSE.map(s=>({s,v:coverageValue(s,k,r)})).filter(({s,v})=>(!term||(s.ticker+' '+s.name+' '+s.sector).toLowerCase().includes(term))&&(!$('coverageOnlyValue').checked||(v.discount!==null&&v.discount>=.2)))
 .sort((a,b)=>(b.v.discount??-Infinity)-(a.v.discount??-Infinity));
 $('coverageCount').textContent=rows.length+' / '+UNIVERSE.length+'개 · '+labels[k]+' 시나리오 · 연 할인율 '+r+'% · 목표 2028.10.26 · 모든 모형 가정은 분석자 판단';
 $('coverageRows').innerHTML=rows.map(({s,v})=>{
  const [label,kind]=coverageClass(s,v),impact=s.live?.impact||{};
  const date=s.priceDate||'미확인',stale=s.live?.quote?.status!=='ok';
  return '<tr><td><button type="button" class="stock-btn" data-coverage-ticker="'+s.ticker+'">'+s.ticker+'</button><span class="company-name">'+esc(s.name)+'</span></td><td>'+esc(s.sector)+'<span class="per-year">'+esc(s.metric||'정상화 조정 EPS × PER')+'</span></td><td>'+(s.price>0?usd(s.price,2):'미확인')+'<span class="per-year">'+date+(stale?' · 가격 지연':'')+'</span></td><td>'+usd(v.target,2)+'</td><td>'+usd(v.pv,2)+'</td><td class="'+(v.ret===null?'':cls(v.ret))+'">'+(v.ret===null?'—':pct(v.ret))+'</td><td>'+(v.discount===null?'산정 불가':pct(v.discount))+'</td><td><span class="tag '+kind+'">'+label+'</span></td><td><span class="tag '+(impact.review?'watch':'weak')+'">'+esc(impact.label||'확인 필요')+'</span><span class="per-year">'+esc((s.live?.errors||[]).join(' / '))+'</span></td></tr>';
 }).join('');
}
function modelFormula(s,k){
 const m=s.models[k],factor=s.splitFactor||1;
 if(s.modelKind==='per-share')return esc(s.metric)+' '+usd(m.perShare,2)+' × '+m.multiple+'배'+(factor!==1?' ÷ 분할비율 '+factor:'');
 if(s.modelKind==='net-margin')return '연매출 $'+m.revenueB+'B × 세후 정상화 순마진 '+(m.netMargin*100).toFixed(1)+'% ÷ 희석 경제적 지분 '+m.sharesB+'B주 × PER '+m.multiple+'배'+(factor!==1?' ÷ 분할비율 '+factor:'');
 return 'max(0, 연매출 $'+m.revenueB+'B × EV/매출 '+m.multiple+'배 − 순부채 $'+m.netDebtB+'B) ÷ 희석 경제적 지분 '+m.sharesB+'B주'+(factor!==1?' ÷ 분할비율 '+factor:'');
}
function renderExtendedDetails(){
 $('extendedDetails').innerHTML=EXTENDED.map(s=>{
  const reference=s.referencePerShare?'회사 가이던스 기준 P/'+esc(s.metric)+' '+(s.price>0?(s.price/(s.referencePerShare/(s.splitFactor||1))).toFixed(1)+'배':'미확인')+' · '+esc(s.referenceLabel)+' '+usd(s.referencePerShare,2)+' (2026.10.27 확인·고정)':'';
  const m=s.models.base,factor=s.splitFactor||1;
  const required=s.price>0?(s.modelKind==='ev-sales'?((s.price*factor*m.sharesB+m.netDebtB)/m.multiple):s.modelKind==='net-margin'?(s.price*factor/m.multiple*m.sharesB/m.revenueB*100):(s.price*factor/m.multiple)):null;
  const reqText=required===null?'가격 조회 후 계산':s.modelKind==='ev-sales'?'현재 가격을 정당화할 목표일 매출 약 $'+required.toFixed(2)+'B':s.modelKind==='net-margin'?'현재 가격을 정당화할 목표일 순마진 약 '+required.toFixed(1)+'%':'현재 가격을 정당화할 목표일 '+s.metric+' 약 '+usd(required,2);
  return '<details id="model-'+s.ticker+'"><summary>'+s.ticker+' · '+esc(s.name)+' — '+esc(s.metric)+' / 위험 '+esc(s.risk)+'</summary><p class="note"><b>관측 사실 · '+s.primaryDate+'</b><br>'+esc(s.fact)+' <a href="'+esc(s.primary)+'" target="_blank" rel="noopener noreferrer">공식 원문 ↗</a></p>'+(reference?'<p class="note">'+reference+'</p>':'')+'<p class="note"><b>가정의 출발점</b><br>'+esc(s.anchor)+'</p><p class="note"><b>배수·회계 처리 근거</b><br>'+esc(s.rationale)+'</p><div class="table-scroll"><table class="scenario-table"><thead><tr><th>시나리오</th><th>목표일 산식 · 모두 분석 가정</th><th>목표 가격</th><th>현재가치 / 연 12%</th><th>가격 여력</th></tr></thead><tbody>'+['bear','base','bull'].map(k=>{const v=coverageValue(s,k,12);return '<tr><td>'+labels[k]+'</td><td style="text-align:left;min-width:300px">'+modelFormula(s,k)+'</td><td>'+usd(v.target,2)+'</td><td>'+usd(v.pv,2)+'</td><td>'+(v.ret===null?'—':pct(v.ret))+'</td></tr>';}).join('')+'</tbody></table></div><p class="note"><b>역산 검증:</b> '+esc(reqText)+' — 기준 시나리오의 나머지 가정을 유지하고 할인 없이 계산한 필요 수준이다. 연 12% 요구수익률까지 충족하려면 더 높은 이익·매출이 필요하다.</p><p class="note"><b>다음 공시 확인:</b> '+esc(s.watch)+'</p><p class="note">가정 검토 2026.10.27 · 목표 2028.10.26 · 순부채 음수는 순현금. 미래 순부채·주식수는 현재 공시 수치가 아닌 조달·희석 가정이다. 시나리오는 확률 가중 목표가·최대 손실 한도가 아니다. EV/매출은 이익·교체투자 검증을 대신하지 못한다.</p></details>';
 }).join('');
}
function openCoverageStock(ticker){
 if(STOCKS.some(s=>s.ticker===ticker))selectStock(ticker,true);
 else {const target=$('model-'+ticker);if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}}
}
for(const id of ['coverageScenario','coverageDiscount','coverageOnlyValue'])$(id).addEventListener('change',renderCoverage);
$('coverageSearch').addEventListener('input',renderCoverage);
$('all-coverage').addEventListener('click',e=>{const b=e.target.closest('[data-coverage-ticker]');if(b)openCoverageStock(b.dataset.coverageTicker);});
renderCoverage();renderExtendedDetails();
