import type {ReactNode} from 'react';

export type Point={label:string;value:number};
const palette=['#2563eb','#0d9488','#f59e0b','#8b5cf6','#e11d48','#64748b','#16a34a','#ea580c'];
const fmt=(n:number,unit:string)=>new Intl.NumberFormat('el-GR',{maximumFractionDigits:1}).format(n)+(unit?' '+unit:'');
export function BarGraph({data,unit='€'}:{data:Point[];unit?:string}){
 const max=Math.max(1,...data.map(x=>x.value));
 const visible=data.length>12?data.filter((_,i)=>i%Math.ceil(data.length/12)===0||i===data.length-1):data;
 return <div className="report-chart" role="img" aria-label={data.map(x=>x.label+': '+fmt(x.value,unit)).join(', ')}>
  {data.length===0?<p>Δεν υπάρχουν δεδομένα.</p>:<div className="report-bars">{visible.map((p,i)=><div className="report-bar-col" key={p.label+i} title={p.label+': '+fmt(p.value,unit)}><span className="report-bar-value">{fmt(p.value,unit)}</span><div className="report-bar" style={{height:Math.max(2,p.value/max*170)+'px',background:palette[i%palette.length]}}/><span className="report-bar-label">{p.label}</span></div>)}</div>}
 </div>;
}
export function LineGraph({data,unit=''}:{data:Point[];unit?:string}){
 const w=420,h=220,pad=35,max=Math.max(1,...data.map(x=>x.value)),min=Math.min(0,...data.map(x=>x.value));
 const x=(i:number)=>pad+(w-2*pad)*(data.length===1?.5:i/(data.length-1));
 const y=(v:number)=>h-pad-(v-min)/(max-min)*(h-2*pad);
 const points=data.map((d,i)=>x(i)+','+y(d.value)).join(' ');
 return <div className="report-chart" role="img" aria-label={data.map(d=>d.label+': '+fmt(d.value,unit)).join(', ')}>
  {data.length===0?<p>Δεν υπάρχουν δεδομένα.</p>:<><svg viewBox={'0 0 '+w+' '+h} className="report-line" aria-hidden="true"><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#94a3b8"/><line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#94a3b8"/>{[0,.5,1].map(f=><g key={f}><line x1={pad} y1={y(min+(max-min)*f)} x2={w-pad} y2={y(min+(max-min)*f)} stroke="#e2e8f0"/><text x={pad-5} y={y(min+(max-min)*f)+4} fontSize="11" textAnchor="end" fill="#64748b">{fmt(min+(max-min)*f,unit)}</text></g>)}<polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points}/>{data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d.value)} r="4" fill="#2563eb"><title>{d.label}: {fmt(d.value,unit)}</title></circle>)}</svg><div className="report-axis-labels">{data.filter((_,i)=>i%Math.max(1,Math.ceil(data.length/5))===0||i===data.length-1).map((d,i)=><span key={i}>{d.label}</span>)}</div></>}
 </div>;
}
export function DonutGraph({data,unit='€'}:{data:Point[];unit?:string}){
 const valid=data.filter(x=>x.value>0),total=valid.reduce((a,x)=>a+x.value,0);let current=0;
 const gradient=valid.map((d,i)=>{const start=current;current+=d.value/total*100;return palette[i%palette.length]+' '+start+'% '+current+'%';}).join(', ');
 return <div className="report-donut-layout">{total>0?<div className="report-donut" role="img" aria-label={valid.map(x=>x.label+': '+fmt(x.value,unit)).join(', ')} style={{background:'conic-gradient('+gradient+')'}}><div className="report-donut-center"><strong>{fmt(total,unit)}</strong><small>Σύνολο</small></div></div>:<p>Δεν υπάρχουν δεδομένα.</p>}<div className="report-legend">{valid.map((x,i)=><div key={x.label}><span className="report-legend-dot" style={{background:palette[i%palette.length]}}/><span>{x.label}</span><strong>{fmt(x.value,unit)} · {(x.value/total*100).toFixed(1)}%</strong></div>)}</div></div>;
}
export function ReportCard({title,children}:{title:string;children:ReactNode}){return <section className="panel report-card"><h3>{title}</h3>{children}</section>}
