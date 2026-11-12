import {beforeEach,describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../api/src/index';
import {commonCalculator} from '../api/src/common-model';

// Exercise real Worker handlers against SQLite, adapting only the D1 interface.
let sql:DatabaseSync;
function prepare(query:string){
 let values:any[]=[];
 const result={bind(...args:any[]){values=args;return result;},
 async first(){return sql.prepare(query).get(...values)??null;},
 async all(){return {results:sql.prepare(query).all(...values)};},
 async run(){const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};}};
 return result;
}
const env={DB:{prepare,async batch(writes:any[]){return Promise.all(writes.map(w=>w.run()));}},WEB_ORIGIN:'https://george-stathopoulos.github.io'};
const tokens:Record<string,string>={};
async function call(path:string,user='admin',body?:unknown){
 const headers:Record<string,string>={};if(tokens[user])headers.Authorization='Bearer '+tokens[user];
 const response=await worker.fetch(new Request('https://test/api'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env as any,{waitUntil(){}} as any);
 return {status:response.status,body:await response.json() as any};
}
beforeEach(async()=>{
 sql=new DatabaseSync(':memory:');
 for(const name of ['0001_initial','0002_monthly_statements','0003_statement_payments','0007_apartment_pin_auth','0022_admin_pin_credentials','0025_common_expense_settings'])sql.exec(readFileSync(new URL('../api/migrations/'+name+'.sql',import.meta.url),'utf8'));
 for(const [i,name] of ['admin','A3','A1','B3'].entries()){
  sql.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(name,name+'@test.invalid','salt','hash',name==='admin'?'admin':'resident','2026-01-01');
  if(name!=='admin')sql.prepare('INSERT INTO memberships VALUES(?,?,?)').run(name,'apt-'+name.toLowerCase(),'2026-01-01');
  const token=String(i+1).repeat(64);tokens[name]=token;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  sql.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash,name,'2099-01-01','2026-01-01');
 }
 sql.prepare('INSERT INTO monthly_statements VALUES(?,?,?,?,?,?,?,?)').run('2026-11','Test','equal',JSON.stringify([{name:'Cleaning',amount_cents:18000}]),'{}',null,'2026-11-01','2026-11-01');
 sql.prepare('INSERT INTO statement_payments VALUES(?,?,?,?,?,?)').run('2026-11','apt-a3',2000,'2026-11-01','admin','2026-11-01');
});
describe('shared A3 setting',()=>{
 it('defaults on; persists a resident update for admin and vice versa, with an audit record',async()=>{
  expect((await call('/settings/a3-common-credit')).body.enabled).toBe(true);
  expect((await call('/settings/a3-common-credit','A3',{enabled:false})).status).toBe(200);
  sql.exec(readFileSync(new URL('../api/migrations/0025_common_expense_settings.sql',import.meta.url),'utf8'));
  expect((await call('/settings/a3-common-credit')).body.enabled).toBe(false);
  await call('/settings/a3-common-credit','admin',{enabled:true});
  expect((await call('/settings/a3-common-credit','A3')).body.enabled).toBe(true);
  expect(sql.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='a3_common_credit_updated'").get()?.n).toBe(2);
 });
 it('rejects unauthenticated, other resident and owner access; validates boolean without trusting a supplied apartment',async()=>{
  expect((await call('/settings/a3-common-credit','anonymous',{enabled:false})).status).toBe(401);
  for(const user of ['A1','B3'])for(const body of [undefined,{enabled:false,apartment_code:'A3'}])expect((await call('/settings/a3-common-credit',user,body)).status).toBe(403);
  for(const enabled of [0,'false',null])expect((await call('/settings/a3-common-credit','admin',{enabled})).status).toBe(400);
  expect((await call('/settings/a3-common-credit')).body.enabled).toBe(true);
 });
 it('recalculates detail, summaries, payment status and owner totals, retaining payments',async()=>{
  for(const enabled of [true,false,true]){
   await call('/settings/a3-common-credit','A3',{enabled});
   const due=enabled?2000:3000;
   const detail=await call('/statements/detail?month=2026-11','A3');
   expect(detail.body.apartments).toEqual([{apartment_code:'A3',due_cents:due,gross_due_cents:3000,credit_cents:enabled?1000:0}]);
   const summary=(await call('/statements/summary','A3')).body.months[0];
   expect([summary.due_cents,summary.paid_cents,summary.balance_cents]).toEqual([due,2000,due-2000]);
   const payments=(await call('/statements/payments?month=2026-11')).body.apartments;
   expect(payments.find((a:any)=>a.apartment_code==='A3').due_cents).toBe(due);
   expect(payments.find((a:any)=>a.apartment_code==='A1').due_cents).toBe(3000);
   const totals=(await call('/statements/summary')).body.months[0];
   expect(totals.due_cents).toBe(9000+due);
   const unpaid=(await call('/owner/unpaid-expenses','B3')).body.unpaid;
   expect(unpaid.find((a:any)=>a.apartment_code==='A3')?.balance_cents??0).toBe(due-2000);
  }
 });
 it('caps the credit at gross and leaves every other apartment unchanged',()=>{
  for(const gross of [0,500,1000,3001]){
   expect(commonCalculator(true).netCommonDue('A3',gross)).toBe(Math.max(0,gross-1000));
   expect(commonCalculator(false).netCommonDue('A3',gross)).toBe(gross);
   for(const code of ['A1','A2','B1','B2','B3'])expect(commonCalculator(true).netCommonDue(code,gross)).toBe(gross);
  }
 });
});
