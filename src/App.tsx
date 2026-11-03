import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {configured,authenticated,saveToken,clearToken,request,type Overview} from './api';
import {money} from './accounting';
type Tab='home'|'expenses'|'heating'|'payments'|'residents'|'history';
const apartmentCodes=['A1','A2','A3','B1','B2','B3'];
const demo:Overview={role:'admin',email:'',my_apartments:[],apartments:apartmentCodes.map((code,i)=>({id:String(i),code,heating_share:[19.25,14,16.75,19.25,14,16.75][i],common_share:1})),expenses:[],payments:[],readings:[],tank:null};
const navigation:{id:Tab;name:string;icon:string}[]=[{id:'home',name:'Αρχική',icon:'⌂'},{id:'expenses',name:'Κοινόχρηστα',icon:'▤'},{id:'heating',name:'Θέρμανση',icon:'♨'},{id:'payments',name:'Πληρωμές',icon:'€'},{id:'residents',name:'Κάτοικοι',icon:'♙'},{id:'history',name:'Ιστορικό',icon:'◷'}];
const amount=(v:string)=>Math.round(Number(v.replace(',','.'))*100);
const nowMonth=()=>new Date().toISOString().slice(0,7);
function App(){
 const [tab,setTab]=useState<Tab>('home');
 const [data,setData]=useState<Overview|null>(configured?null:demo);
 const [status,setStatus]=useState('');
 const [loading,setLoading]=useState(false);
 const [isConfigured,setIsConfigured]=useState<boolean|null>(null);
 const [loginMode,setLoginMode]=useState<'login'|'setup'|'invite'>('login');
 const [authEmail,setAuthEmail]=useState('');
 const [password,setPassword]=useState('');
 const [setupKey,setSetupKey]=useState('');
 const [inviteToken,setInviteToken]=useState(new URLSearchParams(location.search).get('πρόσκληση')||'');
 const [month,setMonth]=useState(nowMonth());
 const [category,setCategory]=useState('Καθαριότητα');
 const [description,setDescription]=useState('');
 const [price,setPrice]=useState('');
 const [method,setMethod]=useState('equal');
 const [paymentApartment,setPaymentApartment]=useState('A1');
 const [paymentKind,setPaymentKind]=useState<'common'|'heating'>('common');
 const [paymentAmount,setPaymentAmount]=useState('');
 const [readingDate,setReadingDate]=useState(new Date().toISOString().slice(0,10));
 const [tank,setTank]=useState('');
 const [readings,setReadings]=useState<Record<string,string>>({});
 const [inviteEmail,setInviteEmail]=useState('');
 const [inviteApartment,setInviteApartment]=useState('A1');
 const [generatedInvite,setGeneratedInvite]=useState('');
 async function refresh(){try{const x=await request<Overview>('/overview');setData(x);setStatus('');}catch(e){setStatus((e as Error).message);}}
 useEffect(()=>{if(!configured)return;request<{configured:boolean}>('/bootstrap/status').then(r=>setIsConfigured(r.configured)).catch(()=>setIsConfigured(true));if(authenticated())refresh();},[]);
 async function doAuth(e:FormEvent){e.preventDefault();setLoading(true);setStatus('');try{
 const endpoint=loginMode==='setup'?'/bootstrap':loginMode==='invite'?'/invitations/accept':'/login';
 const args=loginMode==='setup'?{email:authEmail,password,setup_key:setupKey}:loginMode==='invite'?{email:authEmail,password,token:inviteToken}:{email:authEmail,password};
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
 {isConfigured===false&&loginMode==='login'&&<div className="notice">Η αρχική εγκατάσταση δεν έχει ολοκληρωθεί. Ο διαχειριστής μπορεί να δημιουργήσει τον πρώτο λογαριασμό.</div>}
 <form onSubmit={doAuth} className="stack">
 <label>Ηλεκτρονική διεύθυνση<input type="email" required value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/></label>
 <label>Κωδικός πρόσβασης<input type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {loginMode==='setup'&&<label>Κλειδί αρχικής εγκατάστασης<input type="password" required value={setupKey} onChange={e=>setSetupKey(e.target.value)}/></label>}
 {loginMode==='invite'&&<label>Κωδικός πρόσκλησης<input required value={inviteToken} onChange={e=>setInviteToken(e.target.value)}/></label>}
 <button disabled={loading}>{loading?'Παρακαλώ περιμένετε…':loginMode==='setup'?'Δημιουργία διαχειριστή':loginMode==='invite'?'Αποδοχή πρόσκλησης':'Σύνδεση'}</button>
 </form>
 <div className="auth-options"><button className="link" onClick={()=>setLoginMode('login')}>Σύνδεση</button><button className="link" onClick={()=>setLoginMode('invite')}>Έχω πρόσκληση</button>{isConfigured===false&&<button className="link" onClick={()=>setLoginMode('setup')}>Αρχική εγκατάσταση</button>}</div>
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
 {tab==='expenses'&&<><section className="panel"><div className="panel-head"><div><h2>Μηνιαία κοινόχρηστα</h2><p className="muted">Καταχωρίστε δαπάνες με ασφαλή κατανομή στους κατοίκους.</p></div></div>
 {isAdmin&&configured&&<form className="form-grid" onSubmit={e=>{e.preventDefault();submit('/expenses',{month,category,description,amount_cents:amount(price),method},()=>{setPrice('');setDescription('');});}}>
 <label>Μήνας<input type="month" required value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Κατηγορία<select value={category} onChange={e=>setCategory(e.target.value)}>{['Καθαριότητα','Ηλεκτρικό ρεύμα','Κηπουρός','Συντήρηση','Ανελκυστήρας','Λοιπές δαπάνες'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Περιγραφή<input value={description} maxLength={300} onChange={e=>setDescription(e.target.value)}/></label><label>Ποσό (€)<input type="number" min="0.01" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
 <label>Κατανομή<select value={method} onChange={e=>setMethod(e.target.value)}><option value="equal">Ισομερώς</option><option value="shares">Με βάση τα χιλιοστά κοινοχρήστων</option></select></label><button disabled={loading}>Καταχώριση δαπάνης</button></form>}
 <div className="table-wrap"><table><thead><tr><th>Μήνας</th><th>Κατηγορία</th><th>Περιγραφή</th><th>Ποσό</th></tr></thead><tbody>{data?.expenses.map(e=><tr key={e.id}><td>{e.month}</td><td>{e.category}</td><td>{e.description||'—'}</td><td>{money(e.amount_cents)}</td></tr>)}{!data?.expenses.length&&<tr><td colSpan={4} className="empty">Δεν υπάρχουν καταχωρισμένες δαπάνες.</td></tr>}</tbody></table></div></section></>}
 {tab==='payments'&&<section className="panel"><h2>Πληρωμές και καταθέσεις</h2><p className="muted">Οι καταθέσεις θέρμανσης παρακολουθούνται ξεχωριστά από τις εισπράξεις κοινοχρήστων.</p>
 {isAdmin&&configured&&<form className="form-grid" onSubmit={e=>{e.preventDefault();submit('/payments',{apartment_code:paymentApartment,kind:paymentKind,amount_cents:amount(paymentAmount),paid_on:new Date().toISOString().slice(0,10)},()=>setPaymentAmount(''));}}>
 <label>Διαμέρισμα<select value={paymentApartment} onChange={e=>setPaymentApartment(e.target.value)}>{allApartments.map(a=><option key={a.id}>{a.code}</option>)}</select></label><label>Τύπος<select value={paymentKind} onChange={e=>setPaymentKind(e.target.value as 'common'|'heating')}><option value="common">Κοινόχρηστα</option><option value="heating">Θέρμανση</option></select></label><label>Ποσό (€)<input type="number" min="0.01" step="0.01" required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><button disabled={loading}>Καταχώριση πληρωμής</button></form>}
 <div className="table-wrap"><table><thead><tr><th>Ημερομηνία</th><th>Διαμέρισμα</th><th>Είδος</th><th>Ποσό</th></tr></thead><tbody>{data?.payments.map(p=><tr key={p.id}><td>{p.paid_on}</td><td>{p.apartment_code}</td><td>{p.kind==='common'?'Κοινόχρηστα':'Θέρμανση'}</td><td>{money(p.amount_cents)}</td></tr>)}{!data?.payments.length&&<tr><td colSpan={4} className="empty">Δεν υπάρχουν καταχωρισμένες πληρωμές.</td></tr>}</tbody></table></div></section>}
 {tab==='heating'&&<><div className="notice">Οι μετρήσεις καταγράφονται οριστικά. Η αυτόματη χρέωση πετρελαίου θα ενεργοποιηθεί μόνον αφού επιβεβαιωθεί ο λογιστικός τύπος της πολυκατοικίας.</div>
 <section className="panel"><h2>Μετρήσεις θέρμανσης</h2><p className="muted">Νέα ημερομηνία μέτρησης, ένδειξη κάθε διαμερίσματος και στάθμη κοινής δεξαμενής.</p>
 {isAdmin&&configured&&<form onSubmit={e=>{e.preventDefault();submit('/readings',{measured_on:readingDate,centimeters:Number(tank),readings:allApartments.map(a=>({apartment_code:a.code,reading:Number(readings[a.code])}))},()=>{setTank('');setReadings({});});}} className="stack">
 <div className="form-grid"><label>Ημερομηνία<input type="date" required value={readingDate} onChange={e=>setReadingDate(e.target.value)}/></label><label>Στάθμη δεξαμενής (εκ.)<input type="number" step="0.1" min="0" required value={tank} onChange={e=>setTank(e.target.value)}/></label></div>
 <div className="reading-grid">{allApartments.map(a=><label key={a.code}>{a.code}<input type="number" required min="0" step="1" placeholder="Ένδειξη" value={readings[a.code]||''} onChange={e=>setReadings(v=>({...v,[a.code]:e.target.value}))}/></label>)}</div><button disabled={loading}>Αποθήκευση μετρήσεων</button></form>}
 <div className="table-wrap"><table><thead><tr><th>Ημερομηνία</th><th>Διαμέρισμα</th><th>Ένδειξη</th></tr></thead><tbody>{data?.readings.map(r=><tr key={r.id}><td>{r.measured_on}</td><td>{r.apartment_code}</td><td>{r.reading.toLocaleString('el-GR')}</td></tr>)}{!data?.readings.length&&<tr><td colSpan={3} className="empty">Δεν υπάρχουν μετρήσεις.</td></tr>}</tbody></table></div></section></>}
 {tab==='residents'&&isAdmin&&<section className="panel"><h2>Πρόσκληση κατοίκων</h2><p className="muted">Ο κάθε κάτοικος έχει πρόσβαση μόνο στο δικό του διαμέρισμα.</p>
 {configured&&<form className="form-grid" onSubmit={async e=>{e.preventDefault();setLoading(true);try{const r=await request<{token:string}>('/invitations',{method:'POST',body:JSON.stringify({email:inviteEmail,apartment_code:inviteApartment})});setGeneratedInvite(location.origin+location.pathname+'?πρόσκληση='+encodeURIComponent(r.token));setStatus('Η πρόσκληση δημιουργήθηκε.');}catch(err){setStatus((err as Error).message);}finally{setLoading(false);}}}>
 <label>Ηλεκτρονική διεύθυνση<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><label>Διαμέρισμα<select value={inviteApartment} onChange={e=>setInviteApartment(e.target.value)}>{allApartments.map(a=><option key={a.id}>{a.code}</option>)}</select></label><button disabled={loading}>Δημιουργία πρόσκλησης</button></form>}
 {generatedInvite&&<div className="notice"><strong>Ιδιωτικός σύνδεσμος πρόσκλησης:</strong><textarea readOnly value={generatedInvite} rows={3}/><button onClick={()=>navigator.clipboard.writeText(generatedInvite)}>Αντιγραφή συνδέσμου</button></div>}</section>}
 {tab==='history'&&<section className="panel"><h2>Ιστορικό καταχωρίσεων</h2><p className="muted">Τα στοιχεία προέρχονται από την ασφαλή βάση δεδομένων. Οι οριστικοποιημένες εγγραφές δεν αντικαθίστανται σιωπηρά.</p><div className="history-list"><div>▤ <strong>{data?.expenses.length||0}</strong> καταχωρίσεις κοινοχρήστων</div><div>€ <strong>{data?.payments.length||0}</strong> καταχωρίσεις πληρωμών</div><div>♨ <strong>{data?.readings.length||0}</strong> καταχωρίσεις μετρητών</div></div></section>}
 <footer className="footnote">Διαχείριση Πολυκατοικίας · Ελληνική έκδοση · Οι οικονομικές εγγραφές δεν αποθηκεύονται στο GitHub.</footer>
 </main><nav className="bottom-nav" aria-label="Κύρια πλοήγηση κινητού">{navigation.filter(x=>['home','expenses','heating','payments'].includes(x.id)).map(x=><button key={x.id} className={tab===x.id?'active':''} onClick={()=>setTab(x.id)}><span>{x.icon}</span><small>{x.name}</small></button>)}</nav></div>;
}
export default App;
