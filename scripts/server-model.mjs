// Deterministic sensitivity overlay. This does not read guidance or predict consensus.
export function proposeRevision(stock, anchor, current, disclosure) {
 const f=current?.financials, q=current?.quote;
 const hold=reason=>({status:'held',reason});
 if(!anchor)return hold('최초 비교 기준 수집 대기');
 if(!f||f.status!=='ok'||q?.status!=='ok')return hold('가격·재무 자료 지연');
 if(q.splitFactor!==1)return hold('분할 후 단위 확인 필요');
 if(f.period<=anchor.period)return {status:'unchanged',reason:'비교 기준 이후 새 분기 없음'};
 if(stock.riskReview)return hold('지속 공시·실행 위험: 수치 규칙으로 변경하지 않음');
 if(stock.referencePerShare)return hold('FFO/AFFO는 GAAP 영업마진으로 대체하지 않음');
 if(stock.ticker==='MU'||stock.ticker==='INTC')return hold('경기 정상화·턴어라운드는 별도 판단 필요');
 if(!(anchor.ttmRevenue>0&&f.ttmRevenue>0))return hold('연속 4분기 매출 자료 부족');
 let factor=f.ttmRevenue/anchor.ttmRevenue;
 if(stock.modelKind!=='ev-sales'){
  if(!(anchor.ttmOperatingMargin>0&&f.ttmOperatingMargin>0))return hold('정상 영업마진 비교 불가');
  factor*=f.ttmOperatingMargin/anchor.ttmOperatingMargin;
 }
 // Refuse large moves rather than repeatedly ratcheting a cap each day.
 if(!Number.isFinite(factor)||factor<.8||factor>1.2)return hold('기준 대비 ±20% 초과: 구조 변화 직접 검토 필요');
 if(Math.abs(factor-1)<.03)return {status:'unchanged',reason:'기준 대비 변화 3% 미만'};
 if(factor>1&&(disclosure?.status!=='ok'||disclosure?.unreviewed))return hold('공시 접근 실패·새 공시: 상향 보류');
 const before=structuredClone(stock.models||Object.fromEntries(['bear','base','bull'].map(k=>[k,stock[k]])));
 const after=structuredClone(anchor.models);
 for(const k of ['bear','base','bull']){
  if(Array.isArray(after[k]))after[k][0]=+(after[k][0]*factor).toFixed(4);
  else if(stock.modelKind==='per-share')after[k].perShare=+(after[k].perShare*factor).toFixed(4);
  else after[k].revenueB=+(after[k].revenueB*factor).toFixed(4);
 }
 if(JSON.stringify(before)===JSON.stringify(after))return {status:'unchanged',reason:'이미 반영한 값'};
 return {status:'revised',factor,before,after,reason:'서버 규칙 민감도: 기준 대비 TTM 매출'+(stock.modelKind==='ev-sales'?'':' × TTM 영업마진')+' 변화 반영. 성장률·마진 가정·배수·순부채·주식수는 유지; 공식 전망 재해석 아님'};
}
