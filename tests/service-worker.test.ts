import {describe,it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(){
 const handlers:Record<string,Function>={};
 const cache={put:vi.fn()},caches={open:vi.fn(async()=>cache),keys:vi.fn(async()=>['another-app','πολυκατοικία-v1','πολυκατοικία-v2']),delete:vi.fn(),match:vi.fn()};
 const owned={url:'https://example.com/building-manager/',navigate:vi.fn(async()=>{})};
 const other={url:'https://example.com/another-app/',navigate:vi.fn()};
 const self={registration:{scope:owned.url},skipWaiting:vi.fn(),clients:{claim:vi.fn(),matchAll:vi.fn(async()=>[owned,other])},addEventListener:(type:string,fn:Function)=>handlers[type]=fn};
 const fetch=vi.fn(async()=>new Response('latest'));
 runInNewContext(source,{self,caches,fetch,URL,location:{origin:'https://example.com'}});
 return {handlers,caches,fetch,owned,other};
}
describe('PWA freshness and scoped caches',()=>{
 it('bypasses caches for an explicit fresh request',async()=>{
  const w=worker();let response:any;
  w.handlers.fetch({request:{url:w.owned.url,method:'GET',cache:'no-store'},respondWith:(p:any)=>response=p});
  expect(await (await response).text()).toBe('latest');expect(w.caches.match).not.toHaveBeenCalled();
 });
 it('leaves API and other apps alone',()=>{
  const w=worker(),respondWith=vi.fn();
  for(const url of ['https://example.com/api/overview','https://example.com/another-app/','https://api.example.com/api/overview'])w.handlers.fetch({request:{url,method:'GET'},respondWith});
  expect(respondWith).not.toHaveBeenCalled();expect(w.caches.match).not.toHaveBeenCalled();
 });
 it('clears only its old cache and upgrades only its own windows',async()=>{
  const w=worker();let activation:any;
  w.handlers.activate({waitUntil:(p:any)=>activation=p});await activation;
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith('πολυκατοικία-v1');
  expect(w.owned.navigate).toHaveBeenCalledWith(w.owned.url);expect(w.other.navigate).not.toHaveBeenCalled();
 });
 it('uses a fresh network navigation and falls back to the offline shell',async()=>{
  const w=worker();let response:any;
  const request={url:w.owned.url,method:'GET',mode:'navigate'};
  w.handlers.fetch({request,respondWith:(p:any)=>response=p,waitUntil:()=>{}});
  expect(await (await response).text()).toBe('latest');expect(w.fetch).toHaveBeenCalledWith(request,{cache:'no-store'});
  w.fetch.mockRejectedValueOnce(Error('offline'));w.caches.match.mockResolvedValueOnce(new Response('offline shell'));
  w.handlers.fetch({request,respondWith:(p:any)=>response=p});
  expect(await (await response).text()).toBe('offline shell');
 });
});
