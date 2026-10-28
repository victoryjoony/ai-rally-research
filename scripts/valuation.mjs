export function modelTarget(stock, scenario='base', splitFactor=1) {
 const m=stock.models?.[scenario];
 if(!m||!Number.isFinite(m.multiple)||m.multiple<=0||!Number.isFinite(splitFactor)||splitFactor<=0)throw new Error('Invalid valuation inputs');
 let target;
 if(stock.modelKind==='per-share')target=m.perShare*m.multiple;
 else {
  if(!(m.sharesB>0)||!(m.revenueB>=0))throw new Error('Invalid revenue or diluted shares');
  if(stock.modelKind==='net-margin')target=m.revenueB*m.netMargin/m.sharesB*m.multiple;
  else if(stock.modelKind==='ev-sales')target=Math.max(0,m.revenueB*m.multiple-m.netDebtB)/m.sharesB;
  else throw new Error('Unknown valuation model');
 }
 if(!Number.isFinite(target)||target<0)throw new Error('Invalid equity value');
 return target/splitFactor;
}
export function modelValue(stock,scenario='base',discount=12,years=2){
 const target=modelTarget(stock,scenario,stock.splitFactor||1),pv=target/(1+discount/100)**years;
 const price=stock.price;
 return {target,pv,ret:price>0?target/price-1:null,discount:price>0&&pv>0?1-price/pv:null,cagr:price>0?Math.pow(target/price,1/years)-1:null};
}
