import {useState} from 'react';
import {BarGraph,LineGraph,DonutGraph,type Point} from './ReportCharts';
type ChartKind='bar'|'line'|'pie';
export function FlexibleChart({data,unit='',title,initial='bar'}:{data:Point[];unit?:string;title:string;initial?:ChartKind}){
 const [kind,setKind]=useState<ChartKind>(initial);
 return <div className="flexible-chart">
  <div className="chart-kind-picker"><label htmlFor={'chart-'+title}>Τύπος γραφήματος</label><select id={'chart-'+title} value={kind} onChange={e=>setKind(e.target.value as ChartKind)}><option value="bar">Στήλες</option><option value="line">Γραμμή</option><option value="pie">Κυκλικό</option></select></div>
  {kind==='bar'?<BarGraph data={data} unit={unit}/>:kind==='line'?<LineGraph data={data} unit={unit}/>:<DonutGraph data={data} unit={unit}/>}
 </div>;
}
export function PeriodComparison({current,previous,unit}:{current:Point[];previous:Point[];unit:string}){
 const sum=(items:Point[])=>items.reduce((a,x)=>a+x.value,0);
 const now=sum(current),before=sum(previous),delta=now-before;
 return <div className="period-comparison"><span>Επιλεγμένο έτος: <strong>{now.toLocaleString('el-GR',{maximumFractionDigits:2})} {unit}</strong></span><span>Προηγούμενο έτος: <strong>{previous.length?before.toLocaleString('el-GR',{maximumFractionDigits:2})+' '+unit:'Δεν υπάρχουν δεδομένα'}</strong></span>{previous.length>0&&<span>Διαφορά: <strong>{delta>=0?'+':''}{delta.toLocaleString('el-GR',{maximumFractionDigits:2})} {unit} ({before>0?(delta/before*100).toLocaleString('el-GR',{maximumFractionDigits:1})+'%':'—'})</strong></span>}</div>;
}
