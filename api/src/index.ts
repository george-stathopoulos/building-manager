import {calculateFuelAccounts,type FuelApartment,type FuelReading,type FuelTank,type FuelDelivery,type FuelPayment,type FuelOpening,type FuelSettings} from './fuel-model';
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
function validPin(pin:unknown):pin is string{return typeof pin==='string'&&/^\d{4}$/.test(pin);}
function defaultPin(code:string){const i=['A1','A2','A3','B1','B2','B3'].indexOf(code);return i<0?null:String(i+1).padStart(4,'0');}
type PinCredential={apartment_id:string;user_id:string;salt:string;pin_hash:string;must_change:number};
async function pinCredential(env:Env,apartmentId:string){return env.DB.prepare('SELECT * FROM apartment_pin_credentials WHERE apartment_id=?').bind(apartmentId).first<PinCredential>();}
async function replacePin(env:Env,apartmentId:string,userId:string,pin:string,mustChange:boolean){const salt=randomToken();await env.DB.prepare('INSERT INTO apartment_pin_credentials(apartment_id,user_id,salt,pin_hash,must_change,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(apartment_id) DO UPDATE SET salt=excluded.salt,pin_hash=excluded.pin_hash,must_change=excluded.must_change,updated_at=excluded.updated_at').bind(apartmentId,userId,salt,await hashPassword(pin,salt),mustChange?1:0,iso()).run();}
function validEmail(v:unknown):v is string{return typeof v==='string'&&v.length<=254&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);}
function validDate(v:unknown):v is string{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
function validMonth(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);}
function validHeatingHours(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=0&&Math.abs(v*100-Math.round(v*100))<1e-7;}
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
   if(path==='/api/pin/login'&&method==='POST'){
    const b=await jsonBody(req);if(typeof b.apartment_code!=='string'||!validPin(b.pin))return fail(req,env,'Λανθασμένο διαμέρισμα ή PIN.',401);
    const apt=await env.DB.prepare('SELECT id,code FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string;code:string}>();
    if(!apt)return fail(req,env,'Λανθασμένο διαμέρισμα ή PIN.',401);
    const cutoff=new Date(Date.now()-30*60000).toISOString();
    const attempts=await env.DB.prepare('SELECT attempts,window_start FROM apartment_pin_attempts WHERE apartment_id=?').bind(apt.id).first<{attempts:number;window_start:string}>();
    if(attempts&&attempts.window_start>cutoff&&attempts.attempts>=5)return fail(req,env,'Πολλές προσπάθειες. Δοκιμάστε ξανά σε 30 λεπτά.',429);
    let cred=await pinCredential(env,apt.id);
    const ok=cred?same(await hashPassword(b.pin,cred.salt),cred.pin_hash):b.pin===defaultPin(apt.code);
    if(!ok){await env.DB.prepare('INSERT INTO apartment_pin_attempts(apartment_id,attempts,window_start) VALUES(?,?,?) ON CONFLICT(apartment_id) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start').bind(apt.id,attempts&&attempts.window_start>cutoff?attempts.attempts+1:1,attempts&&attempts.window_start>cutoff?attempts.window_start:iso()).run();return fail(req,env,'Λανθασμένο διαμέρισμα ή PIN.',401);}
    await env.DB.prepare('DELETE FROM apartment_pin_attempts WHERE apartment_id=?').bind(apt.id).run();
    if(!cred){const userId=uuid(),salt=randomToken(),email='apartment-'+apt.code.toLowerCase()+'@building-manager.invalid';await env.DB.batch([env.DB.prepare('INSERT INTO users(id,email,salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(userId,email,salt,await hashPassword(randomToken(),salt),'resident',iso()),env.DB.prepare('INSERT INTO memberships(user_id,apartment_id,created_at) VALUES(?,?,?)').bind(userId,apt.id,iso())]);await replacePin(env,apt.id,userId,b.pin,true);cred=await pinCredential(env,apt.id);}
    if(!cred)return fail(req,env,'Σφάλμα λογαριασμού.',500);
    return response(req,env,{token:await session(env,cred.user_id),must_change:Boolean(cred.must_change)});
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
   const myPin=await env.DB.prepare('SELECT c.apartment_id,c.must_change FROM apartment_pin_credentials c WHERE c.user_id=?').bind(user.id).first<{apartment_id:string;must_change:number}>();
   if(path==='/api/account/pin'&&method==='POST'){
    if(!myPin)return fail(req,env,'Ο λογαριασμός δεν χρησιμοποιεί PIN.',403);
    const b=await jsonBody(req);if(!validPin(b.pin)||!validPin(b.confirm_pin)||b.pin!==b.confirm_pin)return fail(req,env,'Το PIN πρέπει να έχει 4 ψηφία και να επιβεβαιώνεται.');
    if(!myPin.must_change){if(!validPin(b.current_pin))return fail(req,env,'Απαιτείται το τρέχον PIN.',403);const cred=await pinCredential(env,myPin.apartment_id);if(!cred||!same(await hashPassword(b.current_pin,cred.salt),cred.pin_hash))return fail(req,env,'Λανθασμένο τρέχον PIN.',403);}
    if(b.pin===defaultPin((await env.DB.prepare('SELECT code FROM apartments WHERE id=?').bind(myPin.apartment_id).first<{code:string}>())?.code||''))return fail(req,env,'Επιλέξτε διαφορετικό PIN από το αρχικό.');
    await replacePin(env,myPin.apartment_id,user.id,b.pin,false);await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();await audit(env,user.id,'resident_pin_changed','apartment',myPin.apartment_id).run();return response(req,env,{token:await session(env,user.id)});
   }
   if(myPin?.must_change&&path!=='/api/logout'&&path!=='/api/account')return fail(req,env,'Αλλάξτε πρώτα το αρχικό PIN.',403);
   const owner= user.role!=='admin' && (await env.DB.prepare("SELECT 1 AS found FROM memberships m JOIN apartments a ON a.id=m.apartment_id WHERE m.user_id=? AND a.code='B3' LIMIT 1").bind(user.id).first())!==null;
   const canReview=user.role==='admin'||owner;
   const effectiveRole=owner?'owner':user.role;
   if(path==='/api/account'&&method==='GET')return response(req,env,{role:effectiveRole,apartment_code:myPin?(await env.DB.prepare('SELECT code FROM apartments WHERE id=?').bind(myPin.apartment_id).first<{code:string}>())?.code:null,must_change:Boolean(myPin?.must_change)});
   if(path==='/api/admin/pins'&&method==='GET'){
    if(user.role!=='admin')return fail(req,env,'Δεν επιτρέπεται.',403);
    const rows=(await env.DB.prepare('SELECT a.code,c.must_change,c.updated_at FROM apartments a LEFT JOIN apartment_pin_credentials c ON c.apartment_id=a.id ORDER BY a.code').all()).results;
    return response(req,env,{apartments:rows.map((x:any)=>({code:x.code,activated:x.must_change===0,must_change:x.must_change===null||x.must_change===1,updated_at:x.updated_at}))});
   }
   if(path==='/api/admin/pins/reset'&&method==='POST'){
    if(user.role!=='admin')return fail(req,env,'Δεν επιτρέπεται.',403);
    const b=await jsonBody(req);if(typeof b.apartment_code!=='string'||!validPin(b.pin))return fail(req,env,'Επιλέξτε διαμέρισμα και τετραψήφιο PIN.');
    const apt=await env.DB.prepare('SELECT id,code FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string;code:string}>();if(!apt)return fail(req,env,'Άγνωστο διαμέρισμα.');
    let cred=await pinCredential(env,apt.id);
    if(!cred){const userId=uuid(),salt=randomToken();await env.DB.batch([env.DB.prepare('INSERT INTO users(id,email,salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(userId,'apartment-'+apt.code.toLowerCase()+'@building-manager.invalid',salt,await hashPassword(randomToken(),salt),'resident',iso()),env.DB.prepare('INSERT INTO memberships(user_id,apartment_id,created_at) VALUES(?,?,?)').bind(userId,apt.id,iso())]);await replacePin(env,apt.id,userId,b.pin,true);cred=await pinCredential(env,apt.id);}else await replacePin(env,apt.id,cred.user_id,b.pin,true);
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(cred!.user_id).run();await env.DB.prepare('DELETE FROM apartment_pin_attempts WHERE apartment_id=?').bind(apt.id).run();await audit(env,user.id,'resident_pin_reset','apartment',apt.id,{code:apt.code}).run();return response(req,env,{ok:true});
   }
   if(path==='/api/logout'&&method==='POST'){const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')||'');if(match)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(match[1])).run();return response(req,env,{ok:true});}
   if(path==='/api/overview'&&method==='GET'){
    const own=canReview?null:await myApartmentIds(env,user);
    const a=(await env.DB.prepare('SELECT id,code,common_weight AS common_share,heating_share_bp/100.0 AS heating_share FROM apartments ORDER BY code').all<{id:string;code:string;common_share:number;heating_share:number}>()).results;
    const es=(await env.DB.prepare('SELECT id,month,category,description,amount_cents,created_at FROM expenses ORDER BY month DESC,created_at DESC LIMIT 500').all()).results;
    const ps=(await env.DB.prepare('SELECT p.id,a.code AS apartment_code,p.kind,p.amount_cents,p.paid_on FROM payments p JOIN apartments a ON a.id=p.apartment_id ORDER BY p.paid_on DESC,p.created_at DESC LIMIT 500').all<{id:string;apartment_code:string;kind:string;amount_cents:number;paid_on:string}>()).results;
    const rs=(await env.DB.prepare('SELECT r.id,a.code AS apartment_code,r.reading,r.measured_on FROM heating_readings r JOIN apartments a ON a.id=r.apartment_id ORDER BY r.measured_on DESC,a.code LIMIT 500').all<{id:string;apartment_code:string;reading:number;measured_on:string}>()).results;
    const tank=await env.DB.prepare('SELECT measured_on,centimeters FROM tank_measurements ORDER BY measured_on DESC LIMIT 1').first<{measured_on:string;centimeters:number}>();
    const tank_history=(await env.DB.prepare('SELECT id,measured_on,centimeters FROM tank_measurements ORDER BY measured_on DESC LIMIT 100').all<{id:string;measured_on:string;centimeters:number}>()).results;
    const fuel_deliveries=canReview?(await env.DB.prepare('SELECT id,delivered_on,liters,cost_cents,note FROM fuel_deliveries ORDER BY delivered_on DESC LIMIT 500').all()).results:[];
    const accessible=new Set(a.filter(x=>!own||own.includes(x.id)).map(x=>x.code));
    return response(req,env,{role:effectiveRole,email:user.email,my_apartments:[...accessible],apartments:a.filter(x=>accessible.has(x.code)),expenses:canReview?es:[],fuel_deliveries,payments:ps.filter(x=>accessible.has(x.apartment_code)),readings:rs.filter(x=>accessible.has(x.apartment_code)),tank:canReview?tank:null,tank_history:canReview?tank_history:[]});
   }
   if(path==='/api/fuel/accounts'&&method==='GET'){
    const own=await myApartmentIds(env,user);
    const apartments=(await env.DB.prepare('SELECT id,code,heating_share_bp FROM apartments ORDER BY code').all<FuelApartment>()).results;
    const readings=(await env.DB.prepare('SELECT apartment_id,measured_on,reading FROM heating_readings ORDER BY measured_on').all<FuelReading>()).results;
    const tank=(await env.DB.prepare('SELECT measured_on,centimeters FROM tank_measurements ORDER BY measured_on').all<FuelTank>()).results;
    const deliveries=(await env.DB.prepare('SELECT delivered_on,liters FROM fuel_deliveries ORDER BY delivered_on').all<FuelDelivery>()).results;
    const payments=(await env.DB.prepare("SELECT apartment_id,paid_on,amount_cents FROM payments WHERE kind='heating' ORDER BY paid_on").all<FuelPayment>()).results;
    const openings=(await env.DB.prepare('SELECT apartment_id,as_of,deposited_cents,estimated_consumed_cents,note FROM fuel_openings').all<FuelOpening>()).results;
    const settings=await env.DB.prepare('SELECT liters_per_cm,price_cents_per_liter FROM fuel_settings WHERE id=1').first<FuelSettings>();
    if(!settings)return fail(req,env,'Δεν έχουν ενεργοποιηθεί ακόμη οι ρυθμίσεις θέρμανσης.',503);
    const legacy=(await env.DB.prepare('SELECT apartment_id,as_of,reported_deposited_cents,reported_estimated_consumed_cents FROM fuel_legacy_snapshots').all<{apartment_id:string;as_of:string;reported_deposited_cents:number;reported_estimated_consumed_cents:number}>()).results;
    const settlement=await env.DB.prepare('SELECT settled_through,historical_arrears_cents,credit_status FROM fuel_settlement WHERE id=1').first<{settled_through:string;historical_arrears_cents:number;credit_status:string}>();
    if(!settlement)return fail(req,env,'Δεν έχει οριστεί ακόμη η ημερομηνία εκκαθάρισης θέρμανσης.',503);
    const model=calculateFuelAccounts({apartments,readings,tank,deliveries,payments,openings,settings,settledThrough:settlement.settled_through});
    const visible=apartments.filter(a=>!own||own.includes(a.id));
    return response(req,env,{
     settings,settlement,
     accounts:model.accounts.filter(a=>visible.some(v=>v.code===a.apartment_code)).map(a=>({
      ...a,legacy:legacy.find(x=>visible.some(v=>v.code===a.apartment_code&&v.id===x.apartment_id))||null
     })),
     excluded:model.excluded,period_count:model.periodCount,
     note:'Όλες οι ιστορικές καταναλώσεις έως την ημερομηνία εκκαθάρισης έχουν εξοφληθεί. Οι νέες εκτιμήσεις υπολογίζονται μόνο από επόμενες μετρήσεις. Τυχόν υπόλοιπο πίστωσης απαιτεί ξεχωριστή συμφωνία.'
    });
   }
   if(path==='/api/announcements'&&method==='GET'){
    const own=await myApartmentIds(env,user);
    const apartmentId=own?.[0]||null;
    const all=(await env.DB.prepare('SELECT id,title,body,published_at,created_at,archived_at FROM announcements ORDER BY published_at DESC LIMIT 100').all<{id:string;title:string;body:string;published_at:string;created_at:string;archived_at:string|null}>()).results;
    const reads=apartmentId?(await env.DB.prepare('SELECT announcement_id FROM announcement_reads WHERE apartment_id=?').bind(apartmentId).all<{announcement_id:string}>()).results.map(x=>x.announcement_id):[];
    const announcements=all.filter(a=>user.role==='admin'||!a.archived_at).map(a=>({...a,read:user.role==='admin'||reads.includes(a.id)}));
    return response(req,env,{announcements,unread_count:announcements.filter(a=>!a.read).length});
   }
   if(path==='/api/announcements/read'&&method==='POST'){
    if(user.role==='admin')return response(req,env,{ok:true});
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||b.id.length>100)return fail(req,env,'Μη έγκυρη ανακοίνωση.');
    const announcement=await env.DB.prepare('SELECT id FROM announcements WHERE id=? AND archived_at IS NULL').bind(b.id).first();
    if(!announcement)return fail(req,env,'Η ανακοίνωση δεν βρέθηκε.',404);
    const own=await myApartmentIds(env,user);
    if(!own?.length)return fail(req,env,'Δεν βρέθηκε διαμέρισμα.',403);
    await env.DB.batch(own.map(apartmentId=>env.DB.prepare('INSERT OR IGNORE INTO announcement_reads(announcement_id,apartment_id,read_at) VALUES(?,?,?)').bind(b.id,apartmentId,iso())));
    return response(req,env,{ok:true});
   }
   if(path==='/api/statements'&&method==='GET'){
    if(user.role!=='admin')return fail(req,env,'Δεν επιτρέπεται η προβολή των συνολικών καταστάσεων.',403);
    const rows=(await env.DB.prepare('SELECT month,address,method,items_json,names_json,created_at,updated_at FROM monthly_statements ORDER BY month DESC').all()).results;
    return response(req,env,{statements:rows.map((r:any)=>({month:r.month,address:r.address,method:r.method,items:JSON.parse(r.items_json),names:JSON.parse(r.names_json),created_at:r.created_at,updated_at:r.updated_at}))});
   }
   if(path==='/api/statements/detail'&&method==='GET'){
    const month=url.searchParams.get('month');
    if(!validMonth(month))return fail(req,env,'Επιλέξτε έγκυρο μήνα.');
    const statement=await env.DB.prepare('SELECT month,address,method,items_json FROM monthly_statements WHERE month=?').bind(month).first<{month:string;address:string;method:string;items_json:string}>();
    if(!statement)return fail(req,env,'Η κατάσταση κοινοχρήστων δεν βρέθηκε.',404);
    const own=await myApartmentIds(env,user);
    const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
    const items=JSON.parse(statement.items_json) as Array<{name:string;amount_cents:number}>;
    const total=items.reduce((n,x)=>n+x.amount_cents,0);
    const allocations=allocate(total,apartments,statement.method);
    const selected=apartments.filter(a=>!own||own.includes(a.id)).map(a=>({apartment_code:a.code,due_cents:allocations[apartments.findIndex(x=>x.id===a.id)]}));
    return response(req,env,{month:statement.month,address:statement.address,items,total_cents:total,apartments:selected});
   }
   if(path==='/api/statements/summary'&&method==='GET'){
    const own=await myApartmentIds(env,user);
    const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
    const statements=(await env.DB.prepare('SELECT month,method,items_json FROM monthly_statements ORDER BY month DESC').all<{month:string;method:string;items_json:string}>()).results;
    const payments=(await env.DB.prepare('SELECT month,apartment_id,paid_cents,paid_on FROM statement_payments').all<{month:string;apartment_id:string;paid_cents:number;paid_on:string|null}>()).results;
    const months=statements.map(st=>{
      const items=JSON.parse(st.items_json) as Array<{name:string;amount_cents:number}>;
      const allocations=allocate(items.reduce((n,x)=>n+x.amount_cents,0),apartments,st.method);
      const rows=apartments.filter(a=>!own||own.includes(a.id)).map(a=>{
        const i=apartments.findIndex(x=>x.id===a.id),p=payments.find(p=>p.month===st.month&&p.apartment_id===a.id);
        const due=allocations[i],paid=['A2','B3'].includes(a.code)?due:Math.min(p?.paid_cents||0,due);
        return {apartment_code:a.code,due_cents:due,paid_cents:paid,balance_cents:due-paid,paid_on:p?.paid_on||null,paid:paid>=due};
      });
      return {month:st.month,apartments:rows,due_cents:rows.reduce((n,x)=>n+x.due_cents,0),paid_cents:rows.reduce((n,x)=>n+x.paid_cents,0),balance_cents:rows.reduce((n,x)=>n+x.balance_cents,0),paid_count:rows.filter(x=>x.paid).length,apartment_count:rows.length};
    });
    return response(req,env,{months});
   }
   if(path==='/api/statements/payments'&&method==='GET'){
    const month=url.searchParams.get('month');
    if(!validMonth(month))return fail(req,env,'Επιλέξτε έγκυρο μήνα.');
    const statement=await env.DB.prepare('SELECT month,items_json,method FROM monthly_statements WHERE month=?').bind(month).first<{month:string;items_json:string;method:string}>();
    if(!statement)return fail(req,env,'Η κατάσταση κοινοχρήστων δεν βρέθηκε.',404);
    const own=await myApartmentIds(env,user);
    const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
    const items=JSON.parse(statement.items_json) as Array<{name:string;amount_cents:number}>;
    const total=items.reduce((sum,item)=>sum+item.amount_cents,0);
    const due=allocate(total,apartments,statement.method);
    const paid=(await env.DB.prepare('SELECT apartment_id,paid_cents,paid_on FROM statement_payments WHERE month=?').bind(month).all<{apartment_id:string;paid_cents:number;paid_on:string|null}>()).results;
    return response(req,env,{month,apartments:apartments.filter(a=>!own||own.includes(a.id)).map(a=>{const i=apartments.findIndex(x=>x.id===a.id);const payment=paid.find(x=>x.apartment_id===a.id);const paidCents=['A2','B3'].includes(a.code)?due[i]:(payment?.paid_cents||0);return {apartment_code:a.code,due_cents:due[i],paid_cents:paidCents,balance_cents:Math.max(0,due[i]-paidCents),paid_on:payment?.paid_on||null,status:paidCents>=due[i]?'paid':paidCents>0?'partial':'unpaid'};})});
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
   if(path==='/api/heating-requests'&&method==='GET'){
    const own=await myApartmentIds(env,user);
    const rows=(await env.DB.prepare("SELECT h.id,a.code AS apartment_code,h.amount_cents,h.requested_on,h.status,h.declared_on,h.confirmed_on,h.created_at FROM heating_payment_requests h JOIN apartments a ON a.id=h.apartment_id ORDER BY h.created_at DESC LIMIT 300").all<{id:string;apartment_code:string;amount_cents:number;requested_on:string;status:string;declared_on:string|null;confirmed_on:string|null;created_at:string}>()).results;
    const codes=own?new Set((await env.DB.prepare('SELECT id,code FROM apartments').all<{id:string;code:string}>()).results.filter(a=>own.includes(a.id)).map(a=>a.code)):null;
    return response(req,env,{requests:canReview?rows:rows.filter(x=>codes?.has(x.apartment_code))});
   }
   if(path==='/api/heating-requests/declare'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.id!=='string')return fail(req,env,'Μη έγκυρο αίτημα.');
    const row=await env.DB.prepare('SELECT apartment_id,status FROM heating_payment_requests WHERE id=?').bind(b.id).first<{apartment_id:string;status:string}>();
    if(!row)return fail(req,env,'Δεν βρέθηκε η χρέωση.',404);
    const own=await myApartmentIds(env,user);
    if(!canReview&&!own?.includes(row.apartment_id))return fail(req,env,'Δεν επιτρέπεται.',403);
    if(row.status!=='unpaid')return fail(req,env,'Η πληρωμή έχει ήδη δηλωθεί.',409);
    const now=iso();
    const result=await env.DB.batch([env.DB.prepare("UPDATE heating_payment_requests SET status='pending',declared_on=?,updated_at=? WHERE id=? AND status='unpaid'").bind(now.slice(0,10),now,b.id),audit(env,user.id,'heating_payment_declared','heating_payment_request',b.id,{})]);
    if(result[0].meta.changes!==1)return fail(req,env,'Η πληρωμή έχει ήδη δηλωθεί.',409);
    return response(req,env,{ok:true});
   }
   if(path==='/api/heating-requests/create'&&method==='POST'){
    if(user.role!=='admin')return fail(req,env,'Μόνο ο διαχειριστής δημιουργεί χρεώσεις θέρμανσης.',403);
    const b=await jsonBody(req);
    if(!validDate(b.requested_on)||!Array.isArray(b.allocations)||b.allocations.length<1||b.allocations.length>6)return fail(req,env,'Ελέγξτε την ημερομηνία και τα ποσά.');
    const entries=b.allocations as Array<{apartment_code:string;amount_cents:number}>;
    if(entries.some(x=>!['A1','A2','A3','B1','B2','B3'].includes(x.apartment_code)||!cents(x.amount_cents))||new Set(entries.map(x=>x.apartment_code)).size!==entries.length)return fail(req,env,'Μη έγκυρα ποσά ή διαμερίσματα.');
    const apartments=(await env.DB.prepare('SELECT id,code FROM apartments').all<{id:string;code:string}>()).results;
    const now=iso(),writes:D1PreparedStatement[]=[];
    for(const e of entries){const id=uuid(),a=apartments.find(x=>x.code===e.apartment_code)!;writes.push(env.DB.prepare("INSERT INTO heating_payment_requests(id,apartment_id,amount_cents,requested_on,status,created_by,created_at,updated_at) VALUES(?,?,?,?,'unpaid',?,?,?)").bind(id,a.id,e.amount_cents,b.requested_on,user.id,now));writes.push(audit(env,user.id,'heating_payment_requested','heating_payment_request',id,{apartment_code:e.apartment_code,amount_cents:e.amount_cents}));}
    await env.DB.batch(writes);return response(req,env,{ok:true,created:entries.length},201);
   }
   if(path==='/api/heating-requests/review'&&method==='POST'){
    if(!canReview)return fail(req,env,'Δεν επιτρέπεται.',403);
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||!['confirmed','unpaid'].includes(String(b.decision))||!validDate(b.paid_on))return fail(req,env,'Ελέγξτε τα στοιχεία επιβεβαίωσης.');
    const h=await env.DB.prepare('SELECT * FROM heating_payment_requests WHERE id=?').bind(b.id).first<{id:string;apartment_id:string;amount_cents:number;status:string}>();
    if(!h)return fail(req,env,'Δεν βρέθηκε η πληρωμή.',404);
    if(h.status!=='pending')return fail(req,env,'Η δήλωση δεν εκκρεμεί.',409);
    const now=iso(),id=uuid(),confirmed=b.decision==='confirmed';
    const writes:D1PreparedStatement[]=[];
    if(confirmed)writes.push(env.DB.prepare("INSERT INTO payments(id,apartment_id,kind,amount_cents,paid_on,created_by,created_at) VALUES(?,?,'heating',?,?,?,?)").bind(id,h.apartment_id,h.amount_cents,b.paid_on,user.id,now));
    writes.push(env.DB.prepare("UPDATE heating_payment_requests SET status=?,confirmed_on=?,payment_id=?,reviewed_by=?,updated_at=? WHERE id=? AND status='pending'").bind(b.decision,confirmed?b.paid_on:null,confirmed?id:null,user.id,now,b.id));
    writes.push(audit(env,user.id,'heating_payment_reviewed','heating_payment_request',b.id,{decision:b.decision,amount_cents:h.amount_cents,paid_on:b.paid_on}));
    await env.DB.batch(writes);return response(req,env,{ok:true});
   }
   if(path==='/api/payment-declarations'&&method==='GET'){
    const rows=(await env.DB.prepare("SELECT d.id,a.code AS apartment_code,d.kind,d.month,d.amount_cents,d.declared_on,d.status,d.reversed_at,d.created_at,d.reviewed_at,CASE WHEN n.declaration_id IS NOT NULL THEN 1 ELSE 0 END AS notification_read FROM payment_declarations d JOIN apartments a ON a.id=d.apartment_id LEFT JOIN payment_notification_reads n ON n.declaration_id=d.id AND n.apartment_id=d.apartment_id ORDER BY CASE WHEN d.status='pending' THEN 0 ELSE 1 END,d.created_at DESC LIMIT 300").all<{id:string;apartment_code:string;kind:string;month:string|null;amount_cents:number;declared_on:string;status:string;created_at:string;reviewed_at:string|null;reversed_at:string|null;notification_read:number}>()).results;
    const own=canReview?null:await myApartmentIds(env,user);
    const allowed=own?new Set((await env.DB.prepare('SELECT id,code FROM apartments').all<{id:string;code:string}>()).results.filter(a=>own.includes(a.id)).map(a=>a.code)):null;
    const declarations=rows.filter(x=>!allowed||allowed.has(x.apartment_code));
    return response(req,env,{declarations,unread_payment_count:canReview?0:declarations.filter(x=>x.status!=='pending'&&!x.notification_read).length});
   }
   if(path==='/api/payment-declarations/mark-read'&&method==='POST'){
    const b=await jsonBody(req);
    if(!Array.isArray(b.ids)||b.ids.length>100||b.ids.some((id:unknown)=>typeof id!=='string'||id.length>100))return fail(req,env,'Μη έγκυρες ειδοποιήσεις.');
    const own=await myApartmentIds(env,user);
    if(!own?.length)return fail(req,env,'Δεν βρέθηκε διαμέρισμα.',403);
    const rows=(await env.DB.prepare("SELECT d.id,d.apartment_id FROM payment_declarations d WHERE d.status!='pending'").all<{id:string;apartment_id:string}>()).results;
    const ids=new Set(b.ids as string[]);
    const allowed=rows.filter(x=>ids.has(x.id)&&own.includes(x.apartment_id));
    if(allowed.length)await env.DB.batch(allowed.map(x=>env.DB.prepare('INSERT OR IGNORE INTO payment_notification_reads(declaration_id,apartment_id,read_at) VALUES(?,?,?)').bind(x.id,x.apartment_id,iso())));
    return response(req,env,{ok:true});
   }
   if(path==='/api/payment-declarations'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.apartment_code!=='string'||b.kind!=='common'||!validDate(b.declared_on))return fail(req,env,'Ελέγξτε τα στοιχεία πληρωμής.');
    const apt=await env.DB.prepare('SELECT id,code FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string;code:string}>();
    if(!apt)return fail(req,env,'Άγνωστο διαμέρισμα.',404);
    if(['A2','B3'].includes(apt.code))return fail(req,env,'Το διαμέρισμα εξοφλείται αυτόματα.');
    if(!canReview){const own=await myApartmentIds(env,user);if(!own?.includes(apt.id))return fail(req,env,'Δεν επιτρέπεται.',403);}
    let amount=0;let month:string|null=null;
    if(b.kind==='common'){
     if(!validMonth(b.month))return fail(req,env,'Επιλέξτε μήνα.');
     month=b.month;
     const statement=await env.DB.prepare('SELECT method,items_json FROM monthly_statements WHERE month=?').bind(month).first<{method:string;items_json:string}>();
     if(!statement)return fail(req,env,'Δεν βρέθηκαν κοινόχρηστα για τον μήνα.',404);
     const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
     const due=allocate((JSON.parse(statement.items_json) as Array<{amount_cents:number}>).reduce((n,x)=>n+x.amount_cents,0),apartments,statement.method);
     const already=await env.DB.prepare('SELECT paid_cents FROM statement_payments WHERE month=? AND apartment_id=?').bind(month,apt.id).first<{paid_cents:number}>();
     amount=Math.max(0,due[apartments.findIndex(a=>a.id===apt.id)]-(already?.paid_cents||0));
     if(!amount)return fail(req,env,'Τα κοινόχρηστα είναι ήδη εξοφλημένα.');
    }else{
     if(!cents(b.amount_cents))return fail(req,env,'Συμπληρώστε έγκυρο ποσό θέρμανσης.');
     amount=b.amount_cents;
    }
    const id=uuid(),timestamp=iso();
    try{await env.DB.batch([
     env.DB.prepare('INSERT INTO payment_declarations(id,apartment_id,kind,month,amount_cents,declared_on,status,declared_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,apt.id,b.kind,month,amount,b.declared_on,'pending',user.id,timestamp),
     audit(env,user.id,'payment_declared','payment_declaration',id,{apartment_code:apt.code,kind:b.kind,month,amount_cents:amount})
    ]);}catch{return fail(req,env,'Υπάρχει ήδη αίτημα επιβεβαίωσης για αυτόν τον μήνα ή η καταχώριση απέτυχε.',409);}
    return response(req,env,{ok:true,id},201);
   }
   if(path==='/api/payment-declarations/review'&&method==='POST'){
    if(!canReview)return fail(req,env,'Δεν επιτρέπεται.',403);
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||!['confirmed','rejected'].includes(String(b.decision)))return fail(req,env,'Μη έγκυρη απόφαση.');
    const row=await env.DB.prepare("SELECT d.*,a.code AS apartment_code FROM payment_declarations d JOIN apartments a ON a.id=d.apartment_id WHERE d.id=?").bind(b.id).first<{id:string;apartment_id:string;apartment_code:string;kind:string;month:string|null;amount_cents:number;declared_on:string;status:string}>();
    if(!row)return fail(req,env,'Το αίτημα δεν βρέθηκε.',404);
    if(row.status!=='pending')return fail(req,env,'Το αίτημα έχει ήδη εξεταστεί.',409);
    if(row.kind==='heating'&&b.decision==='confirmed')return fail(req,env,'Οι καταθέσεις θέρμανσης καταχωρίζονται απευθείας από τον διαχειριστή στην ενότητα Θέρμανση.',409);
    const timestamp=iso(),confirmed=b.decision==='confirmed';
    const writes:D1PreparedStatement[]=[
     env.DB.prepare("UPDATE payment_declarations SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(b.decision,user.id,timestamp,b.id)
    ];
    if(confirmed&&row.kind==='heating'){
     writes.push(env.DB.prepare("INSERT OR IGNORE INTO payments(id,apartment_id,kind,amount_cents,paid_on,created_by,created_at,source_declaration_id) SELECT ?,apartment_id,'heating',amount_cents,declared_on,?,?,id FROM payment_declarations WHERE id=? AND status='confirmed' AND reviewed_by=? AND reviewed_at=?").bind(uuid(),user.id,timestamp,b.id,user.id,timestamp));
    }
    if(confirmed&&row.kind==='common'&&row.month){
     const st=await env.DB.prepare('SELECT method,items_json FROM monthly_statements WHERE month=?').bind(row.month).first<{method:string;items_json:string}>();
     if(!st)return fail(req,env,'Η μηνιαία κατάσταση δεν βρέθηκε.',409);
     const a=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
     const due=allocate((JSON.parse(st.items_json) as Array<{amount_cents:number}>).reduce((n,x)=>n+x.amount_cents,0),a,st.method)[a.findIndex(x=>x.id===row.apartment_id)];
     writes.push(env.DB.prepare("INSERT INTO statement_payments(month,apartment_id,paid_cents,paid_on,updated_by,updated_at) SELECT ?,apartment_id,?,?,?,? FROM payment_declarations WHERE id=? AND status='confirmed' AND reviewed_by=? AND reviewed_at=? ON CONFLICT(month,apartment_id) DO UPDATE SET paid_cents=excluded.paid_cents,paid_on=excluded.paid_on,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(row.month,due,row.declared_on,user.id,timestamp,b.id,user.id,timestamp));
    }
    writes.push(audit(env,user.id,'payment_declaration_reviewed','payment_declaration',b.id,{decision:b.decision,apartment_code:row.apartment_code,kind:row.kind,amount_cents:row.amount_cents}));
    const result=await env.DB.batch(writes);
    if(result[0].meta.changes!==1)return fail(req,env,'Το αίτημα έχει ήδη εξεταστεί.',409);
    return response(req,env,{ok:true});
   }
   if(path==='/api/payment-declarations/reverse'&&method==='POST'){
    if(user.role!=='admin')return fail(req,env,'Μόνο ο διαχειριστής μπορεί να αναιρέσει πληρωμές.',403);
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>500)return fail(req,env,'Απαιτείται αιτιολογία (τουλάχιστον 5 χαρακτήρες).');
    const d=await env.DB.prepare("SELECT d.*,a.code AS apartment_code FROM payment_declarations d JOIN apartments a ON a.id=d.apartment_id WHERE d.id=?").bind(b.id).first<{id:string;apartment_id:string;apartment_code:string;kind:string;month:string|null;amount_cents:number;status:string}>();
    if(!d)return fail(req,env,'Η πληρωμή δεν βρέθηκε.',404);
    if(d.status!=='confirmed')return fail(req,env,'Μόνο επιβεβαιωμένες πληρωμές μπορούν να αναιρεθούν.',409);
    const now=iso(),writes:D1PreparedStatement[]=[];
    if(d.kind==='heating'){
     const deposit=await env.DB.prepare('SELECT id FROM payments WHERE source_declaration_id=?').bind(d.id).first<{id:string}>();
     if(!deposit)return fail(req,env,'Η πίστωση θέρμανσης δεν βρέθηκε. Δεν έγινε αναίρεση.',409);
     writes.push(env.DB.prepare('DELETE FROM payments WHERE source_declaration_id=?').bind(d.id));
    }else if(d.kind==='common'&&d.month){
     const current=await env.DB.prepare('SELECT paid_cents FROM statement_payments WHERE month=? AND apartment_id=?').bind(d.month,d.apartment_id).first<{paid_cents:number}>();
     if(!current||current.paid_cents<=0)return fail(req,env,'Η εξόφληση έχει ήδη τροποποιηθεί. Δεν έγινε αναίρεση.',409);
     writes.push(env.DB.prepare("UPDATE statement_payments SET paid_cents=0,paid_on=NULL,updated_by=?,updated_at=? WHERE month=? AND apartment_id=?").bind(user.id,now,d.month,d.apartment_id));
    }
    writes.push(env.DB.prepare("UPDATE payment_declarations SET status='rejected',reversed_at=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='confirmed'").bind(now,user.id,now,d.id));
    writes.push(env.DB.prepare('DELETE FROM payment_notification_reads WHERE declaration_id=?').bind(d.id));
    writes.push(audit(env,user.id,'payment_confirmation_reversed','payment_declaration',d.id,{apartment_code:d.apartment_code,kind:d.kind,month:d.month,amount_cents:d.amount_cents,reason:b.reason.trim()}));
    await env.DB.batch(writes);
    return response(req,env,{ok:true});
   }
   if(user.role!=='admin')return fail(req,env,'Δεν έχετε δικαίωμα καταχώρισης.',403);
   if(path==='/api/statements/payments/batch'&&method==='POST'){
    const b=await jsonBody(req);
    if(!validMonth(b.month)||!Array.isArray(b.apartment_codes)||b.apartment_codes.length<1||b.apartment_codes.length>6||typeof b.paid!=='boolean')return fail(req,env,'Ελέγξτε τις επιλογές εξόφλησης.');
    const codes=b.apartment_codes as unknown[];
    if(codes.some(x=>typeof x!=='string')||new Set(codes).size!==codes.length)return fail(req,env,'Διπλά ή μη έγκυρα διαμερίσματα.');
    const st=await env.DB.prepare('SELECT method,items_json FROM monthly_statements WHERE month=?').bind(b.month).first<{method:string;items_json:string}>();
    if(!st)return fail(req,env,'Η κατάσταση δεν βρέθηκε.',404);
    const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
    if(codes.some(x=>['A2','B3'].includes(String(x))))return fail(req,env,'Τα διαμερίσματα A2 και B3 εξοφλούνται αυτόματα.');
    if(codes.some(x=>!apartments.some(a=>a.code===x)))return fail(req,env,'Άγνωστο διαμέρισμα.');
    const total=(JSON.parse(st.items_json) as Array<{amount_cents:number}>).reduce((n,x)=>n+x.amount_cents,0);
    const due=allocate(total,apartments,st.method);
    const timestamp=iso(),day=timestamp.slice(0,10);
    const writes:D1PreparedStatement[]=[];
    for(const code of codes){
      const i=apartments.findIndex(a=>a.code===code),a=apartments[i];
      const before=await env.DB.prepare('SELECT paid_cents,paid_on FROM statement_payments WHERE month=? AND apartment_id=?').bind(b.month,a.id).first();
      const paidCents=b.paid?due[i]:0;
      writes.push(env.DB.prepare('INSERT INTO statement_payments(month,apartment_id,paid_cents,paid_on,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(month,apartment_id) DO UPDATE SET paid_cents=excluded.paid_cents,paid_on=excluded.paid_on,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(b.month,a.id,paidCents,b.paid?day:null,user.id,timestamp));
      writes.push(audit(env,user.id,'statement_payment_updated','statement_payment',b.month+':'+a.code,{before,after:{paid_cents:paidCents,paid_on:b.paid?day:null},month:b.month,apartment_code:a.code,bulk:true}));
    }
    await env.DB.batch(writes);
    return response(req,env,{ok:true,updated:codes.length});
   }
   if(path==='/api/statements/payments'&&method==='POST'){
    const b=await jsonBody(req);
    if(!validMonth(b.month)||typeof b.apartment_code!=='string'||typeof b.paid!=='boolean')return fail(req,env,'Ελέγξτε τα στοιχεία εξόφλησης.');
    const statement=await env.DB.prepare('SELECT method,items_json FROM monthly_statements WHERE month=?').bind(b.month).first<{method:string;items_json:string}>();
    if(!statement)return fail(req,env,'Η κατάσταση κοινοχρήστων δεν βρέθηκε.',404);
    const apartments=(await env.DB.prepare('SELECT id,code,common_weight,heating_share_bp FROM apartments ORDER BY code').all<Apartment>()).results;
    if(['A2','B3'].includes(b.apartment_code))return fail(req,env,'Το διαμέρισμα εξοφλείται αυτόματα.');
    const target=apartments.find(a=>a.code===b.apartment_code);
    if(!target)return fail(req,env,'Άγνωστο διαμέρισμα.');
    const total=(JSON.parse(statement.items_json) as Array<{amount_cents:number}>).reduce((n,x)=>n+x.amount_cents,0);
    const allocations=allocate(total,apartments,statement.method);
    const due=allocations[apartments.findIndex(a=>a.id===target.id)];
    const paidCents=b.paid?due:0;
    const paidOn=b.paid?iso().slice(0,10):null;
    const before=await env.DB.prepare('SELECT paid_cents,paid_on FROM statement_payments WHERE month=? AND apartment_id=?').bind(b.month,target.id).first();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO statement_payments(month,apartment_id,paid_cents,paid_on,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(month,apartment_id) DO UPDATE SET paid_cents=excluded.paid_cents,paid_on=excluded.paid_on,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(b.month,target.id,paidCents,paidOn,user.id,iso()),
      audit(env,user.id,'statement_payment_updated','statement_payment',b.month+':'+target.code,{before,after:{paid_cents:paidCents,paid_on:paidOn},month:b.month,apartment_code:target.code})
    ]);
    return response(req,env,{ok:true,month:b.month,apartment_code:target.code,due_cents:due,paid_cents:paidCents});
   }
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
   if(path==='/api/fuel/settings'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.liters_per_cm!=='number'||!Number.isFinite(b.liters_per_cm)||b.liters_per_cm<=0||b.liters_per_cm>1000||
       typeof b.price_cents_per_liter!=='number'||!Number.isSafeInteger(b.price_cents_per_liter)||b.price_cents_per_liter<=0||b.price_cents_per_liter>100000)
     return fail(req,env,'Ελέγξτε τον συντελεστή λίτρων/εκ. και την τιμή πετρελαίου.');
    const before=await env.DB.prepare('SELECT liters_per_cm,price_cents_per_liter FROM fuel_settings WHERE id=1').first();
    await env.DB.batch([
     env.DB.prepare('UPDATE fuel_settings SET liters_per_cm=?,price_cents_per_liter=?,updated_by=?,updated_at=? WHERE id=1').bind(b.liters_per_cm,b.price_cents_per_liter,user.id,iso()),
     audit(env,user.id,'fuel_settings_updated','fuel_settings','1',{before,after:{liters_per_cm:b.liters_per_cm,price_cents_per_liter:b.price_cents_per_liter}})
    ]);
    return response(req,env,{ok:true});
   }
   if(path==='/api/fuel/opening'&&method==='POST'){
    const b=await jsonBody(req);
    const validNonNegative=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
    if(typeof b.apartment_code!=='string'||!validDate(b.as_of)||!validNonNegative(b.deposited_cents)||!validNonNegative(b.estimated_consumed_cents)||typeof b.note!=='string'||b.note.length>300)
     return fail(req,env,'Ελέγξτε τα στοιχεία αρχικού υπολοίπου.');
    if(b.as_of>iso().slice(0,10))return fail(req,env,'Η ημερομηνία βάσης δεν μπορεί να είναι μελλοντική.');
    const apt=await env.DB.prepare('SELECT id FROM apartments WHERE code=?').bind(b.apartment_code).first<{id:string}>();
    if(!apt)return fail(req,env,'Άγνωστο διαμέρισμα.');
    const settled=await env.DB.prepare('SELECT settled_through FROM fuel_settlement WHERE id=1').first<{settled_through:string}>();
    if(!settled||b.as_of<settled.settled_through)return fail(req,env,'Η αφετηρία δεν μπορεί να προηγείται της εξοφλημένης ιστορικής περιόδου.');
    const measured=await env.DB.prepare('SELECT id FROM tank_measurements WHERE measured_on=?').bind(b.as_of).first();
    if(!measured)return fail(req,env,'Επιλέξτε ημερομηνία που έχει ήδη μετρήσεις θέρμανσης και δεξαμενής.');
    const before=await env.DB.prepare('SELECT * FROM fuel_openings WHERE apartment_id=?').bind(apt.id).first();
    await env.DB.batch([
     env.DB.prepare('INSERT INTO fuel_openings(apartment_id,as_of,deposited_cents,estimated_consumed_cents,note,confirmed_by,confirmed_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(apartment_id) DO UPDATE SET as_of=excluded.as_of,deposited_cents=excluded.deposited_cents,estimated_consumed_cents=excluded.estimated_consumed_cents,note=excluded.note,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at').bind(apt.id,b.as_of,b.deposited_cents,b.estimated_consumed_cents,b.note,user.id,iso()),
     audit(env,user.id,'fuel_opening_reconciled','apartment',apt.id,{before,after:{as_of:b.as_of,deposited_cents:b.deposited_cents,estimated_consumed_cents:b.estimated_consumed_cents,note:b.note}})
    ]);
    return response(req,env,{ok:true});
   }
   if(path==='/api/announcements'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.title!=='string'||typeof b.body!=='string'||!b.title.trim()||!b.body.trim()||b.title.trim().length>120||b.body.trim().length>5000)
     return fail(req,env,'Συμπληρώστε τίτλο και κείμενο ανακοίνωσης (έως 120 και 5.000 χαρακτήρες).');
    const id=uuid(),timestamp=iso();
    await env.DB.batch([
     env.DB.prepare('INSERT INTO announcements(id,title,body,published_at,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(id,b.title.trim(),b.body.trim(),timestamp,user.id,timestamp),
     audit(env,user.id,'announcement_published','announcement',id,{title:b.title.trim()})
    ]);
    return response(req,env,{ok:true,id},201);
   }
   if(path==='/api/announcements/delete'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||!b.id||b.id.length>100)return fail(req,env,'Μη έγκυρη ανακοίνωση.');
    const target=await env.DB.prepare('SELECT id,title,body,published_at,archived_at FROM announcements WHERE id=?').bind(b.id).first<{id:string;title:string;body:string;published_at:string;archived_at:string|null}>();
    if(!target)return fail(req,env,'Η ανακοίνωση δεν βρέθηκε.',404);
    await env.DB.batch([
     env.DB.prepare('DELETE FROM announcement_reads WHERE announcement_id=?').bind(b.id),
     env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(b.id),
     audit(env,user.id,'announcement_deleted','announcement',b.id,{title:target.title,body:target.body,published_at:target.published_at,archived_at:target.archived_at})
    ]);
    return response(req,env,{ok:true});
   }
   if(path==='/api/announcements/archive'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||b.id.length>100)return fail(req,env,'Μη έγκυρη ανακοίνωση.');
    const target=await env.DB.prepare('SELECT id,title FROM announcements WHERE id=? AND archived_at IS NULL').bind(b.id).first<{id:string;title:string}>();
    if(!target)return fail(req,env,'Η ανακοίνωση δεν βρέθηκε ή έχει ήδη αρχειοθετηθεί.',404);
    await env.DB.batch([
     env.DB.prepare('UPDATE announcements SET archived_at=? WHERE id=? AND archived_at IS NULL').bind(iso(),b.id),
     audit(env,user.id,'announcement_archived','announcement',b.id,{title:target.title})
    ]);
    return response(req,env,{ok:true});
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
    if(readings.length!==apartments.length||new Set(readings.map(x=>x.apartment_code)).size!==apartments.length||readings.some(x=>!apartments.some(a=>a.code===x.apartment_code)||!validHeatingHours(x.reading)||x.reading<0))return fail(req,env,'Απαιτούνται έγκυρες μετρήσεις για όλα τα διαμερίσματα.');
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
     if(!r||!validHeatingHours(r.reading)||r.reading<0)return fail(req,env,'Λανθασμένη ένδειξη μετρητή.');
     const previous=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on<? ORDER BY measured_on DESC LIMIT 1').bind(a.id,b.measured_on).first<{reading:number}>();
     const next=await env.DB.prepare('SELECT reading FROM heating_readings WHERE apartment_id=? AND measured_on>? ORDER BY measured_on ASC LIMIT 1').bind(a.id,b.measured_on).first<{reading:number}>();
     if((previous&&r.reading<previous.reading)||(next&&r.reading>next.reading))return fail(req,env,'Η ένδειξη '+a.code+' δεν συμφωνεί με το ιστορικό.',409);
     statements.push(env.DB.prepare('INSERT INTO heating_readings(id,apartment_id,measured_on,reading,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(uuid(),a.id,b.measured_on,r.reading,user.id,iso()));
    }
    statements.push(audit(env,user.id,'heating_readings_created','tank_measurement',tankId,{measured_on:b.measured_on,centimeters:b.centimeters}));
    await env.DB.batch(statements);return response(req,env,{ok:true},201);
   }
   if(path==='/api/fuel-deliveries/update'&&method==='POST'){
    const b=await jsonBody(req);
    if(typeof b.id!=='string'||b.id.length>100||!validDate(b.delivered_on)||typeof b.liters!=='number'||!Number.isFinite(b.liters)||b.liters<=0||!cents(b.cost_cents)||typeof b.note!=='string'||b.note.length>500)return fail(req,env,'Ελέγξτε τα στοιχεία του ανεφοδιασμού.');
    const before=await env.DB.prepare('SELECT id,delivered_on,liters,cost_cents,note FROM fuel_deliveries WHERE id=?').bind(b.id).first();
    if(!before)return fail(req,env,'Ο ανεφοδιασμός δεν βρέθηκε.',404);
    const after={delivered_on:b.delivered_on,liters:b.liters,cost_cents:b.cost_cents,note:b.note};
    await env.DB.batch([
      env.DB.prepare('UPDATE fuel_deliveries SET delivered_on=?,liters=?,cost_cents=?,note=? WHERE id=?').bind(b.delivered_on,b.liters,b.cost_cents,b.note,b.id),
      audit(env,user.id,'fuel_delivery_updated','fuel_delivery',b.id,{before,after})
    ]);
    return response(req,env,{ok:true,updated:true});
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
