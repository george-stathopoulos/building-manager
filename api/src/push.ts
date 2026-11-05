export interface PushEnv { DB:D1Database; VAPID_PUBLIC_KEY?:string; VAPID_PRIVATE_KEY?:string; VAPID_SUBJECT?:string }
const enc=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const allowedEndpoint=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&url.length<2048&&(/(^|\.)push\.apple\.com$|^fcm\.googleapis\.com$|^updates\.push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$|^wns[0-9]*\.notify\.windows\.com$/).test(u.hostname);}catch{return false;}};
export function validPushSubscription(s:unknown):s is {endpoint:string;keys:{p256dh:string;auth:string}}{
 if(!s||typeof s!=='object')return false;
 const v=s as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
 return typeof v.endpoint==='string'&&allowedEndpoint(v.endpoint)&&typeof v.keys?.p256dh==='string'&&typeof v.keys.auth==='string'&&v.keys.p256dh.length<200&&v.keys.auth.length<100&&/^[\w-]+$/.test(v.keys.p256dh)&&/^[\w-]+$/.test(v.keys.auth);
}
async function vapidToken(env:PushEnv,audience:string){
 const pub=unb64(env.VAPID_PUBLIC_KEY!);const priv=unb64(env.VAPID_PRIVATE_KEY!);
 if(pub.length!==65||pub[0]!==4||priv.length!==32)throw Error('Invalid VAPID keys');
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:b64(pub.slice(1,33)),y:b64(pub.slice(33,65)),d:b64(priv),ext:false}, {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const head=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const payload=b64(enc.encode(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+3600,sub:env.VAPID_SUBJECT})));
 const data=head+'.'+payload;
 const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(data)));
 return data+'.'+b64(signature);
}
export async function sendPushToUsers(env:PushEnv,userIds:string[]){
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT||!userIds.length)return;
 const unique=[...new Set(userIds)];
 const subscriptions=(await env.DB.prepare('SELECT id,user_id,endpoint FROM push_subscriptions WHERE user_id IN ('+unique.map(()=>'?').join(',')+')').bind(...unique).all<{id:string;user_id:string;endpoint:string}>()).results;
 await Promise.all(subscriptions.map(async s=>{
  try{
   if(!allowedEndpoint(s.endpoint))return;
   const origin=new URL(s.endpoint).origin;
   const token=await vapidToken(env,origin);
   const response=await fetch(s.endpoint,{method:'POST',headers:{Authorization:'vapid t='+token+', k='+env.VAPID_PUBLIC_KEY,'TTL':'86400','Urgency':'normal'}});
   if(response.status===404||response.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(s.id).run();
   else if(!response.ok)console.error('Push service rejected request',response.status);
  }catch(e){console.error('Push delivery failed',e instanceof Error?e.message:'unknown');}
 }));
}
export async function notifyApartment(env:PushEnv,apartmentId:string){
 const rows=(await env.DB.prepare('SELECT user_id FROM memberships WHERE apartment_id=?').bind(apartmentId).all<{user_id:string}>()).results;
 await sendPushToUsers(env,rows.map(r=>r.user_id));
}
export async function notifyReviewers(env:PushEnv){
 const rows=(await env.DB.prepare("SELECT DISTINCT u.id FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN apartments a ON a.id=m.apartment_id WHERE u.role='admin' OR a.code='B3'").all<{id:string}>()).results;
 await sendPushToUsers(env,rows.map(r=>r.id));
}
export async function notifyAll(env:PushEnv){
 const rows=(await env.DB.prepare('SELECT id FROM users').all<{id:string}>()).results;
 await sendPushToUsers(env,rows.map(r=>r.id));
}
