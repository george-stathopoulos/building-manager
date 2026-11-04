export type FuelApartment={id:string;code:string;heating_share_bp:number};
export type FuelReading={apartment_id:string;measured_on:string;reading:number};
export type FuelTank={measured_on:string;centimeters:number};
export type FuelDelivery={delivered_on:string;liters:number};
export type FuelPayment={apartment_id:string;paid_on:string;amount_cents:number};
export type FuelOpening={apartment_id:string;as_of:string;deposited_cents:number;estimated_consumed_cents:number;note:string};
export type FuelSettings={liters_per_cm:number;price_cents_per_liter:number};
export type FuelPeriod={start:string;end:string;hours:number;liters:number;cost_cents:number};
export type FuelAccount={
 apartment_code:string;opening:FuelOpening|null;deposits_cents:number|null;
 estimated_cost_cents:number;estimated_balance_cents:number|null;
 hours:number;estimated_liters:number;estimated_hourly_cost_cents:number|null;
 remaining_hours:number|null;periods:FuelPeriod[];warnings:string[];
};
type Input={apartments:FuelApartment[];readings:FuelReading[];tank:FuelTank[];deliveries:FuelDelivery[];payments:FuelPayment[];openings:FuelOpening[];settings:FuelSettings};
function distribute(total:number,weights:number[]):number[]{
 const totalWeight=weights.reduce((a,b)=>a+b,0);
 if(totalWeight<=0)return weights.map(()=>0);
 const exact=weights.map(w=>total*w/totalWeight);
 const allocated=exact.map(Math.floor);
 const extra=total-allocated.reduce((a,b)=>a+b,0);
 const order=exact.map((value,i)=>({i,remainder:value-Math.floor(value)})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let i=0;i<extra;i++)allocated[order[i].i]++;
 return allocated;
}
export function calculateFuelAccounts(input:Input):{accounts:FuelAccount[];excluded:string[];periodCount:number}{
 const tank=[...input.tank].sort((a,b)=>a.measured_on.localeCompare(b.measured_on));
 const readingsByKey=new Map(input.readings.map(r=>[r.measured_on+'|'+r.apartment_id,r.reading]));
 const accounts=input.apartments.map(a=>({
  apartment_code:a.code,opening:input.openings.find(o=>o.apartment_id===a.id)||null,
  deposits_cents:null as number|null,estimated_cost_cents:0,estimated_balance_cents:null as number|null,
  hours:0,estimated_liters:0,estimated_hourly_cost_cents:null as number|null,
  remaining_hours:null as number|null,periods:[] as FuelPeriod[],warnings:[] as string[]
 }));
 const excluded:string[]=[];
 let allWeightedHours=0,allFuelCost=0,periodCount=0;
 for(let t=1;t<tank.length;t++){
  const start=tank[t-1],end=tank[t];
  const changes=input.apartments.map(a=>{
   const prev=readingsByKey.get(start.measured_on+'|'+a.id),next=readingsByKey.get(end.measured_on+'|'+a.id);
   return prev===undefined||next===undefined?null:Math.round((next-prev)*100)/100;
  });
  if(changes.some(x=>x===null||x<0)){excluded.push(start.measured_on+' → '+end.measured_on+': missing or decreasing meter readings');continue;}
  const hours=changes as number[];
  const totalHours=hours.reduce((a,b)=>a+b,0);
  if(totalHours<=0){excluded.push(start.measured_on+' → '+end.measured_on+': no recorded heating hours');continue;}
  // Deliveries on the START day are assumed to follow that day's pre-refill tank reading.
  // A delivery on the END day belongs to the next interval. The assumption is disclosed in UI.
  const delivered=input.deliveries.filter(d=>d.delivered_on>=start.measured_on&&d.delivered_on<end.measured_on).reduce((a,b)=>a+b.liters,0);
  const liters=(start.centimeters-end.centimeters)*input.settings.liters_per_cm+delivered;
  if(!Number.isFinite(liters)||liters<0){excluded.push(start.measured_on+' → '+end.measured_on+': tank movement/refills require review');continue;}
  const totalLitersCenti=Math.round(liters*100);
  const costCents=Math.round(liters*input.settings.price_cents_per_liter);
  const weighted=hours.map((v,i)=>v*input.apartments[i].heating_share_bp);
  const portions=distribute(totalLitersCenti,hours);
  const costs=distribute(costCents,weighted);
  allWeightedHours+=weighted.reduce((a,b)=>a+b,0);
  allFuelCost+=costCents;
  periodCount++;
  accounts.forEach((account,i)=>{
   const part={start:start.measured_on,end:end.measured_on,hours:hours[i],liters:portions[i]/100,cost_cents:costs[i]};
   account.periods.push(part);
   account.hours+=part.hours;
   account.estimated_liters+=part.liters;
   if(!account.opening||start.measured_on>=account.opening.as_of)account.estimated_cost_cents+=part.cost_cents;
   else if(end.measured_on>account.opening.as_of)account.warnings.push('Unallocated interval overlapping opening date: '+start.measured_on+' → '+end.measured_on);
  });
 }
 accounts.forEach((account,i)=>{
  const apt=input.apartments[i];
  account.hours=Math.round(account.hours*100)/100;
  account.estimated_liters=Math.round(account.estimated_liters*100)/100;
  if(account.opening){
   const newDeposits=input.payments.filter(p=>p.apartment_id===apt.id&&p.paid_on>account.opening!.as_of).reduce((n,p)=>n+p.amount_cents,0);
   account.deposits_cents=account.opening.deposited_cents+newDeposits;
   account.estimated_cost_cents+=account.opening.estimated_consumed_cents;
   account.estimated_balance_cents=account.deposits_cents-account.estimated_cost_cents;
  }
  if(allWeightedHours>0){
   account.estimated_hourly_cost_cents=Math.round(allFuelCost*apt.heating_share_bp/allWeightedHours*100)/100;
   if(account.estimated_balance_cents!==null&&account.estimated_hourly_cost_cents>0){
    account.remaining_hours=Math.round(Math.max(0,account.estimated_balance_cents)/account.estimated_hourly_cost_cents*100)/100;
   }
  }
  if(excluded.length)account.warnings.push(excluded.length+' heating periods excluded from estimates');
 });
 return {accounts,excluded,periodCount};
}
