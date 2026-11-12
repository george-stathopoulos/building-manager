import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {checkForAppUpdate} from '../src/appUpdates';
let next:string|null;
const reload=vi.fn(),fetchLatest=vi.fn();
beforeEach(()=>{
 vi.stubEnv('BASE_URL','/building-manager/');
 next='/building-manager/assets/new.js';
 vi.stubGlobal('navigator',{onLine:true});
 vi.stubGlobal('location',{origin:'https://example.com',href:'https://example.com/building-manager/',reload});
 vi.stubGlobal('document',{querySelector:()=>({src:'https://example.com/building-manager/assets/old.js'})});
 vi.stubGlobal('DOMParser',class{parseFromString(){return {querySelector:()=>next?{getAttribute:()=>next}:null};}});
 vi.stubGlobal('fetch',fetchLatest);
 fetchLatest.mockResolvedValue({ok:true,url:'https://example.com/building-manager/',text:async()=>'<html/>'});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
describe('foreground app updates',()=>{
 it('bypasses caches and reloads a changed published entry',async()=>{
  await checkForAppUpdate();
  const [url,options]=fetchLatest.mock.calls[0];
  expect(url.pathname).toBe('/building-manager/');expect(url.searchParams.has('__app_update')).toBe(true);
  expect(options).toEqual({cache:'no-store'});
  expect(reload).toHaveBeenCalledTimes(1);
 });
 it('does not reload the same version or a response without a valid entry',async()=>{
  next='/building-manager/assets/old.js';await checkForAppUpdate();
  next=null;await checkForAppUpdate();
  expect(reload).not.toHaveBeenCalled();
 });
 it('preserves the app while offline or on failed checks',async()=>{
  fetchLatest.mockRejectedValueOnce(Error('offline'));await checkForAppUpdate();
  fetchLatest.mockResolvedValueOnce({ok:false});await checkForAppUpdate();
  vi.stubGlobal('navigator',{onLine:false});await checkForAppUpdate();
  expect(reload).not.toHaveBeenCalled();expect(fetchLatest).toHaveBeenCalledTimes(2);
 });
});
