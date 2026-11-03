interface Env {DB:D1Database; WEB_ORIGIN:string}
type DbUser={id:string;email:string;role:'admin'|'resident';salt:string;password_hash:string};
type Apartment={id:string;code:string;common_weight:number;heating_share_bp:number};
const encoder=new TextEncoder();
const iso=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function randomToken(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
async function sha(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
async function hashPassword(value:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(value),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return hex(new Uint8Array(bytes));}
function same(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function permittedOrigin(req:Request,env:Env){const o=req.headers.get('Origin');return !o||o===env.WEB_ORIGIN||o==='http://localhost:5173';}
function response(req:Request,env:Env,obj:unknown,status=200){const origin=req.headers.get('Origin');const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'});if(origin&&permittedOrigin(req,env)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}return new Response(JSON.stringify(obj),{status,headers});}
function fail(req:Request,env:Env,message:string,status=400){return response(req,env,{error:message},status);}
function validEmail(v:unknown):v is string{return typeof v==='string'&&v.length<=254&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);}
function validDate(v:unknown):v is string{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
function validMonth(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);}
function cents(v:unknown):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=1000000000;}
function jsonBody(req:Request):Promise<Record<string,unknown>>{return req.json().then(v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Μη έγκυρη υποβολή.');return v as Record<string,unknown>;});}
async function userFor(req:Request,env:Env){const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')||'');if(!match)return null;return env.DB.prepare('SELECT u.id,u.email,u.role,u.salt,u.password_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha(match[1]),iso()).first<DbUser>();}
async function session(env:Env,userId:string){const token=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha(token),userId,new Date(Date.now()+7*86400000).toISOString(),iso()).run();return token;}
function audit(env:Env,actor:string,action:string,type:string,id:string,details:object={}){return env.DB.prepare('INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(uuid(),actor,action,type,id,JSON.stringify(details),iso());}
async function myApartmentIds(env:Env,user:DbUser){if(user.role==='admin')return null;const r=await env.DB.prepare('SELECT apartment_id FROM memberships WHERE user_id=?').bind(user.id).all<{apartment_id:string}>();return r.results.map(x=>x.apartment_id);}
function allocate(total:number,apartments:Apartment[],method:string){const weights=apartments.map(a=>method==='shares'?a.common_weight:1);const weightSum=weights.reduce((a,b)=>a+b,0);const exact=weights.map(w=>total*w/weightSum);const amounts=exact.map(Math.floor);const left=total-amounts.reduce((a,b)=>a+b,0);const order=exact.map((n,i)=>({i,part:n-Math.floor(n)})).sort((a,b)=>b.part-a.part||a.i-b.i);for(let i=0;i<left;i++)amounts[order[i].i]++;return amounts;}
export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  try{
   const url=new URL(req.url);const path=url.pathname;const method=req.method;
   if(!permittedOrigin(req,env))return fail(req,env,'Μη επιτρεπτή προέλευση.',403);
   if(method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':req.headers.get('Origin')||env.WEB_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}});
   if(path==='/api/health'&&method==='GET')return response(req,env,{ok:true});
   if(path==='/api/bootstrap/status'&&method==='GET'){const r=await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{n:number}>();return response(req,env,{configured:(r?.n||0)>0});}
   if(path==='/api/login'&&method==='POST'){
    let loginStage='request';
    try {
    const body=await jsonBody(req);if(!validEmail(body.email)||typeof body.password!=='string')return fail(req,env,'Λανθασμένα στοιχεία σύνδεσης.',401);
    const email=body.email.trim().toLowerCase(),cutoff=new Date(Date.now()-15*60000).toISOString();
    loginStage='attempts';
    const attempts=await env.DB.prepare('SELECT attempts,window_start FROM login_attempts WHERE email=?').bind(email).first<{attempts:number;window_start:string}>();
    if(attempts&&attempts.window_start>cutoff&&attempts.attempts>=7)return fail(req,env,'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε αργότερα.',429);
    loginStage='user';
    const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first<DbUser>();
    loginStage='password_hash';
    const supplied=user?await hashPassword(body.password,user.salt):'';
    if(!user||!same(supplied,user.password_hash)){
     const n=attempts&&attempts.window_start>cutoff?attempts.attempts+1:1;
     await env.DB.prepare('INSERT INTO login_attempts(email,attempts,window_start) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start').bind(email,n,attempts&&attempts.window_start>cutoff?attempts.window_start:iso()).run();
     return fail(req,env,'Λανθασμένα στοιχεία σύνδεσης.',401);
    }
    loginStage='clear_attempts';
    await env.DB.prepare('DELETE FROM login_attempts WHERE email=?').bind(email).run();
    loginStage='session';
    return response(req,env,{token:await session(env,user.id)});
    } catch(e) { console.error('Login stage:',loginStage,e instanceof Error?e.name:'unknown',e instanceof Error?e.message:'');return fail(req,env,'Σφάλμα σύνδεσης ('+loginStage+').',500); }
   }
   if(path==='/api/invitations/accept'&&method==='POST'){
    const b=await jsonBody(req);if(!validEmail(b.email)||typeof b.password!=='string'||b.password.length<12||b.password.length>128||typeof b.token!=='string'||!/^([a-f0-9]{64})$/.test(b.token))return fail(req,env,'Μη έγκυρα στοιχεία πρόσκλησης.');
    const tokenHash=await sha(b.token),email=b.email.trim().toLowerCase();
    const inv=await env.DB.prepare('SELECT * FROM invitations WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(tokenHash,iso()).first<{email:string;apartment_id:string}>();
    if(!inv||inv.email!==email)return fail(req,env,'Η πρόσκληση δεν είναι έγκυρη ή έχει λήξει.',403);
    const id=uuid(),salt=randomToken();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,email,salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(id,email,salt,await hashPassword(b.password,salt),'resident',iso()),
      env.DB.prepare('INSERT INTO memberships(user_id,apartment_id,created_at) VALUES(?,?,?)').bind(id,inv.apartment_id,iso()),
      env.DB.prepare('UPDATE invitations SET used_at=? WHERE token_hash=? AND used_at IS NULL').bind(iso(),tokenHash),
      audit(env,id,'invitation_accepted','user',id)
    ]);
    return response(req,env,{token:await session(env,id)},201);
   }
   const user=await userFor(req,env);
   if(!user)return fail(req,env,'Απαιτείται σύνδεση.',401);
   if(path==='/api/logout'&&method==='POST'){const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')||'');if(match)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(match[1])).run();return response(req,env,{ok:true});}
   if(path==='/api/overview'&&method==='GET'){
    const own=await myApartmentIds(env,user);
    const a=(await env.DB.prepare('SELECT id,code,common_weight AS common_share,heating_share_bp/100.0 AS heating_share FROM apartments ORDER BY code').all<{id:string;code:string;common_share:number;heating_share:number}>()).results;
    const es=(await env.DB.prepare('SELECT id,month,category,description,amount_cents,created_at FROM expenses ORDER BY month DESC,created_at DESC LIMIT 500').all()).results;
    const ps=(await env.DB.prepare('SELECT p.id,a.code AS apartment_code,p.kind,p.amount_cents,p.paid_on FROM payments p JOIN apartments a ON a.id=p.apartment_id ORDER BY p.paid_on DESC,p.created_at DESC LIMIT 500').all<{id:string;apartment_code:string;kind:string;amount_cents:number;paid_on:string}>()).results;
    const rs=(await env.DB.prepare('SELECT r.id,a.code AS apartment_code,r.reading,r.measured_on FROM heating_readings r JOIN apartments a ON a.id=r.apartment_id ORDER BY r.measured_on DESC,a.code LIMIT 500').all<{id:string;apartment_code:string;reading:number;measured_on:string}>()).results;
    const tank=await env.DB.prepare('SELECT measured_on,centimeters FROM tank_measurements ORDER BY measured_on DESC LIMIT 1').first<{measured_on:string;centimeters:number}>();
    const tank_history=(await env.DB.prepare('SELECT id,measured_on,centimeters FROM tank_measurements ORDER BY measured_on DESC LIMIT 100').all<{id:string;measured_on:string;centimeters:number}>()).results;
    const fuel_deliveries=user.role==='admin'?(await env.DB.prepare('SELECT id,delivered_on,liters,cost_cents,note FROM fuel_deliveries ORDER BY delivered_on DESC LIMIT 500').all()).results:[];
    const accessible=new Set(a.filter(x=>!own||own.includes(x.id)).map(x=>x.code));
    return response(req,env,{role:user.role,email:user.email,my_apartments:[...accessible],apartments:a.filter(x=>accessible.has(x.code)),expenses:user.role==='admin'?es:[],fuel_deliveries,payments:ps.filter(x=>accessible.has(x.apartment_code)),readings:rs.filter(x=>accessible.has(x.apartment_code)),tank,tank_history});
   }
   if(path==='/api/statements'&&method==='GET'){
    const rows=(await env.DB.prepare('SELECT month,address,method,items_json,names_json,created_at,updated_at FROM monthly_statements ORDER BY month DESC').all()).results;
    return response(req,env,{statements:rows.map((r:any)=>({month:r.month,address:r.address,method:r.method,items:JSON.parse(r.items_json),names:JSON.parse(r.names_json),created_at:r.created_at,updated_at:r.updated_at}))});
   }
   if(path==='/api/statements/revisions'&&method==='GET'){
    if(user.role!=='admin')return fail(req,env,'Δεν επιτρέπεται.',403);
    const rows=(await env.DB.prepare('SELECT month,created_at,actor_id,old_json,new_json FROM statement_revisions ORDER BY created_at DESC LIMIT 100').all()).results;
    return response(req,env,{revisions:rows});
   }
   if(path==='/api/audit'&&method==='GET'){
    if(user.role!=='admin')return fail(req,env,'Δεν επιτρέπεται.',403);
    const events=(await env.DB.prepare('SELECT id,action,entity_type,entity_id,details,created_at FROM audit_events ORDER BY created_at DESC LIMIT 250').all()).results;
    return response(req,env,{events:events.map((x:any)=>({...x,details:JSON.parse(x.details)}))});
   }
   if(user.role!=='admin')return fail(req,env,'Δεν έχετε δικαίωμα καταχώρισης.',403);
   if(path==='/api/statements'&&method==='POST'){
    const b=await jsonBody(req);
    if(!validMonth(b.month)||typeof b.address!=='string'||b.address.length>200||!['equal','shares'].includes(String(b.method))||!Array.isArray(b.items)||b.items.length>40||!b.items.length||!b.names||typeof b.names!=='object'||Array.isArray(b.names))return fail(req,env,'Ελέγξτε την κατάσταση κοινοχρήστων.');
    const items=b.items as Array<{name:string;amount_cents:number}>;
    if(items.some(x=>typeof x.name!=='string'||!x.name.trim()||x.name.length>120||!cents(x.amount_cents)))return fail(req,env,'Μη έγκυρες δαπάνες.');
    const names=b.names as Record<string,unknown>;
    if(Object.entries(names).some(([k,v])=>!['A1','A2','A3','B1','B2','B3'].includes(k)||typeof v!=='string'||v.length>100))return fail(req,env,'Μη έγκυρα ονόματα.');
    const old=await env.DB.prepare('SELECT * FROM monthly_statements WHERE month=?').bind(b.month).first();
    const timestamp=iso(),newData={month:b.month,address:b.address,method:b.method,items,names};
    await env.DB.batch([
      env.DB.prepare('INSERT INTO monthly_statements(month,address,method,items_json,names_json,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(month) DO UPDATE SET address=excluded.address,method=excluded.method,items_json=excluded.items_json,names_json=excluded.names_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(b.month,b.address,b.method,JSON.stringify(items),JSON.stringify(names),user.id,timestamp,timestamp),
      env.DB.prepare('INSERT INTO statement_revisions(id,month,old_json,new_json,actor_id,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),b.month,old?JSON.stringify(old):null,JSON.stringify(newData),user.id,timestamp),
      audit(env,user.id,old?'statement_updated':'statement_created','statement',String(b.month),{total_cents:items.reduce((a,x)=>a+x.amount_cents,0)})
    ]);
    return response(req,env,{ok:true,updated:Boolean(old)});
   }
   if(path==='/api/expenses'&&method==='POST'){
    const b=await jsonBody(req),category=String(b.category||'');
    if(!validMonth(b.month)||!cents(b.amount_cents)||!['equal','shares'].includes(String(b.method))||category.length>80||category.length<1||typeof b.description!=='string'&&b.description!==undefined||String(b.description||'').length>300)return fail(req,env,'Ελέγξτε τα στοιχεία της δαπάνης.');
    const apartments=(await env.DB.prepare('SELECT * FROM apartments ORDER BY code').all<Apartment>()).results;
    if(!apartments.length)return fail(req,env,'Δεν υπάρχουν διαμερίσματα.',409);
    const allocations=allocate(b.amount_cents,apartments,String(b.method)),id=uuid();
    await env.DB.batch([
     env.DB.prepare('INSERT INTO expenses(id,month,category,description,amount_cents,method,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.month,category,String(b.description||''),b.amount_cents,b.method,user.id,iso()),
     ...apartments.map((a,i)=>env.DB.prepare('INSERT INTO expense_allocations(expense_id,apartment_id,amount_cents) VALUES(?,?,?)').bind(id,a.id,allocations[i])),
     audit(env,user.id,'expense_created','expense',id,{amount_cents:b.amount_cents,month:b.month,method:b.method})
    ]);
    return response(req,env,{id,allocations:apartments.map((a,i)=>({apartment_code:a.code,amount_cents:allocations[i]}))},201);
   }
   if(path==='/api/payments/update'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||b.id.length>100||typeof b.apartment_code!=='string'||!['common','heating'].includes(String(b.kind))||!cents(b.amount_cents)||!validDate(b.paid_on))return fail(req,env,'Ελέγξτε τα στοιχεία της πληρωμής.');
    const before=await env.DB.prepare('SELECT p.id,p.apartment_id,a.code AS apartment_code,p.kind,p.amount_cents,p.paid_on FROM payments p JOIN apartments a ON a.id=p.apartment_id WHERE p.id=?').bind(b.id).first();
    if(!before)return fail(req,env,'Η πληρωμή δεν βρέθηκε.',404);
    const apartment=await env.DB.prepare('SELECT id FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string}>();
    if(!apartment)return fail(req,env,'Άγνωστο διαμέρισμα.');
    const after={apartment_code:b.apartment_code,kind:b.kind,amount_cents:b.amount_cents,paid_on:b.paid_on};
    await env.DB.batch([
      env.DB.prepare('UPDATE payments SET apartment_id=?,kind=?,amount_cents=?,paid_on=? WHERE id=?').bind(apartment.id,b.kind,b.amount_cents,b.paid_on,b.id),
      audit(env,user.id,'payment_updated','payment',b.id,{before,after})
    ]);
    return response(req,env,{ok:true,updated:true});
   }
   if(path==='/api/payments'&&method==='POST'){
    const b=await jsonBody(req);if(typeof b.apartment_code!=='string'||!['common','heating'].includes(String(b.kind))||!cents(b.amount_cents)||!validDate(b.paid_on))return fail(req,env,'Ελέγξτε τα στοιχεία πληρωμής.');
    const a=await env.DB.prepare('SELECT id FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string}>();
    if(!a)return fail(req,env,'Άγνωστο διαμέρισμα.');
    const id=uuid();await env.DB.batch([env.DB.prepare('INSERT INTO payments(id,apartment_id,kind,amount_cents,paid_on,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,a.id,b.kind,b.amount_cents,b.paid_on,user.id,iso()),audit(env,user.id,'payment_created','payment',id,{apartment_code:b.apartment_code,amount_cents:b.amount_cents,kind:b.kind})]);return response(req,env,{id},201);
   }
   if(path==='/api/readings/update'&&method==='POST'){
    const b=await jsonBody(req);
    if(!validDate(b.original_date)||!validDate(b.measured_on)||typeof b.centimeters!=='number'||!Number.isFinite(b.centimeters)||b.centimeters<0||b.centimeters>10000||!Array.isArray(b.readings))return fail(req,env,'Ελέγξτε την ημερομηνία και τις μετρήσεις.');
    const apartments=(await env.DB.prepare('SELECT id,code FROM apartments ORDER BY code').all<{id:string;code:string}>()).results;
    const readings=b.readings as Array<{apartment_code:string;reading:number}>;
    if(readings.length!==apartments.length||new Set(readings.map(x=>x.apartment_code)).size!==apartments.length||readings.some(x=>!apartments.some(a=>a.code===x.apartment_code)||!Number.isSafeInteger(x.reading)||x.reading<0))return fail(req,env,'Απαιτούνται έγκυρες μετρήσεις για όλα τα διαμερίσματα.');
    const original=await env.DB.prepare('SELECT id,centimeters,measured_on FROM tank_measurements WHERE measured_on=?').bind(b.original_date).first<{id:string;centimeters:number;measured_on:string}>();
    if(!original)return fail(req,env,'Η μέτρηση προς διόρθωση δεν βρέθηκε.',404);
    if(b.measured_on!==b.original_date){
     const collision=await env.DB.prepare('SELECT id FROM tank_measurements WHERE measured_on=?').bind(b.measured_on).first();
     if(collision)return fail(req,env,'Υπάρχει ήδη μέτρηση στη νέα ημερομηνία.',409);
    }
    const before=(await env.DB.prepare('SELECT a.code AS apartment_code,r.reading FROM heating_readings r JOIN apartments a ON a.id=r.apartment_id WHERE r.measured_on=? ORDER BY a.code').bind(b.original_date).all()).results;
    const queries:D1PreparedStatement[]=[];
    for(const a of apartments){
     const item=readings.find(x=>x.apartment_code===a.code)!;
     const previous=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on<? AND measured_on<>? ORDER BY measured_on DESC LIMIT 1').bind(a.id,b.measured_on,b.original_date).first<{reading:number}>();
     const next=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on>? AND measured_on<>? ORDER BY measured_on ASC LIMIT 1').bind(a.id,b.measured_on,b.original_date).first<{reading:number}>();
     if((previous&&item.reading<previous.reading)||(next&&item.reading>next.reading))return fail(req,env,'Η νέα ένδειξη '+a.code+' δεν συμφωνεί με την προηγούμενη/επόμενη μέτρηση.',409);
     const old=(before as Array<{apartment_code:string;reading:number}>).find(x=>x.apartment_code===a.code);
     if(!old)return fail(req,env,'Απουσιάζει η αρχική μέτρηση '+a.code+'.',409);
     queries.push(env.DB.prepare('UPDATE heating_readings SET measured_on=?,reading=? WHERE apartment_id=? AND measured_on=?').bind(b.measured_on,item.reading,a.id,b.original_date));
    }
    queries.unshift(env.DB.prepare('UPDATE tank_measurements SET measured_on=?,centimeters=? WHERE id=?').bind(b.measured_on,b.centimeters,original.id));
    queries.push(audit(env,user.id,'heating_readings_updated','tank_measurement',original.id,{before:{...original,readings:before},after:{measured_on:b.measured_on,centimeters:b.centimeters,readings}}));
    await env.DB.batch(queries);
    return response(req,env,{ok:true,updated:true});
   }
   if(path==='/api/readings'&&method==='POST'){
    const b=await jsonBody(req);if(!validDate(b.measured_on)||typeof b.centimeters!=='number'||!Number.isFinite(b.centimeters)||b.centimeters<0||b.centimeters>10000||!Array.isArray(b.readings))return fail(req,env,'Ελέγξτε τις μετρήσεις.');
    const apartments=(await env.DB.prepare('SELECT id,code FROM apartments ORDER BY code').all<{id:string;code:string}>()).results;
    if(b.readings.length!==apartments.length)return fail(req,env,'Απαιτούνται μετρήσεις από όλα τα διαμερίσματα.');
    const readings=b.readings as {apartment_code:string;reading:number}[];
    if(new Set(readings.map(r=>r.apartment_code)).size!==apartments.length)return fail(req,env,'Διπλές ή ελλιπείς μετρήσεις.');
    const statements:D1PreparedStatement[]=[];const tankId=uuid();statements.push(env.DB.prepare('INSERT INTO tank_measurements(id,measured_on,centimeters,created_by,created_at) VALUES(?,?,?,?,?)').bind(tankId,b.measured_on,b.centimeters,user.id,iso()));
    for(const a of apartments){
     const r=readings.find(x=>x.apartment_code===a.code);
     if(!r||!Number.isSafeInteger(r.reading)||r.reading<0)return fail(req,env,'Λανθασμένη ένδειξη μετρητή.');
     const previous=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on<? ORDER BY measured_on DESC LIMIT 1').bind(a.id,b.measured_on).first<{reading:number}>();
     const next=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on>? ORDER BY measured_on ASC LIMIT 1').bind(a.id,b.measured_on).first<{reading:number}>();
     if((previous&&r.reading<previous.reading)||(next&&r.reading>next.reading))return fail(req,env,'Η ένδειξη '+a.code+' δεν συμφωνεί με το ιστορικό.',409);
     statements.push(env.DB.prepare('INSERT INTO heating_readings(id,apartment_id,measured_on,reading,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),a.id,b.measured_on,r.reading,user.id,iso()));
    }
    statements.push(audit(env,user.id,'heating_readings_created','tank_measurement',tankId,{measured_on:b.measured_on,centimeters:b.centimeters}));
    await env.DB.batch(statements);return response(req,env,{ok:true},201);
   }
   if(path==='/api/fuel-deliveries'&&method==='POST'){
    const b=await jsonBody(req);if(!validDate(b.delivered_on)||typeof b.liters!=='number'||!Number.isFinite(b.liters)||b.liters<=0||!cents(b.cost_cents)||String(b.note||'').length>500)return fail(req,env,'Ελέγξτε τα στοιχεία παράδοσης πετρελαίου.');
    const id=uuid();await env.DB.batch([env.DB.prepare('INSERT INTO fuel_deliveries(id,delivered_on,liters,cost_cents,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,b.delivered_on,b.liters,b.cost_cents,String(b.note||''),user.id,iso()),audit(env,user.id,'fuel_delivery_created','fuel_delivery',id)]);return response(req,env,{id},201);
   }
   if(path==='/api/residents'&&method==='POST'){
    const b=await jsonBody(req);
    if(!validEmail(b.email)||typeof b.password!=='string'||b.password.length<12||b.password.length>128||typeof b.apartment_code!=='string')return fail(req,env,'Ελέγξτε email, διαμέρισμα και κωδικό (τουλάχιστον 12 χαρακτήρες).');
    const a=await env.DB.prepare('SELECT id FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string}>();
    if(!a)return fail(req,env,'Άγνωστο διαμέρισμα.');
    const id=uuid(),salt=randomToken(),email=b.email.trim().toLowerCase();
    await env.DB.batch([
     env.DB.prepare('INSERT INTO users(id,email,salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(id,email,salt,await hashPassword(b.password,salt),'resident',iso()),
     env.DB.prepare('INSERT INTO memberships(user_id,apartment_id,created_at) VALUES(?,?,?)').bind(id,a.id,iso()),
     audit(env,user.id,'resident_created','user',id,{apartment_code:b.apartment_code})
    ]);
    return response(req,env,{ok:true},201);
   }
   return fail(req,env,'Η λειτουργία δεν βρέθηκε.',404);
  }catch(e){const err=e instanceof Error?e.message:'Άγνωστο σφάλμα';console.error('Σφάλμα αιτήματος',err.replace(/[\w.+-]+@[\w.-]+/g,'[email]'));return fail(req,env,err.includes('UNIQUE constraint')?'Η εγγραφή υπάρχει ήδη.':'Δεν ήταν δυνατή η ολοκλήρωση της ενέργειας.',err.includes('UNIQUE constraint')?409:500);}
 }
} satisfies ExportedHandler<Env>;
