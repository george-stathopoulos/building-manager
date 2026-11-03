import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {configured,authenticated,saveToken,clearToken,request,type Overview} from './api';
import {money} from './accounting';
type Tab='home'|'expenses'|'heating'|'payments'|'residents'|'history';
const apartmentCodes=['A1','A2','A3','B1','B2','B3'];
const demo:Overview={role:'admin',email:'',my_apartments:[],apartments:apartmentCodes.map((code,i)=>({id:String(i),code,heating_share:[19.25,14,16.75,19.25,14,16.75][i],common_share:1})),expenses:[],payments:[],readings:[],fuel_deliveries:[],tank:null};
const navigation:{id:Tab;name:string;icon:string}[]=[{id:'home',name:'Αρχική',icon:'⌂'},{id:'expenses',name:'Κοινόχρηστα',icon:'▤'},{id:'heating',name:'Θέρμανση',icon:'♨'},{id:'payments',name:'Πληρωμές',icon:'€'},{id:'residents',name:'Κάτοικοι',icon:'♙'},{id:'history',name:'Ιστορικό',icon:'◷'}];
const amount=(v:string)=>Math.round(Number(v.replace(',','.'))*100);
const nowMonth=()=>new Date().toISOString().slice(0,7);
function App(){
 const [tab,setTab]=useState<Tab>('home');
 const [data,setData]=useState<Overview|null>(configured?null:demo);
 const [status,setStatus]=useState('');
 const [loading,setLoading]=useState(false);
 const [isConfigured,setIsConfigured]=useState<boolean|null>(null);
 
 const [authEmail,setAuthEmail]=useState('');
 const [password,setPassword]=useState('');


 const [month,setMonth]=useState(nowMonth());
 const categories=['ΚΑΘΑΡΙΣΜΟΣ ΚΤΙΡΙΟΥ ΚΑΙ ΚΟΙΝΟΧΡΗΣΤΩΝ ΧΩΡΩΝ','ΗΛΕΚΤΡΙΚΟ ΚΟΙΝΟΧΡΗΣΤΩΝ','ΚΗΠΟΥΡΟΣ','ΑΜΟΙΒΗ - ΠΡΟΓΡΑΜΜΑ ΚΟΙΝΟΧΡΗΣΤΩΝ'];
 const [charges,setCharges]=useState(categories.map(name=>({name,enabled:false,value:''})));
 const [buildingAddress,setBuildingAddress]=useState('ΣΑΜΟΥ 4 ΜΑΡΟΥΣΙ');
 const [allocationMethod,setAllocationMethod]=useState<'equal'|'shares'>('equal');
 const [residentNames,setResidentNames]=useState<Record<string,string>>({'A1':'ΕΛΕΝΗ','A2':'ΜΠΙΤΑ ΚΩΝ/ΝΑ','A3':'ΣΤΑΘΟΠΟΥΛΟΣ','B1':'ΣΕΡΑΦΕΙΜ','B2':'ΚΩΝΣΤΑΝΤΙΝΑ ΜΑΡΙΑ','B3':'ΜΠΙΤΑΣ ΓΡΗΓΟΡΗΣ'});
 const [paymentApartment,setPaymentApartment]=useState('A1');
 const [paymentKind,setPaymentKind]=useState<'common'|'heating'>('common');
 const [paymentAmount,setPaymentAmount]=useState('');
 const [readingDate,setReadingDate]=useState(new Date().toISOString().slice(0,10));
 const [tank,setTank]=useState('');
 const [fuelDate,setFuelDate]=useState(new Date().toISOString().slice(0,10));
 const [fuelLiters,setFuelLiters]=useState('');
 const [fuelCost,setFuelCost]=useState('');
 const [fuelNote,setFuelNote]=useState('');
 const [readings,setReadings]=useState<Record<string,string>>({});
 const [inviteEmail,setInviteEmail]=useState('');
 const [inviteApartment,setInviteApartment]=useState('A1');
 const [residentPassword,setResidentPassword]=useState('');
 async function refresh(){try{const x=await request<Overview>('/overview');setData(x);setStatus('');}catch(e){setStatus((e as Error).message);}}
 useEffect(()=>{if(!configured)return;request<{configured:boolean}>('/bootstrap/status').then(r=>setIsConfigured(r.configured)).catch(()=>setIsConfigured(null));if(authenticated())refresh();},[]);
 async function doAuth(e:FormEvent){e.preventDefault();setLoading(true);setStatus('');try{
 const endpoint='/login';
 const args={email:authEmail,password};
 const r=await request<{token:string}>(endpoint,{method:'POST',body:JSON.stringify(args)});saveToken(r.token);setPassword('');await refresh();
 }catch(err){setStatus((err as Error).message);}finally{setLoading(false);}}
 async function submit(path:string,payload:object,after:()=>void){setLoading(true);setStatus('');try{await request(path,{method:'POST',body:JSON.stringify(payload)});after();await refresh();}catch(e){setStatus((e as Error).message);}finally{setLoading(false);}}
 const totals=useMemo(()=>{
 const expenses=data?.expenses.reduce((s,e)=>s+e.amount_cents,0)||0;
 const paid=data?.payments.filter(p=>p.kind==='common').reduce((s,p)=>s+p.amount_cents,0)||0;
 return {expenses,paid};
 },[data]);
 const allApartments=data?.apartments||demo.apartments;
 const isAdmin=data?.role==='admin';
 if(configured&&!data)return <main className="auth-page"><section className="auth-card">
 <div className="brand-mark">⌂</div><h1>Διαχείριση Πολυκατοικίας</h1><p className="muted">Ασφαλής πρόσβαση διαχειριστή και κατοίκων</p>
 {isConfigured===false&&<div className="notice">Ο λογαριασμός διαχειριστή δεν έχει ενεργοποιηθεί ακόμη.</div>}
 <form onSubmit={doAuth} className="stack">
 <label>Ηλεκτρονική διεύθυνση<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/></label>
 <label>Κωδικός πρόσβασης<input type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 
 <button disabled={loading}>{loading?'Παρακαλώ περιμένετε…':'Σύνδεση'}</button>
 </form>

 {status&&<p className="error" role="alert">{status}</p>}
 </section></main>;
 return <div className="shell">
 <aside className="sidebar"><div className="logo"><span className="logo-icon">⌂</span><div><strong>Η Πολυκατοικία</strong><small>Διαχείριση κτιρίου</small></div></div>
 <div className="side-label">ΜΕΝΟΥ</div><nav aria-label="Κύρια πλοήγηση">{navigation.filter(item=>isAdmin||!['residents'].includes(item.id)).map(item=><button key={item.id} onClick={()=>setTab(item.id)} className={'nav-button '+(tab===item.id?'active':'')}><span>{item.icon}</span>{item.name}</button>)}</nav>
 <div className="side-footer">{configured?<><small>{data?.email}</small><button className="logout" onClick={async()=>{try{await request('/logout',{method:'POST'});}catch{}clearToken();setData(null);}}>Αποσύνδεση</button></>:<span>Λειτουργία επίδειξης</span>}</div>
 </aside>
 <main className="content">
 <header className="topbar"><div><span className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ ΠΟΛΥΚΑΤΟΙΚΙΑΣ</span><h1>{navigation.find(n=>n.id===tab)?.name}</h1></div><span className="role">{isAdmin?'Διαχειριστής':'Κάτοικος'}</span></header>
 {!configured&&<div className="notice"><strong>Δοκιμαστική προβολή:</strong> Δεν έχει συνδεθεί ακόμη η ασφαλής υπηρεσία δεδομένων. Δεν εμφανίζονται πραγματικές χρεώσεις και η αποθήκευση είναι απενεργοποιημένη.</div>}
 {status&&<div className="error" role="alert">{status}</div>}
 {tab==='home'&&<><div className="welcome"><div><span className="eyebrow">ΣΥΝΟΠΤΙΚΗ ΕΙΚΟΝΑ</span><h2>Καλώς ήρθατε!</h2><p>Τα οικονομικά στοιχεία της πολυκατοικίας σε ένα σημείο.</p></div><span className="welcome-symbol">⌂</span></div>
 <div className="stats"><div className="stat"><span>Σύνολο κοινοχρήστων</span><strong>{money(totals.expenses)}</strong><small>Καταχωρισμένες δαπάνες</small></div><div className="stat"><span>Εισπράξεις κοινοχρήστων</span><strong>{money(totals.paid)}</strong><small>Καταχωρισμένες πληρωμές</small></div><div className="stat"><span>Διαμερίσματα</span><strong>{allApartments.length}</strong><small>Μονάδες κτιρίου</small></div><div className="stat"><span>Τελευταία στάθμη</span><strong>{data?.tank?data.tank.centimeters+' εκ.':'—'}</strong><small>{data?.tank?.measured_on||'Δεν υπάρχει μέτρηση'}</small></div></div>
 <section className="panel"><h3>Διαμερίσματα</h3><div className="apartment-grid">{allApartments.map(a=><div className="apartment" key={a.id}><span className="apartment-icon">⌂</span><strong>{a.code}</strong><small>Συντελεστής θέρμανσης {a.heating_share}%</small></div>)}</div></section>
 </>}
 {tab==='expenses'&&<section className="panel"><h2>Κατάσταση Κοινοχρήστων</h2><p className="muted">Συμπληρώστε τις δαπάνες μία φορά για ολόκληρη την πολυκατοικία. Η εκτύπωση περιλαμβάνει όλα τα διαμερίσματα.</p>
 <div className="form-grid"><label>Μήνας<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/><span>{new Date(month+'-01T12:00:00').toLocaleDateString('el-GR',{month:'long',year:'numeric'})}</span></label><label>Διεύθυνση κτιρίου<input value={buildingAddress} onChange={e=>setBuildingAddress(e.target.value)}/></label><label>Κατανομή<select value={allocationMethod} onChange={e=>setAllocationMethod(e.target.value as 'equal'|'shares')}><option value="equal">Ισομερώς</option><option value="shares">Με βάση τα χιλιοστά</option></select></label></div>
 <div className="table-wrap"><table><thead><tr><th>Ενεργό</th><th>Δαπάνη</th><th>Ποσό (€)</th></tr></thead><tbody>{charges.map((c,i)=><tr key={i}><td><input type="checkbox" checked={c.enabled} onChange={e=>setCharges(v=>v.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))}/></td><td><input aria-label="Περιγραφή δαπάνης" value={c.name} onChange={e=>setCharges(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></td><td><input aria-label="Ποσό δαπάνης" type="number" min="0" step="0.01" disabled={!c.enabled} value={c.value} onChange={e=>setCharges(v=>v.map((x,j)=>j===i?{...x,value:e.target.value}:x))}/></td></tr>)}</tbody></table></div>
 <button type="button" onClick={()=>setCharges(v=>[...v,{name:'ΝΕΑ ΔΑΠΑΝΗ',enabled:true,value:''}])}>+ Προσθήκη δαπάνης</button>
 <div className="form-grid">{allApartments.map(a=><label key={a.code}>Ονοματεπώνυμο {a.code}<input value={residentNames[a.code]||''} placeholder="Ονοματεπώνυμο" onChange={e=>setResidentNames(v=>({...v,[a.code]:e.target.value}))}/></label>)}</div>
 {(()=>{const active=charges.filter(c=>c.enabled&&c.name.trim()&&Number(c.value.replace(',','.'))>0);const total=active.reduce((n,c)=>n+amount(c.value),0);const weights=allApartments.map(a=>allocationMethod==='shares'?a.common_share:1);const sum=weights.reduce((x,y)=>x+y,0);const exact=weights.map(w=>total*w/sum);const shares=exact.map(Math.floor);let remaining=total-shares.reduce((x,y)=>x+y,0);const order=exact.map((x,i)=>({i,f:x-Math.floor(x)})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let i=0;i<remaining;i++)shares[order[i].i]++;return <><div className="statement-print" id="common-statement"><h1>ΚΟΙΝΟΧΡΗΣΤΑ</h1><table><tbody><tr><th>ΔΙΕΥΘΥΝΣΗ ΚΤΙΡΙΟΥ</th><th>ΜΗΝΑΣ</th></tr><tr><td>{buildingAddress}</td><td>{new Date(month+'-01T12:00:00').toLocaleDateString('el-GR',{month:'long',year:'numeric'}).toUpperCase()}</td></tr></tbody></table><h3>Πραγματοποιηθείσες Δαπάνες σε ΕΥΡΩ</h3><table><thead><tr><th>ΚΟΙΝΟΧΡΗΣΤΑ</th><th>ΕΥΡΩ</th></tr></thead><tbody>{active.map((c,i)=><tr key={i}><td>{c.name}</td><td>{money(amount(c.value))}</td></tr>)}<tr><th>ΣΥΝΟΛΟ</th><th>{money(total)}</th></tr></tbody></table><table><thead><tr><th>ΔΙΑΜ</th><th>ΟΝΟΜΑΤΕΠΩΝΥΜΟ</th><th>ΚΟΙΝΟΧΡΗΣΤΑ</th><th>ΑΝΕΛΚΥΣΤΗΡΑΣ</th><th>ΘΕΡΜΑΝΣΗ</th><th>ΣΥΝΟΛΟ</th></tr></thead><tbody>{allApartments.map((a,i)=><tr key={a.id}><td>{a.code}</td><td>{residentNames[a.code]||'—'}</td><td>{money(shares[i])}</td><td>—</td><td>—</td><td><strong>{money(shares[i])}</strong></td></tr>)}<tr><th colSpan={5}>ΓΕΝΙΚΟ ΣΥΝΟΛΟ</th><th>{money(total)}</th></tr></tbody></table></div><p className="muted">Οι στήλες ανελκυστήρα και θέρμανσης παραμένουν κενές μέχρι να ενεργοποιηθούν οι αντίστοιχες χρεώσεις.</p><div className="statement-actions"><button type="button" disabled={!total} onClick={()=>window.print()}>Εκτύπωση / Αποθήκευση PDF</button></div></>})()}
 </section>}
 {tab==='payments'&&<section className="panel"><h2>Πληρωμές και καταθέσεις</h2><p className="muted">Οι καταθέσεις θέρμανσης παρακολουθούνται ξεχωριστά από τις εισπράξεις κοινοχρήστων.</p>
 {isAdmin&&configured&&<form className="form-grid" onSubmit={e=>{e.preventDefault();submit('/payments',{apartment_code:paymentApartment,kind:paymentKind,amount_cents:amount(paymentAmount),paid_on:new Date().toISOString().slice(0,10)},()=>setPaymentAmount(''));}}>
 <label>Διαμέρισμα<select value={paymentApartment} onChange={e=>setPaymentApartment(e.target.value)}>{allApartments.map(a=><option key={a.id}>{a.code}</option>)}</select></label><label>Τύπος<select value={paymentKind} onChange={e=>setPaymentKind(e.target.value as 'common'|'heating')}><option value="common">Κοινόχρηστα</option><option value="heating">Θέρμανση</option></select></label><label>Ποσό (€)<input type="number" min="0.01" step="0.01" required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><button disabled={loading}>Καταχώριση πληρωμής</button></form>}
 <div className="table-wrap"><table><thead><tr><th>Ημερομηνία</th><th>Διαμέρισμα</th><th>Είδος</th><th>Ποσό</th></tr></thead><tbody>{data?.payments.map(p=><tr key={p.id}><td>{p.paid_on}</td><td>{p.apartment_code}</td><td>{p.kind==='common'?'Κοινόχρηστα':'Θέρμανση'}</td><td>{money(p.amount_cents)}</td></tr>)}{!data?.payments.length&&<tr><td colSpan={4} className="empty">Δεν υπάρχουν καταχωρισμένες πληρωμές.</td></tr>}</tbody></table></div></section>}
 {tab==='heating'&&<><div className="notice">Οι μετρήσεις καταγράφονται οριστικά. Η αυτόματη χρέωση πετρελαίου θα ενεργοποιηθεί μόνον αφού επιβεβαιωθεί ο λογιστικός τύπος της πολυκατοικίας.</div>
 <section className="panel"><h2>Μετρήσεις θέρμανσης</h2><p className="muted">Νέα ημερομηνία μέτρησης, ένδειξη κάθε διαμερίσματος και στάθμη κοινής δεξαμενής.</p>
 {isAdmin&&configured&&<form onSubmit={e=>{e.preventDefault();submit('/readings',{measured_on:readingDate,centimeters:Number(tank),readings:allApartments.map(a=>({apartment_code:a.code,reading:Number(readings[a.code])}))},()=>{setTank('');setReadings({});});}} className="stack">
 <div className="form-grid"><label>Ημερομηνία<input type="date" required value={readingDate} onChange={e=>setReadingDate(e.target.value)}/></label><label>Στάθμη δεξαμενής (εκ.)<input type="number" step="0.1" min="0" required value={tank} onChange={e=>setTank(e.target.value)}/></label></div>
 <div className="reading-grid">{allApartments.map(a=><label key={a.code}>{a.code}<input type="number" required min="0" step="1" placeholder="Ένδειξη" value={readings[a.code]||''} onChange={e=>setReadings(v=>({...v,[a.code]:e.target.value}))}/></label>)}</div><button disabled={loading}>Αποθήκευση μετρήσεων</button></form>}
 <section className="panel"><h2>Παραδόσεις πετρελαίου</h2><p className="muted">Καταγραφή λίτρων και κόστους κάθε ανεφοδιασμού. Οι παραδόσεις δεν δημιουργούν αυτόματα χρεώσεις διαμερισμάτων.</p>
 {isAdmin&&configured&&<form className="form-grid" onSubmit={e=>{e.preventDefault();submit('/fuel-deliveries',{delivered_on:fuelDate,liters:Number(fuelLiters),cost_cents:amount(fuelCost),note:fuelNote},()=>{setFuelLiters('');setFuelCost('');setFuelNote('');});}}>
 <label>Ημερομηνία παράδοσης<input type="date" required value={fuelDate} onChange={e=>setFuelDate(e.target.value)}/></label>
 <label>Ποσότητα (λίτρα)<input type="number" min="0.01" step="0.01" required value={fuelLiters} onChange={e=>setFuelLiters(e.target.value)}/></label>
 <label>Συνολικό κόστος (€)<input type="number" min="0.01" step="0.01" required value={fuelCost} onChange={e=>setFuelCost(e.target.value)}/></label>
 <label>Σημειώσεις<input maxLength={500} value={fuelNote} onChange={e=>setFuelNote(e.target.value)}/></label>
 <button disabled={loading}>Καταχώριση ανεφοδιασμού</button></form>}
 <div className="table-wrap"><table><thead><tr><th>Ημερομηνία</th><th>Λίτρα</th><th>Κόστος</th><th>Σημειώσεις</th></tr></thead><tbody>{data?.fuel_deliveries.map(f=><tr key={f.id}><td>{f.delivered_on}</td><td>{f.liters.toLocaleString('el-GR')}</td><td>{money(f.cost_cents)}</td><td>{f.note||'—'}</td></tr>)}{!data?.fuel_deliveries.length&&<tr><td colSpan={4} className="empty">Δεν υπάρχουν καταχωρισμένοι ανεφοδιασμοί.</td></tr>}</tbody></table></div></section>
 <div className="table-wrap"><table><thead><tr><th>Ημερομηνία</th><th>Διαμέρισμα</th><th>Ένδειξη</th></tr></thead><tbody>{data?.readings.map(r=><tr key={r.id}><td>{r.measured_on}</td><td>{r.apartment_code}</td><td>{r.reading.toLocaleString('el-GR')}</td></tr>)}{!data?.readings.length&&<tr><td colSpan={3} className="empty">Δεν υπάρχουν μετρήσεις.</td></tr>}</tbody></table></div></section></>}
 {tab==='residents'&&isAdmin&&<section className="panel"><h2>Λογαριασμοί κατοίκων</h2><p className="muted">Δημιουργήστε στοιχεία σύνδεσης για κάθε κάτοικο. Ο κάθε κάτοικος βλέπει μόνο το δικό του διαμέρισμα.</p>
 {configured&&<form className="form-grid" onSubmit={e=>{e.preventDefault();submit('/residents',{email:inviteEmail,password:residentPassword,apartment_code:inviteApartment},()=>{setInviteEmail('');setResidentPassword('');setStatus('Ο λογαριασμός κατοίκου δημιουργήθηκε.');});}}>
 <label>Ηλεκτρονική διεύθυνση<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>
 <label>Προσωρινός κωδικός πρόσβασης<input type="password" minLength={12} required value={residentPassword} onChange={e=>setResidentPassword(e.target.value)}/></label>
 <label>Διαμέρισμα<select value={inviteApartment} onChange={e=>setInviteApartment(e.target.value)}>{allApartments.map(a=><option key={a.id}>{a.code}</option>)}</select></label><button disabled={loading}>Δημιουργία κατοίκου</button></form>}</section>}
 {tab==='history'&&<section className="panel"><h2>Ιστορικό καταχωρίσεων</h2><p className="muted">Τα στοιχεία προέρχονται από την ασφαλή βάση δεδομένων. Οι οριστικοποιημένες εγγραφές δεν αντικαθίστανται σιωπηρά.</p><div className="history-list"><div>▤ <strong>{data?.expenses.length||0}</strong> καταχωρίσεις κοινοχρήστων</div><div>€ <strong>{data?.payments.length||0}</strong> καταχωρίσεις πληρωμών</div><div>♨ <strong>{data?.readings.length||0}</strong> καταχωρίσεις μετρητών</div></div></section>}
 <footer className="footnote">Διαχείριση Πολυκατοικίας · Ελληνική έκδοση · Οι οικονομικές εγγραφές δεν αποθηκεύονται στο GitHub.</footer>
 </main><nav className="bottom-nav" aria-label="Κύρια πλοήγηση κινητού">{navigation.filter(x=>['home','expenses','heating','payments'].includes(x.id)).map(x=><button key={x.id} className={tab===x.id?'active':''} onClick={()=>setTab(x.id)}><span>{x.icon}</span><small>{x.name}</small></button>)}</nav></div>;
}
export default App;
