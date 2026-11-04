import {useMemo,useState} from 'react';
import {FlexibleChart,PeriodComparison} from './FlexibleChart';
import type {FuelResponse,FuelAccountView,FuelPeriodView} from './ResidentFeatures';

const num=(v:number,d=2)=>v.toLocaleString('el-GR',{maximumFractionDigits:d});
const allPeriods=(a:FuelAccountView):FuelPeriodView[]=>[...a.historical_periods,...a.periods];
export function FuelInsights({fuel,account,year:externalYear,onYearChange,compact=false}:{fuel:FuelResponse|null;account?:FuelAccountView;year?:string;onYearChange?:(y:string)=>void;compact?:boolean}){
 const [localYear,setLocalYear]=useState('all');
 const year=externalYear??localYear;
 const entries=useMemo(()=>fuel?(account?[account]:fuel.accounts).flatMap(a=>allPeriods(a).map(p=>({...p,apartment:a.apartment_code}))):[],[fuel,account]);
 const years=[...new Set(entries.map(p=>p.end.slice(0,4)))].sort().reverse();
 const selected=entries.filter(p=>year==='all'||p.end.startsWith(year));
 const previous=year==='all'?[]:entries.filter(p=>p.end.startsWith(String(Number(year)-1)));
 const totals=(ps:typeof entries)=>({hours:ps.reduce((n,p)=>n+p.hours,0),liters:ps.reduce((n,p)=>n+p.liters,0)});
 const t=totals(selected),prior=totals(previous);
 const litersPerHour=t.hours>0?t.liters/t.hours:null;
 // The configured price is a planning assumption, not a verified historic weighted purchase price.
 const price=fuel?.settings.price_cents_per_liter??null;
 const euroPerHour=litersPerHour!==null&&price!==null?litersPerHour*price/100:null;
 const grouped=new Map<string,{hours:number;liters:number}>();
 for(const p of selected){const key=account?p.end.slice(0,7):p.apartment;const g=grouped.get(key)||{hours:0,liters:0};g.hours+=p.hours;g.liters+=p.liters;grouped.set(key,g);}
 const graph=[...grouped].sort((a,b)=>a[0].localeCompare(b[0])).map(([label,x])=>({label,value:x.hours}));
 const litersGraph=[...grouped].sort((a,b)=>a[0].localeCompare(b[0])).map(([label,x])=>({label,value:x.liters}));
 const suffix=account?'ανά μήνα':'ανά διαμέρισμα';
 if(!fuel)return <p className="muted">Δεν είναι διαθέσιμα τα στοιχεία θέρμανσης.</p>;
 return <section className={'fuel-insights '+(compact?'fuel-insights--compact':'')}>
  <div className="fuel-insights-head"><div><h3>{account?'Η κατανάλωσή μου':'Απόδοση θέρμανσης κτιρίου'}</h3><p className="muted">Εκτιμήσεις από διαφορές μετρητών και στάθμης δεξαμενής. Η πρώτη ένδειξη είναι μόνο αφετηρία.</p></div>
   <label className="fuel-insights-year">Έτος<select value={year} onChange={e=>{onYearChange?.(e.target.value);if(!onYearChange)setLocalYear(e.target.value);}}><option value="all">Όλες οι περίοδοι</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
  <div className="fuel-insights-metrics">
   <article><small>Μέση κατανάλωση</small><strong>{litersPerHour===null?'—':num(litersPerHour)+' L/ώρα'}</strong><span>{num(t.liters)} L / {num(t.hours)} ώρες</span></article>
   <article><small>Εκτιμώμενο κόστος</small><strong>{euroPerHour===null?'—':num(euroPerHour)+' €/ώρα'}</strong><span>Με ενδεικτική τιμή {price===null?'—':num(price/100)} €/L</span></article>
  </div>
  {!compact&&<div className="fuel-insights-charts">
   <div><h4>Ώρες θέρμανσης {suffix}</h4><FlexibleChart title={'Ώρες θέρμανσης '+suffix+(account?.apartment_code||'κτίριο')} data={graph} unit="ώρες" initial="bar"/></div>
   <div><h4>Εκτιμώμενα λίτρα {suffix}</h4><FlexibleChart title={'Λίτρα θέρμανσης '+suffix+(account?.apartment_code||'κτίριο')} data={litersGraph} unit="L" initial="line"/></div>
  </div>}
  {!compact&&year!=='all'&&<PeriodComparison current={[{label:year,value:t.liters}]} previous={previous.length?[{label:String(Number(year)-1),value:prior.liters}]:[]} unit="L"/>}
  <p className="fuel-insights-note">Τα λίτρα υπολογίζονται από τη μεταβολή της δεξαμενής και τους ανεφοδιασμούς. {account?'Τα λίτρα επιμερίζονται σύμφωνα με τις ώρες του διαμερίσματος.':'Οι ώρες είναι το άθροισμα των ωρών των διαμερισμάτων, όχι οι ώρες λειτουργίας του καυστήρα.'} Η τιμή €/ώρα είναι ενδεικτική και δεν αποτελεί χρέωση. Οι εξοφλημένες ιστορικές περίοδοι περιλαμβάνονται μόνο για στατιστική σύγκριση.</p>
  {fuel.excluded.length>0&&<p className="fuel-amber">{fuel.excluded.length} περίοδοι εξαιρέθηκαν λόγω ελλιπών ή ασυνεπών μετρήσεων.</p>}
 </section>;
}
